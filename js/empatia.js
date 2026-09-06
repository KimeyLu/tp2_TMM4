const sketchEmpatia = (p) => {
  const BG = '#EFD583';
  const BLACK = '#141414';
  const RED = '#970511';

  const ROTATION_DEG = -43;
  let lineY;

  let blackShapes = [];
  let redShape = null;
  let draggingPt = null;

  // 'interact' -> interacción normal | 'exiting' -> deslizándose por la diagonal
  let phase = 'interact';
  const EXIT_SPEED = 2.4;
  const EXIT_LIMIT_X = 0; // se calcula en base al ancho al entrar en 'exiting'

  const BASE_CANVAS = 400;
  const BASE_BLACK_R = 24;
  const BASE_RED_R = 26;

  function scaledRadius(base) {
    // Siempre se calcula desde la base fija, nunca se multiplica
    // sobre un valor ya escalado (eso es lo que causaba el achique
    // acumulativo en cada resize/reinicio).
    return base * (p.width / BASE_CANVAS);
  }

  p.setup = () => {
    let container = document.getElementById('empatia');
    p.createCanvas(400, 400);
    lineY = p.height / 2;
    resetAll();
  };

  function getCornerLocal(marginPx) {
    // Convierte un punto cercano a la esquina inferior derecha DE PANTALLA
    // a coordenadas locales (antes de rotar), para que al dibujarse con la
    // rotación de -43° termine viéndose realmente en esa esquina visual.
    return toLocalCoords(p.width - marginPx, p.height - marginPx);
  }

  function resetAll() {
    blackShapes = [];
    phase = 'interact';

    // Figura roja solitaria cerca de la esquina inferior derecha (visual)
    const redR = scaledRadius(BASE_RED_R);
    const corner = getCornerLocal(redR + 20);
    redShape = {
      x: corner.x,
      y: corner.y,
      baseX: corner.x,
      baseY: corner.y,
      r: redR,
      shape: 'circle',
      settled: false,
      jitterX: 0,
      jitterY: 0
    };

    const shapes = ['circle', 'square', 'triangle'];
    for (let i = 0; i < 6; i++) {
      blackShapes.push({
        id: i,
        shape: shapes[i % shapes.length],
        r: scaledRadius(BASE_BLACK_R),
        x: p.random(p.width * 0.1, p.width * 0.4),
        y: p.random(p.height * 0.1, p.height * 0.35), // Del lado de arriba (y < lineY)
        vx: p.random(0.2, 0.4) * (p.random() > 0.5 ? 1 : -1),
        vy: p.random(0.2, 0.4) * (p.random() > 0.5 ? 1 : -1),
        rot: p.random(-0.3, 0.3),
        progress: 0,
        settled: false,
        originX: 0,
        originY: 0
      });
    }
  }

  p.windowResized = () => {
    const oldW = p.width;
    const oldH = p.height;
    const oldBaseX = redShape ? redShape.baseX : 0;
    const oldBaseY = redShape ? redShape.baseY : 0;
    const offsetX = redShape ? redShape.x - oldBaseX : 0;
    const offsetY = redShape ? redShape.y - oldBaseY : 0;

    let w = 400, h = 400;
    if (typeof window.getCanvasTargetSize === 'function') {
      const size = window.getCanvasTargetSize('empatia', 400, 400);
      if (size && size.w && size.h) {
        w = size.w;
        h = size.h;
      }
    }

    if (oldW > 0 && oldH > 0) {
      const scaleX = w / oldW;
      const scaleY = h / oldH;

      for (let pt of blackShapes) {
        pt.x *= scaleX;
        pt.y *= scaleY;
        pt.originX *= scaleX;
        pt.originY *= scaleY;
      }
    }

    p.resizeCanvas(w, h);
    lineY = p.height / 2;

    // Los tamaños se recalculan siempre desde la base fija (no se multiplican
    // sobre el valor anterior), para que no se vayan achicando con cada resize
    if (redShape) redShape.r = scaledRadius(BASE_RED_R);
    for (let pt of blackShapes) {
      pt.r = scaledRadius(BASE_BLACK_R);
    }

    // Aseguramos que ninguna quede fuera de su zona apenas cambia el tamaño
    for (let pt of blackShapes) {
      if (!pt.settled) {
        pt.x = p.constrain(pt.x, pt.r, p.width - pt.r);
        pt.y = p.constrain(pt.y, pt.r, lineY - pt.r);
      }
    }

    if (redShape) {
      const corner = getCornerLocal(redShape.r + 20);
      redShape.baseX = corner.x;
      redShape.baseY = corner.y;
      // Conserva el pequeño desplazamiento que tuviera (temblor, repulsión, etc.)
      redShape.x = corner.x + offsetX;
      redShape.y = corner.y + offsetY;
    }
  };

  p.draw = () => {
    p.background(BG);

    // Sistema de coordenadas rotado (-43 deg), idéntico al resto de los interactivos
    p.push();
    p.translate(p.width / 2, p.height / 2);
    p.rotate(p.radians(ROTATION_DEG));
    p.translate(-p.width / 2, -p.height / 2);

    // Línea divisoria central con la inclinación correcta
    p.stroke(BLACK);
    p.strokeWeight(6);
    p.line(-p.width * 0.5, lineY, p.width * 1.5, lineY);

    if (phase === 'exiting') {
      updateExit();
    } else {
      updateLogic();
    }
    drawScene();

    p.pop();
  };

  function updateLogic() {
    // La figura roja tiembla levemente en su lugar
    redShape.jitterX = (p.noise(1000, p.frameCount * 0.06) - 0.5) * 5;
    redShape.jitterY = (p.noise(2000, p.frameCount * 0.06) - 0.5) * 5;

    // La figura roja intenta alejarse levemente de las figuras negras,
    // incluso cuando están lejos (mientras no esté asentada sobre la línea)
    if (!redShape.settled) {
      let pushX = 0, pushY = 0;
      const REPEL_RADIUS = 230;
      for (let pt of blackShapes) {
        if (pt.settled) continue;
        let dx = redShape.x - pt.x;
        let dy = redShape.y - pt.y;
        let d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d < REPEL_RADIUS) {
          let strength = Math.pow(1 - d / REPEL_RADIUS, 2) * 3.2;
          pushX += (dx / d) * strength;
          pushY += (dy / d) * strength;
        }
      }
      redShape.x += pushX;
      redShape.y += pushY;
      // No se aleja infinitamente: se mantiene dentro de su lado de la línea
      if (redShape.y < lineY + redShape.r) redShape.y = lineY + redShape.r;
    }

    // Movimiento libre de las figuras negras (limitadas a su zona)
    for (let pt of blackShapes) {
      if (pt.settled) continue;

      if (draggingPt !== pt) {
        pt.x += pt.vx;
        pt.y += pt.vy;

        // Rebote y clamp estricto en los 4 bordes de su zona
        if (pt.x < pt.r) {
          pt.x = pt.r;
          pt.vx *= -1;
        }
        if (pt.x > p.width - pt.r) {
          pt.x = p.width - pt.r;
          pt.vx *= -1;
        }
        if (pt.y < pt.r) {
          pt.y = pt.r;
          pt.vy *= -1;
        }
        if (pt.y > lineY - pt.r) {
          pt.y = lineY - pt.r;
          pt.vy *= -1;
        }
      }
    }

    // Si una figura negra está siendo arrastrada cruzando la línea (y > lineY)
    if (draggingPt && !draggingPt.settled) {
      if (draggingPt.y > lineY) {
        // Aumenta el progreso de cambio de color (más rápido)
        draggingPt.progress += 0.022;

        if (draggingPt.progress >= 1) {
          draggingPt.progress = 1;
          draggingPt.settled = true;
          draggingPt.y = lineY - 20;
          draggingPt = null;
        }
      } else {
        // Si la vuelve a subir antes de completar, pierde progreso
        draggingPt.progress = Math.max(0, draggingPt.progress - 0.03);
      }
    } else {
      // Descuento de progreso en figuras sueltas si no se sostienen
      for (let pt of blackShapes) {
        if (!pt.settled && draggingPt !== pt) {
          pt.progress = Math.max(0, pt.progress - 0.02);
        }
      }
    }

    // La roja se acerca de a partes: cada figura negra completada suma
    // aproximadamente 1/N del camino hacia la línea (un poco menos
    // mientras la figura actual todavía se está arrastrando/coloreando)
    if (!redShape.settled) {
      const total = blackShapes.length;
      const settledCount = blackShapes.filter(pt => pt.settled).length;
      const active = (draggingPt && !draggingPt.settled && draggingPt.y > lineY) ? draggingPt : null;
      const dragContribution = active ? active.progress * 0.85 : 0;
      const fraction = Math.min((settledCount + dragContribution) / total, 0.97);

      let targetY = p.lerp(redShape.baseY, lineY + 20, fraction);
      let targetX = p.lerp(redShape.baseX, p.width / 2, fraction);

      // Pequeño desvío hacia la figura negra activa, para que el
      // acercamiento no sea una línea recta sino un poco curvo
      if (active) {
        const pull = 0.22;
        targetX = p.lerp(targetX, active.x, pull);
        targetY = p.lerp(targetY, active.y, pull * 0.6);
      }

      redShape.y = p.lerp(redShape.y, targetY, 0.04);
      redShape.x = p.lerp(redShape.x, targetX, 0.04);

      // Nunca debe cruzar al lado de las negras antes de tiempo
      if (redShape.y < lineY + redShape.r) redShape.y = lineY + redShape.r;
    }

    // Cuando todas las figuras negras se completan, la roja llega al centro de la línea
    let allSettled = blackShapes.every(pt => pt.settled);
    if (allSettled) {
      redShape.settled = true;
      redShape.y = p.lerp(redShape.y, lineY + 20, 0.06);
      redShape.x = p.lerp(redShape.x, p.width / 2, 0.06);

      // Cuando la roja llegó a destino, arrancamos la salida por la diagonal
      let dCenter = p.dist(redShape.x, redShape.y, p.width / 2, lineY + 20);
      if (dCenter < 2) {
        redShape.x = p.width / 2;
        redShape.y = lineY + 20;
        redShape.jitterX = 0;
        redShape.jitterY = 0;
        phase = 'exiting';
      }
    }
  }

  function updateExit() {
    // Todas las figuras (negras asentadas + la roja) se deslizan
    // en la misma dirección local X, que visualmente es la diagonal.
    redShape.x += EXIT_SPEED;
    for (let pt of blackShapes) {
      pt.x += EXIT_SPEED;
    }

    let exitLimit = p.width * 1.3;
    let allOut = redShape.x > exitLimit && blackShapes.every(pt => pt.x > exitLimit);
    if (allOut) {
      resetAll();
    }
  }

  function drawScene() {
    // Dibujar figura roja (con temblor)
    p.noStroke();
    p.fill(RED);
    drawShapeObj({
      ...redShape,
      x: redShape.x + redShape.jitterX,
      y: redShape.y + redShape.jitterY
    });

    // Dibujar figuras negras / transformándose
    for (let pt of blackShapes) {
      p.push();
      let c = p.lerpColor(p.color(BLACK), p.color(RED), pt.progress);
      p.fill(c);
      drawShapeObj(pt);
      p.pop();
    }
  }

  function drawShapeObj(obj) {
    p.push();
    p.translate(obj.x, obj.y);
    p.rotate(obj.rot || 0);
    let s = obj.r * 2;
    if (obj.shape === 'circle') {
      p.circle(0, 0, s);
    } else if (obj.shape === 'square') {
      p.rectMode(p.CENTER);
      p.rect(0, 0, s * 0.9, s * 0.9);
    } else {
      p.triangle(-obj.r, obj.r * 0.8, obj.r, obj.r * 0.8, 0, -obj.r);
    }
    p.pop();
  }

  function toLocalCoords(x, y) {
    let cx = p.width / 2, cy = p.height / 2;
    let dx = x - cx, dy = y - cy;
    let rotationRad = p.radians(ROTATION_DEG);
    let cosA = Math.cos(-rotationRad), sinA = Math.sin(-rotationRad);
    return {
      x: dx * cosA - dy * sinA + cx,
      y: dx * sinA + dy * cosA + cy
    };
  }

  function mouseInsideCanvas() {
    return p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;
  }

  p.mousePressed = () => {
    if (phase !== 'interact' || !mouseInsideCanvas()) return;
    let local = toLocalCoords(p.mouseX, p.mouseY);
    for (let pt of blackShapes) {
      if (!pt.settled && p.dist(local.x, local.y, pt.x, pt.y) < pt.r + 10) {
        draggingPt = pt;
        pt.originX = pt.x;
        pt.originY = pt.y;
        break;
      }
    }
  };

  p.mouseDragged = () => {
    if (draggingPt) {
      let localCoord = toLocalCoords(p.mouseX, p.mouseY);
      draggingPt.x = localCoord.x;
      draggingPt.y = localCoord.y;
    }
  };

  p.mouseReleased = () => {
    if (draggingPt) {
      // Si se suelta antes de cruzar la línea o antes de completar el progreso,
      // la figura es "repelida": sale despedida hacia su lado en vez de
      // teletransportarse al punto donde se la agarró.
      if (draggingPt.y <= lineY || draggingPt.progress < 1) {
        const speed = p.random(2.5, 4);
        // Ángulo apuntando hacia arriba (alejándose de la línea) con variación
        const angle = -p.HALF_PI + p.random(-0.7, 0.7);
        draggingPt.vx = Math.cos(angle) * speed;
        draggingPt.vy = Math.sin(angle) * speed;
        draggingPt.progress = 0;

        // Por si quedó del lado equivocado de la línea al soltarla
        if (draggingPt.y > lineY - draggingPt.r) {
          draggingPt.y = lineY - draggingPt.r - 1;
        }
      }
      draggingPt = null;
    }
  };
};

new p5(sketchEmpatia, 'empatia');
