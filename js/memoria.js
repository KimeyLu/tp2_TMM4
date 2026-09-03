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
 
    // cursor
    let cursorSize = 30;
    const CURSOR_BASE_SIZE = 30;
    let cursorColor = '#F0D583';
    let hitTimer = 0;
    const HIT_DURATION = 18; // frames que dura la animacion de "achique"
 
    // memoria: 3 columnas, 4 formas por columna
    const MEMORY_COLS = 3;
    const MEMORY_ROWS = 4;
    const MEMORY_CAPACITY = MEMORY_COLS * MEMORY_ROWS;
    const MEMORY_START_X = 120;
    let MEMORY_START_Y; // depende de p.height, se asigna en setup (createCanvas define p.height recien ahi)
    const MEMORY_COL_SPACING = 80; // distancia horizontal entre columnas
    const MEMORY_ROW_SPACING = 22; // distancia vertical entre formas de una misma columna
    const SLIDE_EASE = 0.2; // suaviza la aparicion de cada clon en su lugar
    const RESET_FADE_DURATION = 30; // frames que tardan en desvanecerse al reiniciar
 
    p.setup = function() {
        p.createCanvas(400, 400);
        lineY = p.height / 2;
        WRAP_LEN = p.width + 180; // buffer fijo, mayor al tamanio maximo de una forma
        MEMORY_START_Y = p.height / 4;
 
        for (let i = 0; i < N_SHAPES; i++) {
            shapes.push(makeShape(i * (WRAP_LEN / N_SHAPES)));
        }
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
        p.line(-100, lineY, p.width + 100, lineY);
 
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
            size: p.random(24, 24),
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
            s.x = cyclePos - 100; // posicion en que inician las formas, aparecen, principio
 
            // al arrancar un nuevo ciclo, se reasignan tipo y color
            // y se habilita de nuevo la posibilidad de generar un clon
            if (cycleCount !== s.lastCycle) {
                s.lastCycle = cycleCount;
                s.type = p.random(TYPES);
                s.color = p.random(COLORS);
                s.clicked = false;
            }
 
            drawShapeAt(s.x, lineY, s.size, s.type, s.color);
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
        return d < shape.size / 2 + 4; // un poco de margen para que sea facil clickear
    }
 
    p.mousePressed = function() {
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
