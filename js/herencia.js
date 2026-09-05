const Herencia = (p) => {
  // ---------- variables necesarias ----------
  let rectA, rectB, rectC;
  let parentA, parentB;      // formas que estan en los rect A y B (padres)
  let draggingShape = null;  // referencia a la forma que se esta arrastrando
  let children = [];         // formas hijas que viajan por la linea
  let merging = [];          // fusiones en curso (A y B yendo hacia C)
 
  const TYPES = ['circle', 'square', 'triangle'];
  const COLORS = ['#F0D583', '#121212'];

  // tamaño base de las formas (a 400x400). El tamaño real (SHAPE_SIZE) se
  // recalcula con computeSizeScale() para que se vea más grande en fullscreen.
  const BASE_SHAPE_SIZE = 24;
  let SHAPE_SIZE;
  let SIZE_SCALE = 1;

  function computeSizeScale() {
    const ratio = Math.min(p.width, p.height) / 400;
    return ratio <= 1 ? ratio : ratio * 1.25;
  }

  // posiciones donde quedan las formas al soltarlas en C. Se calculan como
  // proporción del canvas (antes eran píxeles fijos calculados a mano para
  // 400x400), así se recalculan bien si el canvas cambia de tamaño.
  let SNAP_A, SNAP_B;
 
  const ROTATION_DEG = -43; // angulo de rotacion de todo el sketch

  function computeLayout() {
    rectA = { x: p.width / 5, y: p.height / 4.7, w: 50, h: 50 };
    rectC = { x: p.width / 2.3, y: p.height / 3.5, w: 50, h: 50 };
    rectB = { x: p.width / 1.5, y: p.height / 4.7, w: 50, h: 50 };
    SNAP_A = { x: p.width * 0.375, y: p.height * 0.345 };
    SNAP_B = { x: p.width * 0.6, y: p.height * 0.345 };
  }

  // reubica las formas padre existentes según el layout ACTUAL: si todavía
  // no fueron soltadas en C, al centro de su rectángulo; si ya estaban
  // colocadas, al punto de snap correspondiente. Esto es lo que evita que
  // se vean "corridas" fuera de su cuadrado al cambiar el tamaño del canvas.
  function repositionParents() {
    if (parentA) {
      if (parentA.placed) {
        parentA.x = SNAP_A.x;
        parentA.y = SNAP_A.y;
      } else {
        parentA.x = rectA.x + rectA.w / 2;
        parentA.y = rectA.y + rectA.h / 2;
      }
    }
    if (parentB) {
      if (parentB.placed) {
        parentB.x = SNAP_B.x;
        parentB.y = SNAP_B.y;
      } else {
        parentB.x = rectB.x + rectB.w / 2;
        parentB.y = rectB.y + rectB.h / 2;
      }
    }
  }
 
  p.setup = function() {
    p.createCanvas(400, 400);
    p.rectMode(p.CORNER);
    SIZE_SCALE = computeSizeScale();
    SHAPE_SIZE = BASE_SHAPE_SIZE * SIZE_SCALE;
    computeLayout();
 
    parentA = spawnShape('A');
    parentB = spawnShape('B');
  }

  p.windowResized = function() {
    const { w, h } = window.getCanvasTargetSize('herencia', 400, 400);
    p.resizeCanvas(w, h);

    const oldScale = SIZE_SCALE;
    computeLayout();
    SIZE_SCALE = computeSizeScale();
    SHAPE_SIZE = BASE_SHAPE_SIZE * SIZE_SCALE;

    const ratio = SIZE_SCALE / oldScale;
    if (parentA) parentA.size *= ratio;
    if (parentB) parentB.size *= ratio;
    for (const m of merging) {
      m.a.size *= ratio;
      m.b.size *= ratio;
      m.baseSize *= ratio;
    }
    for (const c of children) {
      c.baseSize *= ratio;
      c.size *= ratio;
    }

    repositionParents();
  }
 
  p.draw = function() {
    p.background('#970510');
 
    p.push();
    p.translate(p.width / 2, p.height / 2);
    p.rotate(p.radians(ROTATION_DEG));
    p.translate(-p.width / 2, -p.height / 2);
    
    p.stroke('#F0D583');
    p.strokeWeight(2);
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
    const margin = 40;
    return mx > rectC.x - margin && mx < rectC.x + rectC.w + margin &&
           my > rectC.y - margin && my < rectC.y + rectC.h + margin;
  }
 
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
 
  const GROW_STEP = 0.06;
  const TOLINE_STEP = 0.025;
  const MERGE_STEP = 0.04;
  const SHRINK_STEP = 0.08;
 
  function TryStartMerge() {
    if (parentA.placed && parentB.placed && parentA.shrinkT >= 1 && parentB.shrinkT >= 1) {
      startMerge();
    }
  }
 
  function startMerge() {
    const traits = inherit(parentA, parentB);
    const centerX = (SNAP_A.x + SNAP_B.x) / 2;
    const centerY = (SNAP_A.y + SNAP_B.y) / 2;
 
    merging.push({
      a: { type: parentA.type, color: parentA.color, x: parentA.x, y: parentA.y, startX: parentA.x, startY: parentA.y, size: parentA.size },
      b: { type: parentB.type, color: parentB.color, x: parentB.x, y: parentB.y, startX: parentB.x, startY: parentB.y, size: parentB.size },
      baseSize: parentA.size,
      centerX,
      centerY,
      t: 0,
      traits
    });
 
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
      x: x+5,
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
      draggingShape.shrinkT = 0;
    } else {
      const rect = draggingShape.slot === 'A' ? rectA : rectB;
      draggingShape.x = rect.x + rect.w / 2;
      draggingShape.y = rect.y + rect.h / 2;
    }
 
    draggingShape = null;
  }
};
 
new p5(Herencia, 'herencia');