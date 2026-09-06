/*
  Experiencia "incertidumbre"
  ---------------------------
  Siempre 4 obstáculos con fases dinámicas:
    - "silent": Sin titileo, se lanza súbitamente al acercarte.
    - "diagonal": Lento y esquivable. 30% de prob. de invertirse y salir del otro lado.
    - "rebound": Rebota de 1 a 3 veces (35%, 35%, 22%) o 4 veces (8% prob. mínima).
    - "invisible": 30% de prob. de duplicarse y rebotar formando 2 ataques en "X" con hueco central.

  SISTEMA DE REPETICIÓN:
    - 80% de las veces: Los 4 obstáculos son 100% distintos (sin repeticiones).
    - 20% de las veces: Se permite baja probabilidad de repetición (parejas).
*/

const sketchIncertidumbre = (p) => {
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
  let wallGap = 0;

  // Estado del círculo
  let circleX = 0;
  let circleY = 0;
  let isDragging = false;

  // Velocidad dinámica del círculo (cambios en seco)
  let currentMaxStep = 0.7;
  let zoneSpeeds = [];

  // --- Configuración de los obstáculos ---
  const OBSTACLE_COUNT = 4;
  const TRIANGLE_SIZE = 25;
  const OFFSET_FACTOR = 3.0;

  const LAUNCH_MS_NORMAL = 230;
  const LAUNCH_MS_DIAGONAL = 1400; // Muy lento para esquivar con facilidad

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
    generateRun();
    p.windowResized();
  };

  p.windowResized = () => {
    const { w, h } = getTargetSize('incertidumbre', 400, 400);
    p.resizeCanvas(w, h);

    const oldLimitStart = limitStart;
    const oldLimitEnd = limitEnd;

    computeSizes();

    const progress = (circleX - oldLimitStart) / ((oldLimitEnd - oldLimitStart) || 1);
    circleX = p.lerp(limitStart, limitEnd, progress);
    circleY = lineY;
  };

  // --- SELECCIÓN CONTROLADA DE FASES ---
  function pickRunTypes() {
    const availableTypes = ['silent', 'diagonal', 'rebound', 'invisible'];
    
    // Probabilidad general baja de permitir cualquier repetición (20%)
    // El 80% restante garantiza 4 fases completamente distintas
    const REPEAT_PROB = 0.20;
    const allowRepeat = Math.random() < REPEAT_PROB;

    if (!allowRepeat) {
      // 80%: 4 fases únicas barajadas
      const shuffled = [...availableTypes];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    } else {
      // 20%: Sorteo con repetición controlada (parejas, y 3 iguales casi nulo)
      while (true) {
        const picked = [];
        const counts = {};

        for (let i = 0; i < OBSTACLE_COUNT; i++) {
          const t = p.random(availableTypes);
          picked.push(t);
          counts[t] = (counts[t] || 0) + 1;
        }

        const maxRepetitions = Math.max(...Object.values(counts));

        // Parejas normales aceptadas en este 20%
        if (maxRepetitions === 2) {
          return picked;
        }

        // Si salieran 3 iguales, probabilidad ínfima (5% dentro del 20% = 1% real)
        if (maxRepetitions === 3 && Math.random() < 0.05) {
          return picked;
        }
      }
    }
  }

  // --- GENERADOR DE CORRIDA ---
  function generateRun() {
    obstacles = [];

    // 1. Velocidades del círculo contrastantes por tramo
    zoneSpeeds = [];
    const speedsPool = [0.48, 0.60, 0.80, 1.30, 1.65, 1.95];
    for (let i = 0; i <= OBSTACLE_COUNT; i++) {
      zoneSpeeds.push(p.random(speedsPool));
    }

    // 2. Sorteo con baja probabilidad de repetición
    const chosenTypes = pickRunTypes();

    const startMargin = 0.24;
    const endMargin = 0.88;

    for (let i = 0; i < OBSTACLE_COUNT; i++) {
      const progress = p.map(i, 0, OBSTACLE_COUNT - 1, startMargin, endMargin);
      let side = i % 2 === 0 ? 1 : -1;
      const type = chosenTypes[i];

      // --- Probabilidad diagonal invertido (30%) ---
      let isInvertedDiagonal = false;
      if (type === 'diagonal') {
        isInvertedDiagonal = Math.random() < 0.30;
        if (isInvertedDiagonal) {
          side = -side;
        }
      }

      // --- Probabilidad rebote dinámico (1 a 4 ciclos) ---
      let reboundTrips = 1;
      let reboundDuration = 700;
      if (type === 'rebound') {
        const roll = Math.random();
        if (roll < 0.35) {
          reboundTrips = 1; // 35%
        } else if (roll < 0.70) {
          reboundTrips = 2; // 35%
        } else if (roll < 0.92) {
          reboundTrips = 3; // 22%
        } else {
          reboundTrips = 4; // 8% probabilidad mínima
        }
        reboundDuration = reboundTrips * 650;
      }

      // --- Probabilidad ataque doble X (30%) ---
      let isDoubleX = false;
      let xDuration = 850;
      if (type === 'invisible') {
        isDoubleX = Math.random() < 0.30;
        xDuration = isDoubleX ? 1500 : 850;
      }

      obstacles.push({
        type,
        progress,
        side,
        offsetFactor: OFFSET_FACTOR,
        sizeFactor: TRIANGLE_SIZE,
        state: 'idle',
        chargeStart: 0,
        chargeDuration: 300,
        launchStart: 0,
        currentX: null,
        currentY: null,
        flickerPhase: 0,
        targetDiagonalX: 0,
        revealed: type !== 'invisible',

        // Parámetros calculados independientemente
        isInvertedDiagonal,
        reboundTrips,
        reboundDuration,
        isDoubleX,
        xDuration,
        cloneX: null,
        cloneY: null
      });
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

    let currentZone = 0;
    for (let i = 0; i < obstacles.length; i++) {
      if (circleX > obstacleX(obstacles[i])) {
        currentZone = i + 1;
      }
    }
    currentMaxStep = zoneSpeeds[currentZone] || 0.7;

    const mouse = getLogicalMouse();
    const desiredX = p.constrain(mouse.x, limitStart, limitEnd);

    const maxStep = currentMaxStep * SIZE_SCALE;
    const dx = (desiredX - circleX) * 0.12;
    const step = p.constrain(dx, -maxStep, maxStep);
    circleX += step;
    circleY = lineY;

    if (circleX >= limitEnd - 0.5) {
      finishAndRestart();
    }
  }

  function updateObstacles() {
    const now = p.millis();
    const dt = p.deltaTime / 1000;
    const triggerDistance = circleR * 4.8;

    for (const o of obstacles) {
      const ox = obstacleX(o);
      const restY = obstacleRestY(o);
      const oppositeY = lineY - o.side * (circleR * o.offsetFactor + wallGap);

      // --- 1. DETECCIÓN Y ACTIVACIÓN ---
      if (o.state === 'idle') {
        if (o.type === 'diagonal') {
          if (circleX >= ox + circleR * 1.5) {
            o.state = 'charging';
            o.chargeStart = now;
            o.chargeDuration = 320;
            o.flickerPhase = 0;
            o.targetDiagonalX = ox + 55 * SIZE_SCALE;
          }
        } else if (o.type === 'silent') {
          if (circleX >= ox - circleR * 2.8) {
            o.state = 'launching';
            o.launchStart = now;
            o.currentX = ox;
            o.currentY = restY;
          }
        } else if (o.type === 'invisible') {
          if (circleX >= ox - triggerDistance) {
            o.revealed = true;
            o.state = 'charging';
            o.chargeStart = now;
            o.chargeDuration = 380;
            o.flickerPhase = 0;
          }
        } else {
          // Rebote / normal
          if (circleX >= ox - triggerDistance) {
            o.state = 'charging';
            o.chargeStart = now;
            o.chargeDuration = 350;
            o.flickerPhase = 0;
          }
        }
      }

      // --- 2. TITILEO / CARGA ---
      else if (o.state === 'charging') {
        const t = p.constrain((now - o.chargeStart) / o.chargeDuration, 0, 1);
        o.flickerPhase += p.lerp(2, 16, t * t) * dt * p.TWO_PI;

        if (t >= 1) {
          o.state = 'launching';
          o.launchStart = now;
          o.currentX = ox;
          o.currentY = restY;
          if (o.type === 'invisible') {
            o.cloneX = ox;
            o.cloneY = oppositeY;
          }
        }
      }

      // --- 3. LANZAMIENTOS Y ATAQUES ---
      else if (o.state === 'launching') {
        // A) REBOTE DINÁMICO (1 a 4 ciclos)
        if (o.type === 'rebound') {
          const t = p.constrain((now - o.launchStart) / o.reboundDuration, 0, 1);
          const cycleProgress = (t * o.reboundTrips) % 1;
          let yFactor = 0;

          if (cycleProgress < 0.20) {
            yFactor = p.map(cycleProgress, 0, 0.20, 0, 1);
          } else if (cycleProgress < 0.35) {
            yFactor = 1;
          } else if (cycleProgress < 0.90) {
            yFactor = p.map(cycleProgress, 0.35, 0.90, 1, 0);
          } else {
            yFactor = 0;
          }

          o.currentX = ox;
          o.currentY = p.lerp(restY, oppositeY, yFactor);

          if (t >= 1) o.state = 'spent';
        }

        // B) DIAGONAL LENTO
        else if (o.type === 'diagonal') {
          const t = p.constrain((now - o.launchStart) / LAUNCH_MS_DIAGONAL, 0, 1);
          const startX = ox - 35 * SIZE_SCALE;
          o.currentX = p.lerp(startX, o.targetDiagonalX, t);
          o.currentY = p.lerp(restY, oppositeY, t);

          if (t >= 1) o.state = 'spent';
        }

        // C) INVISIBLE: ATAQUE EN X SIMPLE O DOBLE X CON REBOTE
        else if (o.type === 'invisible') {
          const t = p.constrain((now - o.launchStart) / o.xDuration, 0, 1);

          if (o.isDoubleX) {
            const gap = 20 * SIZE_SCALE;
            let currentStartX, currentEndX;

            if (t < 0.48) {
              const subT = p.map(t, 0, 0.48, 0, 1);
              currentStartX = ox + 65 * SIZE_SCALE;
              currentEndX = ox + gap;
              o.currentX = p.lerp(currentStartX, currentEndX, subT);
              o.currentY = p.lerp(restY, oppositeY, subT);
              o.cloneX = p.lerp(currentStartX, currentEndX, subT);
              o.cloneY = p.lerp(oppositeY, restY, subT);
            } else if (t < 0.54) {
              o.currentX = ox + gap;
              o.cloneX = ox + gap;
            } else {
              const subT = p.map(t, 0.54, 1, 0, 1);
              currentStartX = ox - gap;
              currentEndX = ox - 65 * SIZE_SCALE;
              o.currentX = p.lerp(currentStartX, currentEndX, subT);
              o.currentY = p.lerp(oppositeY, restY, subT);
              o.cloneX = p.lerp(currentStartX, currentEndX, subT);
              o.cloneY = p.lerp(restY, oppositeY, subT);
            }
          } else {
            const startX = ox + 45 * SIZE_SCALE;
            const endX = ox - 50 * SIZE_SCALE;

            o.currentX = p.lerp(startX, endX, t);
            o.currentY = p.lerp(restY, oppositeY, t);
            o.cloneX = p.lerp(startX, endX, t);
            o.cloneY = p.lerp(oppositeY, restY, t);
          }

          if (t >= 1) o.state = 'spent';
        }

        // D) ATAQUE RECTO SILENCIOSO
        else {
          const t = p.constrain((now - o.launchStart) / LAUNCH_MS_NORMAL, 0, 1);
          o.currentX = ox;
          o.currentY = p.lerp(restY, oppositeY, t);

          if (t >= 1) o.state = 'spent';
        }

        // Colisiones
        const d1 = p.dist(circleX, circleY, o.currentX, o.currentY);
        if (d1 < circleR + obstacleSize(o) * 0.45) {
          resetExperience();
          return;
        }

        if (o.type === 'invisible' && o.cloneX !== null) {
          const d2 = p.dist(circleX, circleY, o.cloneX, o.cloneY);
          if (d2 < circleR + obstacleSize(o) * 0.45) {
            resetExperience();
            return;
          }
        }
      }
    }
  }

  function drawObstacles() {
    for (const o of obstacles) {
      if (o.state === 'spent') continue;
      if (o.type === 'invisible' && !o.revealed) continue;

      const ox = o.currentX !== null ? o.currentX : obstacleX(o);
      const oy = o.currentY !== null ? o.currentY : obstacleRestY(o);
      const size = obstacleSize(o);

      let col = p.color(RED);

      if (o.state === 'charging') {
        const blinkOn = Math.sin(o.flickerPhase) > 0;
        col = p.color(blinkOn ? CREAM : RED);
      } else if (o.state === 'launching') {
        col = p.color(CREAM);
      }

      drawSingleTriangle(ox, oy, size, col, o);

      if (o.type === 'invisible' && o.state === 'launching' && o.cloneX !== null) {
        drawSingleTriangle(o.cloneX, o.cloneY, size, col, o, true);
      }
    }
  }

  function drawSingleTriangle(x, y, size, col, o, isClone = false) {
    p.push();
    p.translate(x, y);

    let angle = o.side > 0 ? -p.HALF_PI : p.HALF_PI;

    if (o.type === 'diagonal' && o.state === 'launching') {
      const oppositeY = lineY - o.side * (circleR * o.offsetFactor + wallGap);
      const startX = obstacleX(o) - 35 * SIZE_SCALE;
      angle = Math.atan2(oppositeY - obstacleRestY(o), o.targetDiagonalX - startX);
    } else if (o.type === 'invisible' && o.state === 'launching') {
      const dirY = isClone ? o.side : -o.side;
      angle = Math.atan2(dirY, -1);
    }

    p.rotate(angle);
    p.noStroke();
    p.fill(col);

    const half = size / 2;
    p.triangle(half, 0, -half, half, -half, -half);

    p.pop();
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
    generateRun();
  }

  function finishAndRestart() {
    circleX = limitStart;
    circleY = lineY;
    isDragging = false;
    generateRun();
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

new p5(sketchIncertidumbre, 'incertidumbre');
