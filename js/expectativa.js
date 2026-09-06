// ============================================================
// SURVIVE THE DASH — p5.js prototype
// Minimalist geometric survival game.
// ------------------------------------------------------------
// MODO INSTANCIA: todo el sketch vive dentro del closure
// `sketchExpectativa`, para poder correr junto a otros sketches
// de p5 en la misma pagina sin pisarse variables globales.
// Se monta automaticamente en el div con id="expectativa".
// ============================================================

const sketchExpectativa = (p) => {
    // ---------------------------------------------------------
    // CONFIG — valores que se recalculan según el tamaño del canvas.
    // BASE_CONFIG guarda los valores de referencia (a 400x400);
    // applyScale() los reescala para que en fullscreen se vea todo
    // más grande, manteniendo las proporciones entre sí.
    // ---------------------------------------------------------
    const BASE_CONFIG = {
        canvasSize: 400,
        squareSize: 150,
        outlineSpacing: 11,
        strokeWeightThin: 1.6,
        nodeRadius: 8,
        nodeOffset: 44,
        triangleLength: 200,
        triangleHalfWidth: 80,
        dashSpeed: 1250,
        pullBackMax: 40,
        spawnMargin: 3
    };

    const CONFIG = {
        canvasSize: BASE_CONFIG.canvasSize,

        squareSize: BASE_CONFIG.squareSize,
        outlineSpacing: BASE_CONFIG.outlineSpacing,
        strokeWeightThin: BASE_CONFIG.strokeWeightThin,

        nodeRadius: BASE_CONFIG.nodeRadius,
        nodeOffset: BASE_CONFIG.nodeOffset,
        easeAnchor: 0.16, // how fast the edge-anchor slides
        easeNode: 0.22, // how fast the visible node eases toward its target

        chargeDuration: 3.0, // seconds — phase 1
        pauseBetweenAttacks: 0.8, // seconds — rest between attacks
        fillFlashTime: 0.16, // seconds — square fill fade-in speed

        triangleLength: BASE_CONFIG.triangleLength,
        triangleHalfWidth: BASE_CONFIG.triangleHalfWidth,
        dashSpeed: BASE_CONFIG.dashSpeed, // px / sec top speed
        dashAccelTime: 0.22, // seconds to reach top speed
        pullBackMax: BASE_CONFIG.pullBackMax, // px the triangle winds up before launching
        spawnMargin: BASE_CONFIG.spawnMargin, // px outside the canvas the enemy spawns at

        colors: {
            bg: "#141414",
            squareOutline: "#5c1414",
            squareOutlineBright: "#8f2323",
            squareFill: "#c81e1e",
            node: "#ff2f2f",
            nodeGlow: "rgba(255,47,47,0.28)",
            triangle: "#f2dca0",
            triangleTrail: "rgba(242,220,160,0.18)",
            text: "#6b6b6b",
            textDim: "#3c3c3c",
        },
    };

    function computeSizeScale() {
        const ratio = Math.min(p.width, p.height) / BASE_CONFIG.canvasSize;
        return ratio <= 1 ? ratio : ratio * 1.25;
    }

    function applyScale(scale) {
        CONFIG.squareSize = BASE_CONFIG.squareSize * scale;
        CONFIG.outlineSpacing = BASE_CONFIG.outlineSpacing * scale;
        CONFIG.strokeWeightThin = BASE_CONFIG.strokeWeightThin * scale;
        CONFIG.nodeRadius = BASE_CONFIG.nodeRadius * scale;
        CONFIG.nodeOffset = BASE_CONFIG.nodeOffset * scale;
        CONFIG.triangleLength = BASE_CONFIG.triangleLength * scale;
        CONFIG.triangleHalfWidth = BASE_CONFIG.triangleHalfWidth * scale;
        CONFIG.dashSpeed = BASE_CONFIG.dashSpeed * scale;
        CONFIG.pullBackMax = BASE_CONFIG.pullBackMax * scale;
        CONFIG.spawnMargin = BASE_CONFIG.spawnMargin * scale;
    }

    // ---------------------------------------------------------
    // EASING HELPERS
    // ---------------------------------------------------------
    function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }
    function easeInQuad(t) {
        return t * t;
    }
    function easeOutQuad(t) {
        return t * (2 - t);
    }

    // ---------------------------------------------------------
    // PERIMETER MATH HELPERS (square edge parametrization)
    // side order: top(0..S) -> right(S..2S) -> bottom(2S..3S) -> left(3S..4S)
    // coordinates are relative to the square's center
    // ---------------------------------------------------------
    function sideForPoint(rx, ry) {
        if (ry <= -Math.abs(rx)) return "top";
        if (ry >= Math.abs(rx)) return "bottom";
        if (rx <= -Math.abs(ry)) return "left";
        return "right";
    }

    function pointOnSide(side, rx, ry, half) {
        switch (side) {
            case "top":
                return { x: p.constrain(rx, -half, half), y: -half };
            case "bottom":
                return { x: p.constrain(rx, -half, half), y: half };
            case "left":
                return { x: -half, y: p.constrain(ry, -half, half) };
            default:
                return { x: half, y: p.constrain(ry, -half, half) };
        }
    }

    function pointToParam(side, x, y, half, size) {
        switch (side) {
            case "top":
                return x + half;
            case "right":
                return size + (y + half);
            case "bottom":
                return size * 2 + (half - x);
            default:
                return size * 3 + (half - y);
        }
    }

    function paramToPoint(u, half, size) {
        const total = size * 4;
        u = ((u % total) + total) % total;
        if (u < size) return { x: -half + u, y: -half, side: "top" };
        if (u < size * 2)
            return { x: half, y: -half + (u - size), side: "right" };
        if (u < size * 3)
            return { x: half - (u - size * 2), y: half, side: "bottom" };
        return { x: -half, y: half - (u - size * 3), side: "left" };
    }

    function normalForSide(side) {
        switch (side) {
            case "top":
                return { x: 0, y: -1 };
            case "bottom":
                return { x: 0, y: 1 };
            case "left":
                return { x: -1, y: 0 };
            default:
                return { x: 1, y: 0 };
        }
    }

    // ---------------------------------------------------------
    // GEOMETRY HELPERS (collision)
    // ---------------------------------------------------------
    function distToSegment(px, py, ax, ay, bx, by) {
        const abx = bx - ax,
            aby = by - ay;
        const apx = px - ax,
            apy = py - ay;
        const abLenSq = abx * abx + aby * aby;
        let t = abLenSq > 0 ? (apx * abx + apy * aby) / abLenSq : 0;
        t = p.constrain(t, 0, 1);
        const cx = ax + abx * t,
            cy = ay + aby * t;
        return p.dist(px, py, cx, cy);
    }

    function pointInTriangle(px, py, p0, p1, p2) {
        const s = (p0.x - p2.x) * (py - p2.y) - (p0.y - p2.y) * (px - p2.x);
        const t = (p1.x - p0.x) * (py - p0.y) - (p1.y - p0.y) * (px - p0.x);
        if ((s < 0) !== (t < 0) && s !== 0 && t !== 0) return false;
        const d = (p2.x - p1.x) * (py - p1.y) - (p2.y - p1.y) * (px - p1.x);
        return d === 0 || (d < 0) === s + t <= 0;
    }

    function circleIntersectsTriangle(cx, cy, r, pts) {
        if (pointInTriangle(cx, cy, pts[0], pts[1], pts[2])) return true;
        for (let i = 0; i < 3; i++) {
            const a = pts[i],
                b = pts[(i + 1) % 3];
            if (distToSegment(cx, cy, a.x, a.y, b.x, b.y) <= r) return true;
        }
        return false;
    }

    // ---------------------------------------------------------
    // SQUARE — center anchor + charge visualization
    // ---------------------------------------------------------
    class Square {
        constructor(cx, cy, size) {
            this.cx = cx;
            this.cy = cy;
            this.size = size;
            this.fillAlpha = 0;
        }

        // chargeStage: 0..CONFIG.chargeDuration seconds. filling: bool, fillT: 0..1
        draw(chargeStage, filling, fillT) {
            p.push();
            p.translate(this.cx, this.cy);
            p.rectMode(p.CENTER);

            // base outline
            p.noFill();
            p.stroke(CONFIG.colors.squareOutline);
            p.strokeWeight(CONFIG.strokeWeightThin);
            p.rect(0, 0, this.size, this.size);

            // nested charge outlines (appear at stage thresholds 1 and 2)
            const thresholds = [1, 2];
            let innerMostSize = this.size;
            for (let i = 0; i < thresholds.length; i++) {
                const t = p.constrain(chargeStage - thresholds[i], 0, 1);
                if (t <= 0) continue;
                const eased = easeOutCubic(t);
                const inset = eased * CONFIG.outlineSpacing * (i + 1) * 2;
                const s = this.size - inset;
                innerMostSize = s;
                p.stroke(CONFIG.colors.squareOutlineBright);
                p.strokeWeight(CONFIG.strokeWeightThin);
                let a = eased * 255;
                strokeAlpha(CONFIG.colors.squareOutlineBright, a);
                p.rect(0, 0, s, s);
            }

            // fill flash once charge completes
            if (filling) {
                const a = easeOutCubic(p.constrain(fillT, 0, 1)) * 255;
                p.noStroke();
                const c = p.color(CONFIG.colors.squareFill);
                c.setAlpha(a);
                p.fill(c);
                const fillSize = innerMostSize - CONFIG.outlineSpacing * 2;
                const s = Math.max(fillSize, this.size * 0.35);
                p.rect(0, 0, s, s);
            }

            p.pop();
        }
    }

    // small helper to draw a stroke with custom alpha without mutating CONFIG
    function strokeAlpha(hexColor, alpha) {
        const c = p.color(hexColor);
        c.setAlpha(alpha);
        p.stroke(c);
    }

    // ---------------------------------------------------------
    // PLAYER — node sliding around the square, connected by a line
    // ---------------------------------------------------------
    class Player {
        constructor(square) {
            this.square = square;
            this.half = CONFIG.squareSize / 2;
            this.size = CONFIG.squareSize;
            this.u = 0;
            this.anchor = { x: 0, y: 0 };
            this.pos = { x: 0, y: 0 };
            this.currentSide = "top";
            this._syncInstant();
        }

        _targetPointFor(u) {
            const pt = paramToPoint(u, this.half, this.size);
            return {
                x: this.square.cx + pt.x,
                y: this.square.cy + pt.y,
                side: pt.side,
            };
        }

        computeTargetU(mx, my) {
            const rx = mx - this.square.cx;
            const ry = my - this.square.cy;
            const side = sideForPoint(rx, ry);
            const pt = pointOnSide(side, rx, ry, this.half);
            return pointToParam(side, pt.x, pt.y, this.half, this.size);
        }

        _syncInstant() {
            const pt = this._targetPointFor(this.u);
            this.anchor.x = pt.x;
            this.anchor.y = pt.y;
            const n = normalForSide(pt.side);
            this.pos.x = pt.x + n.x * CONFIG.nodeOffset;
            this.pos.y = pt.y + n.y * CONFIG.nodeOffset;
            this.currentSide = pt.side;
        }

        update(mx, my, canMove) {
            if (canMove) {
                const targetU = this.computeTargetU(mx, my);
                const total = this.size * 4;
                let diff =
                    ((targetU - this.u + total * 1.5) % total) - total * 0.5;
                this.u += diff * CONFIG.easeAnchor;
            }

            const pt = this._targetPointFor(this.u);
            const n = normalForSide(pt.side);
            const targetAnchorX = pt.x,
                targetAnchorY = pt.y;
            const targetNodeX = pt.x + n.x * CONFIG.nodeOffset;
            const targetNodeY = pt.y + n.y * CONFIG.nodeOffset;

            this.anchor.x = p.lerp(this.anchor.x, targetAnchorX, CONFIG.easeAnchor);
            this.anchor.y = p.lerp(this.anchor.y, targetAnchorY, CONFIG.easeAnchor);
            this.pos.x = p.lerp(this.pos.x, targetNodeX, CONFIG.easeNode);
            this.pos.y = p.lerp(this.pos.y, targetNodeY, CONFIG.easeNode);
            this.currentSide = pt.side;
        }

        draw() {
            p.stroke(CONFIG.colors.node);
            p.strokeWeight(CONFIG.strokeWeightThin);
            p.line(this.anchor.x, this.anchor.y, this.pos.x, this.pos.y);

            p.noStroke();
            p.fill(CONFIG.colors.nodeGlow);
            p.circle(this.pos.x, this.pos.y, CONFIG.nodeRadius * 3.6);

            p.fill(CONFIG.colors.node);
            p.circle(this.pos.x, this.pos.y, CONFIG.nodeRadius * 2);
        }
    }

    // ---------------------------------------------------------
    // ENEMY — the yellow triangle
    // ---------------------------------------------------------
    class Enemy {
        constructor(cx, cy, w, h) {
            this.cx = cx;
            this.cy = cy;
            this.w = w;
            this.h = h;
            this.reset();
        }

        reset(side) {
            side = side || p.random(["top", "bottom", "left", "right"]);
            let sx, sy;
            if (side === "top") {
                sx = p.random(this.w * 0.15, this.w * 0.85);
                sy = -CONFIG.spawnMargin;
            } else if (side === "bottom") {
                sx = p.random(this.w * 0.15, this.w * 0.85);
                sy = this.h + CONFIG.spawnMargin;
            } else if (side === "left") {
                sx = -CONFIG.spawnMargin;
                sy = p.random(this.h * 0.15, this.h * 0.85);
            } else {
                sx = this.w + CONFIG.spawnMargin;
                sy = p.random(this.h * 0.15, this.h * 0.85);
            }

            const dx = this.cx - sx,
                dy = this.cy - sy;
            const len = Math.hypot(dx, dy) || 1;
            this.dir = { x: dx / len, y: dy / len };
            this.spawn = { x: sx, y: sy };
            this.pos = { x: sx, y: sy };

            // mirror the spawn point across the center to get where it should exit,
            // then require the dash to actually cover that full distance (plus a
            // buffer for the triangle's own size) before it's allowed to end.
            const exitPoint = { x: 2 * this.cx - sx, y: 2 * this.cy - sy };
            this.travelTarget =
                Math.hypot(exitPoint.x - sx, exitPoint.y - sy) +
                CONFIG.triangleLength +
                60;

            this.state = "charging";
            this.chargeTimer = 0;
            this.dashTimer = 0;
            this.speed = 0;
        }

        update(dt) {
            if (this.state === "charging") {
                this.chargeTimer += dt;
                const envelope = easeOutCubic(
                    p.constrain(this.chargeTimer / CONFIG.chargeDuration, 0, 1),
                );
                const wobble =
                    Math.sin(this.chargeTimer * 9.0) * CONFIG.pullBackMax * 0.5;
                const pull =
                    (CONFIG.pullBackMax * 0.5 + wobble * 0.5) * envelope;
                this.pos.x = this.spawn.x - this.dir.x * pull;
                this.pos.y = this.spawn.y - this.dir.y * pull;

                if (this.chargeTimer >= CONFIG.chargeDuration) {
                    this.state = "dashing";
                    this.dashTimer = 0;
                    this.speed = 0;
                    // dash always launches cleanly from the spawn point, not from
                    // wherever the wind-up wobble happened to leave it
                    this.pos.x = this.spawn.x;
                    this.pos.y = this.spawn.y;
                }
            } else if (this.state === "dashing") {
                this.dashTimer += dt;
                const t = p.constrain(this.dashTimer / CONFIG.dashAccelTime, 0, 1);
                this.speed = CONFIG.dashSpeed * easeOutQuad(t);
                this.pos.x += this.dir.x * this.speed * dt;
                this.pos.y += this.dir.y * this.speed * dt;

                const traveled =
                    (this.pos.x - this.spawn.x) * this.dir.x +
                    (this.pos.y - this.spawn.y) * this.dir.y;
                if (traveled >= this.travelTarget) {
                    this.state = "done";
                }
            }
        }

        getPoints() {
            const dir = this.dir;
            const perp = { x: -dir.y, y: dir.x };
            const len = CONFIG.triangleLength;
            const hw = CONFIG.triangleHalfWidth;
            const tip = {
                x: this.pos.x + dir.x * len * 0.6,
                y: this.pos.y + dir.y * len * 0.6,
            };
            const baseCenter = {
                x: this.pos.x - dir.x * len * 0.4,
                y: this.pos.y - dir.y * len * 0.4,
            };
            const baseL = {
                x: baseCenter.x + perp.x * hw,
                y: baseCenter.y + perp.y * hw,
            };
            const baseR = {
                x: baseCenter.x - perp.x * hw,
                y: baseCenter.y - perp.y * hw,
            };
            return [tip, baseL, baseR];
        }

        draw() {
            // trailing echoes while dashing, for a sense of speed
            if (this.state === "dashing" && this.speed > 60) {
                p.noStroke();
                p.fill(CONFIG.colors.triangleTrail);
                for (let i = 1; i <= 3; i++) {
                    const back = i * 14;
                    const savedX = this.pos.x,
                        savedY = this.pos.y;
                    this.pos.x -= this.dir.x * back;
                    this.pos.y -= this.dir.y * back;
                    const pts = this.getPoints();
                    this.pos.x = savedX;
                    this.pos.y = savedY;
                    p.beginShape();
                    p.vertex(pts[0].x, pts[0].y);
                    p.vertex(pts[1].x, pts[1].y);
                    p.vertex(pts[2].x, pts[2].y);
                    p.endShape(p.CLOSE);
                }
            }

            const pts = this.getPoints();
            p.fill(CONFIG.colors.triangle);
            p.stroke(CONFIG.colors.triangle);
            p.strokeWeight(1);
            p.beginShape();
            p.vertex(pts[0].x, pts[0].y);
            p.vertex(pts[1].x, pts[1].y);
            p.vertex(pts[2].x, pts[2].y);
            p.endShape(p.CLOSE);
        }
    }

    // ---------------------------------------------------------
    // ATTACK CONTROLLER — owns the charge -> dash -> pause cycle
    // ---------------------------------------------------------
    class AttackController {
        constructor(w, h, cx, cy) {
            this.w = w;
            this.h = h;
            this.cx = cx;
            this.cy = cy;
            this.enemy = null;
            this.state = "charging"; // charging | dashing | pausing
            this.pauseTimer = 0;
            this.attacksSurvived = 0;
            this._spawnNewAttack();
        }

        _spawnNewAttack() {
            if (!this.enemy) {
                this.enemy = new Enemy(this.cx, this.cy, this.w, this.h);
            } else {
                this.enemy.reset();
            }
            this.state = "charging";
        }

        get canPlayerMove() {
            return this.state === "charging";
        }

        get chargeStage() {
            if (this.state === "charging")
                return (
                    p.constrain(this.enemy.chargeTimer / CONFIG.chargeDuration, 0, 1) *
                    3
                );
            return 3;
        }

        get filling() {
            return (
                this.state === "dashing" ||
                (this.state === "charging" &&
                    this.enemy.chargeTimer >= CONFIG.chargeDuration)
            );
        }

        get fillT() {
            if (this.state === "dashing")
                return p.constrain(this.enemy.dashTimer / CONFIG.fillFlashTime, 0, 1);
            return 0;
        }

        update(dt) {
            this.enemy.update(dt);

            if (this.state === "charging" && this.enemy.state === "dashing") {
                this.state = "dashing";
            } else if (this.state === "dashing" && this.enemy.state === "done") {
                this.state = "pausing";
                this.pauseTimer = 0;
                this.attacksSurvived++;
            } else if (this.state === "pausing") {
                this.pauseTimer += dt;
                if (this.pauseTimer >= CONFIG.pauseBetweenAttacks) {
                    this._spawnNewAttack();
                }
            }
        }

        draw() {
            if (this.enemy && (this.state === "charging" || this.state === "dashing")) {
                this.enemy.draw();
            }
        }
    }

    // ---------------------------------------------------------
    // GAME — top level state machine
    // ---------------------------------------------------------
    class Game {
        constructor(w, h) {
            this.w = w;
            this.h = h;
            this.cx = w / 2;
            this.cy = h / 2;
            this.reset();
        }

        reset() {
            this.square = new Square(this.cx, this.cy, CONFIG.squareSize);
            this.player = new Player(this.square);
            this.controller = new AttackController(this.w, this.h, this.cx, this.cy);
        }

        update(dt, mx, my, mouseInside) {
            this.controller.update(dt);
            this.player.update(mx, my, this.controller.canPlayerMove && mouseInside);

            if (this.controller.state === "dashing") {
                const pts = this.controller.enemy.getPoints();
                if (
                    circleIntersectsTriangle(
                        this.player.pos.x,
                        this.player.pos.y,
                        CONFIG.nodeRadius,
                        pts,
                    )
                ) {
                    this.reset();
                }
            }
        }

        draw() {
            p.background(CONFIG.colors.bg);

            this.square.draw(
                this.controller.chargeStage,
                this.controller.filling,
                this.controller.fillT,
            );
            this.controller.draw();
            this.player.draw();
        }
    }

    // ---------------------------------------------------------
    // p5 ENTRY POINTS
    // ---------------------------------------------------------
    let game;

    p.setup = () => {
        const container = document.getElementById("expectativa");
        const c = p.createCanvas(BASE_CONFIG.canvasSize, BASE_CONFIG.canvasSize);
        c.parent(container);
        applyScale(computeSizeScale());
        game = new Game(p.width, p.height);
    };

    p.windowResized = () => {
        const { w, h } = window.getCanvasTargetSize('expectativa', BASE_CONFIG.canvasSize, BASE_CONFIG.canvasSize);
        p.resizeCanvas(w, h);
        applyScale(computeSizeScale());
        game = new Game(p.width, p.height);
    };

    // el mouse solo cuenta si esta dentro de ESTE canvas (en modo instancia
    // los eventos de mouse llegan de toda la pagina, no solo del propio div).
    function mouseInsideCanvas() {
        return (
            p.mouseX >= 0 &&
            p.mouseX <= p.width &&
            p.mouseY >= 0 &&
            p.mouseY <= p.height
        );
    }

    p.draw = () => {
        const dt = Math.min(p.deltaTime / 1000, 1 / 30); // clamp to avoid spiral of death on lag
        game.update(dt, p.mouseX, p.mouseY, mouseInsideCanvas());
        game.draw();
    };
};

// Monta el sketch en el div#expectativa
new p5(sketchExpectativa);