const sketchIdentidad = (p) => {
 
  // ------ constantes / configuración ------
  // Definimos 3 alturas relativas para las distintas zonas
  const lineYRatio = 0.25;       // 25% (Arriba: camino original)
  const dividerYRatio = 0.5;     // 50% (Medio: frontera punteada)
  const newLineYRatio = 0.75;    // 75% (Abajo: camino de identidad propia)
  
  const squareSizeRatio = 0.06;
  const lineSpeedRatio = 0.005;
  const leaveSpeedRatio = 0.005;
  const maxLineShapes = 10;
  const spawnDelay = 2000;
  const spawnInterval = 500;
  
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
  let lineY, dividerY, newLineY, squareSize, lineSpeed, leaveSpeed;
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
    
    // Asignamos las alturas de las 3 líneas
    lineY = canvasHeight * lineYRatio;
    dividerY = canvasHeight * dividerYRatio;
    newLineY = canvasHeight * newLineYRatio;
    
    squareSize = canvasWidth * squareSizeRatio;
    lineSpeed = canvasWidth * lineSpeedRatio;
    leaveSpeed = canvasWidth * leaveSpeedRatio;
  }
  
  p.draw = function() {
    if (p.width !== canvasWidth || p.height !== canvasHeight) {
      updateDimensions();
    }
    
    p.background(bgColor);
 
    p.push();
    p.translate(p.width / 2, p.height / 2);
    p.rotate(ROTATION_ANGLE);
    p.translate(-p.width / 2, -p.height / 2);
    
    // 1. Línea original (arriba)
    p.stroke(colorLine);
    p.strokeWeight(p.width / 200);
    p.line(-p.width * 0.5, lineY, p.width * 1.5, lineY);
    
    // 2. Línea divisoria (centro, punteada)
    p.strokeWeight(1.5);
    p.drawingContext.setLineDash([8, 8]); // Estilo punteado
    p.line(-p.width * 0.5, dividerY, p.width * 1.5, dividerY);
    p.drawingContext.setLineDash([]); // Reseteamos para que no afecte lo demás
    
    // 3. Nueva línea de identidad (abajo, roja)
    p.stroke(colorIdentidad);
    p.strokeWeight(p.width / 200);
    p.line(-p.width * 0.5, newLineY, p.width * 1.5, newLineY);
    
    drawShapes();
    ShapesWithIdentityMovement();
    
    if (dragging) {
      drawRandomShape(dragging);
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
      shape.x += lineSpeed; // Avanzan hacia adelante
      
      if (shape.x - shape.size / 2 > p.width * 1.5) {
        lineShapes.splice(i, 1);
        continue;
      }
      drawRandomShape(shape);
    }
  }
  
  function addNewLineShape() {
    lineShapes.push({
      id: shapeCounter++,
      x: -p.width * 0.2,
      y: lineY,
      size: squareSize,
      kind: 'square',
      color: colorLine,
      transformed: false
    });
  }
  
  function ShapesWithIdentityMovement() {
    for (let i = freeShapes.length - 1; i >= 0; i--) {
      let shape = freeShapes[i];
      
      if (shape.state === 'leaving_backwards') {
        shape.x -= leaveSpeed; // Se mueven a contracorriente
        // Si salen por completo de la pantalla por el lado izquierdo, se borran
        if (shape.x + shape.size < -p.width * 0.5) {
          freeShapes.splice(i, 1);
          continue;
        }
      }
      drawRandomShape(shape);
    }
  }
  
  function drawRandomShape(shape) {
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
    
    // Solo permitimos agarrar figuras de la línea superior
    for (let i = lineShapes.length - 1; i >= 0; i--) {
      if (isOverShape(local.x, local.y, lineShapes[i])) {
        dragging = lineShapes[i];
        dragging.fromLine = true;
        lineShapes.splice(i, 1);
        return;
      }
    }
  }
  
  p.mouseDragged = function() {
    if (dragging) {
      let local = toLocalCoords(p.mouseX, p.mouseY);
      dragging.x = local.x;
      dragging.y = local.y;
      
      // Feedback en tiempo real: Si cruza la frontera, se transforma
      if (dragging.fromLine && dragging.y > dividerY && !dragging.transformed) {
        dragging.kind = randomKind();
        dragging.color = colorIdentidad;
        dragging.transformed = true;
      } 
      // Si se arrepiente y vuelve arriba antes de soltar, vuelve a ser cuadrado
      else if (dragging.fromLine && dragging.y <= dividerY && dragging.transformed) {
        dragging.kind = 'square';
        dragging.color = colorLine;
        dragging.transformed = false;
      }
    }
  }
  
  p.mouseReleased = function() {
    if (!dragging) return;
    
    // Si la soltamos en la zona inferior (más allá del límite)
    if (dragging.y > dividerY) {
      dragging.y = newLineY; // Se acopla al nuevo camino
      dragging.state = 'leaving_backwards';
      delete dragging.fromLine;
      freeShapes.push(dragging);
    } 
    // Si la soltamos en la zona superior (no cruzó o se arrepintió)
    else {
      dragging.kind = 'square';
      dragging.color = colorLine;
      dragging.y = lineY;
      dragging.transformed = false;
      delete dragging.state;
      delete dragging.fromLine;
      lineShapes.push(dragging);
    }
    
    dragging = null;
  }
};
 
new p5(sketchIdentidad, 'identidad');
