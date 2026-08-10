const sketchIdentidad = (p) => {
  const BG = '#EFD583';
  const BLACK = '#141414';
  const RED = '#970511';

  const LINE_ANGLE = -Math.PI / 4;
  const CORNER_GAP = 70;
  const SQUARES_PER_LINE = 15;
  const SNAP_THRESHOLD = 42;
  const FLOW_SPEED = 1.1;
  const PULSE_DURATION = 300;
  const SETTLE_DURATION = 280;

  let container;
  let dirVec, perpVec;
  let LINE_DRAW_LEN, PARTICLE_RANGE, CORNER_OFFSET;
  let lines = [];
  let particles = [];
  let activeTouches = {};

  p.setup = () => {
    container = document.getElementById('identidad');
    p.createCanvas(400, 400);
    dirVec = { x: p.cos(LINE_ANGLE), y: p.sin(LINE_ANGLE) };
    perpVec = { x: -p.sin(LINE_ANGLE), y: p.cos(LINE_ANGLE) };
    setupLines();
    initParticles();
  };
/*
  p.windowResized = () => {
    p.resizeCanvas(container.offsetWidth, container.offsetHeight);
    setupLines();
  };
*/
  function setupLines() {
    LINE_DRAW_LEN = p.width + p.height;
    PARTICLE_RANGE = (p.width + p.height) * 0.55;
    CORNER_OFFSET = p.min(p.width, p.height) * 0.35;

    const offsets = [
      -CORNER_OFFSET - CORNER_GAP / 2,
      -CORNER_OFFSET + CORNER_GAP / 2,
       CORNER_OFFSET - CORNER_GAP / 2,
       CORNER_OFFSET + CORNER_GAP / 2
    ];

    lines = offsets.map(offset => ({
      p0: { x: p.width / 2 + perpVec.x * offset, y: p.height / 2 + perpVec.y * offset },
      dir: dirVec
    }));
  }

  function initParticles() {
    particles = [];
    activeTouches = {};
    let id = 0;
    const spacing = (2 * PARTICLE_RANGE) / SQUARES_PER_LINE;

    for (let li = 0; li < lines.length; li++) {
      const ln = lines[li];
      for (let s = 0; s < SQUARES_PER_LINE; s++) {
        const t = -PARTICLE_RANGE + s * spacing + p.random(-spacing * 0.15, spacing * 0.15);
        particles.push({
          id: id++,
          shape: 'square',
          r: p.random(22, 28),
          isIndividual: false,
          individualShape: null,
          individualRot: 0,
          lineIndex: li,
          nearestLineIndex: li,
          t: t,
          x: ln.p0.x + ln.dir.x * t,
          y: ln.p0.y + ln.dir.y * t,
          homeX: 0, homeY: 0,
          rot: 0,
          phase: p.random(1000),
          dragging: false,
          scale: 1,
          pulseTimer: 0,
          settleTimer: 0,
          settleFrom: null
        });
      }
    }
  }

  function distToLine(x, y, ln) {
    const dx = x - ln.p0.x, dy = y - ln.p0.y;
    return Math.abs(ln.dir.x * dy - ln.dir.y * dx);
  }

  p.draw = () => {
    p.background(BG);
    drawLines();
    updateParticles();
    drawParticles();
  };

  function drawLines() {
    p.stroke(RED);
    p.strokeWeight(2);
    for (const ln of lines) {
      const x1 = ln.p0.x - ln.dir.x * LINE_DRAW_LEN, y1 = ln.p0.y - ln.dir.y * LINE_DRAW_LEN;
      const x2 = ln.p0.x + ln.dir.x * LINE_DRAW_LEN, y2 = ln.p0.y + ln.dir.y * LINE_DRAW_LEN;
      p.line(x1, y1, x2, y2);
    }
  }

  function easeOutBack(x) {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  }

  function updateParticles() {
    for (const pt of particles) {
      const prevX = pt.x, prevY = pt.y;

      if (pt.dragging) {
        checkLiveTransform(pt);
      } else if (pt.isIndividual) {
        pt.x = pt.homeX + p.sin(p.frameCount * 0.02 + pt.phase) * 3;
        pt.y = pt.homeY + p.cos(p.frameCount * 0.017 + pt.phase) * 3;
      } else {
        const ln = lines[pt.lineIndex];
        pt.t += FLOW_SPEED * (p.deltaTime / 16.6667);
        if (pt.t > PARTICLE_RANGE) pt.t -= 2 * PARTICLE_RANGE;
        const targetX = ln.p0.x + ln.dir.x * pt.t;
        const targetY = ln.p0.y + ln.dir.y * pt.t;

        if (pt.settleTimer > 0) {
          pt.settleTimer -= p.deltaTime;
          const tNorm = p.constrain(1 - pt.settleTimer / SETTLE_DURATION, 0, 1);
          const eased = easeOutBack(tNorm);
          pt.x = p.lerp(pt.settleFrom.x, targetX, eased);
          pt.y = p.lerp(pt.settleFrom.y, targetY, eased);
        } else {
          pt.x = targetX;
          pt.y = targetY;
        }
      }

      const speed = p.dist(prevX, prevY, pt.x, pt.y);
      let targetScale = 1;
      if (pt.dragging) {
        targetScale = 1.15 + p.min(speed * 0.03, 0.15);
      } else if (pt.pulseTimer > 0) {
        pt.pulseTimer -= p.deltaTime;
        targetScale = 1 + 0.35 * Math.max(0, pt.pulseTimer / PULSE_DURATION);
      }
      pt.scale = p.lerp(pt.scale, targetScale, 0.25);
    }
  }

  function checkLiveTransform(pt) {
    let minDist = Infinity, nearestIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const d = distToLine(pt.x, pt.y, lines[i]);
      if (d < minDist) { minDist = d; nearestIdx = i; }
    }
    pt.nearestLineIndex = nearestIdx;
    pt.nearLineDist = minDist;

    if (!pt.isIndividual && minDist > SNAP_THRESHOLD) {
      pt.isIndividual = true;
      if (!pt.individualShape) {
        pt.individualShape = p.random(['circle', 'triangle', 'square']);
        pt.individualRot = p.random(-0.3, 0.3);
      }
      pt.shape = pt.individualShape;
      pt.rot = pt.individualRot;
      pt.pulseTimer = PULSE_DURATION;
    } else if (pt.isIndividual && minDist <= SNAP_THRESHOLD) {
      pt.isIndividual = false;
      pt.shape = 'square';
      pt.rot = 0;
      pt.pulseTimer = PULSE_DURATION;
    }
  }

  function finalizeRelease(pt) {
    if (!pt.isIndividual) {
      const ln = lines[pt.nearestLineIndex];
      const dx = pt.x - ln.p0.x, dy = pt.y - ln.p0.y;
      const t = ln.dir.x * dx + ln.dir.y * dy;
      pt.lineIndex = pt.nearestLineIndex;
      pt.t = t;
      pt.settleFrom = { x: pt.x, y: pt.y };
      pt.settleTimer = SETTLE_DURATION;
      pt.pulseTimer = PULSE_DURATION;
    } else {
      pt.homeX = pt.x;
      pt.homeY = pt.y;
      pt.phase = p.random(1000);
      pt.pulseTimer = PULSE_DURATION;
    }
  }

  function drawParticles() {
    for (const pt of particles) {
      if (pt.dragging) {
        p.noFill();
        p.stroke(pt.isIndividual ? RED : BLACK);
        p.strokeWeight(1.5);
        p.circle(pt.x, pt.y, pt.r * 2 * pt.scale + 16);
      }
      p.noStroke();
      p.fill(pt.isIndividual ? RED : BLACK);
      drawShape(pt);
    }
  }

  function drawShape(pt) {
    p.push();
    p.translate(pt.x, pt.y);
    p.scale(pt.scale || 1);
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
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      if (p.dist(x, y, pt.x, pt.y) < pt.r + 14) return pt;
    }
    return null;
  }

  p.touchStarted = () => {
    for (const t of p.touches) {
      const pt = findParticleAt(t.x, t.y);
      if (pt) {
        pt.dragging = true;
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
        pt.x = p.constrain(t.x, pt.r, p.width - pt.r);
        pt.y = p.constrain(t.y, pt.r, p.height - pt.r);
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
        if (pt) { pt.dragging = false; finalizeRelease(pt); }
        delete activeTouches[id];
      }
    }
    return false;
  };

  p.mousePressed = () => {
    const pt = findParticleAt(p.mouseX, p.mouseY);
    if (pt) {
      pt.dragging = true;
      activeTouches['mouse'] = pt.id;
    }
  };
  p.mouseDragged = () => {
    const pid = activeTouches['mouse'];
    if (pid !== undefined) {
      const pt = particles[pid];
      pt.x = p.constrain(p.mouseX, pt.r, p.width - pt.r);
      pt.y = p.constrain(p.mouseY, pt.r, p.height - pt.r);
    }
  };
  p.mouseReleased = () => {
    const pid = activeTouches['mouse'];
    if (pid !== undefined) {
      const pt = particles[pid];
      if (pt) { pt.dragging = false; finalizeRelease(pt); }
      delete activeTouches['mouse'];
    }
  };
};

new p5(sketchIdentidad, 'identidad');
