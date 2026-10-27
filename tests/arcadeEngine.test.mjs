import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVELS,
  INITIAL_DISP,
  HELI_COOLDOWN_BASE,
  HELI_WARN_FRAMES,
  HELI_STRIKE_FRAMES,
  WALL_EDGE,
  STEER,
  Z_SPAWN,
  getLevelIdx,
  getStars,
  persp,
  screenX,
  createGameState,
  resetGameState,
  cameraShake,
  stepGame,
} from '../src/lib/arcadeEngine.ts';

/** rng that returns the given values in order, then 0.5 forever; counts its calls. */
const seq = (...values) => {
  let i = 0;
  const rng = () => { rng.calls++; return i < values.length ? values[i++] : 0.5; };
  rng.calls = 0;
  return rng;
};

// The spawner shuffles the 3 lanes with sort(() => rng() - 0.5); how many times V8 calls the comparator is an
// implementation detail, so measure it here instead of assuming it.
const SORT = (() => { let n = 0; [0, 1, 2].sort(() => { n++; return 0.5 - 0.5; }); return Array(n).fill(0.5); })();

const mkDeps = (rng = seq()) => ({ rng, saved: [], saveHighScore(n) { this.saved.push(n); } });
const NONE = { left: false, right: false };
const ob = (type, x = 0, z = 0.5, hit = false) => ({ type, x, z, hit });
/** A started run; spawn is parked far away so steps are deterministic unless a test wants a spawn. */
const run = (patch = {}) => Object.assign(createGameState(0), { started: true, spawnTimer: -1000 }, patch);
const apply = (updates, d = { ...INITIAL_DISP }) => updates.reduce((acc, u) => u(acc), d);

test('getLevelIdx and getStars follow the score thresholds', () => {
  assert.deepEqual([0, 499, 500, 1999, 2000, 4999, 5000, 9999, 10000, 24999, 25000, 1e9].map(getLevelIdx), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  assert.deepEqual([0, 499, 500, 1999, 2000, 4999, 5000, 9999, 10000, 24999, 25000].map(getStars), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5]);
  assert.equal(LEVELS.length, 6);
});

test('perspective: the horizon is narrower than the player row, lane 0 is centred', () => {
  assert.equal(persp(0), 1);
  assert.ok(persp(Z_SPAWN) < persp(1));
  assert.equal(screenX(0, 10), 160);
  assert.ok(screenX(0.68, 0) > screenX(0, 0));
});

test('createGameState / resetGameState: reset keeps the high score and stripes, clears the run', () => {
  const s = createGameState(777);
  assert.equal(s.started, false);
  assert.equal(s.highScore, 777);
  Object.assign(s, { score: 900, lives: 1, obs: [ob('cop')], stripeZ: [1], level: 3, heliPhase: 'warn', gameOver: true });
  resetGameState(s);
  assert.equal(s.started, true);
  assert.equal(s.gameOver, false);
  assert.equal(s.score, 0);
  assert.equal(s.lives, 3);
  assert.equal(s.level, 0);
  assert.equal(s.heliPhase, 'idle');
  assert.equal(s.heliCooldown, HELI_COOLDOWN_BASE);
  assert.deepEqual(s.obs, []);
  assert.equal(s.highScore, 777);
  assert.deepEqual(s.stripeZ, [1]);
});

test('cameraShake only consumes randomness while off the asphalt', () => {
  const rng = seq(1, 1);
  assert.equal(cameraShake(0, rng), 0);
  assert.equal(rng.calls, 0);
  assert.equal(cameraShake(1, rng), 1.25);
  assert.equal(cameraShake(2, rng), 2.5);
  assert.equal(rng.calls, 2);
});

test('driving earns score, speeds up every 600 frames and reports mph', () => {
  const s = run({ frame: 599 });
  const r = stepGame(s, LEVELS[0], NONE, mkDeps());
  assert.equal(s.frame, 600);
  assert.ok(Math.abs(s.speed - 2.56) < 1e-9);
  assert.equal(s.score, Math.floor(2.56 * 0.5 + 0.5));
  assert.equal(r.mph, Math.round(28 + 2.56 * 13));
  assert.equal(apply(r.updates).mph, r.mph);
  assert.equal(apply(r.updates).score, s.score);
});

test('speed is capped at 5.4', () => {
  const s = run({ frame: 599, speed: 5.39 });
  stepGame(s, LEVELS[0], NONE, mkDeps());
  assert.equal(s.speed, 5.4);
});

test('invincibility doubles the driving score', () => {
  const a = run(); const b = run({ invincibleTimer: 5 });
  stepGame(a, LEVELS[0], NONE, mkDeps());
  stepGame(b, LEVELS[0], NONE, mkDeps());
  assert.equal(b.score, a.score * 2);
});

test('steering moves by STEER, the wall stops the car and slows it down', () => {
  const s = run();
  stepGame(s, LEVELS[0], { left: false, right: true }, mkDeps());
  assert.ok(Math.abs(s.playerX - STEER) < 1e-12);
  assert.equal(s.offRoad, 0);

  const w = run({ playerX: WALL_EDGE });
  stepGame(w, LEVELS[0], { left: false, right: true }, mkDeps());
  assert.equal(w.playerX, WALL_EDGE);
  assert.equal(w.offRoad, 2);
  assert.equal(w.wallFlash, 7); // set to 8, then ticked down in the same step

  const l = run({ playerX: -WALL_EDGE });
  stepGame(l, LEVELS[0], { left: true, right: false }, mkDeps());
  assert.equal(l.playerX, -WALL_EDGE);

  const shoulder = run({ playerX: 1.05 });
  stepGame(shoulder, LEVELS[0], NONE, mkDeps());
  assert.equal(shoulder.offRoad, 1);
  const road = run({ playerX: 0 });
  stepGame(road, LEVELS[0], NONE, mkDeps());
  const slow = [shoulder, road].map(x => x.stripeZ[0]);
  assert.ok(slow[0] > slow[1], 'stripes scroll slower on the shoulder');
});

test('level up: banner, grace period and the new name on the overlay', () => {
  const s = run({ score: 499 });
  const r = stepGame(s, LEVELS[0], NONE, mkDeps());
  assert.equal(s.level, 1);
  assert.equal(s.graceTimer, 70);
  assert.equal(s.levelBannerTimer, 89); // 90, ticked once in the same step
  assert.equal(apply(r.updates).levelName, 'HEAT RISING');
});

test('spawning: nothing before the timer, one obstacle when it fires, randomness consumed in order', () => {
  const idle = run({ spawnTimer: 0 });
  const rng0 = seq();
  stepGame(idle, LEVELS[0], NONE, mkDeps(rng0));
  assert.equal(idle.obs.length, 0);
  assert.equal(rng0.calls, 0);

  // level 0 is single-lane: no "dual" roll. Then the lane shuffle, then one type roll.
  const s = run({ spawnTimer: 1000 });
  const rng = seq(...SORT, 0.2); // after the lane shuffle comes the type roll -> money (0.095 <= 0.2 < 0.34)
  stepGame(s, LEVELS[0], NONE, mkDeps(rng));
  assert.equal(s.spawnTimer, 0);
  assert.equal(s.obs.length, 1);
  assert.equal(s.obs[0].type, 'money');
  assert.equal(s.obs[0].hit, false);
});

test('spawn type bands: nitro, shield, money, then the level pool without money', () => {
  const typeFor = (roll, extra = []) => {
    const s = run({ spawnTimer: 1000 });
    const rng = seq(...SORT, roll, ...extra);
    stepGame(s, LEVELS[0], NONE, mkDeps(rng));
    return s.obs[0].type;
  };
  assert.equal(typeFor(0.01), 'nitro');
  assert.equal(typeFor(0.07), 'shield');
  assert.equal(typeFor(0.2), 'money');
  assert.equal(typeFor(0.9, [0.0]), 'cop'); // level 0 pool without money is ['cop']
});

test('dual spawn on a dual level puts two obstacles in different lanes', () => {
  const s = run({ spawnTimer: 1000 });
  // dual roll 0.1 < 0.22 -> dual; lane shuffle; lane0 roll 0.9 -> pool pick (0.0 = cop); lane1 roll 0.9 -> cop (0.3 < 0.6)
  const rng = seq(0.1, ...SORT, 0.9, 0.0, 0.9, 0.3);
  stepGame(s, LEVELS[2], NONE, mkDeps(rng));
  assert.equal(s.obs.length, 2);
  assert.notEqual(s.obs[0].x, s.obs[1].x);
  assert.equal(s.obs[1].type, 'cop');
});

test('money pickup: 500 + combo * 50, combo grows and shows on the overlay', () => {
  const s = run({ combo: 2, obs: [ob('money', 0, 0.45)] });
  const r = stepGame(s, LEVELS[0], NONE, mkDeps());
  const gain = Math.floor(2.4 * 0.5 + 0.5);
  assert.equal(s.score, gain + 500 + 2 * 50);
  assert.equal(s.combo, 3);
  assert.equal(apply(r.updates).combo, 3);
  assert.equal(s.obs[0].hit, true);
});

test('nitro: 200 points, 200 frames of invincibility, overlay flag; shield pickup arms the shield', () => {
  const n = run({ obs: [ob('nitro', 0, 0.45)] });
  const r = stepGame(n, LEVELS[0], NONE, mkDeps());
  assert.equal(n.invincibleTimer, 200);
  assert.equal(apply(r.updates).nitro, true);

  const sh = run({ obs: [ob('shield', 0, 0.45)] });
  const r2 = stepGame(sh, LEVELS[0], NONE, mkDeps());
  assert.equal(sh.shielded, true);
  assert.equal(apply(r2.updates).shielded, true);
});

test('nitro flag leaves the overlay once the invincibility is over', () => {
  const s = run();
  const r = stepGame(s, LEVELS[0], NONE, mkDeps());
  assert.equal(apply(r.updates, { ...INITIAL_DISP, nitro: true }).nitro, false);
  const t = run({ invincibleTimer: 10 });
  assert.equal(apply(stepGame(t, LEVELS[0], NONE, mkDeps()).updates, { ...INITIAL_DISP, nitro: true }).nitro, true);
});

test('hitting a cop costs a life and the combo; roadblocks and SWAT flash longer', () => {
  const cop = run({ combo: 4, obs: [ob('cop')] });
  const r = stepGame(cop, LEVELS[0], NONE, mkDeps());
  assert.equal(cop.lives, 2);
  assert.equal(cop.combo, 0);
  assert.equal(cop.flashTimer, 40); // set after this frame's timers tick, so the full value
  assert.equal(apply(r.updates).lives, 2);

  const swat = run({ obs: [ob('swat', 0.4)] }); // 0.4 < 0.42 tolerance
  stepGame(swat, LEVELS[0], NONE, mkDeps());
  assert.equal(swat.lives, 2);
  assert.equal(swat.flashTimer, 55); // set after the timers tick, so it keeps the full value this frame

  const road = run({ obs: [ob('road', 0.45)] });
  stepGame(road, LEVELS[0], NONE, mkDeps());
  assert.equal(road.lives, 2);
});

test('hit tolerance differs per type', () => {
  const cop = run({ obs: [ob('cop', 0.4)] }); // 0.4 >= 0.32: a miss
  stepGame(cop, LEVELS[0], NONE, mkDeps());
  assert.equal(cop.lives, 3);
  const swat = run({ obs: [ob('swat', 0.43)] }); // 0.43 >= 0.42: a miss
  stepGame(swat, LEVELS[0], NONE, mkDeps());
  assert.equal(swat.lives, 3);
});

test('dodging a hazard pays 40; missing a pickup pays nothing', () => {
  const dodge = run({ obs: [ob('cop', 0.68)] });
  stepGame(dodge, LEVELS[0], NONE, mkDeps());
  assert.equal(dodge.score, Math.floor(2.4 * 0.5 + 0.5) + 40);
  const miss = run({ obs: [ob('money', 0.68, 0.45)] });
  stepGame(miss, LEVELS[0], NONE, mkDeps());
  assert.equal(miss.score, Math.floor(2.4 * 0.5 + 0.5));
});

test('the shield absorbs a hit, invincibility and the grace period turn it into +150', () => {
  const shield = run({ shielded: true, obs: [ob('cop')] });
  const r = stepGame(shield, LEVELS[0], NONE, mkDeps());
  assert.equal(shield.lives, 3);
  assert.equal(shield.shielded, false);
  assert.equal(apply(r.updates, { ...INITIAL_DISP, shielded: true }).shielded, false);

  const nitro = run({ invincibleTimer: 50, obs: [ob('cop')] });
  stepGame(nitro, LEVELS[0], NONE, mkDeps());
  assert.equal(nitro.lives, 3);
  assert.equal(nitro.score, 2 * Math.floor(2.4 * 0.5 + 0.5) + 150);

  const grace = run({ graceTimer: 5, obs: [ob('cop')] });
  stepGame(grace, LEVELS[0], NONE, mkDeps());
  assert.equal(grace.lives, 3);
});

test('the last life ends the run and saves a new best score only', () => {
  const best = run({ lives: 1, score: 100, highScore: 50, obs: [ob('cop')] });
  const deps = mkDeps();
  const r = stepGame(best, LEVELS[0], NONE, deps);
  assert.equal(best.gameOver, true);
  assert.equal(best.highScore, best.score);
  assert.deepEqual(deps.saved, [best.score]);
  const d = apply(r.updates);
  assert.equal(d.gameOver, true);
  assert.equal(d.lives, 0);

  const worse = run({ lives: 1, score: 10, highScore: 5000, obs: [ob('cop')] });
  const deps2 = mkDeps();
  stepGame(worse, LEVELS[0], NONE, deps2);
  assert.equal(worse.gameOver, true);
  assert.equal(worse.highScore, 5000);
  assert.deepEqual(deps2.saved, []);
});

test('obstacles are removed once they are far behind the player', () => {
  const s = run({ obs: [ob('cop', 0.68, -1.49, true)] });
  stepGame(s, LEVELS[0], NONE, mkDeps());
  assert.equal(s.obs.length, 0);
});

test('obstacles are processed nearest-first after sorting by distance', () => {
  const s = run({ obs: [ob('cop', 0.68, 5), ob('cop', 0.68, 12), ob('cop', 0.68, 8)] });
  stepGame(s, LEVELS[0], NONE, mkDeps());
  assert.deepEqual(s.obs.map(o => Math.round(o.z)), [12, 8, 5].map(z => Math.round(z - 2.4 * 0.05 * 1)));
});

test('the chopper only appears on levels that have one: warn, strike, then cooldown', () => {
  const calm = run({ heliCooldown: 1 });
  stepGame(calm, LEVELS[2], NONE, mkDeps());
  assert.equal(calm.heliPhase, 'idle');

  const s = run({ heliCooldown: 1, level: 3, score: 5000 });
  const rng = seq(0.9); // lane = floor(0.9 * 3) = 2
  stepGame(s, LEVELS[3], NONE, mkDeps(rng));
  assert.equal(s.heliPhase, 'warn');
  assert.equal(s.heliZone, 2);
  assert.equal(s.heliTimer, HELI_WARN_FRAMES);

  s.heliTimer = 1;
  stepGame(s, LEVELS[3], NONE, mkDeps());
  assert.equal(s.heliPhase, 'strike');
  assert.equal(s.heliTimer, HELI_STRIKE_FRAMES);
});

test('chopper strike outcomes (flash length, dodge bonus, shield, invulnerability)', () => {
  const strike = (patch) => run({ level: 3, score: 5000, heliPhase: 'strike', heliZone: 1, heliTimer: HELI_STRIKE_FRAMES, heliHit: false, ...patch });
  const base = 2 * 0 + Math.floor(2.4 * 1.3 * 0.5 + 0.5); // driving score of one step on level 3

  const hit = strike({ playerX: 0 });
  stepGame(hit, LEVELS[3], NONE, mkDeps());
  assert.equal(hit.lives, 2);
  assert.equal(hit.flashTimer, 45);
  assert.equal(hit.heliHit, true);

  const dodge = strike({ playerX: 0.68 });
  stepGame(dodge, LEVELS[3], NONE, mkDeps());
  assert.equal(dodge.lives, 3);
  assert.equal(dodge.score, 5000 + base + 300);

  const shield = strike({ playerX: 0, shielded: true });
  stepGame(shield, LEVELS[3], NONE, mkDeps());
  assert.equal(shield.lives, 3);
  assert.equal(shield.shielded, false);

  const safe = strike({ playerX: 0, invincibleTimer: 30 });
  stepGame(safe, LEVELS[3], NONE, mkDeps());
  assert.equal(safe.lives, 3);
  assert.equal(safe.score, 5000 + 2 * base, 'invulnerable in the same lane: no bonus, no damage');

  // a strike hits only once, then the chopper goes back to idle with a level-based cooldown
  const done = strike({ playerX: 0, heliTimer: 1, level: 4 });
  stepGame(done, LEVELS[4], NONE, mkDeps());
  assert.equal(done.heliPhase, 'idle');
  assert.equal(done.heliZone, -1);
  assert.equal(done.heliCooldown, Math.max(260, HELI_COOLDOWN_BASE - 4 * 30));
});

test('stepGame is deterministic for a given rng sequence', () => {
  const play = () => {
    const s = run({ spawnTimer: 0 });
    let k = 0;
    const deps = mkDeps(() => ((k = (k * 9301 + 49297) % 233280) / 233280));
    for (let i = 0; i < 400; i++) stepGame(s, LEVELS[getLevelIdx(s.score)], { left: i % 40 < 15, right: i % 40 >= 25 }, deps);
    return JSON.stringify([s.score, s.lives, s.obs.length, s.level, s.playerX]);
  };
  assert.equal(play(), play());
});
