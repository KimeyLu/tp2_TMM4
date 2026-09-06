const sketchIdentidad = (p) => {
 
  // ------ constantes / configuración (ahora relativas) ------
  // lineY ahora es height/2, pero ajustado para que quede en la mitad inferior
  const lineYRatio = 0.5; // 50% del height
  const squareSizeRatio = 0.06; // 6% del width
  const lineSpeedRatio = 0.005; // 0.5% del width por frame
  const leaveSpeedRatio = 0.005; // 0.5% del width por frame
  const maxLineShapes = 10;
  const spawnDelay = 2000;   // tiempo en ms (no necesita ser relativo)
  const spawnInterval = 500; // tiempo en ms (no necesita ser relativo)
  const collisionThresholdRatio = 0.3; // 30% del width
  
  const colorLine = '#121212';
  const colorIdentidad = '#970510';
  const bgColor = '#F0D583';
  
  // ------ estado ------
  let lineShapes = [];
  let freeShapes = [];
  let dragging = null;
  let shapeCounter = 0;
  let shapeVisible = false;
  let startTime = 0;
  let lastSpawnTime = 0;
  
  const ROTATION_ANGLE = p.radians(-43);
  
  // Variables que almacenan los valores calculados en tiempo real
  let lineY, squareSize, lineSpeed, leaveSpeed, collisionThreshold;
  let canvasWidth, canvasHeight;
  
  p.setup = function() {
    p.createCanvas(400, 400);
    updateDimensions();
    startTime = p.millis();
    lastSpawnTime = startTime;
  }
  
  p.windowResized = function() {
    const { w, h } = window.getCanvasTargetSize('identidad', 400, 400);
    p.resizeCanvas(w, h);
    updateDimensions();
  }
  
  function updateDimensions() {
    canvasWidth = p.width;
    canvasHeight = p.height;
    lineY = canvasHeight * lineYRatio;
    squareSize = canvasWidth * squareSizeRatio;
    lineSpeed = canvasWidth * lineSpeedRatio;
    leaveSpeed = canvasWidth * leaveSpeedRatio;
    collisionThreshold = canvasWidth * collisionThresholdRatio;
  }
  
  p.draw = function() {
    // Actualizar dimensiones por si acaso (por si no se llamó a windowResized)
    if (p.width !== canvasWidth || p.height !== canvasHeight) {
      updateDimensions();
    }
    
    p.background(bgColor);
 
    p.push();
    p.translate(p.width / 2, p.height / 2);
    p.rotate(ROTATION_ANGLE);
    p.translate(-p.width / 2, -p.height / 2);
    

    // línea
    p.stroke(colorLine);
    p.strokeWeight(p.width / 200);
    p.line(-p.width * 0.25, lineY, p.width * 1.25, lineY);
    
    drawShapes();
    p.push();
    p.noStroke();
    p.fill(bgColor);
    p.rect(0, 0, p.width, p.height/2);
    p.pop();
    ShapesWithIdentityMovement();
    
    if (dragging) {
      drawShape(dragging);
    }
    
    p.pop();
  }
  
  function toLocalCoords(x, y) {
    let cx = p.width / 2, cy = p.height / 2;
    let dx = x - cx, dy = y - cy;
    let cosA = Math.cos(-ROTATION_ANGLE), sinA = Math.sin(-ROTATION_ANGLE);
    return {
      x: dx * cosA - dy * sinA + cx,
      y: dx * sinA + dy * cosA + cy
    };
  }
  
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
      
      if (shape.x - shape.size / 2 > p.width * 1.5) {
        lineShapes.splice(i, 1);
        continue;
      }
      drawShape(shape);
    }
  }
  
  function addNewLineShape() {
    lineShapes.push({
      id: shapeCounter++,
      x: -p.width * 0.2,
      y: lineY,
      size: squareSize,
      kind: 'square',
      color: colorLine
    });
  }
  
  function ShapesWithIdentityMovement() {
    for (let i = freeShapes.length - 1; i >= 0; i--) {
      let shape = freeShapes[i];
      
      if (shape.state === 'leaving') {
        shape.x -= leaveSpeed;
        if (shape.x + shape.size < -p.width * 0.5) {
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
  
  function mouseInsideCanvas() {
    return p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;
  }
  
  p.mousePressed = () => {
    if (!mouseInsideCanvas()) return;
    
    let local = toLocalCoords(p.mouseX, p.mouseY);
    
    for (let i = lineShapes.length - 1; i >= 0; i--) {
      if (isOverShape(local.x, local.y, lineShapes[i])) {
        dragging = lineShapes[i];
        dragging.fromLine = true;
        lineShapes.splice(i, 1);
        return;
      }
    }
    
    for (let i = freeShapes.length - 1; i >= 0; i--) {
      if (freeShapes[i].state === 'still' && isOverShape(local.x, local.y, freeShapes[i])) {
        dragging = freeShapes[i];
        dragging.fromLine = false;
        freeShapes.splice(i, 1);
        return;
      }
    }
  }
  
  p.mouseDragged = function() {
    if (dragging) {
      let local = toLocalCoords(p.mouseX, p.mouseY);
      dragging.x = local.x;
      dragging.y = local.y;
    }
  }
  
  p.mouseReleased = function() {
    if (!dragging) return;
    
    const droppedOnLine = Math.abs(dragging.y - lineY) < dragging.size;
    
    if (droppedOnLine) {
      dragging.kind = 'square';
      dragging.size = squareSize;
      dragging.color = colorLine;
      dragging.y = lineY;
      delete dragging.state;
      delete dragging.fromLine;
      lineShapes.push(dragging);
    } else {
      dragging.kind = dragging.fromLine ? randomKind() : dragging.kind;
      dragging.size = squareSize;
      dragging.color = colorIdentidad;
      delete dragging.fromLine;
      
      let colisiones = [];
      for (let i = freeShapes.length - 1; i >= 0; i--) {
        let s = freeShapes[i];
        if (s.state === 'still' && p.dist(dragging.x, dragging.y, s.x, s.y) < collisionThreshold) {
          colisiones.push(s);
          freeShapes.splice(i, 1);
        }
      }
      
      if (colisiones.length > 0) {
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
