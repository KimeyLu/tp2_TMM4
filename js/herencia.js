const Herencia = (p) => {
  // ---------- variables necesarias ----------
  let rectA, rectB, rectC;
  let parentA, parentB;      // formas que estan en A y B
  let draggingShape = null;  // referencia a la forma que se esta arrastrando
  let children = [];         // formas hijas que viajan por la linea
  let merging = [];          // fusiones en curso (A y B yendo hacia C)
 
  const TYPES = ['circle', 'square', 'triangle'];
  const COLORS = ['#F0D583', '#121212'];
  const SHAPE_SIZE = 36;
 
  // posiciones fijas donde quedan las formas al soltarlas en C
  const SNAP_A = { x: 150, y: 128 };
  const SNAP_B = { x: 240, y: 128 };
 
  const ROTATION_DEG = -40; // angulo de rotacion de todo el sketch
 
  p.setup = function() {
    p.createCanvas(400, 400);
    p.rectMode(p.CORNER);
 
    rectA = { x: p.width / 5, y: p.height / 5, w: 50, h: 50 };
    rectC = { x: p.width / 2.3, y: p.height / 4, w: 50, h: 50 };
    rectB = { x: p.width / 1.5, y: p.height / 5, w: 50, h: 50 };
 
    parentA = spawnShape('A');
    parentB = spawnShape('B');
  }
 
  p.draw = function() {
    p.background('#970510');
 
    p.push();
    p.translate(p.width / 2, p.height / 2);
    p.rotate(p.radians(ROTATION_DEG));
    p.translate(-p.width / 2, -p.height / 2);
 
    p.line(-100, p.height / 2, p.width + 100, p.height / 2);
 
    DrawRectZones();
    ParentShapesActions();
    TryStartMerge();
    AnimateMerging();
    BornChildShape();
 
    p.pop();
  }
 
  // ---------- zonas ----------
  function DrawRectZones() {
    p.push();
    p.noFill();
    p.stroke('#F0D583');
    p.strokeWeight(4);
    p.rect(rectA.x, rectA.y, rectA.w, rectA.h);
    p.rect(rectC.x, rectC.y, rectC.w, rectC.h);
    p.rect(rectB.x, rectB.y, rectB.w, rectB.h);
    p.pop();
  }
 
  // ---------- formas padre (A y B) ----------
  function spawnShape(slot) {
    const rect = slot === 'A' ? rectA : rectB;
    return {
      slot,
      type: p.random(TYPES),
      color: p.random(COLORS),
      x: rect.x + rect.w / 2,
      y: rect.y + rect.h / 2,
      size: SHAPE_SIZE,
      placed: false,
      shrinkT: 0 // progreso de la animacion de achicado al soltarse en C
    };
  }
 
  function ParentShapesActions() {
    if (parentA) { updatePlacedShrink(parentA); drawShape(parentA); }
    if (parentB) { updatePlacedShrink(parentB); drawShape(parentB); }
  }
 
  // cuando una forma se suelta en C, va reduciendo su tamaño a la mitad
  function updatePlacedShrink(s) {
    if (s.placed && s.shrinkT < 1) {
      s.shrinkT = Math.min(1, s.shrinkT + SHRINK_STEP);
      const e = easeOutQuad(s.shrinkT);
      s.size = p.lerp(SHAPE_SIZE, SHAPE_SIZE / 2, e);
    }
  }
 
  function drawShape(s) {
    p.push();
    p.noStroke();
    if (s.alpha !== undefined) {
      const col = p.color(s.color);
      p.fill(p.red(col), p.green(col), p.blue(col), s.alpha);
    } else {
      p.fill(s.color);
    }
    if (s.type === 'circle') {
      p.ellipse(s.x, s.y, s.size, s.size);
    } else if (s.type === 'square') {
      p.rectMode(p.CENTER);
      p.rect(s.x, s.y, s.size, s.size);
      p.rectMode(p.CORNER);
    } else if (s.type === 'triangle') {
      const h = s.size;
      p.triangle(
        s.x, s.y - h / 2,
        s.x - h / 2, s.y + h / 2,
        s.x + h / 2, s.y + h / 2
      );
    }
    p.pop();
  }
 
  function isOver(s, mx, my) {
    return Math.abs(mx - s.x) < s.size / 2 && Math.abs(my - s.y) < s.size / 2;
  }
 
  function isOverRectC(mx, my) {
    // zona de soltado un poco mas amplia que el rect visual, para que sea comodo soltar
    const margin = 40;
    return mx > rectC.x - margin && mx < rectC.x + rectC.w + margin &&
           my > rectC.y - margin && my < rectC.y + rectC.h + margin;
  }
 
  // como todo el sketch se dibuja rotado, esta funcion convierte la posicion
  // del mouse (que p5 siempre da en coordenadas de pantalla) a las coordenadas
  // "del mundo" que usan las formas, aplicando la rotacion inversa
  function screenToWorld(mx, my) {
    const cx = p.width / 2;
    const cy = p.height / 2;
    const ang = p.radians(-ROTATION_DEG);
    const dx = mx - cx;
    const dy = my - cy;
    return {
      x: cx + dx * Math.cos(ang) - dy * Math.sin(ang),
      y: cy + dx * Math.sin(ang) + dy * Math.cos(ang)
    };
  }
 
  // ---------- forma hija ----------
  function inherit(a, b) {
    const type = (a.type === b.type) ? a.type : p.random([a.type, b.type]);
    const color = (a.color === b.color) ? a.color : p.random([a.color, b.color]);
    return { type, color };
  }
 
  // easings para las animaciones
  function easeOutBack(t) {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }
  function easeInQuad(t) {
    return t * t;
  }
  function easeOutQuad(t) {
    return 1 - (1 - t) * (1 - t);
  }
 
  const GROW_STEP = 0.06;    // velocidad de la animacion de aparicion
  const TOLINE_STEP = 0.025; // velocidad del desplazamiento hacia la linea
  const MERGE_STEP = 0.04;   // velocidad de la fusion de A y B hacia C
  const SHRINK_STEP = 0.08;  // velocidad del achicado al soltarse en C
 
  // ---------- fusion de A y B en C ----------
  // arranca recien cuando ambas formas estan sueltas en C y ya terminaron
  // su animacion de achicado a la mitad
  function TryStartMerge() {
    if (parentA.placed && parentB.placed && parentA.shrinkT >= 1 && parentB.shrinkT >= 1) {
      startMerge();
    }
  }
 
  function startMerge() {
    const traits = inherit(parentA, parentB);
    const centerX = (SNAP_A.x + SNAP_B.x) / 2;
    const centerY = (SNAP_A.y + SNAP_B.y) / 2;
 
    // A y B (ya reducidas a la mitad) viajan hacia C encogiendose del todo
    // y desvaneciendose; recien al terminar esa fusion nace la forma hija
    merging.push({
      a: { type: parentA.type, color: parentA.color, x: parentA.x, y: parentA.y, startX: parentA.x, startY: parentA.y, size: parentA.size },
      b: { type: parentB.type, color: parentB.color, x: parentB.x, y: parentB.y, startX: parentB.x, startY: parentB.y, size: parentB.size },
      baseSize: parentA.size,
      centerX,
      centerY,
      t: 0,
      traits
    });
 
    // las formas padre desaparecen de A y B y nacen otras nuevas ahi
    parentA = spawnShape('A');
    parentB = spawnShape('B');
  }
 
  function AnimateMerging() {
    for (let i = merging.length - 1; i >= 0; i--) {
      const m = merging[i];
      m.t = Math.min(1, m.t + MERGE_STEP);
      const e = easeInQuad(m.t);
 
      m.a.x = p.lerp(m.a.startX, m.centerX, e);
      m.a.y = p.lerp(m.a.startY, m.centerY, e);
      m.a.size = m.baseSize * (1 - e);
      m.a.alpha = 255 * (1 - e);
 
      m.b.x = p.lerp(m.b.startX, m.centerX, e);
      m.b.y = p.lerp(m.b.startY, m.centerY, e);
      m.b.size = m.baseSize * (1 - e);
      m.b.alpha = 255 * (1 - e);
 
      drawShape(m.a);
      drawShape(m.b);
 
      if (m.t >= 1) {
        spawnChild(m.centerX, m.centerY, m.traits);
        merging.splice(i, 1);
      }
    }
  }
 
  function BornChildShape() {
    for (let i = children.length - 1; i >= 0; i--) {
      const c = children[i];
 
      if (c.state === 'growing') {
        c.growT = Math.min(1, c.growT + GROW_STEP);
        c.size = c.baseSize * easeOutBack(c.growT);
        if (c.growT >= 1) {
          c.size = c.baseSize;
          c.state = 'toLine';
        }
      } else if (c.state === 'toLine') {
        c.moveT = Math.min(1, c.moveT + TOLINE_STEP);
        c.y = p.lerp(c.startY, c.targetY, easeInOutQuad(c.moveT));
        if (c.moveT >= 1) {
          c.y = c.targetY;
          c.state = 'traveling';
        }
      } else if (c.state === 'traveling') {
        c.x += c.speed;
      }
 
      drawShape(c);
 
      if (c.state === 'traveling' && c.x > p.width + 100 + c.size) {
        children.splice(i, 1);
      }
    }
  }
 
  function spawnChild(x, y, traits) {
    children.push({
      type: traits.type,
      color: traits.color,
      x: x,
      y: y,
      startY: y,
      targetY: p.height / 2,
      baseSize: SHAPE_SIZE,
      size: 0,
      growT: 0,
      moveT: 0,
      state: 'growing',
      speed: 2
    });
  }
 
  // ---------- interaccion con el mouse ----------
  p.mousePressed = function() {
    const w = screenToWorld(p.mouseX, p.mouseY);
    if (parentA && !parentA.placed && isOver(parentA, w.x, w.y)) {
      draggingShape = parentA;
    } else if (parentB && !parentB.placed && isOver(parentB, w.x, w.y)) {
      draggingShape = parentB;
    }
  }
 
  p.mouseDragged = function() {
    if (draggingShape) {
      const w = screenToWorld(p.mouseX, p.mouseY);
      draggingShape.x = w.x;
      draggingShape.y = w.y;
    }
  }
 
  p.mouseReleased = function() {
    if (!draggingShape) return;
 
    const w = screenToWorld(p.mouseX, p.mouseY);
 
    if (isOverRectC(w.x, w.y)) {
      const snap = draggingShape.slot === 'A' ? SNAP_A : SNAP_B;
      draggingShape.x = snap.x;
      draggingShape.y = snap.y;
      draggingShape.placed = true;
      draggingShape.shrinkT = 0; // arranca la animacion de achicado a la mitad
    } else {
      // si no se solto sobre C, vuelve a su rectangulo de origen
      const rect = draggingShape.slot === 'A' ? rectA : rectB;
      draggingShape.x = rect.x + rect.w / 2;
      draggingShape.y = rect.y + rect.h / 2;
    }
 
    draggingShape = null;
  }
};
 
new p5(Herencia, 'herencia');
