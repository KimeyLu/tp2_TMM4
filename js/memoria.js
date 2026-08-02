const Memoria = (p) => {

  // ===================== CONFIG GENERAL =====================
  let registerX = 150;
  let registerY = 200;
  let registerSize = 150;

  let originalX = 0;
  let originalY = 500;

  let wobbleAmplitude = 8;
  let wobbleSpeed = 0.03;

  let SNAP_DURATION = 500;
  let RETURN_DURATION = 400;

  let ROTATION_ANGLE = Math.PI / 4; // Math.PI es JS nativo, no necesita "p."

  // Convierte mouseX/mouseY (coordenadas de pantalla) al sistema local
  // ya trasladado y rotado, para que la lógica (clicks, drag) coincida
  // con lo que se ve dibujado en pantalla.
  // OJO: cos()/sin() SÍ son de p5 (dependen de angleMode), por eso llevan "p."
  function getLocalMouse() {
    let sx = p.mouseX - p.width / 2;
    let sy = p.mouseY;
    let cosA = p.cos(-ROTATION_ANGLE);
    let sinA = p.sin(-ROTATION_ANGLE);
    return {
      x: sx * cosA - sy * sinA,
      y: sx * sinA + sy * cosA
    };
  }

  let shapes = [];

  // ===================== CLASE SHAPE =====================
  class Shape {
    constructor(x, y, size, type, col) {
      this.x = x;
      this.y = y;
      this.size = size;

      this.type = type !== undefined ? type : p.floor(p.random(3));
      this.color = col !== undefined ? col : p.random([p.color('#F0D583'), p.color('#121212')]);

      this.dragging = false;
      this.snapped = false;
      this.snapTime = 0;
      this.lastY = y;

      this.returning = false;
      this.returnStartTime = 0;
      this.returnFrom = { x, y };
      this.returnTo = { x, y };
    }

    getBounds() {
      let left, top, right, bottom;

      if (this.type == 0) {
        left = this.x;
        top = this.y;
        right = this.x + this.size;
        bottom = this.y + this.size;
      } else if (this.type == 1) {
        left = this.x - this.size / 2;
        top = this.y - this.size / 2;
        right = this.x + this.size / 2;
        bottom = this.y + this.size / 2;
      } else {
        left = this.x - this.size / 2;
        top = this.y;
        right = this.x + this.size / 2;
        bottom = this.y + this.size;
      }

      return { left, top, right, bottom };
    }

    contains(mx, my) {
      let b = this.getBounds();
      return mx >= b.left && mx <= b.right && my >= b.top && my <= b.bottom;
    }

    getCenter() {
      let b = this.getBounds();
      return {
        x: (b.left + b.right) / 2,
        y: (b.top + b.bottom) / 2
      };
    }

    startDrag() {
      this.dragging = true;
      this.lastY = this.y;
    }

    trySnap(reg) {
      let b = this.getBounds();
      let fits =
        b.left >= reg.x &&
        b.top >= reg.y &&
        b.right <= reg.x + reg.size &&
        b.bottom <= reg.y + reg.size;

      if (fits) {
        let centerX = reg.x + reg.size / 2;
        let centerY = reg.y + reg.size / 2;

        if (this.type == 0) {
          this.x = centerX - this.size / 2;
          this.y = centerY - this.size / 2;
        } else if (this.type == 1) {
          this.x = centerX;
          this.y = centerY;
        } else {
          this.x = centerX;
          this.y = centerY - (this.size * 2) / 3;
        }

        this.snapped = true;
        this.snapTime = p.millis();
        reg.lastColor = this.color;
        reg.lastType = this.type;
      } else {
        this.snapped = false;
        this.x = originalX;
        this.y = this.lastY;
      }

      return fits;
    }

    update() {
      if (this.dragging) {
        let m = getLocalMouse();
        this.x = m.x;
        this.y = m.y;
      } else if (this.returning) {
        let elapsed = p.millis() - this.returnStartTime;
        let t = p.constrain(elapsed / RETURN_DURATION, 0, 1);
        let eased = 1 - p.pow(1 - t, 3);
        this.x = p.lerp(this.returnFrom.x, this.returnTo.x, eased);
        this.y = p.lerp(this.returnFrom.y, this.returnTo.y, eased);
        if (t >= 1) {
          this.returning = false;
        }
      } else if (!this.snapped) {
        this.y--;
        this.x = originalX + p.sin(p.frameCount * wobbleSpeed) * wobbleAmplitude;
      }

      if (this.snapped && p.millis() - this.snapTime > SNAP_DURATION) {
        this.snapped = false;
        this.returning = true;
        this.returnStartTime = p.millis();
        this.returnFrom = { x: this.x, y: this.y };
        this.returnTo = { x: originalX, y: this.lastY };
      }

      if (this.y < -30) {
        this.y = p.height;
        this.type = p.floor(p.random(3));
        this.color = p.random([p.color('#F0D583'), p.color('#121212')]);
      }
    }

    draw() {
      p.push();
      p.fill(this.color);
      if (this.type == 0) {
        p.rect(this.x, this.y, this.size, this.size);
      } else if (this.type == 1) {
        p.ellipse(this.x, this.y, this.size);
      } else {
        p.triangle(
          this.x, this.y,
          this.x - this.size / 2, this.y + this.size,
          this.x + this.size / 2, this.y + this.size
        );
      }
      p.pop();
    }
  }

  // ===================== CLASE REGISTER =====================
  class Register {
    constructor(x, y, size) {
      this.x = x;
      this.y = y;
      this.size = size;
      this.lastColor = p.color('#F0D583');
      this.lastType = null;
    }

    getScale(snappedShape, animDuration = SNAP_DURATION) {
      if (snappedShape) {
        let elapsed = p.millis() - snappedShape.snapTime;
        let t = p.constrain(elapsed / animDuration, 0, 1);
        return 1 - 0.3 * p.sin(p.PI * t);
      }
      return 1;
    }

    draw(snappedShape) {
      let s = this.getScale(snappedShape);
      p.push();
      p.fill(this.lastColor);
      let cx = this.x + this.size / 2;
      let cy = this.y + this.size / 2;
      p.translate(cx, cy);
      p.scale(s);

      if (this.lastType === 1) {
        p.ellipse(0, 0, this.size);
        p.push();
          p.noStroke();
          p.fill('#970510');
          p.ellipse(0, 0, this.size / 2);
          p.push();
            p.fill('#970510');
            p.strokeWeight(3);
            p.stroke(this.lastColor);
            p.ellipse(0, 0, this.size / 2.4);
          p.pop();
        p.pop();
      } else if (this.lastType === 2) {
        p.triangle(
          0, -this.size / 2,
          -this.size / 2, this.size / 2,
          this.size / 2, this.size / 2
        );
        p.push();
          p.noStroke();
          p.fill('#970510');
          p.triangle(
            0, -this.size / 5,
            -this.size / 4.2, this.size / 3.2,
            this.size / 4.2, this.size / 3.2
          );
          p.push();
            p.strokeWeight(3);
            p.stroke(this.lastColor);
            p.triangle(
              0, -this.size / 8,
              -this.size / 5.2, this.size / 3.5,
              this.size / 5.2, this.size / 3.5
            );
          p.pop();
        p.pop();
      } else {
        p.rectMode(p.CENTER);
        p.rect(0, 0, this.size, this.size);
        p.push();
          p.noStroke();
          p.fill('#970510');
          p.rect(0, 0, this.size / 2, this.size / 2);
          p.push();
            p.fill('#970510');
            p.strokeWeight(3);
            p.stroke(this.lastColor);
            p.rect(0, 0, this.size / 2.4, this.size / 2.4);
          p.pop();
        p.pop();
      }

      p.pop();
    }
  }

  // ===================== SETUP / DRAW =====================
  let register;
  let shapeGapY = 150;

  p.setup = function () {
    p.createCanvas(510, 505);
    register = new Register(registerX, registerY, registerSize);

    for (let i = 0; i < 4; i++) {
      shapes.push(new Shape(originalX, p.height + i * shapeGapY, 30));
    }
  };

  p.draw = function () {
    p.background('#970510');
    p.translate(p.width / 2, 0);
    p.rotate(ROTATION_ANGLE);
    p.noStroke();

    let snappedShape = shapes.find(s => s.snapped);
    register.draw(snappedShape);

    p.push();
    p.stroke(30, 30, 30);
    p.strokeWeight(1.5);

    let originPoint = { x: originalX, y: p.height };
    let nearestShape = null;
    let nearestOriginDist = Infinity;
    for (let s of shapes) {
      if (s.dragging || s.snapped) continue;
      let c = s.getCenter();
      let d = p.dist(originPoint.x, originPoint.y, c.x, c.y);
      if (d < nearestOriginDist) {
        nearestOriginDist = d;
        nearestShape = s;
      }
    }
    if (nearestShape) {
      let c = nearestShape.getCenter();
      p.push();
      p.stroke(30, 30, 30);
      p.strokeWeight(1.5);
      p.line(originPoint.x, originPoint.y, c.x, c.y);
      p.pop();
    }

    let exitPoint = { x: originalX, y: -30 };
    let nearestExitShape = null;
    let nearestExitDist = Infinity;
    for (let s of shapes) {
      if (s.dragging || s.snapped) continue;
      let c = s.getCenter();
      let d = p.dist(exitPoint.x, exitPoint.y, c.x, c.y);
      if (d < nearestExitDist) {
        nearestExitDist = d;
        nearestExitShape = s;
      }
    }
    if (nearestExitShape) {
      let c = nearestExitShape.getCenter();
      p.push();
      p.stroke(30, 30, 30);
      p.strokeWeight(1.5);
      p.line(exitPoint.x, exitPoint.y, c.x, c.y);
      p.pop();
    }

    let freeShapes = shapes.filter(s => !s.dragging && !s.snapped && !s.returning);
    let drawnPairs = new Set();

    for (let i = 0; i < freeShapes.length; i++) {
      let a = freeShapes[i];
      let ac = a.getCenter();

      let nearestIdx = -1;
      let nearestDist = Infinity;
      for (let j = 0; j < freeShapes.length; j++) {
        if (i === j) continue;
        let bc = freeShapes[j].getCenter();
        let d = p.dist(ac.x, ac.y, bc.x, bc.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearestIdx = j;
        }
      }

      if (nearestIdx !== -1) {
        let key = [i, nearestIdx].sort().join('-');
        if (!drawnPairs.has(key)) {
          drawnPairs.add(key);
          let bc = freeShapes[nearestIdx].getCenter();
          p.line(ac.x, ac.y, bc.x, bc.y);
        }
      }
    }
    p.pop();

    for (let s of shapes) {
      s.update();
      s.draw();
    }
  };

  p.mousePressed = function () {
    let m = getLocalMouse();
    for (let s of shapes) {
      if (s.contains(m.x, m.y)) {
        s.startDrag();
        break;
      }
    }
  };

  p.mouseReleased = function () {
    for (let s of shapes) {
      if (s.dragging) {
        s.dragging = false;
        s.trySnap(register);
      }
    }
  };
};

// Instanciación: 'contenedor-shapes-2' es el id del div donde va este canvas
new p5(Memoria, 'memoria');
