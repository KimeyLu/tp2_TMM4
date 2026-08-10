const sketchColaboracion = (p) => {
  const BG = '#EFD583';
  const BLACK = '#141414';
  const RED = '#970511';
  const GROUP_THRESHOLD = 3;
  const CONNECT_DIST = 75;
  const CLOSE_CONNECT_DIST = 40;
  const MAX_STRETCH = 110;
  const SPRING_FACTOR = 0.12;
  const N_PARTICLES = 11;

  let container;
  let particles = [];
  let edges = [];
  let lineX;
  let activeTouches = {};

  p.setup = () => {
    container = document.getElementById('colaboracion');
    p.createCanvas(400, 400);
    lineX = p.width * 0.58;
    initParticles();
  };

 /* p.windowResized = () => {
    p.resizeCanvas(container.offsetWidth, container.offsetHeight);
    lineX = p.width * 0.58;
  }; */

  function initParticles() {
    particles = [];
    edges = [];
    activeTouches = {};
    const shapes = ['circle', 'square', 'triangle'];
    for (let i = 0; i < N_PARTICLES; i++) {
      particles.push(makeParticle(i, shapes[i % shapes.length], false));
    }
  }

  function makeParticle(id, shape, entering) {
    const r = p.random(24, 32);
    return {
      id, shape, r,
      x: entering ? -r - p.random(0, 300) : p.random(60, lineX - 70),
      y: p.random(r, p.height - r),
      vx: p.random(0.3, 0.6),
      vy: p.random(-0.3, 0.3),
      rot: p.random(-0.3, 0.3),
      parent: id,
      dragging: false,
      active: true,
      entering: entering,
      excludeIds: []
    };
  }

  function find(i) {
    if (particles[i].parent !== i) {
      particles[i].parent = find(particles[i].parent);
    }
    return particles[i].parent;
  }

  function union(a, b) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) particles[rb].parent = ra;
  }

  function groupSizeOf(id) {
    const root = find(id);
    let count = 0;
    for (const pt of particles) if (pt.active && find(pt.id) === root) count++;
    return count;
  }

  function computeRoots() {
    const roots = {};
    for (const pt of particles) {
      if (!pt.active) continue;
      const r = find(pt.id);
      if (!roots[r]) roots[r] = [];
      roots[r].push(pt);
    }
    return roots;
  }

  p.draw = () => {
    p.background(BG);
    //drawDecorations();
    drawDivider();

    checkConnections();
    let roots = computeRoots();
    updateParticles(roots);
    roots = computeRoots();
    applySpringConstraints();
    clampAll(roots);

    drawEdges();
    drawParticles(roots);
  };

  function drawDivider() {
    p.stroke(BLACK);
    p.strokeWeight(4);
    p.line(lineX, 0, lineX, p.height);
    p.stroke(RED);
    p.strokeWeight(1.5);
    p.line(lineX + 9, 0, lineX + 9, p.height);
  }

  function drawDecorations() {
    p.push();
    const s = p.min(p.width, p.height) * 0.32;

    p.noFill();
    p.stroke(BLACK);
    p.strokeWeight(2);
    p.rectMode(p.CORNER);
    p.rect(p.width - s - 30, 30, s, s);

    p.stroke(RED);
    p.strokeWeight(1.5);
    p.line(p.width - 20, 20, p.width - 20 - s * 0.55, 20 + s * 0.55);

    p.stroke(RED);
    p.strokeWeight(2);
    for (let k = 0; k < 6; k++) {
      const off = k * 10;
      p.line(20 + off, 18, 20 + off, 66);
    }

    p.stroke(BLACK);
    p.strokeWeight(2);
    for (let k = 0; k < 5; k++) {
      const off = k * 9;
      p.line(p.width - 30 - off, p.height - 18, p.width - 30 - off, p.height - 62);
    }
    p.pop();
  }

  // Solo conecta figuras que el usuario está tocando/arrastrando activamente en simultáneo
  // (una en cada dedo). No se conecta arrastrando una sola hacia otra que está quieta.
  function checkConnections() {
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      if (!a.active || !a.dragging) continue;
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        if (!b.active || !b.dragging) continue;
        if (find(a.id) === find(b.id)) continue;
        const d = p.dist(a.x, a.y, b.x, b.y);
        const wasClose = a.excludeIds.includes(b.id) || b.excludeIds.includes(a.id);
        const threshold = wasClose ? CLOSE_CONNECT_DIST : CONNECT_DIST;
        if (d < threshold) {
          union(a.id, b.id);
          edges.push([a.id, b.id]);
        }
      }
    }
  }

  function updateParticles(roots) {
    const exitedThisFrame = [];

    for (const r in roots) {
      const group = roots[r];
      if (group.some(pt => pt.dragging)) continue;
      const empowered = group.length >= GROUP_THRESHOLD;

      for (const pt of group) {
        if (pt.entering) {
          pt.x += 1.5;
          if (pt.x > pt.r) pt.entering = false;
          continue;
        }

        pt.x += pt.vx;
        pt.y += pt.vy;
        if (pt.y < pt.r) { pt.y = pt.r; pt.vy = Math.abs(pt.vy); }
        if (pt.y > p.height - pt.r) { pt.y = p.height - pt.r; pt.vy = -Math.abs(pt.vy); }
        if (pt.x < pt.r) { pt.x = pt.r; pt.vx = Math.abs(pt.vx); }
        if (!empowered && pt.x > lineX - pt.r) { pt.x = lineX - pt.r; pt.vx = -Math.abs(pt.vx); }

        // una vez cruzada la línea, ya no puede retroceder: solo avanza hacia la derecha
        if (pt.x > lineX && pt.vx < 0) pt.vx = Math.abs(pt.vx);

        if (pt.x - pt.r > p.width) {
          pt.active = false;
          pt.parent = pt.id;
          edges = edges.filter(([i, j]) => i !== pt.id && j !== pt.id);
          exitedThisFrame.push(pt);
        }
      }
    }

    if (exitedThisFrame.length > 0) handleExits();
  }

  function handleExits() {
    const activeCount = particles.filter(q => q.active).length;
    if (activeCount === 0) {
      fullReset();
    } else if (activeCount < GROUP_THRESHOLD) {
      activateOneWaiting();
    }
  }

  function applySpringConstraints() {
    for (const [i, j] of edges) {
      const a = particles[i], b = particles[j];
      if (!a.active || !b.active) continue;
      const d = p.dist(a.x, a.y, b.x, b.y);
      if (d > MAX_STRETCH) {
        const excess = d - MAX_STRETCH;
        const dx = (b.x - a.x) / d, dy = (b.y - a.y) / d;
        // una figura que ya cruzó la línea nunca es tironeada hacia atrás por el resorte
        const aCrossed = a.x > lineX;
        const bCrossed = b.x > lineX;
        if (!a.dragging && !aCrossed) { a.x += dx * excess * SPRING_FACTOR; a.y += dy * excess * SPRING_FACTOR; }
        if (!b.dragging && !bCrossed) { b.x -= dx * excess * SPRING_FACTOR; b.y -= dy * excess * SPRING_FACTOR; }
      }
    }
  }

  function clampAll(roots) {
    for (const pt of particles) {
      if (!pt.active || pt.entering) continue;
      const rootId = find(pt.id);
      const size = roots[rootId] ? roots[rootId].length : 1;
      if (pt.y < pt.r) pt.y = pt.r;
      if (pt.y > p.height - pt.r) pt.y = p.height - pt.r;
      if (pt.x < pt.r) pt.x = pt.r;
      if (size < GROUP_THRESHOLD && pt.x > lineX - pt.r) pt.x = lineX - pt.r;
    }
  }

  function reviveParticle(pt) {
    pt.active = true;
    pt.entering = true;
    pt.dragging = false;
    pt.parent = pt.id;
    pt.excludeIds = [];
    pt.rot = p.random(-0.3, 0.3);
    pt.x = -pt.r - p.random(0, 260);
    pt.y = p.random(pt.r, p.height - pt.r);
    pt.vx = p.random(0.3, 0.6);
    pt.vy = p.random(-0.3, 0.3);
  }

  function fullReset() {
    edges = [];
    for (const pt of particles) reviveParticle(pt);
  }

  function activateOneWaiting() {
    const waiting = particles.filter(q => !q.active);
    if (waiting.length === 0) return;
    reviveParticle(p.random(waiting));
  }

  function drawEdges() {
    p.stroke(RED);
    p.strokeWeight(2);
    for (const [i, j] of edges) {
      const a = particles[i], b = particles[j];
      if (!a.active || !b.active) continue;
      p.line(a.x, a.y, b.x, b.y);
    }
  }

  function drawParticles(roots) {
    p.noStroke();
    for (const pt of particles) {
      if (!pt.active) continue;
      const size = roots[find(pt.id)] ? roots[find(pt.id)].length : 1;
      p.fill(size >= GROUP_THRESHOLD ? RED : BLACK);
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
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      if (!pt.active || pt.entering) continue;
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
        pt.excludeIds = particles
          .filter(q => q.active && q.id !== pt.id && p.dist(pt.x, pt.y, q.x, q.y) < CONNECT_DIST)
          .map(q => q.id);
      }
    }
    return false;
  };

  p.touchMoved = () => {
    for (const t of p.touches) {
      const pid = activeTouches[t.id];
      if (pid !== undefined) {
        const pt = particles[pid];
        const size = groupSizeOf(pt.id);
        const maxX = size >= GROUP_THRESHOLD ? p.width - pt.r : lineX - pt.r;
        pt.x = p.constrain(t.x, pt.r, maxX);
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
        pt.dragging = false;
        pt.excludeIds = [];
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
      pt.excludeIds = particles
        .filter(q => q.active && q.id !== pt.id && p.dist(pt.x, pt.y, q.x, q.y) < CONNECT_DIST)
        .map(q => q.id);
    }
  };
  p.mouseDragged = () => {
    const pid = activeTouches['mouse'];
    if (pid !== undefined) {
      const pt = particles[pid];
      const size = groupSizeOf(pt.id);
      const maxX = size >= GROUP_THRESHOLD ? p.width - pt.r : lineX - pt.r;
      pt.x = p.constrain(p.mouseX, pt.r, maxX);
      pt.y = p.constrain(p.mouseY, pt.r, p.height - pt.r);
    }
  };
  p.mouseReleased = () => {
    const pid = activeTouches['mouse'];
    if (pid !== undefined) {
      const pt = particles[pid];
      pt.dragging = false;
      pt.excludeIds = [];
      delete activeTouches['mouse'];
    }
  };
};

new p5(sketchColaboracion, 'colaboracion');
