/* ============================================================
   INCERTIDUMBRE 
   ============================================================ */

const sketchIncertidumbre = (p) => {
  const COLOR_BG = '#141414';
  const COLOR_RED = '#970511';
  const COLOR_CREAM = '#EFD583';

  const IDLE_SPEED = 0.02;
  const IDLE_AMP = 4;

  const FOLLOW_EASE = 0.28;   // qué tan rápido el círculo sigue al dedo/mouse mientras se arrastra
  const RETRACT_EASE = 0.18;  // qué tan rápido vuelve a su anclaje al soltar
  const CONNECT_FACTOR = 0.22; // qué tan cerca (relativo al tamaño del canvas) hay que arrastrar de OTRO cuadrado para transferirse

  const GATE_CLOSE_MS = 140;
  const GATE_HOLD_MS = 260;
  const GATE_REOPEN_MS = 320;
  const GATE_EXTEND_FACTOR = 2.6; // cuánto se alarga la barra al cerrarse
  const GATE_MIN_INTERVAL = 1800;
  const GATE_MAX_INTERVAL = 3600;
  const GATE_DANGER_FROM = 0.55; // a partir de qué tan "cerrada" (0-1) ya puede romper al círculo

  const DEATH_MS = 420;

  let size; // min(width, height): referencia de escala para todo
  let squares = []; // los dos cuadrados rojos (bases)
  let gates = [];    // las dos barras crema
  let player;
  let dragging = false;
  let activePointer = null; // 'mouse' o el id de un touch
  let pointerPos = { x: 0, y: 0 };
  let nextGateEventTimer = 0;

  p.setup = () => {
    p.createCanvas(400, 400);
    buildScene(false);
  };

  p.windowResized = () => {
    const { w, h } = window.getCanvasTargetSize('incertidumbre', 400, 400);
    p.resizeCanvas(w, h);
    buildScene(true);
  };

  function buildScene(keepPlayer) {
    size = Math.min(p.width, p.height);

    // dos cuadrados en la diagonal "/" (arriba-derecha y abajo-izquierda)
    squares = [
      makeSquare(p.width * 0.74, p.height * 0.26, size * 0.30, p.radians(45)),
      makeSquare(p.width * 0.26, p.height * 0.74, size * 0.30, p.radians(45))
    ];

    // dos barras en la diagonal "\" (arriba-izquierda y abajo-derecha)
    gates = [
      makeGate(p.width * 0.20, p.height * 0.20, size * 0.34, size * 0.11, p.radians(45)),
      makeGate(p.width * 0.80, p.height * 0.80, size * 0.34, size * 0.11, p.radians(45))
    ];

    if (!keepPlayer || !player) {
      player = makePlayer(0, 0);
    } else {
      // reubica al jugador en el mismo cuadrado/borde que tenía, con la nueva geometría
      const edges = squareEdges(squares[player.squareIndex]);
      const anchor = midpoint(edges[player.edgeIndex].a, edges[player.edgeIndex].b);
      player.anchor = anchor;
      player.pos = { x: anchor.x, y: anchor.y };
    }

    scheduleNextGateEvent();
  }

  // ---------- geometría de los cuadrados ----------
  function makeSquare(cx, cy, side, rot) {
    return { cx, cy, side, rot, phase: p.random(1000) };
  }

  function rotatePoint(pt, rot, cx, cy) {
    const cosA = Math.cos(rot), sinA = Math.sin(rot);
    return {
      x: cx + pt.x * cosA - pt.y * sinA,
      y: cy + pt.x * sinA + pt.y * cosA
    };
  }

  function squareEdges(sq) {
    const h = sq.side / 2;
    const local = [
      { x: -h, y: -h }, { x: h, y: -h }, { x: h, y: h }, { x: -h, y: h }
    ];
    const corners = local.map(pt => rotatePoint(pt, sq.rot, sq.cx, sq.cy));
    const edges = [];
    for (let i = 0; i < 4; i++) {
      edges.push({ a: corners[i], b: corners[(i + 1) % 4] });
    }
    return edges;
  }

  function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function closestPointOnSegment(pt, a, b) {
    const abx = b.x - a.x, aby = b.y - a.y;
    const apx = pt.x - a.x, apy = pt.y - a.y;
    const lenSq = abx * abx + aby * aby;
    let t = lenSq === 0 ? 0 : (apx * abx + apy * aby) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = a.x + abx * t, cy = a.y + aby * t;
    const dx = pt.x - cx, dy = pt.y - cy;
    return { point: { x: cx, y: cy }, dist: Math.sqrt(dx * dx + dy * dy) };
  }

  // ---------- jugador ----------
  function makePlayer(squareIndex, edgeIndex) {
    const edges = squareEdges(squares[squareIndex]);
    const anchor = midpoint(edges[edgeIndex].a, edges[edgeIndex].b);
    return {
      squareIndex,
      edgeIndex,
      anchor: { x: anchor.x, y: anchor.y },
      pos: { x: anchor.x, y: anchor.y },
      r: size * 0.028,
      state: 'alive', // 'alive' | 'dead'
      deathTimer: 0
    };
  }

  function clampToCanvas(x, y) {
    return {
      x: p.constrain(x, player.r, p.width - player.r),
      y: p.constrain(y, player.r, p.height - player.r)
    };
  }

  function tryTransfer() {
    let bestDist = Infinity, best = null;
    for (let si = 0; si < squares.length; si++) {
      const edges = squareEdges(squares[si]);
      for (let ei = 0; ei < edges.length; ei++) {
        if (si === player.squareIndex && ei === player.edgeIndex) continue;
        const { point, dist } = closestPointOnSegment(player.pos, edges[ei].a, edges[ei].b);
        if (dist < bestDist) { bestDist = dist; best = { si, ei, point }; }
      }
    }

    const CONNECT_THRESH = size * CONNECT_FACTOR;
    if (best && bestDist < CONNECT_THRESH) {
      player.squareIndex = best.si;
      player.edgeIndex = best.ei;
      player.anchor = best.point;
    } else {
      // sigue en el mismo borde: el anclaje se desliza hasta el punto
      // más cercano de ESE borde al lugar donde se está arrastrando
      const edges = squareEdges(squares[player.squareIndex]);
      const e = edges[player.edgeIndex];
      const { point } = closestPointOnSegment(player.pos, e.a, e.b);
      player.anchor = point;
    }
  }

  function killPlayer() {
    player.state = 'dead';
    player.deathTimer = DEATH_MS;
    dragging = false;
    activePointer = null;
  }

  function revivePlayer() {
    const edges = squareEdges(squares[player.squareIndex]);
    const anchor = midpoint(edges[player.edgeIndex].a, edges[player.edgeIndex].b);
    player.anchor = anchor;
    player.pos = { x: anchor.x, y: anchor.y };
    player.state = 'alive';
  }

  function updatePlayer() {
    if (player.state === 'dead') {
      player.deathTimer -= p.deltaTime;
      if (player.deathTimer <= 0) revivePlayer();
      return;
    }

    if (dragging) {
      const target = clampToCanvas(pointerPos.x, pointerPos.y);
      player.pos.x = p.lerp(player.pos.x, target.x, FOLLOW_EASE);
      player.pos.y = p.lerp(player.pos.y, target.y, FOLLOW_EASE);
      tryTransfer();
    } else {
      player.pos.x = p.lerp(player.pos.x, player.anchor.x, RETRACT_EASE);
      player.pos.y = p.lerp(player.pos.y, player.anchor.y, RETRACT_EASE);
    }

    checkGateCollision();
  }

  function drawPlayer() {
    if (player.state === 'dead') return;

    p.stroke(COLOR_RED);
    p.strokeWeight(2);
    p.line(player.anchor.x, player.anchor.y, player.pos.x, player.pos.y);

    p.noStroke();
    p.fill(COLOR_RED);
    p.circle(player.pos.x, player.pos.y, player.r * 2);
  }

  // ---------- cuadrados (dibujo) ----------
  function drawSquares() {
    p.noFill();
    p.stroke(COLOR_RED);
    p.strokeWeight(3);
    for (const sq of squares) {
      const idleX = Math.sin(p.frameCount * IDLE_SPEED + sq.phase) * (IDLE_AMP * 0.6);
      const idleY = Math.cos(p.frameCount * IDLE_SPEED * 0.9 + sq.phase) * (IDLE_AMP * 0.6);
      p.push();
      p.translate(sq.cx + idleX, sq.cy + idleY);
      p.rotate(sq.rot);
      p.rectMode(p.CENTER);
      p.rect(0, 0, sq.side, sq.side);
      p.pop();
    }
  }

  // ---------- compuertas (crema) ----------
  function makeGate(cx, cy, length, width, rot) {
    return { cx, cy, length, width, rot, phase: p.random(1000), state: 'idle', timer: 0, extend: 0 };
  }

  function easeOutQuad(t) { return 1 - (1 - t) * (1 - t); }

  function scheduleNextGateEvent() {
    nextGateEventTimer = p.random(GATE_MIN_INTERVAL, GATE_MAX_INTERVAL);
  }

  function updateGates() {
    nextGateEventTimer -= p.deltaTime;
    if (nextGateEventTimer <= 0) {
      const idleGates = gates.filter(g => g.state === 'idle');
      if (idleGates.length > 0) {
        const g = p.random(idleGates);
        g.state = 'closing';
        g.timer = 0;
      }
      scheduleNextGateEvent();
    }

    for (const g of gates) {
      if (g.state === 'idle') continue;
      g.timer += p.deltaTime;

      if (g.state === 'closing') {
        const t = p.constrain(g.timer / GATE_CLOSE_MS, 0, 1);
        g.extend = easeOutQuad(t);
        if (t >= 1) { g.state = 'held'; g.timer = 0; }
      } else if (g.state === 'held') {
        g.extend = 1;
        if (g.timer >= GATE_HOLD_MS) { g.state = 'reopening'; g.timer = 0; }
      } else if (g.state === 'reopening') {
        const t = p.constrain(g.timer / GATE_REOPEN_MS, 0, 1);
        g.extend = 1 - easeOutQuad(t);
        if (t >= 1) { g.state = 'idle'; g.timer = 0; g.extend = 0; }
      }
    }
  }

  function drawGates() {
    p.noStroke();
    p.fill(COLOR_CREAM);
    for (const g of gates) {
      const idleX = Math.sin(p.frameCount * IDLE_SPEED + g.phase) * IDLE_AMP;
      const idleY = Math.cos(p.frameCount * IDLE_SPEED * 0.8 + g.phase) * IDLE_AMP;
      const currentLength = g.length * (1 + (GATE_EXTEND_FACTOR - 1) * g.extend);
      p.push();
      p.translate(g.cx + idleX, g.cy + idleY);
      p.rotate(g.rot);
      p.rectMode(p.CENTER);
      p.rect(0, 0, currentLength, g.width);
      p.pop();
    }
  }

  function toLocal(pt, g) {
    const dx = pt.x - g.cx, dy = pt.y - g.cy;
    const cosA = Math.cos(-g.rot), sinA = Math.sin(-g.rot);
    return { x: dx * cosA - dy * sinA, y: dx * sinA + dy * cosA };
  }

  function checkGateCollision() {
    for (const g of gates) {
      if (g.extend < GATE_DANGER_FROM) continue;
      const currentLength = g.length * (1 + (GATE_EXTEND_FACTOR - 1) * g.extend);
      const halfLen = currentLength / 2 + player.r;
      const halfWid = g.width / 2 + player.r;
      const local = toLocal(player.pos, g);
      if (Math.abs(local.x) < halfLen && Math.abs(local.y) < halfWid) {
        killPlayer();
        return;
      }
    }
  }

  // ---------- ciclo principal ----------
  p.draw = () => {
    p.background(COLOR_BG);
    updateGates();
    drawGates();
    drawSquares();
    updatePlayer();
    drawPlayer();
  };

  // ---------- interacción ----------
  function mouseInsideCanvas() {
    return p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height;
  }

  p.mousePressed = () => {
    if (!mouseInsideCanvas() || player.state !== 'alive' || activePointer !== null) return;
    dragging = true;
    activePointer = 'mouse';
    pointerPos = { x: p.mouseX, y: p.mouseY };
  };

  p.mouseDragged = () => {
    if (activePointer === 'mouse') {
      pointerPos = { x: p.mouseX, y: p.mouseY };
    }
  };

  p.mouseReleased = () => {
    if (activePointer === 'mouse') {
      dragging = false;
      activePointer = null;
    }
  };

  p.touchStarted = () => {
    if (player.state === 'alive' && activePointer === null && p.touches.length > 0) {
      const t = p.touches[0];
      dragging = true;
      activePointer = t.id;
      pointerPos = { x: t.x, y: t.y };
    }
    return false;
  };

  p.touchMoved = () => {
    for (const t of p.touches) {
      if (t.id === activePointer) {
        pointerPos = { x: t.x, y: t.y };
      }
    }
    return false;
  };

  p.touchEnded = () => {
    const stillActive = {};
    for (const t of p.touches) stillActive[t.id] = true;
    if (activePointer !== null && activePointer !== 'mouse' && !stillActive[activePointer]) {
      dragging = false;
      activePointer = null;
    }
    return false;
  };
};

new p5(sketchIncertidumbre, 'incertidumbre');