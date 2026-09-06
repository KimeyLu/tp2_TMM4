const sketchIdentidad = (p) => {
 
  // ------ Constantes relativas ------
  const lineYRatio = 0.25;       // 25% (Arriba: camino original)
  const dividerYRatio = 0.5;     // 50% (Umbral invisible)
  const newLineYRatio = 0.75;    // 75% (Abajo: camino de identidad propia)
  
  const squareSizeRatio = 0.06;
  const lineSpeedRatio = 0.0015; // Velocidad pausada
  const leaveSpeedRatio = 0.0015; // Velocidad pausada
  
  // Distancia constante entre los cuadrados (15% del ancho del canvas)
  const shapeSpacing = 0.15; 
  
  const colorLine = '#121212';
  const colorIdentidad = '#970510';
  const bgColor = '#F0D583';
  
  // ------ Estado ------
  let lineShapes = [];
  let freeShapes = [];
  let dragging = null;
  let shapeCounter = 0;
  
  const ROTATION_ANGLE = p.radians(-43);
  let canvasWidth, canvasHeight;
  
  p.setup = function() {
    p.createCanvas(400, 400);
    updateDimensions();
    
    // Pre-poblar la línea con cuadrados para que ya estén todos desde el principio.
    // Recorremos de derecha a izquierda para que el último del array sea el que
    // está más a la izquierda, permitiendo controlar cuándo generar el siguiente.
    for (let x = 1.5; x >= -0.2; x -= shapeSpacing) {
      lineShapes.push(createShape(x, lineYRatio, 'square', colorLine));
    }
  }
  
  p.windowResized = function() {
    const { w, h } = window.getCanvasTargetSize('identidad', 400, 400);
    p.resizeCanvas(w, h);
    updateDimensions();
    // Ya no necesitamos reescalar manualmente 'x' porque todo es relativo (relX, relY)
  }
  
  function updateDimensions() {
    canvasWidth = p.width;
    canvasHeight = p.height;
  }
  
  // Función para crear formas usando posiciones relativas (0.0 a 1.0)
  function createShape(relX, relY, kind, color) {
    return {
      id: shapeCounter++,
      relX: relX,
      relY: relY,
      kind: kind,
      color: color,
      transformed: false
    };
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
    let lineY = canvasHeight * lineYRatio;
    p.stroke(colorLine);
    p.strokeWeight(p.width / 200);
    p.line(-p.width * 0.5, lineY, p.width * 1.5, lineY);
    
    // 2. Nueva línea de identidad (abajo, roja)
    let newLineY = canvasHeight * newLineYRatio;
    p.stroke(colorIdentidad);
    p.strokeWeight(p.width / 200);
    p.line(-p.width * 0.5, newLineY, p.width * 1.5, newLineY);
    
    updateAndDrawShapes();
    
    if (dragging) {
      drawShapeRelative(dragging);
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
  
  function updateAndDrawShapes() {
    // ---- FIGURAS DE LA LÍNEA SUPERIOR ----
    for (let i = lineShapes.length - 1; i >= 0; i--) {
      let shape = lineShapes[i];
      shape.relX += lineSpeedRatio; // Avance por porcentaje, no por píxeles
      
      // Si se pasa del límite derecho, se elimina
      if (shape.relX > 1.5) {
        lineShapes.splice(i, 1);
        continue;
      }
      drawShapeRelative(shape);
    }
    
    // Generar un nuevo cuadrado a la izquierda solo si el último liberó espacio
    let leftmostShape = lineShapes[lineShapes.length - 1];
    if (!leftmostShape || leftmostShape.relX >= -0.2 + shapeSpacing) {
      lineShapes.push(createShape(-0.2, lineYRatio, 'square', colorLine));
    }
    
    // ---- FIGURAS LIBRES (ABAJO) ----
    for (let i = freeShapes.length - 1; i >= 0; i--) {
      let shape = freeShapes[i];
      
      if (shape.state === 'leaving_backwards') {
        shape.relX -= leaveSpeedRatio;
        // Si sale del límite izquierdo, se elimina
        if (shape.relX < -0.5) {
          freeShapes.splice(i, 1);
          continue;
        }
      }
      drawShapeRelative(shape);
    }
  }
  
  function drawShapeRelative(shape) {
    p.push();
    p.noStroke();
    p.fill(shape.color);
    
    // Convertir de posición relativa a píxeles exactos en el frame actual
    let absX = shape.relX * canvasWidth;
    let absY = shape.relY * canvasHeight;
    let s = canvasWidth * squareSizeRatio;
    
    p.translate(absX, absY);
    
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
  
  // Detección de mouse usando el cálculo relativo
  function isOverShape(absX, absY, shape) {
    let shapeAbsX = shape.relX * canvasWidth;
    let shapeAbsY = shape.relY * canvasHeight;
    let half = (canvasWidth * squareSizeRatio) / 2;
    
    return absX > shapeAbsX - half && absX < shapeAbsX + half &&
           absY > shapeAbsY - half && absY < shapeAbsY + half;
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
  }
  
  p.mouseDragged = function() {
    if (dragging) {
      let local = toLocalCoords(p.mouseX, p.mouseY);
      
      // Actualizar posición arrastrando basándose en porcentajes
      dragging.relX = local.x / canvasWidth;
      dragging.relY = local.y / canvasHeight;
      
      if (dragging.fromLine && dragging.relY > dividerYRatio && !dragging.transformed) {
        dragging.kind = randomKind();
        dragging.color = colorIdentidad;
        dragging.transformed = true;
      } else if (dragging.fromLine && dragging.relY <= dividerYRatio && dragging.transformed) {
        dragging.kind = 'square';
        dragging.color = colorLine;
        dragging.transformed = false;
      }
    }
  }
  
  p.mouseReleased = function() {
    if (!dragging) return;
    
    if (dragging.relY > dividerYRatio) {
      dragging.relY = newLineYRatio;
      dragging.state = 'leaving_backwards';
      delete dragging.fromLine;
      freeShapes.push(dragging);
    } else {
      dragging.kind = 'square';
      dragging.color = colorLine;
      dragging.relY = lineYRatio;
      dragging.transformed = false;
      delete dragging.state;
      delete dragging.fromLine;
      lineShapes.push(dragging);
    }
    
    dragging = null;
  }
};
 
new p5(sketchIdentidad, 'identidad');
