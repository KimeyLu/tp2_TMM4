// ============================================================
// SURVIVE THE DASH — p5.js prototype
// Minimalist geometric survival game.
// ============================================================

// ---------------------------------------------------------
// CONFIG — all tunable values live here
// ---------------------------------------------------------
const CONFIG = {
  canvasSize: 640,

  squareSize: 150,
  strokeWeightThin: 1.6,

  nodeRadius: 8,
  nodeOffset: 62,          // distance the node floats outside the square edge (normal, unwarned)
  minNodeOffset: 20,       // closest the node gets as the warning peaks — keeps a sliver of line visible
  cornerBlendPx: 26,       // how close (in px along the perimeter) to a corner before the normal starts turning
  easeAnchor: 0.30,        // how fast the edge-anchor slides (normal, unwarned)
  easeNode: 0.34,          // how fast the visible node eases toward its target (normal, unwarned)

  chargeDuration: 3.0,     // seconds — phase 1
  pauseBetweenAttacks: 0.8,// seconds — rest between attacks

  // movement-based warning: as the triangle nears launch, the player's own
  // easing gets multiplied down toward minSpeedMultiplier instead of any
  // visual cue on the square. Starts almost immediately and keeps easing
  // down the whole charge, so it reads as gradual rather than a late snap.
  warningStartFraction: 0.12, // fraction of chargeDuration where slowdown begins
  minSpeedMultiplier: 0.07,   // speed multiplier reached right as the dash launches

  triangleLength: 200,
  triangleHalfWidth: 80,
  dashSpeed: 1250,         // px / sec top speed — unaffected by the wobble ramp
  dashAccelTime: 0.22,     // seconds to reach top speed
  pullBackMax: 40,         // px the triangle winds up before launching
  wobbleFreqStart: 4.5,    // rad/s — wind-up shake speed right when charging starts
  wobbleFreqEnd: 26,       // rad/s — wind-up shake speed right before the dash launches
  spawnMargin: 3,         // px outside the canvas the enemy spawns at

  colors: {
    bg: '#111111',
    squareOutline: '#5c1414',
    node: '#ff2f2f',
    nodeGlow: 'rgba(255,47,47,0.28)',
    triangle: '#f2dca0',
    triangleTrail: 'rgba(242,220,160,0.18)',
    text: '#6b6b6b',
    textDim: '#3c3c3c'
  }
};

// ---------------------------------------------------------
// EASING HELPERS
// ---------------------------------------------------------
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeInQuad(t) { return t * t; }
function easeOutQuad(t) { return t * (2 - t); }
function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

// ---------------------------------------------------------
// PERIMETER MATH HELPERS (square edge parametrization)
// side order: top(0..S) -> right(S..2S) -> bottom(2S..3S) -> left(3S..4S)
// coordinates are relative to the square's center
// ---------------------------------------------------------
function sideForPoint(rx, ry) {
  if (ry <= -Math.abs(rx)) return 'top';
  if (ry >= Math.abs(rx)) return 'bottom';
  if (rx <= -Math.abs(ry)) return 'left';
  return 'right';
}

function pointOnSide(side, rx, ry, half) {
  switch (side) {
    case 'top': return { x: constrain(rx, -half, half), y: -half };
    case 'bottom': return { x: constrain(rx, -half, half), y: half };
    case 'left': return { x: -half, y: constrain(ry, -half, half) };
    default: return { x: half, y: constrain(ry, -half, half) };
  }
}

function pointToParam(side, x, y, half, size) {
  switch (side) {
    case 'top': return x + half;
    case 'right': return size + (y + half);
    case 'bottom': return size * 2 + (half - x);
    default: return size * 3 + (half - y);
  }
}

function paramToPoint(u, half, size) {
  const total = size * 4;
  u = ((u % total) + total) % total;
  if (u < size) return { x: -half + u, y: -half, side: 'top' };
  if (u < size * 2) return { x: half, y: -half + (u - size), side: 'right' };
  if (u < size * 3) return { x: half - (u - size * 2), y: half, side: 'bottom' };
  return { x: -half, y: half - (u - size * 3), side: 'left' };
}

function normalForSide(side) {
  switch (side) {
    case 'top': return { x: 0, y: -1 };
    case 'bottom': return { x: 0, y: 1 };
    case 'left': return { x: -1, y: 0 };
    default: return { x: 1, y: 0 };
  }
}

// Perpendicular-to-the-edge everywhere, EXCEPT within `blend` px of a
// corner, where it smoothly turns from the outgoing side's normal to the
// incoming side's normal instead of jumping. That keeps the offset line
// straight/perpendicular along the walls (matching how it looked before)
// while still closing the corner gap that let the node cut inside the
// square when the offset got small.
const SIDE_ORDER = ['top', 'right', 'bottom', 'left'];
function cornerBlendedNormal(u, size, blend) {
  const total = size * 4;
  u = ((u % total) + total) % total;
  const idx = Math.floor(u / size);
  const local = u - idx * size;
  const currNormal = normalForSide(SIDE_ORDER[idx]);

  let fromNormal = currNormal, toNormal = currNormal, t = 0;
  if (local < blend) {
    fromNormal = normalForSide(SIDE_ORDER[(idx + 3) % 4]);
    toNormal = currNormal;
    t = local / blend;
  } else if (local > size - blend) {
    fromNormal = currNormal;
    toNormal = normalForSide(SIDE_ORDER[(idx + 1) % 4]);
    t = (local - (size - blend)) / blend;
  } else {
    return currNormal;
  }

  const x = lerp(fromNormal.x, toNormal.x, t);
  const y = lerp(fromNormal.y, toNormal.y, t);
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

// ---------------------------------------------------------
// GEOMETRY HELPERS (collision)
// ---------------------------------------------------------
function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const apx = px - ax, apy = py - ay;
  const abLenSq = abx * abx + aby * aby;
  let t = abLenSq > 0 ? (apx * abx + apy * aby) / abLenSq : 0;
  t = constrain(t, 0, 1);
  const cx = ax + abx * t, cy = ay + aby * t;
  return dist(px, py, cx, cy);
}

function pointInTriangle(px, py, p0, p1, p2) {
  const s = (p0.x - p2.x) * (py - p2.y) - (p0.y - p2.y) * (px - p2.x);
  const t = (p1.x - p0.x) * (py - p0.y) - (p1.y - p0.y) * (px - p0.x);
  if ((s < 0) !== (t < 0) && s !== 0 && t !== 0) return false;
  const d = (p2.x - p1.x) * (py - p1.y) - (p2.y - p1.y) * (px - p1.x);
  return (d === 0) || (d < 0) === (s + t <= 0);
}

function circleIntersectsTriangle(cx, cy, r, pts) {
  if (pointInTriangle(cx, cy, pts[0], pts[1], pts[2])) return true;
  for (let i = 0; i < 3; i++) {
    const a = pts[i], b = pts[(i + 1) % 3];
    if (distToSegment(cx, cy, a.x, a.y, b.x, b.y) <= r) return true;
  }
  return false;
}

// ---------------------------------------------------------
// SQUARE — center anchor + charge visualization
// ---------------------------------------------------------
class Square {
  constructor(cx, cy, size) {
    this.cx = cx;
    this.cy = cy;
    this.size = size;
  }

  draw() {
    push();
    translate(this.cx, this.cy);
    rectMode(CENTER);
    noFill();
    stroke(CONFIG.colors.squareOutline);
    strokeWeight(CONFIG.strokeWeightThin);
    rect(0, 0, this.size, this.size);
    pop();
  }
}

// ---------------------------------------------------------
// PLAYER — node sliding around the square, connected by a line
// ---------------------------------------------------------
class Player {
  constructor(square) {
    this.square = square;
    this.half = CONFIG.squareSize / 2;
    this.size = CONFIG.squareSize;
    this.u = 0;
    this.anchor = { x: 0, y: 0 };
    this.pos = { x: 0, y: 0 };
    this.offsetDist = CONFIG.nodeOffset;
    this.currentSide = 'top';
    this._syncInstant();
  }

  _targetPointFor(u) {
    const pt = paramToPoint(u, this.half, this.size);
    return {
      x: this.square.cx + pt.x,
      y: this.square.cy + pt.y,
      side: pt.side
    };
  }

  computeTargetU(mx, my) {
    const rx = mx - this.square.cx;
    const ry = my - this.square.cy;
    const side = sideForPoint(rx, ry);
    const p = pointOnSide(side, rx, ry, this.half);
    return pointToParam(side, p.x, p.y, this.half, this.size);
  }

  _syncInstant() {
    const p = this._targetPointFor(this.u);
    this.anchor.x = p.x;
    this.anchor.y = p.y;
    this.offsetDist = CONFIG.nodeOffset;
    const n = cornerBlendedNormal(this.u, this.size, CONFIG.cornerBlendPx);
    this.pos.x = p.x + n.x * this.offsetDist;
    this.pos.y = p.y + n.y * this.offsetDist;
    this.currentSide = p.side;
  }

  // speedMult (0..1) is the movement-warning throttle: 1 = full mobility,
  // lower values = the "the dash is about to launch" cue, replacing the
  // old visual warning on the square. nodeOffset lets that same warning
  // pull the node in closer to the square (down to CONFIG.minNodeOffset).
  update(mx, my, canMove, speedMult = 1, nodeOffset = CONFIG.nodeOffset) {
    if (canMove) {
      const targetU = this.computeTargetU(mx, my);
      const total = this.size * 4;
      let diff = ((targetU - this.u + total * 1.5) % total) - total * 0.5;
      this.u += diff * CONFIG.easeAnchor * speedMult;
    }

    const p = this._targetPointFor(this.u);
    // the anchor sits exactly on the perimeter — this.u above is already
    // what provides the smooth sliding, so the anchor doesn't need (and
    // shouldn't get) a second, separate 2D lerp toward it.
    this.anchor.x = p.x;
    this.anchor.y = p.y;

    // perpendicular-to-the-wall almost everywhere; only turns smoothly
    // within CONFIG.cornerBlendPx of a corner.
    const n = cornerBlendedNormal(this.u, this.size, CONFIG.cornerBlendPx);

    // only the DISTANCE from the anchor is eased (a single number), never
    // pos.x/pos.y independently — that's what keeps the connector line
    // exactly along the normal at all times, instead of drifting sideways
    // (looking diagonal) while the offset shrinks or the anchor slides.
    const nodeEase = CONFIG.easeNode * speedMult;
    this.offsetDist = lerp(this.offsetDist, nodeOffset, nodeEase);

    this.pos.x = this.anchor.x + n.x * this.offsetDist;
    this.pos.y = this.anchor.y + n.y * this.offsetDist;
    this.currentSide = p.side;
  }

  draw() {
    stroke(CONFIG.colors.node);
    strokeWeight(CONFIG.strokeWeightThin);
    line(this.anchor.x, this.anchor.y, this.pos.x, this.pos.y);

    noStroke();
    fill(CONFIG.colors.nodeGlow);
    circle(this.pos.x, this.pos.y, CONFIG.nodeRadius * 3.6);

    fill(CONFIG.colors.node);
    circle(this.pos.x, this.pos.y, CONFIG.nodeRadius * 2);
  }
}

// ---------------------------------------------------------
// ENEMY — the yellow triangle
// ---------------------------------------------------------
class Enemy {
  constructor(cx, cy, w, h) {
    this.cx = cx;
    this.cy = cy;
    this.w = w;
    this.h = h;
    this.reset();
  }

  reset(side) {
    side = side || random(['top', 'bottom', 'left', 'right']);
    let sx, sy;
    if (side === 'top') { sx = random(this.w * 0.15, this.w * 0.85); sy = -CONFIG.spawnMargin; }
    else if (side === 'bottom') { sx = random(this.w * 0.15, this.w * 0.85); sy = this.h + CONFIG.spawnMargin; }
    else if (side === 'left') { sx = -CONFIG.spawnMargin; sy = random(this.h * 0.15, this.h * 0.85); }
    else { sx = this.w + CONFIG.spawnMargin; sy = random(this.h * 0.15, this.h * 0.85); }

    const dx = this.cx - sx, dy = this.cy - sy;
    const len = Math.hypot(dx, dy) || 1;
    this.dir = { x: dx / len, y: dy / len };
    this.spawn = { x: sx, y: sy };
    this.pos = { x: sx, y: sy };

    // mirror the spawn point across the center to get where it should exit,
    // then require the dash to actually cover that full distance (plus a
    // buffer for the triangle's own size) before it's allowed to end.
    const exitPoint = { x: 2 * this.cx - sx, y: 2 * this.cy - sy };
    this.travelTarget = Math.hypot(exitPoint.x - sx, exitPoint.y - sy) + CONFIG.triangleLength + 60;

    this.state = 'charging';
    this.chargeTimer = 0;
    this.dashTimer = 0;
    this.speed = 0;
    this.wobblePhase = 0;
  }

  update(dt) {
    if (this.state === 'charging') {
      this.chargeTimer += dt;
      const progress = constrain(this.chargeTimer / CONFIG.chargeDuration, 0, 1);
      const envelope = easeOutCubic(progress);
      const freq = lerp(CONFIG.wobbleFreqStart, CONFIG.wobbleFreqEnd, progress);
      this.wobblePhase += freq * dt;
      const wobble = Math.sin(this.wobblePhase) * CONFIG.pullBackMax * 0.5;
      const pull = (CONFIG.pullBackMax * 0.5 + wobble * 0.5) * envelope;
      this.pos.x = this.spawn.x - this.dir.x * pull;
      this.pos.y = this.spawn.y - this.dir.y * pull;

      if (this.chargeTimer >= CONFIG.chargeDuration) {
        this.state = 'dashing';
        this.dashTimer = 0;
        this.speed = 0;
        // dash always launches cleanly from the spawn point, not from
        // wherever the wind-up wobble happened to leave it, and always at
        // the same configured speed regardless of how fast it was shaking
        this.pos.x = this.spawn.x;
        this.pos.y = this.spawn.y;
      }
    } else if (this.state === 'dashing') {
      this.dashTimer += dt;
      const t = constrain(this.dashTimer / CONFIG.dashAccelTime, 0, 1);
      this.speed = CONFIG.dashSpeed * easeOutQuad(t);
      this.pos.x += this.dir.x * this.speed * dt;
      this.pos.y += this.dir.y * this.speed * dt;

      const traveled = (this.pos.x - this.spawn.x) * this.dir.x + (this.pos.y - this.spawn.y) * this.dir.y;
      if (traveled >= this.travelTarget) {
        this.state = 'done';
      }
    }
  }

  getPoints() {
    const dir = this.dir;
    const perp = { x: -dir.y, y: dir.x };
    const len = CONFIG.triangleLength;
    const hw = CONFIG.triangleHalfWidth;
    const tip = { x: this.pos.x + dir.x * len * 0.6, y: this.pos.y + dir.y * len * 0.6 };
    const baseCenter = { x: this.pos.x - dir.x * len * 0.4, y: this.pos.y - dir.y * len * 0.4 };
    const baseL = { x: baseCenter.x + perp.x * hw, y: baseCenter.y + perp.y * hw };
    const baseR = { x: baseCenter.x - perp.x * hw, y: baseCenter.y - perp.y * hw };
    return [tip, baseL, baseR];
  }

  draw() {
    // trailing echoes while dashing, for a sense of speed
    if (this.state === 'dashing' && this.speed > 60) {
      noStroke();
      fill(CONFIG.colors.triangleTrail);
      for (let i = 1; i <= 3; i++) {
        const back = i * 14;
        const savedX = this.pos.x, savedY = this.pos.y;
        this.pos.x -= this.dir.x * back;
        this.pos.y -= this.dir.y * back;
        const pts = this.getPoints();
        this.pos.x = savedX; this.pos.y = savedY;
        beginShape();
        vertex(pts[0].x, pts[0].y);
        vertex(pts[1].x, pts[1].y);
        vertex(pts[2].x, pts[2].y);
        endShape(CLOSE);
      }
    }

    const pts = this.getPoints();
    fill(CONFIG.colors.triangle);
    stroke(CONFIG.colors.triangle);
    strokeWeight(1);
    beginShape();
    vertex(pts[0].x, pts[0].y);
    vertex(pts[1].x, pts[1].y);
    vertex(pts[2].x, pts[2].y);
    endShape(CLOSE);
  }
}

// ---------------------------------------------------------
// ATTACK CONTROLLER — owns the charge -> dash -> pause cycle
// ---------------------------------------------------------
class AttackController {
  constructor(w, h, cx, cy) {
    this.w = w;
    this.h = h;
    this.cx = cx;
    this.cy = cy;
    this.enemy = null;
    this.state = 'charging'; // charging | dashing | pausing
    this.pauseTimer = 0;
    this.attacksSurvived = 0;
    this._spawnNewAttack();
  }

  _spawnNewAttack() {
    if (!this.enemy) {
      this.enemy = new Enemy(this.cx, this.cy, this.w, this.h);
    } else {
      this.enemy.reset();
    }
    this.state = 'charging';
  }

  get canPlayerMove() {
    return this.state === 'charging';
  }

  // 0 = no warning yet, 1 = dash about to launch. Shared eased curve that
  // drives both the player's slowdown and how close the node hugs the square.
  get warningProgress() {
    if (this.state !== 'charging' || !this.enemy) return 0;
    const t = constrain(this.enemy.chargeTimer / CONFIG.chargeDuration, 0, 1);
    if (t < CONFIG.warningStartFraction) return 0;
    const localT = (t - CONFIG.warningStartFraction) / (1 - CONFIG.warningStartFraction);
    return easeInOutCubic(constrain(localT, 0, 1));
  }

  // 1 = full mobility. Ramps down toward CONFIG.minSpeedMultiplier as the
  // charge approaches completion — this IS the "it's about to move" warning.
  get playerSpeedMultiplier() {
    return lerp(1, CONFIG.minSpeedMultiplier, this.warningProgress);
  }

  // full nodeOffset normally, tightening toward minNodeOffset as the warning
  // peaks, so the node visibly hugs the square right before the dash.
  get playerNodeOffset() {
    return lerp(CONFIG.nodeOffset, CONFIG.minNodeOffset, this.warningProgress);
  }

  update(dt) {
    this.enemy.update(dt);

    if (this.state === 'charging' && this.enemy.state === 'dashing') {
      this.state = 'dashing';
    } else if (this.state === 'dashing' && this.enemy.state === 'done') {
      this.state = 'pausing';
      this.pauseTimer = 0;
      this.attacksSurvived++;
    } else if (this.state === 'pausing') {
      this.pauseTimer += dt;
      if (this.pauseTimer >= CONFIG.pauseBetweenAttacks) {
        this._spawnNewAttack();
      }
    }
  }

  draw() {
    if (this.enemy && (this.state === 'charging' || this.state === 'dashing')) {
      this.enemy.draw();
    }
  }
}

// ---------------------------------------------------------
// GAME — top level state machine
// ---------------------------------------------------------
class Game {
  constructor() {
    this.w = CONFIG.canvasSize;
    this.h = CONFIG.canvasSize;
    this.cx = this.w / 2;
    this.cy = this.h / 2;
    this.reset();
  }

  reset() {
    this.square = new Square(this.cx, this.cy, CONFIG.squareSize);
    this.player = new Player(this.square);
    this.controller = new AttackController(this.w, this.h, this.cx, this.cy);
  }

  update(dt, mx, my) {
    this.controller.update(dt);
    this.player.update(mx, my, this.controller.canPlayerMove, this.controller.playerSpeedMultiplier, this.controller.playerNodeOffset);

    if (this.controller.state === 'dashing') {
      const pts = this.controller.enemy.getPoints();
      if (circleIntersectsTriangle(this.player.pos.x, this.player.pos.y, CONFIG.nodeRadius, pts)) {
        this.reset();
      }
    }
  }

  draw() {
    background(CONFIG.colors.bg);

    this.square.draw();
    this.controller.draw();
    this.player.draw();
  }
}

// ---------------------------------------------------------
// p5 ENTRY POINTS
// ---------------------------------------------------------
let game;

function setup() {
  createCanvas(CONFIG.canvasSize, CONFIG.canvasSize);
  game = new Game();
}

function draw() {
  const dt = Math.min(deltaTime / 1000, 1 / 30); // clamp to avoid spiral of death on lag
  game.update(dt, mouseX, mouseY);
  game.draw();
}
