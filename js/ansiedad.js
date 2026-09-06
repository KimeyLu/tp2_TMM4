const sketchAnsiedad = (p) => {
  const BG = '#141414';
  const RED = '#970511';
  const CREAM = '#EFD583';

  const ROTATION_DEG = -43;

  // Escala dinámica según pantalla
  const BASE_CIRCLE_R = 12;
  let circleR = BASE_CIRCLE_R;
  let SIZE_SCALE = 1;

  // Geometría del recorrido
  let lineY;
  let limitStart = 0;
  let limitEnd = 0;
  let wallLength = 60;

  // Estado del círculo
  let circleX = 0;
  let circleY = 0;
  let isDragging = false;

  // Parámetros de resistencia y triángulos
  const MAX_OVERRUN = 200; // Distancia máxima que se puede avanzar fuera del límite
  let satellites = [];

// Agregá esta variable arriba, junto a 'let wallLength = 60;'
  let wallGap = 0;

  function computeSizes() {
    const ratio = Math.min(p.width, p.height) / 400;
    SIZE_SCALE = ratio <= 1 ? ratio : ratio * 1.25;
    circleR = BASE_CIRCLE_R * SIZE_SCALE;

    lineY = p.height / 2;
    limitStart = p.width * 0.25;
    limitEnd = p.width * 0.65;
    
    wallLength = 90 * SIZE_SCALE; // Acá las hacemos más largas (antes era 50)
    wallGap = 20 * SIZE_SCALE;    // Esta es la distancia que las separa de la línea
  }
  p.setup = () => {
    p.createCanvas(400, 400);
    computeSizes();
    circleX = limitStart;
    circleY = lineY;
    generateSatellites();
  };

  p.windowResized = () => {
    const { w, h } = window.getCanvasTargetSize('ansiedad', 400, 400);
    p.resizeCanvas(w, h);

    const oldLimitStart = limitStart;
    const oldLimitEnd = limitEnd;

    computeSizes();

    // Reubicar el círculo manteniendo la posición proporcional
    const progress = (circleX - oldLimitStart) / (oldLimitEnd - oldLimitStart);
    circleX = p.lerp(limitStart, limitEnd, progress);
    circleY = lineY;
  };

  function generateSatellites() {
    satellites = [];
    const count = 7;
    for (let i = 0; i < count; i++) {
      const angle = (p.TWO_PI / count) * i;
      satellites.push({
        baseAngle: angle,
        distFactor: p.random(2.2, 3.2),
        size: p.random(14, 22) * SIZE_SCALE
      });
    }
  }

  p.draw = () => {
    p.background(BG);

    // Sistema de coordenadas rotado (-43 deg)
    p.push();
    p.translate(p.width / 2, p.height / 2);
    p.rotate(p.radians(ROTATION_DEG));
    p.translate(-p.width / 2, -p.height / 2);

    drawSceneGeometry();
    updatePosition();
    drawSatellitesAndCircle();

    p.pop();
  };

  // Dibujo de la línea principal y las dos paredes de los límites
function drawSceneGeometry() {
    p.stroke(RED);
    p.strokeWeight(2 * SIZE_SCALE);

    // Línea principal
    p.line(-100, lineY, p.width + 100, lineY);

    // Paredes / Barreras límite (ahora despegadas de la línea central)
    p.strokeWeight(3 * SIZE_SCALE);
    p.line(limitStart, lineY - wallGap, limitStart, lineY - wallGap - wallLength);
    p.line(limitEnd, lineY - wallGap, limitEnd, lineY - wallGap - wallLength);
  }
  function updatePosition() {
    if (!isDragging) return;

    const mouse = getLogicalMouse();
    let desiredX = mouse.x;

    // No se puede ir más atrás del límite de inicio
    if (desiredX < limitStart) {
      desiredX = limitStart;
    }

    if (desiredX <= limitEnd) {
      // Dentro de los límites: movimiento directo y fluido
      circleX = desiredX;
    } else {
      // Fuera de los límites hacia adelante: resistencia progresiva (pesadez)
      const excess = desiredX - limitEnd;
      const t = p.constrain(excess / (MAX_OVERRUN * 2), 0, 1);
      
      // La amortiguación reduce el avance gradualmente hasta frenarse
      const damping = p.pow(1 - t, 2.5);
      const step = (desiredX - circleX) * damping * 0.15;

      circleX = p.constrain(circleX + step, limitEnd, limitEnd + MAX_OVERRUN);
    }

    // Mantener siempre el círculo pegado a la línea
    circleY = lineY;
  }

  function drawSatellitesAndCircle() {
    // Calcular cuánto excedió el límite seguro (0 a 1)
    const excess = Math.max(0, circleX - limitEnd);
    const overrunFactor = p.constrain(excess / MAX_OVERRUN, 0, 1);

    // Si está fuera de los límites, dibujar los triángulos de ansiedad
    if (overrunFactor > 0) {
      drawSatellites(overrunFactor);
    }

    // Anillo exterior alrededor del círculo (SOLO si se está arrastrando)
    if (isDragging) {
      p.noFill();
      p.stroke(RED); // Ahora es del mismo color que el círculo (rojo)
      p.strokeWeight(2 * SIZE_SCALE);
      p.circle(circleX, circleY, (circleR * 2) + (10 * SIZE_SCALE));
    }

    // Círculo principal rojo
    p.noStroke();
    p.fill(RED);
    p.circle(circleX, circleY, circleR * 2);
  }

  function drawSatellites(intensity) {
    p.fill(CREAM);
    p.noStroke();

    const maxJitter = 4 * SIZE_SCALE * intensity;

    for (const sat of satellites) {
      // Temblor aleatorio
      const jx = p.random(-maxJitter, maxJitter);
      const jy = p.random(-maxJitter, maxJitter);

      const d = (circleR * sat.distFactor) + (5 * SIZE_SCALE * (1 - intensity));
      const sx = circleX + p.cos(sat.baseAngle) * d + jx;
      const sy = circleY + p.sin(sat.baseAngle) * d + jy;

      p.push();
      p.translate(sx, sy);
      // Apuntar hacia el centro del círculo
      const angleToCenter = p.atan2(circleY - sy, circleX - sx);
      p.rotate(angleToCenter);

      // Dibujar triángulo apuntando a la derecha (0 rad)
      const s = sat.size * intensity;
      p.triangle(s, 0, -s * 0.7, s * 0.5, -s * 0.7, -s * 0.5);
      p.pop();
    }
  }

  // Traducción de coordenadas considerando la rotación del canvas
  function getLogicalMouse() {
    const cx = p.width / 2;
    const cy = p.height / 2;
    const theta = p.radians(ROTATION_DEG);

    const dx = p.mouseX - cx;
    const dy = p.mouseY - cy;

    // Rotación inversa corregida para que el clic funcione perfecto
    const x = dx * Math.cos(theta) + dy * Math.sin(theta) + cx;
    const y = -dx * Math.sin(theta) + dy * Math.cos(theta) + cy;

    return { x, y };
  }

  function mouseInsideCanvas() {
    return p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;
  }

  // Eventos de interacción
  p.mousePressed = () => {
    if (!mouseInsideCanvas()) return;
    const mouse = getLogicalMouse();
    if (p.dist(mouse.x, mouse.y, circleX, circleY) < circleR * 2.5) {
      isDragging = true;
    }
  };

  p.mouseReleased = () => {
    isDragging = false;
  };

  p.touchStarted = () => {
    if (!mouseInsideCanvas()) return false;
    const mouse = getLogicalMouse();
    if (p.dist(mouse.x, mouse.y, circleX, circleY) < circleR * 2.5) {
      isDragging = true;
    }
    return false;
  };

  p.touchMoved = () => {
    // El movimiento se procesa dentro del p.draw() con updatePosition()
    return false;
  };

  p.touchEnded = () => {
    isDragging = false;
    return false;
  };
};

new p5(sketchAnsiedad, 'ansiedad');
