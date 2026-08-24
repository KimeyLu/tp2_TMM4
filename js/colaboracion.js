const sketchColaboracion = (p) => {
  const BG = '#EFD583';
  const BLACK = '#141414';
  const RED = '#970511';
  const GROUP_THRESHOLD = 3;
  const MAX_STRETCH = 110;
  const SPRING_FACTOR = 0.12;
  const N_PARTICLES = 11;
  const HOVER_TOLERANCE = 14; // px extra de "área de agarre" alrededor de cada figura

  let container;
  let particles = [];
  let edges = [];
  let activeTouches = {}; // touchId (o 'mouse') -> particleId, mientras hay contacto activo
  let hoveredId = null; // qué figura está bajo el cursor ahora mismo (solo mouse)

  // ---------- LÍNEA DIVISORIA DIAGONAL ----------
  // en vez de una barrera vertical, va en diagonal (estilo "identidad").
  // se define con dos puntos; el resto se deriva de ahí.
  let lineTop, lineBottom, lineNormal, allowedSign;

  function setupLine() {
    lineTop = { x: p.width * 0.34, y: 0 };
    lineBottom = { x: p.width * 0.74, y: p.height };
    const dx = lineBottom.x - lineTop.x;
    const dy = lineBottom.y - lineTop.y;
    const len = Math.hypot(dx, dy) || 1;
    lineNormal = { x: -dy / len, y: dx / len };
    // el lado "permitido" (donde arrancan las figuras) es el izquierdo
    allowedSign = Math.sign(rawSideDistance(10, p.height / 2)) || 1;
  }

  function rawSideDistance(x, y) {
    return (x - lineTop.x) * lineNormal.x + (y - lineTop.y) * lineNormal.y;
  }

  // distancia con signo al lado permitido: positiva = todavía no cruzó, negativa = ya cruzó
  function sideDistance(x, y) {
    return rawSideDistance(x, y) * allowedSign;
  }

  // x de la línea a una altura y dada (para ubicar a las figuras al generarlas)
  function lineXAt(y) {
    const t = p.height === 0 ? 0 : y / p.height;
    return lineTop.x + (lineBottom.x - lineTop.x) * t;
  }

  p.setup = () => {
    container = document.getElementById('colaboracion');
    p.createCanvas(400, 400);
    setupLine();
    initParticles();

    // el click derecho selecciona (toggle) en vez de abrir el menú contextual
    // del navegador. Usamos el evento nativo 'contextmenu' en lugar de
    // p.mouseButton === p.RIGHT porque ese chequeo es poco confiable entre
    // navegadores/trackpads; 'contextmenu' es el evento que realmente
    // representa "click derecho / click secundario" de forma consistente.
    if (container) {
      container.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (!mouseInsideCanvas()) return;
        const pt = findParticleAt(p.mouseX, p.mouseY);
        if (pt) pt.heldPersist = !pt.heldPersist;
      });
    }
  };

 /* p.windowResized = () => {
    p.resizeCanvas(container.offsetWidth, container.offsetHeight);
    setupLine();
  }; */

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
    const r = p.random(24, 32);
    const y = p.random(r, p.height - r);
    const maxX = Math.max(90, lineXAt(y) - 70);
    return {
      id, shape, r,
      x: entering ? -r - p.random(0, 300) : p.random(60, maxX),
      y,
      vx: p.random(0.3, 0.6),
      vy: p.random(-0.3, 0.3),
      rot: p.random(-0.3, 0.3),
      parent: id,
      heldPress: false,   // contacto activo (touch o click izquierdo sostenido)
      heldPersist: false, // selección persistente (click derecho, se mantiene hasta volver a tocar)
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

  // mueve una figura mientras se la sostiene (dedo o click izquierdo). Si su
  // grupo todavía no llegó al umbral, no la deja cruzar la diagonal a mano,
  // igual que el movimiento automático.
  function moveHeldParticle(pt, x, y) {
    let nx = p.constrain(x, pt.r, p.width - pt.r);
    let ny = p.constrain(y, pt.r, p.height - pt.r);

    const empowered = groupSizeOf(pt.id) >= GROUP_THRESHOLD;
    if (!empowered) {
      const sd = sideDistance(nx, ny);
      if (sd < pt.r) {
        const push = pt.r - sd;
        nx += lineNormal.x * allowedSign * push;
        ny += lineNormal.y * allowedSign * push;
      }
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
    p.strokeWeight(4);
    p.line(lineTop.x, lineTop.y, lineBottom.x, lineBottom.y);
    p.stroke(RED);
    p.strokeWeight(1.5);
    p.line(
      lineTop.x + lineNormal.x * 9, lineTop.y + lineNormal.y * 9,
      lineBottom.x + lineNormal.x * 9, lineBottom.y + lineNormal.y * 9
    );
  }

  // Conecta TODAS las figuras que estén siendo seleccionadas al mismo tiempo
  // (uno o varios dedos en simultáneo, o varias marcadas con click derecho).
  // Ya no hace falta acercarlas ni hacer pinza: alcanza con tenerlas activas juntas.
  function checkConnections() {
    const held = particles.filter(pt => pt.active && isHeld(pt));
    for (let i = 0; i < held.length; i++) {
      for (let j = i + 1; j < held.length; j++) {
        const a = held[i], b = held[j];
        if (find(a.id) !== find(b.id)) {
          union(a.id, b.id);
          edges.push([a.id, b.id]);
          // una vez conectadas, se libera la selección persistente:
          // ya cumplió su función, no hace falta seguir "marcándolas".
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
          pt.x += 1.5;
          if (pt.x > pt.r) pt.entering = false;
          continue;
        }

        pt.x += pt.vx;
        pt.y += pt.vy;
        if (pt.y < pt.r) { pt.y = pt.r; pt.vy = Math.abs(pt.vy); }
        if (pt.y > p.height - pt.r) { pt.y = p.height - pt.r; pt.vy = -Math.abs(pt.vy); }
        if (pt.x < pt.r) { pt.x = pt.r; pt.vx = Math.abs(pt.vx); }

        const sd = sideDistance(pt.x, pt.y);
        if (!empowered && sd < pt.r) {
          // rebota contra la diagonal: la empuja de vuelta y refleja su velocidad
          const push = pt.r - sd;
          pt.x += lineNormal.x * allowedSign * push;
          pt.y += lineNormal.y * allowedSign * push;
          const vn = pt.vx * lineNormal.x + pt.vy * lineNormal.y;
          pt.vx -= 2 * vn * lineNormal.x;
          pt.vy -= 2 * vn * lineNormal.y;
        }

        // una vez cruzada la línea, ya no puede retroceder
        if (sd < 0) {
          const vnAllowed = (pt.vx * lineNormal.x + pt.vy * lineNormal.y) * allowedSign;
          if (vnAllowed > 0) {
            const vn = pt.vx * lineNormal.x + pt.vy * lineNormal.y;
            pt.vx -= 2 * vn * lineNormal.x;
            pt.vy -= 2 * vn * lineNormal.y;
          }
        }

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
        const aCrossed = sideDistance(a.x, a.y) < 0;
        const bCrossed = sideDistance(b.x, b.y) < 0;
        if (!isHeld(a) && !aCrossed) { a.x += dx * excess * SPRING_FACTOR; a.y += dy * excess * SPRING_FACTOR; }
        if (!isHeld(b) && !bCrossed) { b.x -= dx * excess * SPRING_FACTOR; b.y -= dy * excess * SPRING_FACTOR; }
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
      if (size < GROUP_THRESHOLD) {
        const sd = sideDistance(pt.x, pt.y);
        if (sd < pt.r) {
          const push = pt.r - sd;
          pt.x += lineNormal.x * allowedSign * push;
          pt.y += lineNormal.y * allowedSign * push;
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
    for (const pt of particles) {
      if (!pt.active) continue;
      const size = roots[find(pt.id)] ? roots[find(pt.id)].length : 1;
      p.fill(size >= GROUP_THRESHOLD ? RED : BLACK);
      drawShape(pt, pt.id === hoveredId && !isHeld(pt), isHeld(pt));
    }
  }

  // isHovered: el cursor está encima (solo mouse) -> anillo fino, indica "podés interactuar"
  // isHeld: está seleccionada ahora mismo -> anillo grueso color BG, bien visible
  function drawShape(pt, isHovered, isHeld) {
    p.push();
    p.translate(pt.x, pt.y);
    if (isHeld) {
      p.stroke(BG);
      p.strokeWeight(4);
    } else if (isHovered) {
      p.stroke(RED);
      p.strokeWeight(2);
    } else {
      p.noStroke();
    }
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

  function idOfParticleAt(x, y) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const pt = particles[i];
      if (!pt.active || pt.entering) continue;
      if (p.dist(x, y, pt.x, pt.y) < pt.r + HOVER_TOLERANCE) return pt.id;
    }
    return null;
  }

  function findParticleAt(x, y) {
    const id = idOfParticleAt(x, y);
    return id === null ? null : particles[id];
  }

  // ---------- TOUCH: mantener el dedo sobre una figura la selecciona y la
  // deja arrastrar; en cuanto hay 2+ seleccionadas al mismo tiempo, se
  // conectan solas (no hace falta juntarlas para eso) ----------
  p.touchStarted = () => {
    for (const t of p.touches) {
      if (activeTouches[t.id] !== undefined) continue;
      const pt = findParticleAt(t.x, t.y);
      if (pt) {
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

  // ---------- MOUSE ----------
  // click izquierdo sostenido: selección momentánea + arrastre, igual que un dedo.
  // click derecho: selección persistente (toggle) — se maneja arriba, en el
  // listener de 'contextmenu', no acá.
  p.mousePressed = (event) => {
    if (!mouseInsideCanvas()) return;
    if (event && event.button === 2) return; // lo maneja el listener de contextmenu

    const pt = findParticleAt(p.mouseX, p.mouseY);
    if (!pt) return;

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
