const Herencia = (p) => {
  // ---------- variables necesarias ----------
  let rectA, rectB, rectC;
  let parentA, parentB;      // formas que estan en A y B
  let draggingShape = null;  // referencia a la forma que se esta arrastrando
  let children = [];         // formas hijas que viajan por la linea
 
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
 
    p.line(0, p.height / 2, p.width, p.height / 2);
 
    DrawRectZones();
    ParentShapesActions();
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
    p.fill(s.color);
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
 
  function BornChildShape() {
    for (let i = children.length - 1; i >= 0; i--) {
      const c = children[i];
      c.x += c.speed;
      drawShape(c);
      if (c.x > p.width + c.size) {
        children.splice(i, 1);
      }
    }
  }
 
  function tryBornChild() {
    if (parentA.placed && parentB.placed) {
      const traits = inherit(parentA, parentB);
      children.push({
        type: traits.type,
        color: traits.color,
        x: (SNAP_A.x + SNAP_B.x) / 2,
        y: p.height / 2,
        size: SHAPE_SIZE,
        speed: 2
      });
 
      // las formas padre desaparecen y nacen otras nuevas en A y B
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
