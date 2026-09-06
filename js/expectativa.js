/*
  Experiencia "Expectativa / Obstáculos"
  --------------------------------------
  Arrastrás el círculo rojo desde el punto de partida hasta la meta. En el
  camino hay triángulos que titilan (rojo <-> crema), cada vez más rápido, para
  avisar que están por lanzarse cruzando la línea.
*/

const sketchExpectativa = (p) => {
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
  let limitStart = 0; // punto de partida
  let limitEnd = 0;   // meta
  let wallLength = 60;
  let wallGap = 0;

  // Estado del círculo
  let circleX = 0;
  let circleY = 0;
  let isDragging = false;

  // Configuración del juego
  const OBSTACLE_COUNT = 5;
  const LAUNCH_MS = 220;        // ms que tarda en cruzar la línea
  const TRIGGER_MULT = 5.5;     // distancia de aviso
  const DRAG_EASE = 0.07;       // suavizado del arrastre
  const MAX_STEP_BASE = 0.6;    // velocidad máxima en px/frame
  const SYNC_FACTOR = 0.88;     
  const FLICKER_HZ_START = 0.7; 
  const FLICKER_HZ_END = 12;    
  const TRIANGLE_SIZE = 25;     
  const OFFSET_FACTOR = 3.0;    

  let obstacles = [];

  function computeSizes() {
    const ratio = Math.min(p.width, p.height) / 400;
    SIZE_SCALE = ratio <= 1 ? ratio : ratio * 1.25;
    circleR = BASE_CIRCLE_R * SIZE_SCALE;

    lineY = p.height / 2;
    limitStart = p.width * 0.15;
    limitEnd = p.width * 0.85;

    wallLength = 70 * SIZE_SCALE;
    wallGap = 18 * SIZE_SCALE;
  }

  // Sistema de obtención de tamaño igual al del resto de los scripts del proyecto
  function getTargetSize(id, defW, defH) {
    if (typeof window !== 'undefined' && typeof window.getCanvasTargetSize === 'function') {
      return window.getCanvasTargetSize(id, defW, defH);
    }
    const el = document.getElementById(id);
    if (el && el.clientWidth && el.clientHeight) {
      return { w: el.clientWidth, h: el.clientHeight };
    }
    return { w: defW, h: defH };
  }

  p.setup = () => {
    p.createCanvas(400, 400);
    computeSizes();
    circleX = limitStart;
    circleY = lineY;
    generateObstacles();
    p.windowResized();
  };

  p.windowResized = () => {
    const { w, h } = getTargetSize('expectativa', 400, 400);
    p.resizeCanvas(w, h);

    const oldLimitStart = limitStart;
    const oldLimitEnd = limitEnd;

    computeSizes();

    const progress = (circleX - oldLimitStart) / ((oldLimitEnd - oldLimitStart) || 1);
    circleX = p.lerp(limitStart, limitEnd, progress);
    circleY = lineY;
  };

  function getTriggerDistance() {
    return circleR * TRIGGER_MULT;
  }

  function getMaxSpeedPxPerMs() {
    const maxStepPerFrame = MAX_STEP_BASE * SIZE_SCALE;
    return maxStepPerFrame * (60 / 1000);
  }

  function generateObstacles() {
    obstacles = [];
    const startMargin = 0.24;
    const endMargin = 0.90;

    const timeToReachMs = getTriggerDistance() / getMaxSpeedPxPerMs();

    for (let i = 0; i < OBSTACLE_COUNT; i++) {
      const progress = p.map(i, 0, OBSTACLE_COUNT - 1, startMargin, endMargin);
      obstacles.push({
        progress,
        side: i % 2 === 0 ? 1 : -1,
        offsetFactor: OFFSET_FACTOR,
        sizeFactor: TRIANGLE_SIZE,
        chargeDuration: timeToReachMs * SYNC_FACTOR,
        state: 'idle',
        chargeStart: 0,
        launchStart: 0,
        currentY: null,
        flickerPhase: 0
      });
    }
  }

  function resetObstacles() {
    for (const o of obstacles) {
      o.state = 'idle';
      o.chargeStart = 0;
      o.launchStart = 0;
      o.currentY = null;
      o.flickerPhase = 0;
    }
  }

  function obstacleX(o) {
    return p.lerp(limitStart, limitEnd, o.progress);
  }

  function obstacleRestY(o) {
    return lineY + o.side * (circleR * o.offsetFactor + wallGap);
  }

  function obstacleSize(o) {
    return o.sizeFactor * SIZE_SCALE;
  }

  p.draw = () => {
    p.background(BG);

    p.push();
    p.translate(p.width / 2, p.height / 2);
    p.rotate(p.radians(ROTATION_DEG));
    p.translate(-p.width / 2, -p.height / 2);

    drawSceneGeometry();
    updatePosition();
    updateObstacles();
    drawObstacles();
    drawCircle();

    p.pop();
  };

  function drawSceneGeometry() {
    p.stroke(RED);
    p.strokeWeight(2 * SIZE_SCALE);
    p.line(-100, lineY, p.width + 100, lineY);

    p.strokeWeight(3 * SIZE_SCALE);
    p.line(limitStart, lineY - wallGap, limitStart, lineY - wallGap - wallLength);
    p.line(limitEnd, lineY - wallGap, limitEnd, lineY - wallGap - wallLength);
  }

  function updatePosition() {
    if (!isDragging) return;

    const mouse = getLogicalMouse();
    const desiredX = p.constrain(mouse.x, limitStart, limitEnd);

    const maxStep = MAX_STEP_BASE * SIZE_SCALE;
    const dx = (desiredX - circleX) * DRAG_EASE;
    const step = p.constrain(dx, -maxStep, maxStep);
    circleX += step;
    circleY = lineY;

    if (circleX >= limitEnd - 0.5) {
      finishAndRestart();
    }
  }

  function updateObstacles() {
    const now = p.millis();
    const triggerDistance = getTriggerDistance();
    const dt = p.deltaTime / 1000;

    for (const o of obstacles) {
      const ox = obstacleX(o);

      if (o.state === 'idle') {
        if (circleX >= ox - triggerDistance) {
          o.state = 'charging';
          o.chargeStart = now;
          o.flickerPhase = 0;
        }
      } else if (o.state === 'charging') {
        const t = p.constrain((now - o.chargeStart) / o.chargeDuration, 0, 1);
        const flickerHz = p.lerp(FLICKER_HZ_START, FLICKER_HZ_END, t * t);
        o.flickerPhase += flickerHz * dt * p.TWO_PI;

        if (t >= 1) {
          o.state = 'launching';
          o.launchStart = now;
          o.currentY = obstacleRestY(o);
        }
      } else if (o.state === 'launching') {
        const t = p.constrain((now - o.launchStart) / LAUNCH_MS, 0, 1);
        const fromY = obstacleRestY(o);
        const toY = lineY - o.side * (circleR * o.offsetFactor + wallGap);
        o.currentY = p.lerp(fromY, toY, t);

        const d = p.dist(circleX, circleY, ox, o.currentY);
        if (d < circleR + obstacleSize(o) * 0.45) {
          resetExperience();
          return;
        }

        if (t >= 1) {
          o.state = 'spent';
        }
      }
    }
  }

  function drawObstacles() {
    for (const o of obstacles) {
      if (o.state === 'spent') continue;

      const ox = obstacleX(o);
      let y = obstacleRestY(o);
      let col = p.color(RED);
      const size = obstacleSize(o);

      if (o.state === 'charging') {
        const blinkOn = Math.sin(o.flickerPhase) > 0;
        col = p.color(blinkOn ? CREAM : RED);
      } else if (o.state === 'launching') {
        y = o.currentY;
        col = p.color(CREAM);
      }

      p.push();
      p.translate(ox, y);
      const angle = o.side > 0 ? -p.HALF_PI : p.HALF_PI;
      p.rotate(angle);
      p.noStroke();
      p.fill(col);

      const half = size / 2;
      p.triangle(half, 0, -half, half, -half, -half);

      p.pop();
    }
  }

  function drawCircle() {
    if (isDragging) {
      p.noFill();
      p.stroke(RED);
      p.strokeWeight(2 * SIZE_SCALE);
      p.circle(circleX, circleY, (circleR * 2) + (10 * SIZE_SCALE));
    }

    p.noStroke();
    p.fill(RED);
    p.circle(circleX, circleY, circleR * 2);
  }

  function resetExperience() {
    circleX = limitStart;
    circleY = lineY;
    isDragging = false;
    resetObstacles();
  }

  function finishAndRestart() {
    circleX = limitStart;
    circleY = lineY;
    isDragging = false;
    resetObstacles();
  }

  function getLogicalMouse() {
    const cx = p.width / 2;
    const cy = p.height / 2;
    const theta = p.radians(ROTATION_DEG);

    const dx = p.mouseX - cx;
    const dy = p.mouseY - cy;

    const x = dx * Math.cos(theta) + dy * Math.sin(theta) + cx;
    const y = -dx * Math.sin(theta) + dy * Math.cos(theta) + cy;

    return { x, y };
  }

  function mouseInsideCanvas() {
    return p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;
  }

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
    return false;
  };

  p.touchEnded = () => {
    isDragging = false;
    return false;
  };
};

new p5(sketchExpectativa, 'expectativa');
