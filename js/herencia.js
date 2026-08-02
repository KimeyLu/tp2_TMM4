const Herencia = (p) => {

  const COLORS = ['#F0D583', '#121212'];
  const TYPES = ['rect', 'circle', 'triangle'];

  // Math.PI es JS nativo -> no lleva "p."
  const ROTATION_ANGLE = Math.PI / 4;

  let shapes = [];
  let dragging = null;
  let offsetX = 0, offsetY = 0;

  function screenToLocal(sx, sy) {
    let cx = p.width / 2;
    let cy = p.height / 2;
    let dx = sx - cx;
    let dy = sy - cy;
    let cosT = p.cos(-ROTATION_ANGLE);
    let sinT = p.sin(-ROTATION_ANGLE);
    return {
      x: cx + dx * cosT - dy * sinT,
      y: cy + dx * sinT + dy * cosT
    };
  }

  p.setup = function () {
    let canvas = p.createCanvas(510, 505);
    //canvas.parent(document.body); // sacar estas cosas
    spawnShapes();
  };

  function spawnShapes() {
    shapes = [];
    let positions = [
      [40, 220], [270, 210], [440, 230],
      [150, 270], [350, 290], [530, 230]
    ];
    // OJO: renombré la variable de loop "p" -> "pos", porque "p" ya es
    // el nombre de la instancia y la taparía (shadowing) dentro del for.
    for (let pos of positions) {
      shapes.push(makeShape(pos[0], pos[1]));
    }
  }

  function makeShape(x, y) {
    return {
      x: x,
      y: y,
      type: p.random(TYPES),
      color: p.random(COLORS),
      size: 40,
      rotation: p.random(p.TWO_PI),
      floatPhaseX: p.random(p.TWO_PI),
      floatPhaseY: p.random(p.TWO_PI),
      floatSpeedX: p.random(0.01, 0.025),
      floatSpeedY: p.random(0.01, 0.025),
      floatAmp: p.random(6, 14)
    };
  }

  function getRenderPos(s) {
    if (s === dragging) {
      return { x: s.x, y: s.y };
    }
    let fx = s.x + p.sin(p.frameCount * s.floatSpeedX + s.floatPhaseX) * s.floatAmp;
    let fy = s.y + p.cos(p.frameCount * s.floatSpeedY + s.floatPhaseY) * s.floatAmp;
    return { x: fx, y: fy };
  }

  function applySeparation() {
    let margin = 14;
    for (let i = 0; i < shapes.length; i++) {
      let a = shapes[i];
      if (a.fleeing) continue;
      for (let j = i + 1; j < shapes.length; j++) {
        let b = shapes[j];
        if (b.fleeing) continue;
        if (a === dragging || b === dragging) continue;
        let pa = getRenderPos(a);
        let pb = getRenderPos(b);
        let d = p.dist(pa.x, pa.y, pb.x, pb.y);
        let minDist = (a.size + b.size) / 2 + margin;
        if (d > 0 && d < minDist) {
          let overlap = minDist - d;
          let angle = p.atan2(pb.y - pa.y, pb.x - pa.x);
          let push_ = overlap / 2; // renombrado: "push" choca con p.push()
          if (a !== dragging) {
            a.x -= p.cos(angle) * push_;
            a.y -= p.sin(angle) * push_;
          }
          if (b !== dragging) {
            b.x += p.cos(angle) * push_;
            b.y += p.sin(angle) * push_;
          }
        }
      }
    }
    for (let s of shapes) {
      if (s !== dragging && !s.fleeing) {
        s.x = p.constrain(s.x, s.size / 2, p.width - s.size / 2);
        s.y = p.constrain(s.y, s.size / 2, p.height - s.size / 2);
      }
    }
  }

  let rectY = 0;
  let spacing = 40;
  let squareSize = 30;

  p.draw = function () {
    p.background('#970510');

    p.push();
    p.translate(p.width / 2, p.height / 2);
    p.rotate(ROTATION_ANGLE);
    p.translate(-p.width / 2, -p.height / 2);

    let count = p.ceil(p.height / spacing) + 1;

    for (let i = 0; i < count; i++) {
      let y = ((i * spacing + rectY) % (p.height + spacing)) - spacing;

      p.push();
        p.fill('#F0D583');
        p.noStroke();
        p.rect(p.width / 7, y, squareSize, squareSize);
        p.rect(p.width / 1.2, y, squareSize, squareSize);
      p.pop();
    }

    rectY++;

    for (let i = shapes.length - 1; i >= 0; i--) {
      let s = shapes[i];
      if (s.fleeing) {
        s.x -= 4;
        if (s.x < -s.size) {
          shapes.splice(i, 1);
          continue;
        }
      }
    }

    applySeparation();

    if (dragging) {
      let pa = getRenderPos(dragging);
      let closest = null;
      let closestDist = Infinity;
      for (let s of shapes) {
        if (s === dragging || s.fleeing) continue;
        let ps = getRenderPos(s);
        let d = p.dist(pa.x, pa.y, ps.x, ps.y);
        if (d < closestDist) {
          closestDist = d;
          closest = s;
        }
      }
      if (closest) {
        let pb = getRenderPos(closest);
        p.stroke('#111111');
        p.strokeWeight(2);
        p.line(pa.x, pa.y, pb.x, pb.y);
        p.noStroke();
      }
    }

    // OJO: renombré "p" -> "pos" acá también (era "let p = getRenderPos(s)")
    for (let s of shapes) {
      let pos = getRenderPos(s);
      p.push();
      p.translate(pos.x, pos.y);
      p.rotate(s.rotation);
      p.noStroke();
      p.fill(s.color);
      drawShape(s);
      p.pop();
    }

    if (shapes.length === 0) {
      p.fill(80);
      p.noStroke();
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(18);
      p.text('¡Chocaron y desaparecieron! Click para generar de nuevo.', p.width / 2, p.height / 2);
    }

    p.pop();
  };

  function drawShape(s) {
    if (s.type === 'circle') {
      p.circle(0, 0, s.size);
    } else if (s.type === 'rect') {
      p.rectMode(p.CENTER);
      p.rect(0, 0, s.size, s.size);
    } else if (s.type === 'triangle') {
      let h = s.size;
      p.triangle(0, -h / 1.6, -h / 1.6, h / 1.8, h / 1.6, h / 1.8);
    }
  }

  p.mousePressed = function () {
    if (shapes.length === 0) {
      spawnShapes();
      return;
    }
    let local = screenToLocal(p.mouseX, p.mouseY);
    for (let i = shapes.length - 1; i >= 0; i--) {
      let s = shapes[i];
      let pos = getRenderPos(s);
      if (p.dist(local.x, local.y, pos.x, pos.y) < s.size / 1.6) {
        dragging = s;
        offsetX = pos.x - local.x;
        offsetY = pos.y - local.y;
        break;
      }
    }
  };

  p.mouseDragged = function () {
    if (dragging) {
      let local = screenToLocal(p.mouseX, p.mouseY);
      dragging.x = local.x + offsetX;
      dragging.y = local.y + offsetY;
    }
  };

  p.mouseReleased = function () {
    if (dragging) {
      let a = dragging;
      let pa = getRenderPos(a);
      for (let i = 0; i < shapes.length; i++) {
        let b = shapes[i];
        if (b === a) continue;
        let pb = getRenderPos(b);
        let d = p.dist(pa.x, pa.y, pb.x, pb.y);
        let threshold = (a.size + b.size) / 2.6;
        if (d < threshold) {
          let cx = (a.x + b.x) / 2;
          let cy = (a.y + b.y) / 2;
          let child1 = makeOffspring(a, b, cx - 60, cy);
          let child2 = makeOffspring(a, b, cx, cy);
          let child3 = makeOffspring(a, b, cx + 60, cy);
          shapes = shapes.filter(s => s !== a && s !== b);
          shapes.push(child1, child2, child3);

          let bystanders = shapes.filter(s => !s.fleeing && s !== child1 && s !== child2 && s !== child3);
          if (bystanders.length > 0) {
            p.random(bystanders).fleeing = true;
          }
          break;
        }
      }
    }
    dragging = null;
  };

  function makeOffspring(a, b, x, y) {
    return {
      x: p.constrain(x, 60, p.width - 60),
      y: p.constrain(y, 60, p.height - 60),
      type: p.random() < 0.5 ? a.type : b.type,
      color: p.random() < 0.5 ? a.color : b.color,
      size: 40,
      rotation: p.random(p.TWO_PI),
      floatPhaseX: p.random(p.TWO_PI),
      floatPhaseY: p.random(p.TWO_PI),
      floatSpeedX: p.random(0.01, 0.025),
      floatSpeedY: p.random(0.01, 0.025),
      floatAmp: p.random(6, 14)
    };
  }
};

// 
new p5(Herencia, 'herencia');
