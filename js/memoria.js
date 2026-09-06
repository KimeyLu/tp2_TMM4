const Memoria = (p) => {

    // ---------- variables necesarias ----------
    let lineY;
    let shapes = [];       // formas que recorren la linea
    let memories = [];     // clones guardados al costado de la linea
    let fadingOut = [];     // clones desvaneciendose al reiniciar la memoria

    const COLORS = ['#F0D583', '#121212'];
    const TYPES = ['triangle', 'rect', 'circle'];
    const N_SHAPES = 10;
    const SHAPE_SPEED = 1.5; // velocidad fija para todas las formas
    let WRAP_LEN; // distancia total del ciclo (igual para todas, evita desfasajes)
    const ROTATION_ANGLE = p.radians(-43); // rotacion del canvas, ajustable

    // ---------- escala de tamaño, como fraccion de ancho/alto ----------
    const SHAPE_SIZE_RATIO = 0.06;          // antes: 24 / 400
    const CURSOR_SIZE_RATIO = 0.075;        // antes: 30 / 400
    const MEMORY_START_X_RATIO = 0.3;       // antes: 120 / 400
    const MEMORY_COL_SPACING_RATIO = 0.2;   // antes: 80 / 400
    const MEMORY_ROW_SPACING_RATIO = 0.055; // antes: 22 / 400
    const LINE_MARGIN_RATIO = 0.25;         // antes: 100 / 400
    const WRAP_BUFFER_RATIO = 0.45;         // antes: 180 / 400
    const HIT_MARGIN_RATIO = 0.01;          // antes: 4 / 400

    let SHAPE_SIZE, CURSOR_BASE_SIZE, MEMORY_START_X, MEMORY_COL_SPACING,
        MEMORY_ROW_SPACING, LINE_MARGIN, HIT_MARGIN;

    // ---------- animacion de "agrandado" al clickear una forma ----------
    const CLICKED_SIZE_RATIO = 0.080; // antes: 26 / 400
    const CLICKED_SHRINK_EASE = 0.15; // velocidad de la interpolacion (0-1, mas alto = mas rapido)
    let CLICKED_DISPLAY_SIZE;

    // cursor
    let cursorSize;
    let cursorColor = '#F0D583';
    let hitTimer = 0;
    const HIT_DURATION = 18; // frames que dura la animacion de "achique"

    // memoria: 3 columnas, 4 formas por columna
    const MEMORY_COLS = 3;
    const MEMORY_ROWS = 4;
    const MEMORY_CAPACITY = MEMORY_COLS * MEMORY_ROWS;
    let MEMORY_START_Y; // depende de p.height, se asigna en setup
    const SLIDE_EASE = 0.2; // suaviza la aparicion de cada clon en su lugar
    const RESET_FADE_DURATION = 30; // frames que tardan en desvanecerse al reiniciar

    function computeSizes() {
        const minSide = Math.min(p.width, p.height);
        SHAPE_SIZE = minSide * SHAPE_SIZE_RATIO;
        CURSOR_BASE_SIZE = minSide * CURSOR_SIZE_RATIO;
        MEMORY_START_X = p.width * MEMORY_START_X_RATIO;
        MEMORY_COL_SPACING = p.width * MEMORY_COL_SPACING_RATIO;
        MEMORY_ROW_SPACING = p.height * MEMORY_ROW_SPACING_RATIO;
        LINE_MARGIN = p.width * LINE_MARGIN_RATIO;
        HIT_MARGIN = minSide * HIT_MARGIN_RATIO;
        CLICKED_DISPLAY_SIZE = minSide * CLICKED_SIZE_RATIO;
    }

    p.setup = function() {
        p.createCanvas(400, 400); // tamaño inicial: no hay width/height previos para basarse en ellos
        computeSizes();
        lineY = p.height / 2;
        WRAP_LEN = p.width + p.width * WRAP_BUFFER_RATIO;
        MEMORY_START_Y = p.height / 4;

        for (let i = 0; i < N_SHAPES; i++) {
            shapes.push(makeShape(i * (WRAP_LEN / N_SHAPES)));
        }
    }

    p.windowResized = function() {
        const oldShapeSize = SHAPE_SIZE;
        const oldWrap = WRAP_LEN;

        const { w, h } = window.getCanvasTargetSize('memoria', 400, 400);
        p.resizeCanvas(w, h);

        computeSizes();
        lineY = p.height / 2;
        WRAP_LEN = p.width + p.width * WRAP_BUFFER_RATIO;
        MEMORY_START_Y = p.height / 4;

        const sizeRatio = SHAPE_SIZE / oldShapeSize;
        const wrapRatio = WRAP_LEN / oldWrap;

        for (const s of shapes) {
            s.size *= sizeRatio;
            s.displaySize *= sizeRatio; // el propio valor objetivo (CLICKED_DISPLAY_SIZE) ya se recalcula en computeSizes()
            s.offset *= wrapRatio; // mantiene la separación relativa entre formas
        }
        for (const m of memories) m.size *= sizeRatio;
        for (const f of fadingOut) f.size *= sizeRatio;
    }

    p.draw = function() {
        p.background('#970510');

        // todo lo que se dibuja aca adentro queda afectado por la rotacion
        p.push();
        p.translate(p.width / 2, p.height / 2);
        p.rotate(ROTATION_ANGLE);
        p.translate(-p.width / 2, -p.height / 2);

        p.stroke('#F0D583');
        p.strokeWeight(2);
        p.line(-LINE_MARGIN, lineY, p.width + LINE_MARGIN, lineY);

        DrawShapes();
        ShapeMemory();

        p.pop();

        // el cursor queda fuera de la rotacion para seguir al puntero real
        CursorInteraction();
    }

    function toLocalCoords(x, y) {
        // convierte una coordenada de pantalla (ej: el mouse) al sistema
        // "sin rotar" en el que estan definidas las formas, invirtiendo
        // la misma rotacion que se aplica en p.draw
        let cx = p.width / 2, cy = p.height / 2;
        let dx = x - cx, dy = y - cy;
        let cosA = Math.cos(-ROTATION_ANGLE), sinA = Math.sin(-ROTATION_ANGLE);
        return {
            x: dx * cosA - dy * sinA + cx,
            y: dx * sinA + dy * cosA + cy
        };
    }

    function makeShape(offset) {
        return {
            offset: offset, // posicion de referencia dentro del ciclo, fija
            lastCycle: 0,
            clicked: false, // evita generar mas de un clon por ciclo
            size: SHAPE_SIZE,
            displaySize: SHAPE_SIZE, // tamaño animado que se muestra en pantalla
            type: p.random(TYPES),
            color: p.random(COLORS)
        };
    }

    function drawShapeAt(x, y, size, type, color, alpha = 255) {
        p.push();
        p.noStroke();
        let c = p.color(color);
        p.fill(p.red(c), p.green(c), p.blue(c), alpha);
        p.translate(x, y);
        if (type === 'circle') {
            p.circle(0, 0, size);
        } else if (type === 'rect') {
            p.rectMode(p.CENTER);
            p.rect(0, 0, size, size);
        } else if (type === 'triangle') {
            p.triangle(-size / 2, size / 2, size / 2, size / 2, 0, -size / 2);
        }
        p.pop();
    }

    function DrawShapes() {
        // se crean formas de tipos y colores aleatorios, avanzan por la linea
        // y al salir del canvas reaparecen al inicio, siempre a la misma distancia
        // entre si (posicion calculada por modulo, no acumulada frame a frame)
        let travel = SHAPE_SPEED * p.frameCount;
        for (let s of shapes) {
            let cyclePos = (s.offset + travel) % WRAP_LEN;
            let cycleCount = Math.floor((s.offset + travel) / WRAP_LEN);
            s.x = cyclePos - LINE_MARGIN; // posicion en que inician las formas, aparecen, principio

            // al arrancar un nuevo ciclo, se reasignan tipo y color
            // y se habilita de nuevo la posibilidad de generar un clon
            if (cycleCount !== s.lastCycle) {
                s.lastCycle = cycleCount;
                s.type = p.random(TYPES);
                s.color = p.random(COLORS);
                s.clicked = false;
            }

            // el tamaño objetivo depende de si la forma ya fue clickeada:
            // un tamaño fijo (26px relativos a pantalla) mientras "clicked" es true,
            // normal apenas se resetea al inicio del siguiente ciclo
            let targetSize = s.clicked ? CLICKED_DISPLAY_SIZE : s.size;
            s.displaySize = p.lerp(s.displaySize, targetSize, CLICKED_SHRINK_EASE);

            drawShapeAt(s.x, lineY, s.displaySize, s.type, s.color);
        }
    }

    function CursorInteraction() {
        // el cursor solo aparece mientras se presiona el mouse
        if (!p.mouseIsPressed) return;

        if (hitTimer > 0) {
            // animacion de achique + cambio de color al tocar una forma
            let t = hitTimer / HIT_DURATION; // 1 -> 0
            let shrink = p.sin((1 - t) * p.PI) * (CURSOR_BASE_SIZE * 0.5);
            cursorSize = CURSOR_BASE_SIZE - shrink;
            cursorColor = '#121212';
            hitTimer--;
        } else {
            cursorSize = CURSOR_BASE_SIZE;
            cursorColor = '#F0D583';
        }

        p.push();
        p.noFill();
        p.stroke(cursorColor);
        p.strokeWeight(2);
        p.circle(p.mouseX, p.mouseY, cursorSize);
        p.pop();
    }

    function slotPos(i) {
        let col = Math.floor(i / MEMORY_ROWS);
        let row = i % MEMORY_ROWS;
        return { x: MEMORY_START_X + col * MEMORY_COL_SPACING, y: MEMORY_START_Y + row * MEMORY_ROW_SPACING };
    }

    function ShapeMemory() {
        // clones guardados: 3 columnas, 4 formas por columna, con
        // reacomodo suave hacia su lugar (misma logica grafica del sketch)
        for (let i = 0; i < memories.length; i++) {
            let m = memories[i];
            let target = slotPos(i);
            m.dispX = p.lerp(m.dispX, target.x, SLIDE_EASE);
            m.dispY = p.lerp(m.dispY, target.y, SLIDE_EASE);
            drawShapeAt(m.dispX, m.dispY, m.size, m.type, m.color);
        }

        // clones del reset anterior: se quedan quietos en su lugar
        // y se van desvaneciendo hasta desaparecer
        for (let i = fadingOut.length - 1; i >= 0; i--) {
            let f = fadingOut[i];
            f.fadeTimer--;
            let alpha = 255 * (f.fadeTimer / RESET_FADE_DURATION);
            drawShapeAt(f.x, f.y, f.size, f.type, f.color, alpha);
            if (f.fadeTimer <= 0) {
                fadingOut.splice(i, 1);
            }
        }
    }

    function hitTest(shape, mx, my) {
        let d = p.dist(mx, my, shape.x, lineY);
        return d < shape.size / 2 + HIT_MARGIN; // un poco de margen para que sea facil clickear
    }
    function mouseInsideCanvas() {
        return p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;
    }

    p.mousePressed = () => {
        if (!mouseInsideCanvas()) return;
        let local = toLocalCoords(p.mouseX, p.mouseY);
        for (let i = shapes.length - 1; i >= 0; i--) {
            let s = shapes[i];
            if (!s.clicked && hitTest(s, local.x, local.y)) {
                hitTimer = HIT_DURATION;
                s.clicked = true; // ya generó su clon, no puede generar otro hasta el proximo ciclo

                // reset: si ya esta llena la memoria, los clones actuales se
                // desvanecen en su lugar en vez de borrarse de golpe
                if (memories.length >= MEMORY_CAPACITY) {
                    for (let old of memories) {
                        fadingOut.push({
                            size: old.size,
                            type: old.type,
                            color: old.color,
                            x: old.dispX,
                            y: old.dispY,
                            fadeTimer: RESET_FADE_DURATION
                        });
                    }
                    memories = [];
                }

                let idx = memories.length;
                let pos = slotPos(idx);
                memories.push({
                    size: s.size * 0.5,
                    type: s.type,
                    color: s.color,
                    dispX: pos.x, // nace ya en su posicion final, sin animacion de entrada
                    dispY: pos.y
                });

                break; // solo la primera forma tocada
            }
        }
    }

};

new p5(Memoria, 'memoria');
