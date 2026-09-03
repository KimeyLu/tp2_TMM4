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
    p.stroke('#F0D583');
    p.strokeWeight(2);
    p.line(0, p.height / 2, p.width, p.height / 2);
    p.pop();
 
    DrawRectZones();
    ParentShapesActions();
    AnimateMerging();
    BornChildShape();
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
      placed: false
    };
  }
 
  function ParentShapesActions() {
    if (parentA) drawShape(parentA);
    if (parentB) drawShape(parentB);
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
 
  const GROW_STEP = 0.06;   // velocidad de la animacion de aparicion
  const TOLINE_STEP = 0.025; // velocidad del desplazamiento hacia la linea
  const MERGE_STEP = 0.04;   // velocidad de la fusion de A y B hacia C
 
  function easeInQuad(t) {
    return t * t;
  }
 
  // ---------- fusion de A y B en C ----------
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
 
      if (c.state === 'traveling' && c.x > p.width + c.size) {
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
 
  function tryBornChild() {
    if (parentA.placed && parentB.placed) {
      const traits = inherit(parentA, parentB);
      const centerX = (SNAP_A.x + SNAP_B.x) / 2;
      const centerY = (SNAP_A.y + SNAP_B.y) / 2;
 
      // A y B viajan hacia C encogiendose y desvaneciendose; recien al
      // terminar esa fusion nace la forma hija (ver AnimateMerging)
      merging.push({
        a: { type: parentA.type, color: parentA.color, x: parentA.x, y: parentA.y, startX: parentA.x, startY: parentA.y, size: SHAPE_SIZE },
        b: { type: parentB.type, color: parentB.color, x: parentB.x, y: parentB.y, startX: parentB.x, startY: parentB.y, size: SHAPE_SIZE },
        baseSize: SHAPE_SIZE,
        centerX,
        centerY,
        t: 0,
        traits
      });
 
      // las formas padre desaparecen de A y B y nacen otras nuevas ahi
      parentA = spawnShape('A');
      parentB = spawnShape('B');
    }
  }
 
  // ---------- interaccion con el mouse ----------
  p.mousePressed = function() {
    if (parentA && !parentA.placed && isOver(parentA, p.mouseX, p.mouseY)) {
      draggingShape = parentA;
    } else if (parentB && !parentB.placed && isOver(parentB, p.mouseX, p.mouseY)) {
      draggingShape = parentB;
    }
  }
 
  p.mouseDragged = function() {
    if (draggingShape) {
      draggingShape.x = p.mouseX;
      draggingShape.y = p.mouseY;
    }
  }
 
  p.mouseReleased = function() {
    if (!draggingShape) return;
 
    if (isOverRectC(p.mouseX, p.mouseY)) {
      const snap = draggingShape.slot === 'A' ? SNAP_A : SNAP_B;
      draggingShape.x = snap.x;
      draggingShape.y = snap.y;
      draggingShape.placed = true;
      tryBornChild();
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
