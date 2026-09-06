const sketchEmpatia = (p) => {
  const BG = '#EFD583';
  const BLACK = '#141414';
  const RED = '#970511';

  const N_BLACK = 10;
  const N_RED = 2;
  const REPEL_RADIUS = 150;
  const CONNECT_RADIUS = 60;
  const BOND_DISTANCE = 65;
  const REPEL_MAX_PUSH = 25;
  const DRAG_EASE = 0.22; // qué tan rápido la figura arrastrada alcanza su posición objetivo (más bajo = más suave/elástico)
  const GROW_MS = 3500;
  const DECAY_MS = 7000;
  const MAX_SPEED_MULT = 3;
  const CONVERGE_DURATION = 2200;
  const FADE_DURATION = 500;

  let container;
  let particles = [];
  let networkEdges = [];
  let activeTouches = {};
  let phase = 'play';
  let convergeStart = 0;
  let fadeState = null;
  let fadeStart = 0;
  let fadeAlpha = 0;
  let colBlack, colRed;

  p.setup = () => {
    container = document.getElementById('empatia');
    p.createCanvas(400, 400);
    colBlack = p.color(BLACK);
    colRed = p.color(RED);
    resetAll();
  };
/*
  p.windowResized = () => {
    p.resizeCanvas(container.offsetWidth, container.offsetHeight);
  };
  */

  function resetAll() {
    particles = [];
    networkEdges = [];
    activeTouches = {};

    const total = N_BLACK + N_RED;
    const cols = 4, rows = Math.ceil(total / cols);
    const cellW = p.width / cols, cellH = p.height / rows;
    const cells = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([c, r]);
    shuffleArray(cells);

    const shapes = ['circle', 'square', 'triangle'];
    let id = 0;
    for (let i = 0; i < total; i++) {
      const [c, r] = cells[i];
      const rad = p.random(24, 32);
      const cx = p.constrain(c * cellW + cellW / 2 + p.random(-cellW * 0.2, cellW * 0.2), rad, p.width - rad);
      const cy = p.constrain(r * cellH + cellH / 2 + p.random(-cellH * 0.2, cellH * 0.2), rad, p.height - rad);
      const isRed = i < N_RED;
      particles.push({
        id: id++,
        shape: shapes[p.floor(p.random(shapes.length))],
        r: rad,
        x: cx, y: cy,
        homeX: cx, homeY: cy,
        dragTargetX: cx, dragTargetY: cy, // posición cruda del dedo/mouse mientras se arrastra
        vx: 0, vy: 0,
        rot: p.random(-0.3, 0.3),
        phase: p.random(1000),
        isRed,
        repulsionStrength: isRed ? 1.0 : 0,
        connectProgress: isRed ? 1 : 0,
        dragging: false,
        active: true
      });
    }
    phase = 'play';
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = p.floor(p.random(i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  p.draw = () => {
    p.background(BG);
 //   drawDecorations();

    if (phase === 'play') updatePlay();
    else if (phase === 'converge') updateConverge();
    else if (phase === 'fade') updateFade();

    drawNetworkEdges();
    drawParticles();

    if (phase === 'fade') {
      p.noStroke();
      p.fill(BG + hex2(p.round(fadeAlpha)));
      p.rect(0, 0, p.width, p.height);
    }
  };

  function hex2(n) {
    let s = n.toString(16);
    while (s.length < 2) s = '0' + s;
    return s;
  }

  function drawDecorations() {
    p.push();
    const s = p.min(p.width, p.height) * 0.3;
    p.noFill();
    p.stroke(BLACK);
    p.strokeWeight(2);
    p.rectMode(p.CORNER);
    p.rect(p.width - s - 30, 30, s, s);

    p.stroke(RED);
    p.strokeWeight(1.5);
    p.line(30, p.height - 30, 30 + s * 0.5, p.height - 30 - s * 0.5);

    p.stroke(RED);
    p.strokeWeight(2);
    for (let k = 0; k < 6; k++) {
      p.line(20 + k * 10, 18, 20 + k * 10, 66);
    }
    p.pop();
  }

  function updatePlay() {
    for (const pt of particles) {
      if (!pt.active) continue;

      if (pt.isRed) {
        pt.x = pt.homeX + p.sin(p.frameCount * 0.4 + pt.phase) * 2.2;
        pt.y = pt.homeY + p.cos(p.frameCount * 0.35 + pt.phase) * 2.2;
        continue;
      }

      if (pt.dragging) {
        // la posición "cruda" (dedo/mouse) y la posición visual ya no son lo mismo:
        // la visual persigue a la cruda + el empuje de repulsión con un lerp,
        // así el empuje se siente elástico en vez de un salto brusco.
        const desiredX = p.constrain(pt.dragTargetX, pt.r, p.width - pt.r);
        const desiredY = p.constrain(pt.dragTargetY, pt.r, p.height - pt.r);
        const f = repulsionForce(pt, desiredX, desiredY);
        const targetX = p.constrain(desiredX + f.fx, pt.r, p.width - pt.r);
        const targetY = p.constrain(desiredY + f.fy, pt.r, p.height - pt.r);
        pt.x = p.lerp(pt.x, targetX, DRAG_EASE);
        pt.y = p.lerp(pt.y, targetY, DRAG_EASE);
      } else {
        const f = repulsionForce(pt);
        const wanderAngle = p.noise(pt.id * 17.3, p.frameCount * 0.004) * p.TWO_PI * 3;
        pt.vx += p.cos(wanderAngle) * 0.035;
        pt.vy += p.sin(wanderAngle) * 0.035;
        pt.vx += f.fx * 0.05;
        pt.vy += f.fy * 0.05;

        const margin = 50;
        if (pt.x < margin) pt.vx += 0.06;
        if (pt.x > p.width - margin) pt.vx -= 0.06;
        if (pt.y < margin) pt.vy += 0.06;
        if (pt.y > p.height - margin) pt.vy -= 0.06;

        pt.vx *= 0.94; pt.vy *= 0.94;
        const speed = Math.hypot(pt.vx, pt.vy);
        const maxSpeed = 0.9;
        if (speed > maxSpeed) { pt.vx = (pt.vx / speed) * maxSpeed; pt.vy = (pt.vy / speed) * maxSpeed; }

        pt.x = p.constrain(pt.x + pt.vx, pt.r, p.width - pt.r);
        pt.y = p.constrain(pt.y + pt.vy, pt.r, p.height - pt.r);
      }
    }

    updateConnections();
  }

  // atX/atY opcionales: evalúa la repulsión en una posición distinta a pt.x/pt.y
  // (se usa mientras se arrastra, para calcular la fuerza en base a la posición
  // objetivo cruda y no a la posición visual, que va un paso atrás).
  function repulsionForce(pt, atX, atY) {
    const x = atX !== undefined ? atX : pt.x;
    const y = atY !== undefined ? atY : pt.y;
    let fx = 0, fy = 0;
    for (const src of particles) {
      if (!src.active || !src.isRed || src.id === pt.id) continue;
      const d = p.dist(x, y, src.x, src.y);
      if (d < REPEL_RADIUS && d > 0.01) {
        // antes era lineal (1 - d/REPEL_RADIUS): arrancaba de golpe apenas
        // entraba al radio. Con la curva al cuadrado el empuje aparece
        // gradualmente y se intensifica recién cerca del centro.
        const t = 1 - d / REPEL_RADIUS;
        const eased = t * t;
        const factor = src.repulsionStrength * eased;
        const ux = (x - src.x) / d, uy = (y - src.y) / d;
        fx += ux * factor * REPEL_MAX_PUSH;
        fy += uy * factor * REPEL_MAX_PUSH;
      }
    }
    return { fx, fy };
  }

  function updateConnections() {
    const nearestMap = {};
    let simultaneous = 0;

    for (const pt of particles) {
      if (!pt.active || pt.isRed) continue;
      let nearest = null, nearestD = Infinity;
      for (const q of particles) {
        if (!q.active || !q.isRed) continue;
        const d = p.dist(pt.x, pt.y, q.x, q.y);
        if (d < nearestD) { nearestD = d; nearest = q; }
      }
      nearestMap[pt.id] = { nearest, nearestD };
      if (pt.dragging && nearest && nearestD < CONNECT_RADIUS) simultaneous++;
    }

    const multiplier = simultaneous > 0 ? Math.min(simultaneous, MAX_SPEED_MULT) : 1;

    for (const pt of particles) {
      if (!pt.active || pt.isRed) continue;
      const { nearest, nearestD } = nearestMap[pt.id];

      if (pt.dragging && nearest && nearestD < CONNECT_RADIUS) {
        pt.connectProgress = p.min(1, pt.connectProgress + (p.deltaTime / GROW_MS) * multiplier);
      } else {
        pt.connectProgress = p.max(0, pt.connectProgress - p.deltaTime / DECAY_MS);
      }

      if (pt.connectProgress >= 1 && nearest) {
        convertToRed(pt, nearest);
      }
    }
  }

  function randOffset(rad) {
    const a = p.random(p.TWO_PI);
    const m = p.random(rad * 0.3, rad * 0.85);
    return { dx: p.cos(a) * m, dy: p.sin(a) * m };
  }

  function convertToRed(pt, target) {
    const ang = p.atan2(pt.y - target.y, pt.x - target.x);
    pt.homeX = p.constrain(target.x + p.cos(ang) * BOND_DISTANCE, pt.r, p.width - pt.r);
    pt.homeY = p.constrain(target.y + p.sin(ang) * BOND_DISTANCE, pt.r, p.height - pt.r);
    pt.x = pt.homeX;
    pt.y = pt.homeY;
    pt.isRed = true;
    pt.dragging = false;
    pt.connectProgress = 1;
    pt.repulsionStrength = 0.5;
    pt.phase = p.random(1000);

    networkEdges.push([pt.id, target.id, randOffset(pt.r), randOffset(target.r)]);
    target.repulsionStrength = p.max(0.15, target.repulsionStrength * 0.6);

    const activeBlacks = particles.filter(q => q.active && !q.isRed).length;
    if (activeBlacks === 0) {
      phase = 'converge';
      convergeStart = p.millis();
    }
  }

  function updateConverge() {
    const cx = p.width / 2, cy = p.height / 2;
    for (const pt of particles) {
      if (!pt.active) continue;
      pt.x = p.lerp(pt.x, cx, 0.035);
      pt.y = p.lerp(pt.y, cy, 0.035);
    }
    if (p.millis() - convergeStart > CONVERGE_DURATION) {
      phase = 'fade';
      fadeState = 'out';
      fadeStart = p.millis();
    }
  }

  function updateFade() {
    const elapsed = p.millis() - fadeStart;
    if (fadeState === 'out') {
      fadeAlpha = p.map(p.constrain(elapsed, 0, FADE_DURATION), 0, FADE_DURATION, 0, 255);
      if (elapsed >= FADE_DURATION) {
        resetAll();
        phase = 'fade';
        fadeState = 'in';
        fadeStart = p.millis();
      }
    } else if (fadeState === 'in') {
      fadeAlpha = p.map(p.constrain(elapsed, 0, FADE_DURATION), 0, FADE_DURATION, 255, 0);
      if (elapsed >= FADE_DURATION) {
        phase = 'play';
        fadeAlpha = 0;
      }
    }
  }

  function drawNetworkEdges() {
    p.stroke(RED);
    p.strokeWeight(2.5);
    for (const [i, j, offA, offB] of networkEdges) {
      const a = particles[i], b = particles[j];
      if (!a || !b || !a.active || !b.active) continue;
      p.line(a.x + offA.dx, a.y + offA.dy, b.x + offB.dx, b.y + offB.dy);
    }
  }

  function drawParticles() {
    p.noStroke();
    for (const pt of particles) {
      if (!pt.active) continue;
      if (pt.isRed && phase === 'play') {
        p.noFill();
        p.stroke(RED);
        p.strokeWeight(1);
        p.circle(pt.x, pt.y, REPEL_RADIUS * 2 * 0.35);
        p.noStroke();
      }
      const c = pt.isRed ? colRed : p.lerpColor(colBlack, colRed, pt.connectProgress);
      p.fill(c);
      drawShape(pt);
    }
  }

  function drawShape(pt) {
    p.push();
    p.translate(pt.x, pt.y);
    if (pt.shape === 'circle') {
      p.circle(0, 0, pt.r * 2);
    } else if (pt.shape === 'square') {
      p.rotate(pt.rot);
      p.rectMode(p.CENTER);
      p.rect(0, 0, pt.r * 1.8, pt.r * 1.8);
    } else {
      p.rotate(pt.rot);
      p.triangle(-pt.r, pt.r * 0.8, pt.r, pt.r * 0.8, 0, -pt.r);
    }
    p.pop();
  }

  function findParticleAt(x, y) {
    if (phase !== 'play') return null;
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      if (!pt.active || pt.isRed) continue;
      if (p.dist(x, y, pt.x, pt.y) < pt.r + 14) return pt;
    }
    return null;
  }

  p.touchStarted = () => {
    for (const t of p.touches) {
      const pt = findParticleAt(t.x, t.y);
      if (pt) {
        pt.dragging = true;
        pt.dragTargetX = t.x;
        pt.dragTargetY = t.y;
        activeTouches[t.id] = pt.id;
      }
    }
    return false;
  };

  p.touchMoved = () => {
    for (const t of p.touches) {
      const pid = activeTouches[t.id];
      if (pid !== undefined) {
        const pt = particles[pid];
        pt.dragTargetX = t.x;
        pt.dragTargetY = t.y;
      }
    }
    return false;
  };

  p.touchEnded = () => {
    const stillActive = {};
    for (const t of p.touches) stillActive[t.id] = true;
    for (const id in activeTouches) {
      if (!stillActive[id]) {
        const pt = particles[activeTouches[id]];
        if (pt) pt.dragging = false;
        delete activeTouches[id];
      }
    }
    return false;
  };

  p.mousePressed = () => {
    const pt = findParticleAt(p.mouseX, p.mouseY);
    if (pt) {
      pt.dragging = true;
      pt.dragTargetX = p.mouseX;
      pt.dragTargetY = p.mouseY;
      activeTouches['mouse'] = pt.id;
    }
  };
  p.mouseDragged = () => {
    const pid = activeTouches['mouse'];
    if (pid !== undefined) {
      const pt = particles[pid];
      pt.dragTargetX = p.mouseX;
      pt.dragTargetY = p.mouseY;
    }
  };
  p.mouseReleased = () => {
    const pid = activeTouches['mouse'];
    if (pid !== undefined) {
      const pt = particles[pid];
      if (pt) pt.dragging = false;
      delete activeTouches['mouse'];
    }
  };
};

new p5(sketchEmpatia, 'empatia');
