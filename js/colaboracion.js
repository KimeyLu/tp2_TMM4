const sketchColaboracion = (p) => {
  const BG = '#EFD583';
  const BLACK = '#141414';
  const RED = '#970511';
  const GROUP_THRESHOLD = 3;
  
  // Constantes base (calculadas para una resolución de 400x400)
  const BASE_CANVAS = 400;
  const BASE_MAX_STRETCH = 110;
  const BASE_HOVER_TOLERANCE = 14;
  const N_PARTICLES = 11;

  let currentScale = 1;
  let container;
  let particles = [];
  let edges = [];
  let activeTouches = {};
  let hoveredId = null;

  let lineTop, lineBottom, lineNormal;

  function updateScale() {
    currentScale = Math.min(p.width, p.height) / BASE_CANVAS;
  }

  function setupLine() {
    lineBottom = { x: 0, y: p.height };
    lineTop = { x: p.width, y: 0 };
    
    const dx = lineTop.x - lineBottom.x;
    const dy = lineTop.y - lineBottom.y;
    const len = Math.hypot(dx, dy) || 1;
    
    lineNormal = { x: p.height / len, y: p.width / len };
  }

  function sideDistance(x, y) {
    return (x - lineBottom.x) * lineNormal.x + (y - lineBottom.y) * lineNormal.y;
  }

  p.setup = () => {
    container = document.getElementById('colaboracion');
    p.createCanvas(400, 400);
    updateScale();
    setupLine();
    initParticles();

    if (container) {
      container.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!mouseInsideCanvas()) return;
        const pt = findParticleAt(p.mouseX, p.mouseY);
        if (pt) {
          pt.entering = false; // Permite selección temprana
          pt.heldPersist = !pt.heldPersist;
        }
      });
    }
  };

  p.windowResized = () => {
    const w = container ? container.clientWidth : 400;
    const h = container ? container.clientHeight : 400;
    
    const oldW = p.width;
    const oldH = p.height;
    
    p.resizeCanvas(w, h);
    updateScale();
    setupLine();

    // Mantener la proporción de las partículas al cambiar el tamaño de la ventana
    const scaleX = w / oldW;
    const scaleY = h / oldH;
    
    for (let pt of particles) {
      pt.r = pt.rBase * currentScale;
      pt.x *= scaleX;
      pt.y *= scaleY;
    }
  };

  function initParticles() {
    particles = [];
    edges = [];
    activeTouches = {};
    hoveredId = null;
    const shapes = ['circle', 'square', 'triangle'];
    for (let i = 0; i < N_PARTICLES; i++) {
      particles.push(makeParticle(i, shapes[i % shapes.length], false));
    }
  }

  function makeParticle(id, shape, entering) {
    const rBase = p.random(20, 28); // Tamaño base un poco más grande
    const r = rBase * currentScale;
    let px, py;
    
    if (entering) {
      px = -r - p.random(0, 100);
      py = p.random(r, p.height - r);
    } else {
      do {
        px = p.random(r, p.width - r);
        py = p.random(r, p.height - r);
      } while (sideDistance(px, py) > -r - 10);
    }

    return {
      id, shape, rBase, r,
      x: px, y: py,
      vx: p.random(0.3, 0.8) * (p.random() > 0.5 ? 1 : -1),
      vy: p.random(0.3, 0.8) * (p.random() > 0.5 ? 1 : -1),
      rot: p.random(-Math.PI, Math.PI),
      parent: id,
      heldPress: false,
      heldPersist: false,
      active: true,
      entering: entering
    };
  }

  function isHeld(pt) {
    return pt.heldPress || pt.heldPersist;
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

  function moveHeldParticle(pt, x, y) {
    let nx = x;
    let ny = y;

    const empowered = groupSizeOf(pt.id) >= GROUP_THRESHOLD;
    if (!empowered) {
      const sd = sideDistance(nx, ny);
      if (sd > -pt.r) {
        const push = sd + pt.r;
        nx -= lineNormal.x * push;
        ny -= lineNormal.y * push;
      }
      nx = p.constrain(nx, pt.r, p.width - pt.r);
      ny = p.constrain(ny, pt.r, p.height - pt.r);
    }

    pt.x = nx;
    pt.y = ny;
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
    updateHover();
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

  function mouseInsideCanvas() {
    return p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;
  }

  function updateHover() {
    hoveredId = mouseInsideCanvas() ? idOfParticleAt(p.mouseX, p.mouseY) : null;
  }

  function drawDivider() {
    p.stroke(BLACK);
    p.strokeWeight(5 * currentScale);
    p.line(lineBottom.x, lineBottom.y, lineTop.x, lineTop.y);
  }

  function checkConnections() {
    const held = particles.filter(pt => pt.active && isHeld(pt));
    for (let i = 0; i < held.length; i++) {
      for (let j = i + 1; j < held.length; j++) {
        const a = held[i], b = held[j];
        if (find(a.id) !== find(b.id)) {
          union(a.id, b.id);
          edges.push([a.id, b.id]);
          a.heldPersist = false;
          b.heldPersist = false;
        }
      }
    }
  }

  function updateParticles(roots) {
    const exitedThisFrame = [];

    for (const r in roots) {
      const group = roots[r];
      if (group.some(pt => isHeld(pt))) continue;
      const empowered = group.length >= GROUP_THRESHOLD;

      for (const pt of group) {
        if (pt.entering) {
          pt.x += 2 * currentScale;
          if (sideDistance(pt.x, pt.y) > -pt.r - (20 * currentScale)) {
              pt.entering = false;
          }
          continue;
        }

        pt.x += pt.vx * currentScale;
        pt.y += pt.vy * currentScale;
        
        const sd = sideDistance(pt.x, pt.y);

        if (sd > 0) {
          pt.vx = Math.abs(pt.vx) + 0.02;
          pt.vy = -Math.abs(pt.vy) - 0.02;

          if (pt.x - pt.r > p.width || pt.y + pt.r < 0) {
            pt.active = false;
            pt.parent = pt.id;
            edges = edges.filter(([i, j]) => i !== pt.id && j !== pt.id);
            exitedThisFrame.push(pt);
          }
        } else {
          if (pt.y < pt.r) { pt.y = pt.r; pt.vy = Math.abs(pt.vy); }
          if (pt.y > p.height - pt.r) { pt.y = p.height - pt.r; pt.vy = -Math.abs(pt.vy); }
          if (pt.x < pt.r) { pt.x = pt.r; pt.vx = Math.abs(pt.vx); }
          if (pt.x > p.width - pt.r) { pt.x = p.width - pt.r; pt.vx = -Math.abs(pt.vx); }

          if (!empowered && sd > -pt.r) {
            const push = sd + pt.r;
            pt.x -= lineNormal.x * push;
            pt.y -= lineNormal.y * push;
            
            const vn = pt.vx * lineNormal.x + pt.vy * lineNormal.y;
            if (vn > 0) {
              pt.vx -= 2 * vn * lineNormal.x;
              pt.vy -= 2 * vn * lineNormal.y;
            }
          }
        }
      }
    }

    if (exitedThisFrame.length > 0) handleExits();
  }

  function handleExits() {
    const activeCount = particles.filter(q => q.active).length;
    const leftCount = particles.filter(q => q.active && sideDistance(q.x, q.y) < 0).length;

    if (activeCount === 0) {
      fullReset();
    } else if (leftCount > 0 && leftCount < GROUP_THRESHOLD) {
      const needed = GROUP_THRESHOLD - leftCount;
      const waiting = particles.filter(q => !q.active);
      for(let i = 0; i < needed && i < waiting.length; i++) {
         reviveParticle(waiting[i]);
      }
    }
  }

  function applySpringConstraints() {
    const scaledMaxStretch = BASE_MAX_STRETCH * currentScale;
    const springFactor = 0.12; // Valor constante de tensión

    for (const [i, j] of edges) {
      const a = particles[i], b = particles[j];
      if (!a.active || !b.active) continue;
      const d = p.dist(a.x, a.y, b.x, b.y);
      if (d > scaledMaxStretch) {
        const excess = d - scaledMaxStretch;
        const dx = (b.x - a.x) / d, dy = (b.y - a.y) / d;
        const aCrossed = sideDistance(a.x, a.y) > 0;
        const bCrossed = sideDistance(b.x, b.y) > 0;
        
        if (!isHeld(a) && !aCrossed) { a.x += dx * excess * springFactor; a.y += dy * excess * springFactor; }
        if (!isHeld(b) && !bCrossed) { b.x -= dx * excess * springFactor; b.y -= dy * excess * springFactor; }
      }
    }
  }

  function clampAll(roots) {
    for (const pt of particles) {
      if (!pt.active || pt.entering) continue;
      const rootId = find(pt.id);
      const size = roots[rootId] ? roots[rootId].length : 1;
      
      const sd = sideDistance(pt.x, pt.y);
      
      if (sd <= 0) {
          if (pt.y < pt.r) pt.y = pt.r;
          if (pt.y > p.height - pt.r) pt.y = p.height - pt.r;
          if (pt.x < pt.r) pt.x = pt.r;
          
          if (size < GROUP_THRESHOLD) {
            if (sd > -pt.r) {
              const push = sd + pt.r;
              pt.x -= lineNormal.x * push;
              pt.y -= lineNormal.y * push;
            }
          }
      }
    }
  }

  function reviveParticle(pt) {
    pt.active = true;
    pt.entering = true;
    pt.heldPress = false;
    pt.heldPersist = false;
    pt.parent = pt.id;
    pt.rot = p.random(-Math.PI, Math.PI);
    pt.x = -pt.r - p.random(10, 100);
    pt.y = p.random(pt.r, p.height - pt.r);
    pt.vx = p.random(0.4, 0.8);
    pt.vy = p.random(-0.5, 0.5);
    pt.r = pt.rBase * currentScale; 
  }

  function fullReset() {
    edges = [];
    for (const pt of particles) {
      reviveParticle(pt);
      pt.entering = false;
      do {
        pt.x = p.random(pt.r, p.width - pt.r);
        pt.y = p.random(pt.r, p.height - pt.r);
      } while (sideDistance(pt.x, pt.y) > -pt.r - 10);
    }
  }

  function drawEdges() {
    p.stroke(RED);
    p.strokeWeight(2 * currentScale);
    for (const [i, j] of edges) {
      const a = particles[i], b = particles[j];
      if (!a.active || !b.active) continue;
      p.line(a.x, a.y, b.x, b.y);
    }
  }

  function drawParticles(roots) {
    for (const pt of particles) {
      if (!pt.active) continue;
      const size = roots[find(pt.id)] ? roots[find(pt.id)].length : 1;
      
      const heldState = isHeld(pt);
      const groupConnected = size >= GROUP_THRESHOLD;
      
      p.fill(groupConnected || heldState ? RED : BLACK);
      
      drawShape(pt, pt.id === hoveredId && !heldState, heldState);
    }
  }

  function drawShape(pt, isHovered, isHeldState) {
    p.push();
    p.translate(pt.x, pt.y);
    p.rotate(pt.rot);

    if (isHeldState) {
      p.noStroke();
      drawBaseShape(pt.shape, pt.r);
      
      p.noFill();
      p.stroke(RED);
      p.strokeWeight(2.5 * currentScale);
      drawBaseShape(pt.shape, pt.r * 1.5); 
    } else {
      if (isHovered) {
        p.stroke(RED);
        p.strokeWeight(2 * currentScale);
      } else {
        p.noStroke();
      }
      drawBaseShape(pt.shape, pt.r);
    }
    
    p.pop();
  }

  function drawBaseShape(shape, r) {
    if (shape === 'circle') {
      p.circle(0, 0, r * 2);
    } else if (shape === 'square') {
      p.rectMode(p.CENTER);
      p.rect(0, 0, r * 1.8, r * 1.8);
    } else {
      p.triangle(-r, r * 0.8, r, r * 0.8, 0, -r);
    }
  }

  function idOfParticleAt(x, y) {
    const scaledTolerance = BASE_HOVER_TOLERANCE * currentScale;
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      // Se elimina la restricción !pt.entering para poder detectar figuras entrando
      if (!pt.active) continue; 
      if (p.dist(x, y, pt.x, pt.y) < pt.r + scaledTolerance) return pt.id;
    }
    return null;
  }

  function findParticleAt(x, y) {
    const id = idOfParticleAt(x, y);
    return id === null ? null : particles[id];
  }

  p.touchStarted = () => {
    for (const t of p.touches) {
      if (activeTouches[t.id] !== undefined) continue;
      const pt = findParticleAt(t.x, t.y);
      if (pt) {
        pt.entering = false; // Permite selección temprana
        pt.heldPress = true;
        activeTouches[t.id] = pt.id;
      }
    }
    return false;
  };

  p.touchMoved = () => {
    for (const t of p.touches) {
      const pid = activeTouches[t.id];
      if (pid !== undefined) {
        moveHeldParticle(particles[pid], t.x, t.y);
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
        if (pt) pt.heldPress = false;
        delete activeTouches[id];
      }
    }
    return false;
  };

  p.mousePressed = (event) => {
    if (!mouseInsideCanvas()) return;
    if (event && event.button === 2) return;

    const pt = findParticleAt(p.mouseX, p.mouseY);
    if (!pt) return;

    pt.entering = false; // Permite selección temprana
    pt.heldPress = true;
    activeTouches['mouse'] = pt.id;
  };

  p.mouseDragged = () => {
    const pid = activeTouches['mouse'];
    if (pid !== undefined) {
      moveHeldParticle(particles[pid], p.mouseX, p.mouseY);
    }
  };

  p.mouseReleased = () => {
    const pid = activeTouches['mouse'];
    if (pid !== undefined) {
      const pt = particles[pid];
      if (pt) pt.heldPress = false;
      delete activeTouches['mouse'];
    }
  };
};

new p5(sketchColaboracion, 'colaboracion');
