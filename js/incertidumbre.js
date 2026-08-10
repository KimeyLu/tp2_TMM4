/* ============================================================
   INCERTIDUMBRE
   ------------------------------------------------------------
   El jugador (circulo rojo) siempre esta anclado a un borde de
   un cuadrado rojo rotado y gigante. Mantener click estira un
   cable elastico; si otro borde entra en rango, la conexion se
   transfiere instantaneamente. La bolita NUNCA sale del area
   visible de pantalla (clamp en coordenadas de pantalla).

   Entre cada par de cuadrados rojos aparece una "compuerta"
   amarilla estilo flappy bird: una barra arriba y otra abajo,
   con un hueco en el medio por donde hay que pasar.
   - Compuertas seguras: el hueco queda fijo, se puede pasar.
   - Compuertas peligrosas: las barras se cierran de golpe en
     el centro (choque rapido) y si te toc640an mientras se cierran,
     mueren. Visualmente son iguales hasta que empiezan a moverse:
     esa es la incertidumbre.

   ------------------------------------------------------------
   MODO INSTANCIA: todo el sketch vive dentro del closure
   `sketchIncertidumbre`, para poder correr junto a otros sketches
   de p5 en la misma pagina sin pisarse variables globales.
   Se monta automaticamente en el div con id="incertidumbre".
   ============================================================ */

const sketchIncertidumbre = (p) => {
    // ---------- COLORES / ESTILO ----------
    const COLOR_BG = [14, 14, 14];
    const COLOR_SQUARE = [190, 45, 45];
    const COLOR_GATE = [232, 217, 154];
    const COLOR_PLAYER = [224, 40, 40];
    const COLOR_CABLE = [190, 45, 45, 160];
    const COLOR_NORMAL_LINE = [190, 45, 45, 90];

    // ---------- HUD (creado dinamicamente, dentro del contenedor) ----------
    let hudEl, distTxtEl, msgEl, containerEl;

    function buildHUD(container) {
        containerEl = container;
        containerEl.style.position = "relative";
        containerEl.style.overflow = "hidden";
        containerEl.style.background = "#0a0a0a";
        containerEl.style.fontFamily = '"Courier New", monospace';
        containerEl.style.lineHeight = "1";

        const style = document.createElement("style");
        style.textContent = `
            #${container.id} canvas {
                display: block;
            }
            #${container.id} .hud {
                position: absolute;
                top: 16px;
                left: 20px;
                color: #d94040;
                font-size: 13px;
                letter-spacing: 2px;
                text-transform: lowercase;
                pointer-events: none;
                z-index: 10;
            }
            #${container.id} .hud .dist {
                color: #e8d99a;
                margin-top: 4px;
            }
            #${container.id} .msg {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #e8d99a;
                font-size: 15px;
                letter-spacing: 3px;
                text-transform: lowercase;
                text-align: center;
                pointer-events: none;
                z-index: 10;
                opacity: 0;
                transition: opacity 0.4s;
            }
        `;
        document.head.appendChild(style);

        hudEl = document.createElement("div");
        hudEl.className = "hud";
        // hudEl.appendChild(document.createTextNode("incertidumbre"));
        //
        distTxtEl = document.createElement("div");
        distTxtEl.className = "dist";
        // hudEl.appendChild(distTxtEl);

        msgEl = document.createElement("div");
        // msgEl.className = "msg";

        containerEl.appendChild(hudEl);
        containerEl.appendChild(msgEl);
    }

    // ---------- ESCALA (fija, en base al canvas de 600x600) ----------
    let SQUARE_SIZE, MIN_DIST, MAX_DIST, MAX_CABLE, CONNECT_THRESH;
    let GATE_GAP,
        GATE_BAR_LEN,
        GATE_WIDTH,
        GATE_TRIGGER_DIST,
        SCREEN_MARGIN;

    const ELASTIC_SPEED = 0.35; // suavizado del estiramiento del cable
    const RETRACT_SPEED = 0.45; // suavizado del retorno al anclaje al soltar
    const GEN_AHEAD_MULT = 3.2; // generar mundo esta cantidad de "distancias" adelante
    const REMOVE_BEHIND = 500; // borrar nodos detras de la camara

    let world;
    let player;
    let cam;
    let dragging = false;
    let gameOver = false;
    let started = false;
    let maxDistReached = 0;

    function computeScale() {
        const base = Math.min(p.width, p.height);
        SQUARE_SIZE = base * 0.5; // cuadrados rojos gigantes
        MIN_DIST = SQUARE_SIZE * 2.8; // mas separacion entre cuadrados rojos
        MAX_DIST = SQUARE_SIZE * 2.8;
        MAX_CABLE = Math.hypot(p.width, p.height) * 0.6;
        CONNECT_THRESH = SQUARE_SIZE * 0.42;
        GATE_GAP = SQUARE_SIZE * 0.95; // hueco de paso de la compuerta
        GATE_BAR_LEN = SQUARE_SIZE * 1.6; // largo finito: ya no cruza toda la pantalla
        GATE_WIDTH = SQUARE_SIZE * 0.3;
        GATE_TRIGGER_DIST = SQUARE_SIZE * 0.85; // distancia a la que la compuerta peligrosa "detecta" al jugador y se cierra
        SCREEN_MARGIN = base * 0.06;
    }

    // ---------- UTILIDADES DE GEOMETRIA ----------

    function localToWorld(cx, cy, rot, lx, ly) {
        const cosA = Math.cos(rot),
            sinA = Math.sin(rot);
        return {
            x: cx + (lx * cosA - ly * sinA),
            y: cy + (lx * sinA + ly * cosA),
        };
    }

    function closestPointOnSegment(pt, a, b) {
        const abx = b.x - a.x,
            aby = b.y - a.y;
        const apx = pt.x - a.x,
            apy = pt.y - a.y;
        const lenSq = abx * abx + aby * aby;
        let t = lenSq === 0 ? 0 : (apx * abx + apy * aby) / lenSq;
        t = Math.max(0, Math.min(1, t));
        const cx = a.x + abx * t,
            cy = a.y + aby * t;
        const dx = pt.x - cx,
            dy = pt.y - cy;
        return {
            point: { x: cx, y: cy },
            dist: Math.sqrt(dx * dx + dy * dy),
        };
    }

    // colision circulo contra rectangulo axis-aligned definido por esquinas x1<x2, y1<y2
    function rectCircleCollide(rect, px, py, r) {
        const cx = Math.max(rect.x1, Math.min(px, rect.x2));
        const cy = Math.max(rect.y1, Math.min(py, rect.y2));
        const dx = px - cx,
            dy = py - cy;
        return dx * dx + dy * dy < r * r;
    }

    // ---------- NODO ROJO (cuadrado rotado, punto de anclaje real) ----------
    class RedSquare {
        constructor(x, y, rot) {
            this.x = x;
            this.y = y;
            this.size = SQUARE_SIZE;
            this.rot = rot;
        }

        getCorners() {
            const h = this.size / 2;
            const local = [
                [-h, -h],
                [h, -h],
                [h, h],
                [-h, h],
            ];
            return local.map(([lx, ly]) =>
                localToWorld(this.x, this.y, this.rot, lx, ly),
            );
        }

        getEdges() {
            const c = this.getCorners();
            const localNormals = [
                [0, -1],
                [1, 0],
                [0, 1],
                [-1, 0],
            ];
            const cosA = Math.cos(this.rot),
                sinA = Math.sin(this.rot);
            const edges = [];
            for (let i = 0; i < 4; i++) {
                const a = c[i],
                    b = c[(i + 1) % 4];
                const [nx, ny] = localNormals[i];
                const normal = {
                    x: nx * cosA - ny * sinA,
                    y: nx * sinA + ny * cosA,
                };
                edges.push({ a, b, normal, square: this, index: i });
            }
            return edges;
        }

        draw(camX, camY) {
            p.push();
            p.translate(this.x - camX, this.y - camY);
            p.rotate(this.rot);
            p.noFill();
            p.stroke(...COLOR_SQUARE);
            p.strokeWeight(2);
            p.rectMode(p.CENTER);
            p.rect(0, 0, this.size, this.size);
            p.pop();
        }
    }

    // ---------- COMPUERTA AMARILLA (se cierra al acercarte, no por ciclo) ----------
    class YellowGate {
        constructor(x, y, angle, dangerous) {
            this.x = x;
            this.y = y;
            this.angle = angle; // orientacion: perpendicular a esto es por donde se pasa
            this.dangerous = dangerous;

            // tiempos del cierre: MUY rapido para generar incertidumbre repentina
            this.closeDuration = 130; // ms: se cierra de golpe
            this.holdClosedDuration = 220; // ms: se mantiene cerrada
            this.reopenDuration = 260; // ms: vuelve a abrirse

            this.triggered = false; // se activo el cierre alguna vez
            this.triggerTime = 0; // millis() en que empezo a cerrarse
        }

        // revisa si el jugador esta lo bastante cerca del hueco como para activar el cierre.
        // solo las compuertas peligrosas reaccionan; las seguras quedan siempre estaticas y abiertas.
        checkTrigger(px, py) {
            if (!this.dangerous || this.triggered) return;
            const dx = px - this.x,
                dy = py - this.y;
            if (
                dx * dx + dy * dy <
                GATE_TRIGGER_DIST * GATE_TRIGGER_DIST
            ) {
                this.triggered = true;
                this.triggerTime = p.millis();
            }
        }

        // hueco actual: estatico y abierto hasta que se dispara el cierre por proximidad,
        // luego cierra rapido, se mantiene cerrada un instante y reabre.
        currentGap() {
            if (!this.dangerous || !this.triggered) return GATE_GAP;
            const elapsed = p.millis() - this.triggerTime;
            if (elapsed < this.closeDuration) {
                return GATE_GAP * (1 - elapsed / this.closeDuration);
            }
            if (
                elapsed <
                this.closeDuration + this.holdClosedDuration
            ) {
                return 0;
            }
            const reopenElapsed =
                elapsed - this.closeDuration - this.holdClosedDuration;
            if (reopenElapsed < this.reopenDuration) {
                return GATE_GAP * (reopenElapsed / this.reopenDuration);
            }
            return GATE_GAP; // totalmente reabierta, queda estatica de nuevo
        }

        // pasa un punto del mundo al sistema local de la compuerta:
        // eje local X = direccion de paso (a lo largo del camino), eje local Y = perpendicular (donde se separan las barras)
        toLocal(px, py) {
            const dx = px - this.x,
                dy = py - this.y;
            const cosA = Math.cos(-this.angle),
                sinA = Math.sin(-this.angle);
            return {
                x: dx * cosA - dy * sinA,
                y: dx * sinA + dy * cosA,
            };
        }

        // solo las compuertas peligrosas matan; las seguras se pueden tocar sin problema.
        // colision hecha en coordenadas locales rotadas, contra las dos barras (arriba/abajo del hueco).
        checkCollision(px, py, r) {
            if (!this.dangerous) return false;
            const gap = this.currentGap();
            const half = gap / 2;
            const local = this.toLocal(px, py);

            for (const sign of [1, -1]) {
                const yMin = sign > 0 ? half : -(half + GATE_BAR_LEN);
                const yMax = sign > 0 ? half + GATE_BAR_LEN : -half;
                const cx = Math.max(
                    -GATE_WIDTH / 2,
                    Math.min(local.x, GATE_WIDTH / 2),
                );
                const cy = Math.max(yMin, Math.min(local.y, yMax));
                const dx = local.x - cx,
                    dy = local.y - cy;
                if (dx * dx + dy * dy < r * r) return true;
            }
            return false;
        }

        draw(camX, camY) {
            const gap = this.currentGap();
            const half = gap / 2;
            p.push();
            p.translate(this.x - camX, this.y - camY);
            p.rotate(this.angle);
            p.noStroke();
            p.fill(...COLOR_GATE);
            p.rectMode(p.CORNER);
            p.rect(-GATE_WIDTH / 2, half, GATE_WIDTH, GATE_BAR_LEN);
            p.rect(
                -GATE_WIDTH / 2,
                -(half + GATE_BAR_LEN),
                GATE_WIDTH,
                GATE_BAR_LEN,
            );
            p.pop();
        }
    }

    // ---------- MUNDO PROCEDURAL ----------
    class World {
        constructor() {
            this.redSquares = [];
            this.gates = [];
            this.generateInitial();
        }

        generateInitial() {
            const first = new RedSquare(0, p.height / 2, 0);
            this.redSquares.push(first);
            this.generateAhead();
        }

        generateAhead() {
            // franja vertical segura: como la camara ya no se mueve en Y, los cuadrados
            // rojos tienen que quedarse siempre dentro de la altura fija de la pantalla.
            const vMargin = SQUARE_SIZE * 0.75 + SCREEN_MARGIN;
            const vMin = vMargin;
            const vMax = p.height - vMargin;

            while (true) {
                const last =
                    this.redSquares[this.redSquares.length - 1];
                if (last.x > player.maxXGenTarget()) break;

                const centerPull = (p.height / 2 - last.y) * 0.01; // empuje mas fuerte hacia el centro
                const angle = p.random(-p.PI / 9, p.PI / 9) + centerPull; // camino mas horizontal, mas seguro
                const dist = p.random(MIN_DIST, MAX_DIST);

                const nx = last.x + Math.cos(angle) * dist;
                let ny = last.y + Math.sin(angle) * dist;
                ny = Math.max(vMin, Math.min(vMax, ny)); // nunca se genera fuera de la franja fija
                const nrot = p.random(0, p.TWO_PI);

                const next = new RedSquare(nx, ny, nrot);
                this.redSquares.push(next);

                // compuerta amarilla a mitad de camino, con el hueco alineado al recorrido real
                const midX = (last.x + nx) / 2;
                const midY = (last.y + ny) / 2;
                const realAngle = Math.atan2(ny - last.y, nx - last.x);
                const dangerous = p.random() < 0.5;
                this.gates.push(
                    new YellowGate(midX, midY, realAngle, dangerous),
                );
            }
        }

        removeOld(camX) {
            this.redSquares = this.redSquares.filter(
                (s) => s.x > camX - REMOVE_BEHIND,
            );
            this.gates = this.gates.filter(
                (g) => g.x > camX - REMOVE_BEHIND,
            );
        }

        update(camX) {
            this.generateAhead();
            this.removeOld(camX);
        }

        allRedEdges() {
            let edges = [];
            for (const s of this.redSquares)
                edges = edges.concat(s.getEdges());
            return edges;
        }

        draw(camX, camY) {
            for (const s of this.redSquares) s.draw(camX, camY);
            for (const g of this.gates) g.draw(camX, camY);
        }
    }

    // ---------- JUGADOR ----------
    class Player {
        constructor(square, edgeIndex) {
            const edges = square.getEdges();
            const e = edges[edgeIndex];
            const mid = {
                x: (e.a.x + e.b.x) / 2,
                y: (e.a.y + e.b.y) / 2,
            };

            this.anchor = mid;
            this.anchorNormal = e.normal;
            this.attachedSquare = square;
            this.attachedEdgeIndex = edgeIndex;

            this.pos = { x: mid.x, y: mid.y };
            this.r = Math.max(6, SQUARE_SIZE * 0.045);
        }

        maxXGenTarget() {
            return this.pos.x + MAX_DIST * GEN_AHEAD_MULT;
        }

        tryTransfer(edges) {
            let best = null;
            let bestDist = CONNECT_THRESH;
            for (const e of edges) {
                if (
                    e.square === this.attachedSquare &&
                    e.index === this.attachedEdgeIndex
                )
                    continue;
                const { point, dist } = closestPointOnSegment(
                    this.pos,
                    e.a,
                    e.b,
                );
                if (dist < bestDist) {
                    bestDist = dist;
                    best = { point, edge: e };
                }
            }
            if (best) {
                this.anchor = best.point;
                this.anchorNormal = best.edge.normal;
                this.attachedSquare = best.edge.square;
                this.attachedEdgeIndex = best.edge.index;
                return true;
            }
            return false;
        }

        update(mouseWorld, isDragging, edges) {
            if (isDragging) {
                let dx = mouseWorld.x - this.anchor.x;
                let dy = mouseWorld.y - this.anchor.y;
                const len = Math.sqrt(dx * dx + dy * dy);
                let target;
                if (len > MAX_CABLE) {
                    const s = MAX_CABLE / len;
                    target = {
                        x: this.anchor.x + dx * s,
                        y: this.anchor.y + dy * s,
                    };
                } else {
                    target = { x: mouseWorld.x, y: mouseWorld.y };
                }
                this.pos.x += (target.x - this.pos.x) * ELASTIC_SPEED;
                this.pos.y += (target.y - this.pos.y) * ELASTIC_SPEED;
                this.tryTransfer(edges);
            } else {
                this.pos.x +=
                    (this.anchor.x - this.pos.x) * RETRACT_SPEED;
                this.pos.y +=
                    (this.anchor.y - this.pos.y) * RETRACT_SPEED;
            }
        }

        // la bolita nunca puede salir del area visible: se limita en coordenadas de pantalla
        clampToScreen(cam) {
            let sx = this.pos.x - cam.x;
            let sy = this.pos.y - cam.y;
            sx = Math.max(
                SCREEN_MARGIN,
                Math.min(p.width - SCREEN_MARGIN, sx),
            );
            sy = Math.max(
                SCREEN_MARGIN,
                Math.min(p.height - SCREEN_MARGIN, sy),
            );
            this.pos.x = sx + cam.x;
            this.pos.y = sy + cam.y;
        }

        draw(camX, camY, isDragging) {
            if (isDragging) {
                p.stroke(...COLOR_CABLE);
                p.strokeWeight(1.5);
                p.line(
                    this.anchor.x - camX,
                    this.anchor.y - camY,
                    this.pos.x - camX,
                    this.pos.y - camY,
                );

                const nx = this.anchorNormal.x,
                    ny = this.anchorNormal.y;
                p.stroke(...COLOR_NORMAL_LINE);
                p.line(
                    this.anchor.x - camX,
                    this.anchor.y - camY,
                    this.anchor.x - camX + nx * 16,
                    this.anchor.y - camY + ny * 16,
                );
            }
            p.noStroke();
            p.fill(...COLOR_PLAYER);
            p.circle(this.pos.x - camX, this.pos.y - camY, this.r * 2);
        }
    }

    // ---------- SETUP / GAME FLOW ----------
    function resetGame() {
        computeScale();
        world = null;
        player = null;
        gameOver = false;
        dragging = false;
        maxDistReached = 0;

        const seed = new RedSquare(0, p.height / 2, 0);
        player = new Player(seed, 1);
        world = new World();
        world.redSquares[0] = seed;

        cam = {
            x: player.pos.x - p.width * 0.32,
            y: player.pos.y - p.height / 2,
        };
        showMsg("");
    }

    p.setup = () => {
        const container = document.getElementById("incertidumbre");
        // Canvas de tamaño FIJO: 600x600, siempre. No depende del tamaño
        // de la ventana ni del zoom del navegador (no hay windowResized).
        const c = p.createCanvas(400, 400);
        c.parent(container);
        buildHUD(container);
        resetGame();
        // showMsg("mantene click y arrastra — esquiva las compuertas que se cierran");
    };

    // NOTA: se elimino windowResized() a proposito. Antes, al hacer zoom
    // con la lupa del navegador, windowWidth/windowHeight cambiaban y
    // resizeCanvas() reescalaba todo el juego (cuadrados, distancias,
    // compuertas, etc). Ahora el canvas queda fijo en 600x600 pase lo
    // que pase con el zoom o el tamaño de la ventana.

    function showMsg(t) {
        //msgEl.textContent = t;
        //msgEl.style.opacity = t ? 1 : 0;
    }

    function worldMouse() {
        return { x: p.mouseX + cam.x, y: p.mouseY + cam.y };
    }

    // el mouse solo cuenta si el click ocurrio dentro de ESTE canvas
    // (en modo instancia, mousePressed se dispara para toda la pagina,
    // asi que hay que filtrar por las coordenadas locales del canvas).
    function mouseInsideCanvas() {
        return (
            p.mouseX >= 0 &&
            p.mouseX <= p.width &&
            p.mouseY >= 0 &&
            p.mouseY <= p.height
        );
    }

    p.mousePressed = () => {
        if (!mouseInsideCanvas()) return;

        if (gameOver) {
            resetGame();
            return;
        }
        if (!started) {
            started = true;
            showMsg("");
        }
        dragging = true;
    };

    p.mouseReleased = () => {
        dragging = false;
    };

    p.draw = () => {
        p.background(...COLOR_BG);

        if (gameOver) {
            world.draw(cam.x, cam.y);
            player.draw(cam.x, cam.y, false);
            return;
        }

        const edges = world.allRedEdges();
        player.update(worldMouse(), dragging, edges);

        // la bolita choca contra el borde de la pantalla ACTUAL (antes de mover la camara):
        // asi el estiramiento maximo real es hasta el limite visible, como una pared fija.
        player.clampToScreen(cam);

        // camara suave siguiendo al jugador SOLO en X (avance horizontal).
        // el eje Y de la camara NUNCA se mueve: la altura queda fija de una vez,
        // asi el techo/piso de pantalla son paredes reales que no se corren
        // aunque te quedes pegado contra el borde sosteniendo el arrastre.
        const targetCamX = player.pos.x - p.width * 0.32;
        cam.x += (targetCamX - cam.x) * 0.08;

        // colision con las compuertas: solo matan si estan cerrando y te tocan
        for (const g of world.gates) {
            g.checkTrigger(player.pos.x, player.pos.y);
            if (
                g.checkCollision(player.pos.x, player.pos.y, player.r)
            ) {
                gameOver = true;
                /*showMsg(
                    "te atrapo la compuerta. click para reintentar",
                );*/
                break;
            }
        }

        world.update(cam.x);

        world.draw(cam.x, cam.y);
        player.draw(cam.x, cam.y, dragging);

        maxDistReached = Math.max(maxDistReached, player.pos.x);
        distTxtEl.textContent = Math.floor(maxDistReached / 10) + " m";
    };
};

// Monta el sketch en el div#incertidumbre
new p5(sketchIncertidumbre);
