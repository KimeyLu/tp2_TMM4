const sketchIdentidad = (p) => {

  // ------ Constantes relativas ------
  // Varias hileras de cuadrados en la parte superior (antes había una sola).
  // Podés sumar o sacar valores de este array para cambiar la cantidad de hileras.
  const ROW_Y_RATIOS = [0.12, 0.22, 0.32];

  const dividerYRatio = 0.5;   // única línea divisoria (antes había dos líneas)
  const restYRatio = 0.72;     // donde "descansan" las figuras ya transformadas, debajo de la línea

  const squareSizeRatio = 0.085; // más grandes que antes (era 0.06)
  const lineSpeedRatio = 0.0015;
  const leaveSpeedRatio = 0.0018;

  const shapeSpacing = 0.2; // espaciado horizontal dentro de cada hilera (subido por el tamaño mayor)

  const colorLine = '#121212';
  const colorIdentidad = '#970510';
  const bgColor = '#F0D583';

  // ------ Estado ------
  // Una hilera por cada valor de ROW_Y_RATIOS, para poder reponer cada una
  // de forma independiente (si no, se generaría un enganche entre hileras).
  let lineShapesByRow = [];
  let freeShapes = [];
  let dragging = null;
  let shapeCounter = 0;

  const ROTATION_ANGLE = p.radians(-43);
  let canvasWidth, canvasHeight;

  p.setup = function() {
    p.createCanvas(400, 400);
    updateDimensions();

    lineShapesByRow = ROW_Y_RATIOS.map((rowY, rowIndex) => {
      const row = [];
      // Pequeño desfasaje por hilera para que no arranquen todas alineadas
      // verticalmente (se ve más orgánico, menos "grilla").
      const xOffset = (rowIndex % 2) * (shapeSpacing / 2);
      for (let x = 1.5 + xOffset; x >= -0.2; x -= shapeSpacing) {
        row.push(createShape(x, rowY, 'square', colorLine));
      }
      return row;
    });
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

    // Única línea divisoria negra, igual que en colaboración / empatía
    p.stroke(colorLine);
    p.strokeWeight(p.width * 0.015);
    let dividerY = canvasHeight * dividerYRatio;
    p.line(-p.width * 0.5, dividerY, p.width * 1.5, dividerY);

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
    // ---- HILERAS DE CUADRADOS (ARRIBA) ----
    for (let r = 0; r < lineShapesByRow.length; r++) {
      const row = lineShapesByRow[r];

      for (let i = row.length - 1; i >= 0; i--) {
        let shape = row[i];
        shape.relX += lineSpeedRatio;

        if (shape.relX > 1.5) {
          row.splice(i, 1);
          continue;
        }
        drawShapeRelative(shape);
      }

      let leftmostShape = row[row.length - 1];
      if (!leftmostShape || leftmostShape.relX >= -0.2 + shapeSpacing) {
        row.push(createShape(-0.2, ROW_Y_RATIOS[r], 'square', colorLine));
      }
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

    for (let r = 0; r < lineShapesByRow.length; r++) {
      const row = lineShapesByRow[r];
      for (let i = row.length - 1; i >= 0; i--) {
        if (isOverShape(local.x, local.y, row[i])) {
          dragging = row[i];
          dragging.fromLine = true;
          dragging.sourceRow = r; // para saber a qué hilera devolverla si no cruza
          row.splice(i, 1);
          return;
        }
      }
    }
  }

  p.mouseDragged = function() {
    if (dragging) {
      let local = toLocalCoords(p.mouseX, p.mouseY);

      dragging.relX = local.x / canvasWidth;
      dragging.relY = local.y / canvasHeight;

      // El umbral de transformación ahora es la línea divisoria única
      let pullThreshold = dividerYRatio;

      // Cruza la línea hacia abajo: adopta su identidad oculta
      if (dragging.fromLine && dragging.relY > pullThreshold && !dragging.transformed) {
        dragging.kind = dragging.hiddenKind;
        dragging.color = colorIdentidad;
        dragging.transformed = true;
        dragging.scaleMultiplier = 1.25;
        dragging.angle = dragging.hiddenAngle; // Adopta su rotación fija
      }
      // Vuelve a cruzar hacia arriba: recupera el formato uniforme
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

    // Si la soltás habiendo cruzado la línea divisoria
    if (dragging.relY > dividerYRatio) {
      dragging.relY = restYRatio;
      dragging.state = 'leaving_backwards'; // se desplaza en dirección contraria a las de arriba
      delete dragging.fromLine;
      delete dragging.sourceRow;

      // Aseguramos que muestre su identidad (por si el movimiento fue muy brusco)
      dragging.kind = dragging.hiddenKind;
      dragging.color = colorIdentidad;
      dragging.scaleMultiplier = 1.25;
      dragging.angle = dragging.hiddenAngle;

      freeShapes.push(dragging);
    }
    // Si la soltás antes de cruzar, vuelve a su hilera original
    else {
      dragging.kind = 'square';
      dragging.color = colorLine;
      dragging.relY = ROW_Y_RATIOS[dragging.sourceRow] ?? ROW_Y_RATIOS[0];
      dragging.transformed = false;
      dragging.scaleMultiplier = 1.0;
      dragging.angle = 0;
      delete dragging.state;
      delete dragging.fromLine;

      // Como devolvemos el MISMO objeto al array, conserva sus propiedades "hidden"
      const targetRow = lineShapesByRow[dragging.sourceRow] ?? lineShapesByRow[0];
      delete dragging.sourceRow;
      targetRow.push(dragging);
    }

    dragging = null;
  }
};

new p5(sketchIdentidad, 'identidad');
