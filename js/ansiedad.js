const sketchAnsiedad = (p) => {
  const BG = '#141414';
  const CREAM = '#EFD583';
  const RED = '#D73E34';

  const FOLLOW_SPEED = 0.08;
  const TRIANGLE_OFFSET_FACTOR = 1.6;
  const BASE_JITTER = 0.6;
  const JITTER_PER_SAT = 0.35;
  const MAX_JITTER = 9;

  // umbral de histéresis: cuánto más cerca tiene que estar OTRO lado
  // para que el nodo se transfiera. Evita que salte solo por ruido/jitter.
  const EDGE_SWITCH_MARGIN = 6;

  let container;
  let cx, cy, DIAMOND_R, MAIN_R, SAT_R_MIN, SAT_R_MAX;
  let mainCircle, target;
  let satellites = [];
  let primaryId = null;

  // nodo conector: queda "anclado" a un solo lado del rombo hasta que
  // otro lado esté claramente más cerca (igual que tryTransfer en el
  // ejemplo de incertidumbre).
  let anchorEdgeIndex = 0;

  p.setup = () => {
    container = document.getElementById('ansiedad');
    p.createCanvas(400, 400);
    recalcGeometry();
    mainCircle = { x: cx, y: cy };
    target = { x: cx, y: cy };
  };

  // p.windowResized = () => {
  //   p.resizeCanvas(container.offsetWidth, container.offsetHeight);
  //   recalcGeometry();
  // };

  function recalcGeometry() {
    cx = p.width / 2;
    cy = p.height / 2;
    DIAMOND_R = p.min(p.width, p.height) * 0.22;
    MAIN_R = DIAMOND_R * 0.18;
    SAT_R_MIN = DIAMOND_R * 0.12;
    SAT_R_MAX = DIAMOND_R * 0.18;
  }

  function isInsideDiamond(x, y) {
    const dx = x - cx, dy = y - cy;
    return (Math.abs(dx) + Math.abs(dy)) <= DIAMOND_R;
  }

  function clampToDiamond(x, y, effR) {
    let dx = x - cx, dy = y - cy;
    const L = Math.abs(dx) + Math.abs(dy);
    const limit = DIAMOND_R - effR;
    if (L > limit && L > 0) {
      const s = limit / L;
      dx *= s; dy *= s;
    }
    return { x: cx + dx, y: cy + dy };
  }

  function addSatellite() {
    const a = p.random(p.TWO_PI);
    const d = p.random(MAIN_R * 0.9, MAIN_R * 2.2);
    satellites.push({
      offX: p.cos(a) * d,
      offY: p.sin(a) * d,
      r: p.random(SAT_R_MIN * 0.7, SAT_R_MAX * 1.3),
      rot: p.random(p.TWO_PI),
      phase: p.random(1000)
    });
  }

  function removeSatellite() {
    if (satellites.length > 0) satellites.pop();
  }

  p.draw = () => {

    //if (p.mouseX > -5 && p.mouseY > -5) 

    p.background(BG);
    drawLattice();

    mainCircle.x = p.lerp(mainCircle.x, target.x, FOLLOW_SPEED);
    mainCircle.y = p.lerp(mainCircle.y, target.y, FOLLOW_SPEED);
    const clamped = clampToDiamond(mainCircle.x, mainCircle.y, MAIN_R);
    mainCircle.x = clamped.x;
    mainCircle.y = clamped.y;

    const totalJitter = p.min(BASE_JITTER + satellites.length * JITTER_PER_SAT, MAX_JITTER);

    drawSatellites(totalJitter);
    drawMainCircle(totalJitter);
    
  };

  function drawLattice() {
    const spacing = DIAMOND_R * 2;
    const range = p.ceil((p.width + p.height) / spacing) + 2;

    p.stroke(RED);
    p.strokeWeight(1);
    for (let k = -range; k <= range; k++) {
      // familia con pendiente -1 (v constante), desfasada media celda
      const y0 = cy + spacing / 2 + k * spacing;
      p.line(cx - 4000, y0 + 4000, cx + 4000, y0 - 4000);
      // familia con pendiente +1 (u constante), desfasada media celda
      const y1 = cy - spacing / 2 - k * spacing;
      p.line(cx - 4000, y1 - 4000, cx + 4000, y1 + 4000);
    }

    // remarca los 4 lados de la celda que contiene al círculo principal
    p.stroke(RED);
    p.strokeWeight(3);
    p.line(cx, cy - DIAMOND_R, cx + DIAMOND_R, cy);
    p.line(cx + DIAMOND_R, cy, cx, cy + DIAMOND_R);
    p.line(cx, cy + DIAMOND_R, cx - DIAMOND_R, cy);
    p.line(cx - DIAMOND_R, cy, cx, cy - DIAMOND_R);
  }

  function drawSatellites(jitterAmp) {
    p.noStroke();
    p.fill(CREAM);
    for (const s of satellites) {
      const jx = p.random(-jitterAmp, jitterAmp);
      const jy = p.random(-jitterAmp, jitterAmp);
      p.push();
      p.translate(mainCircle.x + s.offX + jx, mainCircle.y + s.offY + jy);
      p.rotate(s.rot);
      p.triangle(s.r, 0, -s.r * 0.7, s.r * 0.62, -s.r * 0.7, -s.r * 0.62);
      p.pop();
    }
  }

  function drawMainCircle(jitterAmp) {
    const jx = p.random(-jitterAmp, jitterAmp);
    const jy = p.random(-jitterAmp, jitterAmp);
    const px = mainCircle.x + jx;
    const py = mainCircle.y + jy;

    drawConnector(px, py);

    p.noStroke();
    p.fill(RED);
    p.circle(px, py, MAIN_R * 2);
  }

  // ---------- lados del rombo como 4 segmentos fijos ----------
  function getDiamondEdges() {
    const top = { x: cx, y: cy - DIAMOND_R };
    const right = { x: cx + DIAMOND_R, y: cy };
    const bottom = { x: cx, y: cy + DIAMOND_R };
    const left = { x: cx - DIAMOND_R, y: cy };
    return [
      { a: top, b: right },
      { a: right, b: bottom },
      { a: bottom, b: left },
      { a: left, b: top }
    ];
  }

  function closestPointOnSegment(px, py, a, b) {
    const abx = b.x - a.x, aby = b.y - a.y;
    const apx = px - a.x, apy = py - a.y;
    const lenSq = abx * abx + aby * aby;
    let t = lenSq === 0 ? 0 : (apx * abx + apy * aby) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const qx = a.x + abx * t, qy = a.y + aby * t;
    const dx = px - qx, dy = py - qy;
    return { point: { x: qx, y: qy }, dist: Math.sqrt(dx * dx + dy * dy) };
  }

  function drawConnector(px, py) {
    const edges = getDiamondEdges();

    // distancia al lado actualmente anclado
    const current = closestPointOnSegment(px, py, edges[anchorEdgeIndex].a, edges[anchorEdgeIndex].b);
    let bestIndex = anchorEdgeIndex;
    let bestDist = current.dist;
    let bestPoint = current.point;

    // sólo transferimos si otro lado está claramente más cerca (histéresis),
    // así el nodo no tiembla entre lados por el jitter o por pasar cerca del centro
    for (let i = 0; i < edges.length; i++) {
      if (i === anchorEdgeIndex) continue;
      const res = closestPointOnSegment(px, py, edges[i].a, edges[i].b);
      if (res.dist + EDGE_SWITCH_MARGIN < bestDist) {
        bestDist = res.dist;
        bestIndex = i;
        bestPoint = res.point;
      }
    }

    anchorEdgeIndex = bestIndex;

    p.stroke(RED);
    p.strokeWeight(2);
    p.line(px, py, bestPoint.x, bestPoint.y);

    p.noStroke();
    p.fill(RED);
    p.circle(bestPoint.x, bestPoint.y, MAIN_R * 0.5);
  }

  function handleTouchDown(x, y) {
    if (p.mouseX > 0 && p.mouseX < p.width && p.mouseY > 0 && p.mouseY < p.height) {
        if (isInsideDiamond(x, y)) {
        removeSatellite();
        } else {
        addSatellite();
        }
        if (primaryId === null) {
        target.x = x;
        target.y = y;
        }
    }

  }

  p.touchStarted = () => {
    for (const t of p.touches) {
      if (primaryId === null) primaryId = t.id;
      handleTouchDown(t.x, t.y);
    }
    return false;
  };

  p.touchMoved = () => {
    for (const t of p.touches) {
      if (t.id === primaryId) {
        target.x = t.x;
        target.y = t.y;
      }
    }
    return false;
  };

  p.touchEnded = () => {
    const stillActive = {};
    for (const t of p.touches) stillActive[t.id] = true;
    if (primaryId !== null && !stillActive[primaryId]) {
      primaryId = null;
      if (p.touches.length > 0) {
        primaryId = p.touches[0].id;
        target.x = p.touches[0].x;
        target.y = p.touches[0].y;
      }
    }
    return false;
  };

  p.mousePressed = () => {
    if (primaryId === null) primaryId = 'mouse';
    handleTouchDown(p.mouseX, p.mouseY);
  };
  p.mouseDragged = () => {
    if (primaryId === 'mouse') {
      target.x = p.mouseX;
      target.y = p.mouseY;
    }
  };
  p.mouseReleased = () => {
    if (primaryId === 'mouse') primaryId = null;
  };
};

new p5(sketchAnsiedad, 'ansiedad');
