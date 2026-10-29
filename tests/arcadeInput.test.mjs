import { test } from 'node:test';
import assert from 'node:assert/strict';
import { steerSide, canStartRun, touchSide, createInputHandlers } from '../src/lib/arcadeInput.ts';
import { W } from '../src/lib/arcadeEngine.ts';

function setup(state = { started: true, gameOver: false }, left = 10) {
  const held = { current: { left: false, right: false } };
  const calls = { reset: 0, prevented: 0 };
  const h = createInputHandlers({ held, st: { current: state }, reset: () => { calls.reset++; }, canvasLeft: () => left });
  const key = (k) => ({ key: k, preventDefault: () => { calls.prevented++; } });
  const touch = (x) => ({ changedTouches: [{ clientX: x }], preventDefault: () => { calls.prevented++; } });
  return { held, calls, h, key, touch };
}

test('steerSide: arrows and A/D only (case sensitive, as before)', () => {
  assert.equal(steerSide('ArrowLeft'), 'left');
  assert.equal(steerSide('a'), 'left');
  assert.equal(steerSide('ArrowRight'), 'right');
  assert.equal(steerSide('d'), 'right');
  for (const k of ['A', 'D', 'w', ' ', 'Enter', 'constructor', 'toString', '']) assert.equal(steerSide(k), null);
});

test('canStartRun: title and game-over screens, not mid-run', () => {
  assert.equal(canStartRun({ started: false, gameOver: false }), true);
  assert.equal(canStartRun({ started: true, gameOver: true }), true);
  assert.equal(canStartRun({ started: false, gameOver: true }), true);
  assert.equal(canStartRun({ started: true, gameOver: false }), false);
});

test('touchSide: split at half the canvas width, relative to its left edge', () => {
  assert.equal(touchSide(10 + W / 2 - 1, 10), 'left');
  assert.equal(touchSide(10 + W / 2, 10), 'right');
  assert.equal(touchSide(5, 10), 'left');
});

test('keyDown: steering keys hold and block page scroll; other keys do nothing', () => {
  const { held, calls, h, key } = setup();
  h.keyDown(key('ArrowLeft'));
  h.keyDown(key('d'));
  assert.deepEqual(held.current, { left: true, right: true });
  assert.equal(calls.prevented, 2);
  h.keyDown(key('x'));
  assert.equal(calls.prevented, 2);
  assert.equal(calls.reset, 0);
});

test('keyDown: Space/Enter start a run only on title or game-over screen', () => {
  const mid = setup({ started: true, gameOver: false });
  mid.h.keyDown(mid.key(' ')); mid.h.keyDown(mid.key('Enter'));
  assert.equal(mid.calls.reset, 0);
  const title = setup({ started: false, gameOver: false });
  title.h.keyDown(title.key(' '));
  assert.equal(title.calls.reset, 1);
  const over = setup({ started: true, gameOver: true });
  over.h.keyDown(over.key('Enter'));
  assert.equal(over.calls.reset, 1);
  assert.equal(over.calls.prevented, 0);
});

test('keyUp releases only its own side', () => {
  const { held, h, key } = setup();
  held.current.left = true; held.current.right = true;
  h.keyUp(key('a'));
  assert.deepEqual(held.current, { left: false, right: true });
  h.keyUp(key('x'));
  assert.deepEqual(held.current, { left: false, right: true });
});

test('touchStart: starts a run when idle, steers by half otherwise; always blocks scrolling', () => {
  const idle = setup({ started: false, gameOver: false });
  idle.h.touchStart(idle.touch(50));
  assert.equal(idle.calls.reset, 1);
  assert.deepEqual(idle.held.current, { left: false, right: false });
  assert.equal(idle.calls.prevented, 1);

  const run = setup({ started: true, gameOver: false }, 10);
  run.h.touchStart(run.touch(20));
  assert.deepEqual(run.held.current, { left: true, right: false });
  run.h.touchStart(run.touch(10 + W - 1));
  assert.deepEqual(run.held.current, { left: true, right: true });
  assert.equal(run.calls.reset, 0);
  assert.equal(run.calls.prevented, 2);
});

test('touchEnd releases both sides', () => {
  const { held, calls, h, touch } = setup();
  held.current.left = true; held.current.right = true;
  h.touchEnd(touch(0));
  assert.deepEqual(held.current, { left: false, right: false });
  assert.equal(calls.prevented, 1);
});
