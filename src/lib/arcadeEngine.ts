// Vice City Hustle: pure game rules (no canvas, no React). Extracted from components/ViceArcadeGame.tsx.
// The randomness source and the high-score storage are injected, so the rules can be tested without a browser.
// The ORDER of rng() calls is part of the behaviour (it decides what spawns): keep it when changing anything.

export const W = 320, H = 420;
export const HORIZON_Y = 132, PY = H - 76;
export const ROAD_HW_BOTTOM = 108, ROAD_HW_TOP = 5;
export const CAM_DEPTH = 1.7, Z_SPAWN = 24, Z_SPEED_SCALE = 0.05;
export const CENTER_X = W / 2;

export const ROAD_EDGE = 1.0;
export const WALL_EDGE = 1.14;
export const STEER = 0.05;

export type OType = "cop" | "money" | "road" | "swat" | "nitro" | "shield";
export interface Obs3D { x: number; z: number; type: OType; hit: boolean; }

export interface LevelDef { min: number; name: string; speedMul: number; spawnMul: number; pool: OType[]; heli: boolean; dual: boolean; }

export const LEVELS: LevelDef[] = [
  { min: 0,     name: "CRUISING",      speedMul: 1.00, spawnMul: 1.00, pool: ["cop", "money"],                        heli: false, dual: false },
  { min: 500,   name: "HEAT RISING",   speedMul: 1.08, spawnMul: 1.06, pool: ["cop", "cop", "money"],                 heli: false, dual: false },
  { min: 2000,  name: "ROADBLOCKS UP", speedMul: 1.18, spawnMul: 1.13, pool: ["cop", "cop", "money", "road"],         heli: false, dual: true  },
  { min: 5000,  name: "AIR SUPPORT",   speedMul: 1.30, spawnMul: 1.20, pool: ["cop", "money", "road"],                heli: true,  dual: true  },
  { min: 10000, name: "FULL PURSUIT",  speedMul: 1.42, spawnMul: 1.28, pool: ["cop", "cop", "money", "road", "swat"], heli: true,  dual: true  },
  { min: 25000, name: "MAX WANTED",    speedMul: 1.55, spawnMul: 1.35, pool: ["cop", "cop", "money", "road", "swat"], heli: true,  dual: true  },
];

export function getLevelIdx(score: number): number {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (score >= LEVELS[i].min) idx = i;
  return idx;
}

/** Wanted stars (0-5) for a score. */
export const getStars = (s: number): number => s >= 25000 ? 5 : s >= 10000 ? 4 : s >= 5000 ? 3 : s >= 2000 ? 2 : s >= 500 ? 1 : 0;

export const HELI_WARN_FRAMES = 78, HELI_STRIKE_FRAMES = 15, HELI_COOLDOWN_BASE = 440;
export const MIN_SPAWN_GAP = 46;
export const ZONE_X = [-0.68, 0, 0.68];

export function persp(z: number): number { return CAM_DEPTH / (CAM_DEPTH + Math.max(0, z)); }
export function screenY(z: number): number { return HORIZON_Y + (PY - HORIZON_Y) * persp(z); }
export function roadHalfW(z: number): number { return ROAD_HW_TOP + (ROAD_HW_BOTTOM - ROAD_HW_TOP) * persp(z); }
export function screenX(objX: number, z: number): number { return CENTER_X + objX * roadHalfW(z); }
export function spriteScale(z: number): number { return 0.22 + persp(z) * 1.05; }

export type HeliPhase = "idle" | "warn" | "strike";

export interface GameState {
  playerX: number; wallFlash: number; obs: Obs3D[];
  score: number; lives: number; speed: number; frame: number;
  flashTimer: number; gameOver: boolean; started: boolean;
  highScore: number;
  spawnTimer: number; combo: number;
  level: number; levelBannerTimer: number; graceTimer: number;
  invincibleTimer: number; shielded: boolean;
  heliZone: number; heliPhase: HeliPhase; heliTimer: number; heliCooldown: number; heliHit: boolean;
  stripeZ: number[];
  offRoad: number;
}

/** What the React overlay shows (score, lives, badges); the canvas is drawn straight from GameState. */
export interface Disp { score: number; lives: number; gameOver: boolean; started: boolean; combo: number; levelName: string; shielded: boolean; nitro: boolean; mph: number }

export const INITIAL_DISP: Disp = { score: 0, lives: 3, gameOver: false, started: false, combo: 0, levelName: "CRUISING", shielded: false, nitro: false, mph: 0 };

/** Overlay change produced by a game step. Reads the state lazily, exactly like the original inline setDisp calls. */
export type DispUpdate = (d: Disp) => Disp;

export interface HeldKeys { left: boolean; right: boolean }

export interface EngineDeps {
  /** Uniform random in [0, 1), like Math.random. */
  rng: () => number;
  saveHighScore: (score: number) => void;
}

export const HIGH_SCORE_KEY = "vch_hi";

/** Best score saved on this device (0 when none or when storage is unavailable). */
export function readStoredHighScore(): number {
  return parseInt(typeof localStorage !== "undefined" ? localStorage.getItem(HIGH_SCORE_KEY) || "0" : "0");
}

export function createGameState(highScore: number): GameState {
  return {
    playerX: 0, wallFlash: 0, obs: [],
    score: 0, lives: 3, speed: 2.4, frame: 0,
    flashTimer: 0, gameOver: false, started: false,
    highScore,
    spawnTimer: 0, combo: 0,
    level: 0, levelBannerTimer: 0, graceTimer: 0,
    invincibleTimer: 0, shielded: false,
    heliZone: -1, heliPhase: "idle", heliTimer: 0, heliCooldown: HELI_COOLDOWN_BASE, heliHit: false,
    stripeZ: [3, 6, 9, 12, 15, 18, 21, 24],
    offRoad: 0,
  };
}

/** Start a new run. The high score and the scrolling stripes carry over. */
export function resetGameState(s: GameState): void {
  Object.assign(s, {
    playerX: 0, wallFlash: 0, obs: [], score: 0, lives: 3, speed: 2.4, frame: 0,
    flashTimer: 0, gameOver: false, started: true, spawnTimer: 0, combo: 0,
    level: 0, levelBannerTimer: 0, graceTimer: 0, invincibleTimer: 0, shielded: false,
    heliZone: -1, heliPhase: "idle", heliTimer: 0, heliCooldown: HELI_COOLDOWN_BASE, heliHit: false,
    offRoad: 0,
  });
}

/** Horizontal screen shake while driving on the shoulder (2) or scraping the wall (1). Consumes one rng() call only when off road. */
export function cameraShake(offRoad: number, rng: () => number): number {
  return offRoad > 1 ? (rng() - 0.5) * 5 : offRoad > 0 ? (rng() - 0.5) * 2.5 : 0;
}

// ---------------------------------------------------------------------------------------------------------------
// One simulation step. The sub-steps run in the original order; every one mutates the state in place.
// ---------------------------------------------------------------------------------------------------------------

export interface StepResult {
  effSpeed: number;
  mph: number;
  updates: DispUpdate[];
}

/** Advance the game by one frame. `lvl` is the level at the start of the frame (a level-up shows from the next frame on). */
export function stepGame(s: GameState, lvl: LevelDef, held: HeldKeys, deps: EngineDeps): StepResult {
  const updates: DispUpdate[] = [];

  const effSpeed = advanceScore(s, lvl);
  const effSpeedRoad = steerPlayer(s, held, effSpeed);
  tickTimers(s);
  advanceLevel(s, updates);
  scrollStripes(s, effSpeedRoad);
  spawnObstacles(s, lvl, effSpeed, deps.rng);
  if (lvl.heli) updateHelicopter(s, updates, deps);
  updateObstacles(s, effSpeedRoad, updates, deps);
  if (s.invincibleTimer <= 0) updates.push(d => d.nitro ? { ...d, nitro: false } : d);

  const mph = Math.round(28 + effSpeed * 13);
  updates.push(d => (d.score !== s.score || d.mph !== mph) ? { ...d, score: s.score, mph } : d);
  return { effSpeed, mph, updates };
}

/** Frame counter, speed ramp and the score earned just for driving. Returns the effective speed. */
function advanceScore(s: GameState, lvl: LevelDef): number {
  s.frame++;
  if (s.frame % 600 === 0) s.speed = Math.min(s.speed + 0.16, 5.4);
  const effSpeed = s.speed * lvl.speedMul;
  const scoreGain = (s.invincibleTimer > 0 ? 2 : 1) * Math.floor(effSpeed * 0.5 + 0.5);
  s.score += scoreGain;
  return effSpeed;
}

/** Steering, wall and shoulder handling. Returns the speed after the road-surface penalty. */
function steerPlayer(s: GameState, held: HeldKeys, effSpeed: number): number {
  let nx = s.playerX;
  if (held.left) nx -= STEER;
  if (held.right) nx += STEER;
  let hitWall = false;
  if (nx > WALL_EDGE) { nx = WALL_EDGE; hitWall = true; }
  if (nx < -WALL_EDGE) { nx = -WALL_EDGE; hitWall = true; }
  s.playerX = nx;
  if (hitWall) s.wallFlash = 8;
  if (s.wallFlash > 0) s.wallFlash--;

  const onShoulder = Math.abs(s.playerX) > ROAD_EDGE;
  s.offRoad = hitWall ? 2 : onShoulder ? 1 : 0;
  return effSpeed * (onShoulder ? 0.87 : 1) * (hitWall ? 0.9 : 1);
}

function tickTimers(s: GameState): void {
  if (s.flashTimer > 0) s.flashTimer--;
  if (s.graceTimer > 0) s.graceTimer--;
  if (s.invincibleTimer > 0) s.invincibleTimer--;
}

/** Wanted-level up: banner, a short grace period and the new name on the overlay. */
function advanceLevel(s: GameState, updates: DispUpdate[]): void {
  const newLevel = getLevelIdx(s.score);
  if (newLevel > s.level) {
    s.level = newLevel;
    s.levelBannerTimer = 90;
    s.graceTimer = 70;
    updates.push(d => ({ ...d, levelName: LEVELS[newLevel].name }));
  }
  if (s.levelBannerTimer > 0) s.levelBannerTimer--;
}

function scrollStripes(s: GameState, effSpeedRoad: number): void {
  s.stripeZ = s.stripeZ.map(z => { const nz = z - effSpeedRoad * Z_SPEED_SCALE * 1.4; return nz <= 0 ? nz + Z_SPAWN : nz; });
}

/** Pick what a freshly spawned obstacle in a lane is. */
function rollObstacleType(lvl: LevelDef, dual: boolean, laneIndex: number, rng: () => number): OType {
  const roll = rng();
  if (roll < 0.055) return "nitro";
  if (roll < 0.095) return "shield";
  if (roll < 0.34) return "money";
  if (dual && laneIndex === 1) return rng() < 0.6 ? "cop" : "money";
  const pool = lvl.pool.filter(t => t !== "money");
  return pool[Math.floor(rng() * pool.length)] || "cop";
}

function spawnObstacles(s: GameState, lvl: LevelDef, effSpeed: number, rng: () => number): void {
  s.spawnTimer++;
  const rawRate = Math.max(50, 105 - effSpeed * 5.5);
  const rate = Math.max(MIN_SPAWN_GAP, rawRate / lvl.spawnMul);
  if (s.spawnTimer < rate) return;
  s.spawnTimer = 0;
  const dual = lvl.dual && rng() < 0.22;
  const zoneIdxs = [0, 1, 2].sort(() => rng() - 0.5);
  const useZones = dual ? zoneIdxs.slice(0, 2) : zoneIdxs.slice(0, 1);
  useZones.forEach((zi, n) => {
    s.obs.push({ x: ZONE_X[zi], z: Z_SPAWN, type: rollObstacleType(lvl, dual, n, rng), hit: false });
  });
}

/** Chopper: idle -> red lane warning -> strike. Dodging a strike pays 300. */
function updateHelicopter(s: GameState, updates: DispUpdate[], deps: EngineDeps): void {
  if (s.heliPhase === "idle") {
    s.heliCooldown--;
    if (s.heliCooldown <= 0) { s.heliPhase = "warn"; s.heliZone = Math.floor(deps.rng() * 3); s.heliTimer = HELI_WARN_FRAMES; s.heliHit = false; }
  } else if (s.heliPhase === "warn") {
    s.heliTimer--;
    if (s.heliTimer <= 0) { s.heliPhase = "strike"; s.heliTimer = HELI_STRIKE_FRAMES; }
  } else if (s.heliPhase === "strike") {
    if (!s.heliHit) {
      s.heliHit = true;
      resolveHeliStrike(s, updates, deps);
    }
    s.heliTimer--;
    if (s.heliTimer <= 0) { s.heliPhase = "idle"; s.heliZone = -1; s.heliCooldown = Math.max(260, HELI_COOLDOWN_BASE - s.level * 30); }
  }
}

function resolveHeliStrike(s: GameState, updates: DispUpdate[], deps: EngineDeps): void {
  const playerZone = s.playerX < -0.34 ? 0 : s.playerX > 0.34 ? 2 : 1;
  const invuln = s.invincibleTimer > 0 || s.graceTimer > 0;
  if (playerZone === s.heliZone && !invuln) {
    if (s.shielded) absorbWithShield(s, updates);
    else takeLifeHit(s, 45, updates, deps);
  } else if (playerZone !== s.heliZone) {
    s.score += 300;
  }
}

/** The shield eats one hit. */
function absorbWithShield(s: GameState, updates: DispUpdate[]): void {
  s.shielded = false;
  s.flashTimer = 20;
  updates.push(d => ({ ...d, shielded: false }));
}

/** Lose a life; the last one ends the run and saves a new best score. */
function takeLifeHit(s: GameState, flashFrames: number, updates: DispUpdate[], deps: EngineDeps): void {
  s.lives--;
  s.combo = 0;
  s.flashTimer = flashFrames;
  if (s.lives <= 0) {
    s.gameOver = true;
    if (s.score > s.highScore) { s.highScore = s.score; deps.saveHighScore(s.score); }
    updates.push(d => ({ ...d, lives: 0, gameOver: true }));
  } else {
    updates.push(d => ({ ...d, lives: s.lives }));
  }
}

const isPickup = (t: OType): boolean => t === "money" || t === "nitro" || t === "shield";

/** Pickups drift slower than traffic, roadblocks a little slower. */
const obstacleSpeedMul = (t: OType): number => isPickup(t) ? 0.82 : t === "road" ? 0.95 : 1;

/** How close (in lane units) the player has to be to be hit. */
const hitTolerance = (t: OType): number => t === "road" ? 0.46 : t === "swat" ? 0.42 : 0.32;

function updateObstacles(s: GameState, effSpeedRoad: number, updates: DispUpdate[], deps: EngineDeps): void {
  s.obs.sort((a, b) => b.z - a.z);
  for (let i = s.obs.length - 1; i >= 0; i--) {
    const o = s.obs[i];
    o.z -= effSpeedRoad * Z_SPEED_SCALE * obstacleSpeedMul(o.type);

    if (o.z <= 0.4 && !o.hit) {
      o.hit = true;
      resolveObstaclePass(s, o, updates, deps);
    }
    if (o.z < -1.5) s.obs.splice(i, 1);
  }
}

/** The obstacle reaches the player's row: collect, crash or sail past (+40 for each hazard dodged). */
function resolveObstaclePass(s: GameState, o: Obs3D, updates: DispUpdate[], deps: EngineDeps): void {
  const collided = Math.abs(o.x - s.playerX) < hitTolerance(o.type);
  if (collided) collideWith(s, o, updates, deps);
  else if (!isPickup(o.type)) s.score += 40;
}

function collideWith(s: GameState, o: Obs3D, updates: DispUpdate[], deps: EngineDeps): void {
  if (o.type === "money") {
    s.score += 500 + s.combo * 50; s.combo++;
    updates.push(d => ({ ...d, score: s.score, combo: s.combo }));
  } else if (o.type === "nitro") {
    s.invincibleTimer = 200; s.score += 200;
    updates.push(d => ({ ...d, nitro: true }));
  } else if (o.type === "shield") {
    s.shielded = true; s.score += 200;
    updates.push(d => ({ ...d, shielded: true }));
  } else {
    hitHazard(s, o, updates, deps);
  }
}

/** A cop, SWAT van or roadblock hit: invulnerable players score, shielded ones lose the shield, the rest lose a life. */
function hitHazard(s: GameState, o: Obs3D, updates: DispUpdate[], deps: EngineDeps): void {
  const invuln = s.invincibleTimer > 0 || s.graceTimer > 0;
  if (invuln) s.score += 150;
  else if (s.shielded) absorbWithShield(s, updates);
  else takeLifeHit(s, o.type === "swat" || o.type === "road" ? 55 : 40, updates, deps);
}
