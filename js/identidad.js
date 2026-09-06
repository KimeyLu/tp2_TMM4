const sketchIdentidad = (p) => {
 
  // ------ Constantes relativas ------
  const lineYRatio = 0.25;       
  const dividerYRatio = 0.5;     
  const newLineYRatio = 0.75;    
  
  const squareSizeRatio = 0.06;
  const lineSpeedRatio = 0.0015; 
  const leaveSpeedRatio = 0.0015; 
  
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
    
    for (let x = 1.5; x >= -0.2; x -= shapeSpacing) {
      lineShapes.push(createShape(x, lineYRatio, 'square', colorLine));
    }
  }
  
  p.windowResized = function() {
    const { w, h } = window.getCanvasTargetSize('identidad', 400, 400);
    p.resizeCanvas(w, h);
    updateDimensions();
  }
  
  function updateDimensions() {
    canvasWidth = p.width;
    canvasHeight = p.height;
  }
  
  function createShape(relX, relY, kind, color) {
    return {
      id: shapeCounter++,
      relX: relX,
      relY: relY,
      kind: kind,
      color: color,
      transformed: false,
      scaleMultiplier: 1.0, 
      angle: 0,             
      // Identidad oculta que se mantiene siempre para esta figura
      hiddenKind: randomKind(),       
      hiddenAngle: p.random(-0.5, 0.5) // Rotación fija aleatoria
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
    
    // 2. Nueva línea de identidad (abajo)
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
      shape.relX += lineSpeedRatio; 
      
      if (shape.relX > 1.5) {
        lineShapes.splice(i, 1);
        continue;
      }
      drawShapeRelative(shape);
    }
    
    let leftmostShape = lineShapes[lineShapes.length - 1];
    if (!leftmostShape || leftmostShape.relX >= -0.2 + shapeSpacing) {
      lineShapes.push(createShape(-0.2, lineYRatio, 'square', colorLine));
    }
    
    // ---- FIGURAS LIBRES (ABAJO) ----
    for (let i = freeShapes.length - 1; i >= 0; i--) {
      let shape = freeShapes[i];
      
      if (shape.state === 'leaving_backwards') {
        shape.relX -= leaveSpeedRatio;
        
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
    
    let absX = shape.relX * canvasWidth;
    let absY = shape.relY * canvasHeight;
    let s = (canvasWidth * squareSizeRatio) * shape.scaleMultiplier;
    
    p.translate(absX, absY);
    p.rotate(shape.angle); 
    
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
      
      dragging.relX = local.x / canvasWidth;
      dragging.relY = local.y / canvasHeight;
      
      // Umbral para transformarse: apenas un poco por debajo de la línea original
      let pullThreshold = lineYRatio + 0.05; 
      
      // Se despega de la línea: adopta su identidad oculta
      if (dragging.fromLine && dragging.relY > pullThreshold && !dragging.transformed) {
        dragging.kind = dragging.hiddenKind;
        dragging.color = colorIdentidad;
        dragging.transformed = true;
        dragging.scaleMultiplier = 1.25; 
        dragging.angle = dragging.hiddenAngle; // Adopta su rotación fija
      } 
      // Vuelve a la línea: recupera el formato uniforme
      else if (dragging.fromLine && dragging.relY <= pullThreshold && dragging.transformed) {
        dragging.kind = 'square';
        dragging.color = colorLine;
        dragging.transformed = false;
        dragging.scaleMultiplier = 1.0; 
        dragging.angle = 0;             
      }
    }
  }
  
  p.mouseReleased = function() {
    if (!dragging) return;
    
    // Si la soltás habiendo pasado la mitad de la pantalla
    if (dragging.relY > dividerYRatio) {
      dragging.relY = newLineYRatio;
      dragging.state = 'leaving_backwards';
      delete dragging.fromLine;
      
      // Aseguramos que muestre su identidad (por si el movimiento fue muy brusco)
      dragging.kind = dragging.hiddenKind;
      dragging.color = colorIdentidad;
      dragging.scaleMultiplier = 1.25;
      dragging.angle = dragging.hiddenAngle;
      
      freeShapes.push(dragging);
    } 
    // Si la soltás antes de la mitad, vuelve al rebaño original
    else {
      dragging.kind = 'square';
      dragging.color = colorLine;
      dragging.relY = lineYRatio;
      dragging.transformed = false;
      dragging.scaleMultiplier = 1.0;
      dragging.angle = 0;
      delete dragging.state;
      delete dragging.fromLine;
      
      // Como devolvemos el MISMO objeto al array, conserva sus propiedades "hidden"
      lineShapes.push(dragging);
    }
    
    dragging = null;
  }
};
 
new p5(sketchIdentidad, 'identidad');
