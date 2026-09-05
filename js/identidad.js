const sketchIdentidad = (p) => {
 
  // ------ constantes / configuración ------
  const lineY = 200;
  const squareSize = 24;
  const lineSpeed = 2;
  const leaveSpeed = 2;
  const maxLineShapes = 5;
  const spawnDelay = 2000;   // antes de la primera forma
  const spawnInterval = 1000; // cada cuánto aparece una nueva
  const collisionThreshold = squareSize * 5;
 
  const colorLine = '#121212';
  const colorIdentidad = '#970510';
  const bgColor = '#F0D583';
 
  // ------ estado ------
  let lineShapes = [];   // cuadrados que avanzan sobre la línea
  let freeShapes = [];   // formas ya sueltas del lado, quietas o yéndose
  let dragging = null;   // forma que se está arrastrando actualmente
  let shapeCounter = 0;
  let shapeVisible = false;
  let startTime = 0;
  let lastSpawnTime = 0;
 
  p.setup = function() {
    p.createCanvas(400, 400);
    startTime = p.millis();
    lastSpawnTime = startTime;
  }
 
  p.draw = function() {
    p.background(bgColor);
 
    // línea
    p.stroke(colorLine);
    p.strokeWeight(2);
    p.line(-100, lineY, p.width + 100, lineY);
 
    drawShapes();
    ShapesWithIdentityMovement();
 
    // la forma que se está arrastrando se dibuja al final, arriba de todo
    if (dragging) {
      drawShape(dragging);
    }
  }
 
  // --- cuadrados generándose/avanzando/eliminándose sobre la línea ---
  function drawShapes() {
    let currentTime = p.millis();
 
    if (!shapeVisible && currentTime - startTime >= spawnDelay) {
      shapeVisible = true;
      addNewLineShape();
      lastSpawnTime = currentTime;
    }
 
    if (shapeVisible && currentTime - lastSpawnTime >= spawnInterval) {
      if (lineShapes.length >= maxLineShapes) {
        lineShapes.shift();
      }
      addNewLineShape();
      lastSpawnTime = currentTime;
    }
 
    for (let i = lineShapes.length - 1; i >= 0; i--) {
      let shape = lineShapes[i];
      shape.x += lineSpeed;
 
      // si se pasa del canvas, se elimina (el timer ya se encarga de generar nuevos)
      if (shape.x - shape.size / 2 > p.width) {
        lineShapes.splice(i, 1);
        continue;
      }
      drawShape(shape);
    }
  }
 
  function addNewLineShape() {
    lineShapes.push({
      id: shapeCounter++,
      x: -squareSize / 2,
      y: lineY,
      size: squareSize,
      kind: 'square',
      color: colorLine
    });
  }
 
  // --- formas con identidad: quietas o volviendo al inicio para desaparecer ---
  function ShapesWithIdentityMovement() {
    for (let i = freeShapes.length - 1; i >= 0; i--) {
      let shape = freeShapes[i];
 
      if (shape.state === 'leaving') {
        shape.x -= leaveSpeed;
        if (shape.x + shape.size < 0) {
          freeShapes.splice(i, 1);
          continue;
        }
      }
      drawShape(shape);
    }
  }
 
  function drawShape(shape) {
    p.push();
    p.noStroke();
    p.fill(shape.color);
    p.translate(shape.x, shape.y);
    const s = shape.size;
 
    if (shape.kind === 'circle') {
      p.ellipse(0, 0, s, s);
    } else if (shape.kind === 'triangle') {
      p.triangle(0, -s / 2, -s / 2, s / 2, s / 2, s / 2);
    } else {
      p.rectMode(p.CENTER);
      p.rect(0, 0, s, s);
    }
    p.pop();
  }
 
  function randomKind() {
    const kinds = ['square', 'circle', 'triangle'];
    return kinds[Math.floor(p.random(kinds.length))];
  }
 
  function isOverShape(mx, my, shape) {
    const half = shape.size / 2;
    return mx > shape.x - half && mx < shape.x + half &&
           my > shape.y - half && my < shape.y + half;
  }
 
  // --- interacción con mouse ---
  p.mousePressed = function() {
    // primero: ¿estamos agarrando un cuadrado de la línea?
    for (let i = lineShapes.length - 1; i >= 0; i--) {
      if (isOverShape(p.mouseX, p.mouseY, lineShapes[i])) {
        dragging = lineShapes[i];
        dragging.fromLine = true;
        lineShapes.splice(i, 1);
        return;
      }
    }
    // si no, ¿estamos agarrando una forma quieta ya soltada?
    for (let i = freeShapes.length - 1; i >= 0; i--) {
      if (freeShapes[i].state === 'still' && isOverShape(p.mouseX, p.mouseY, freeShapes[i])) {
        dragging = freeShapes[i];
        dragging.fromLine = false;
        freeShapes.splice(i, 1);
        return;
      }
    }
  }
 
  p.mouseDragged = function() {
    if (dragging) {
      dragging.x = p.mouseX;
      dragging.y = p.mouseY;
    }
  }
 
  p.mouseReleased = function() {
    if (!dragging) return;
 
    const droppedOnLine = Math.abs(dragging.y - lineY) < dragging.size;
 
    if (droppedOnLine) {
      // vuelve a ser un cuadrado normal y recorre la línea
      dragging.kind = 'square';
      dragging.size = squareSize;
      dragging.color = colorLine;
      dragging.y = lineY;
      delete dragging.state;
      delete dragging.fromLine;
      lineShapes.push(dragging);
    } else {
      // se convierte (o se mantiene, si ya era) en forma con identidad
      dragging.kind = dragging.fromLine ? randomKind() : dragging.kind;
      dragging.size = squareSize;
      dragging.color = colorIdentidad;
      delete dragging.fromLine;
 
      // ¿hay ya alguna forma quieta en ese espacio?
      let colisiones = [];
      for (let i = freeShapes.length - 1; i >= 0; i--) {
        let s = freeShapes[i];
        if (s.state === 'still' && p.dist(dragging.x, dragging.y, s.x, s.y) < collisionThreshold) {
          colisiones.push(s);
          freeShapes.splice(i, 1);
        }
      }
 
      if (colisiones.length > 0) {
        // la nueva y las que ya estaban se van hacia el inicio y desaparecen
        dragging.state = 'leaving';
        freeShapes.push(dragging);
        colisiones.forEach(s => {
          s.state = 'leaving';
          freeShapes.push(s);
        });
      } else {
        dragging.state = 'still';
        freeShapes.push(dragging);
      }
    }
 
    dragging = null;
  }
};
 
new p5(sketchIdentidad, 'identidad');
