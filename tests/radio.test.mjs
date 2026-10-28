import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { startRadio, toggleRadio } from '../src/lib/radio.ts';

const store = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; };

/** Fake <audio>: an EventTarget with play/pause/load and the fields the radio reads. */
function fakeAudio(opts = {}) {
  const a = new EventTarget();
  Object.assign(a, { paused: true, currentTime: 0, duration: 200, readyState: 4, loop: true, volume: 1, loads: 0, plays: 0, rejectPlay: false, seekThrows: false }, opts);
  a.load = () => { a.loads++; };
  a.pause = () => { a.paused = true; };
  a.play = () => { a.plays++; if (a.rejectPlay) return Promise.reject(new Error('blocked')); a.paused = false; return Promise.resolve(); };
  return a;
}
const flush = () => new Promise(r => setImmediate(r));

function setup(session = {}, local = {}) {
  const s = store(), l = store();
  for (const [k, v] of Object.entries(session)) s.setItem(k, v);
  for (const [k, v] of Object.entries(local)) l.setItem(k, v);
  const doc = new EventTarget(); doc.visibilityState = 'visible';
  globalThis.sessionStorage = s; globalThis.localStorage = l; globalThis.document = doc; globalThis.window = new EventTarget();
  mock.timers.enable({ apis: ['setInterval'] });
  const states = [];
  return { s, l, doc, states, setPlaying: v => states.push(v), index: () => 7 };
}
const done = () => mock.timers.reset();

const start = (audio, c) => startRadio(audio, c.setPlaying, c.index);

test('mount on a first visit: configures audio, loads and plays, then marks playing', async () => {
  const c = setup();
  const audio = fakeAudio();
  const stop = start(audio, c);
  await flush();
  assert.equal(audio.loop, false); assert.equal(audio.volume, 0.25); assert.equal(audio.preload, 'auto');
  assert.equal(audio.loads, 1); assert.equal(audio.plays, 1);
  assert.deepEqual(c.states, [true]); assert.equal(c.s.getItem('radioPlaying'), 'true');
  stop(); done();
});

test('mount after the user muted this session stays silent and reports not playing', async () => {
  const c = setup({ radioPlaying: 'false' });
  const audio = fakeAudio();
  const stop = start(audio, c);
  await flush();
  assert.equal(audio.plays, 0); assert.deepEqual(c.states, [false]);
  stop(); done();
});

test('saved position is restored when metadata is ready, or after loadedmetadata', () => {
  let c = setup({}, { radioTime: '42.5' });
  let audio = fakeAudio({ readyState: 4 });
  let stop = start(audio, c);
  assert.equal(audio.currentTime, 42.5); stop(); done();

  c = setup({}, { radioTime: '42.5' });
  audio = fakeAudio({ readyState: 0 });
  stop = start(audio, c);
  assert.equal(audio.currentTime, 0);
  audio.dispatchEvent(new Event('loadedmetadata'));
  assert.equal(audio.currentTime, 42.5); stop(); done();
});

test('saved position is ignored when invalid, too long for the track, or when seeking throws', () => {
  for (const raw of ['abc', '-5', '500']) {
    const c = setup({}, { radioTime: raw });
    const audio = fakeAudio();
    const stop = start(audio, c);
    assert.equal(audio.currentTime, 0, `radioTime=${raw}`); stop(); done();
  }
  const c = setup({}, { radioTime: '10' });
  const audio = fakeAudio();
  Object.defineProperty(audio, 'currentTime', { get: () => 0, set: () => { throw new Error('not seekable'); } });
  assert.doesNotThrow(() => start(audio, c)()); done();
});

test('a blocked autoplay is retried on the first click, key or touch and not marked playing before that', async () => {
  for (const type of ['click', 'keydown', 'touchstart', 'touchend']) {
    const c = setup();
    const audio = fakeAudio({ rejectPlay: true });
    const stop = start(audio, c);
    await flush();
    assert.deepEqual(c.states, [], type);
    audio.rejectPlay = false;
    document.dispatchEvent(new Event(type));
    await flush();
    assert.deepEqual(c.states, [true], type); assert.equal(c.s.getItem('radioPlaying'), 'true');
    stop(); done();
  }
});

test('the first gesture does nothing when the user muted', async () => {
  const c = setup({ radioPlaying: 'false' });
  const audio = fakeAudio();
  const stop = start(audio, c);
  document.dispatchEvent(new Event('keydown'));
  await flush();
  assert.equal(audio.plays, 0); stop(); done();
});

test('when a track ends playback resumes (the audio manager loads the next track)', async () => {
  const c = setup();
  const audio = fakeAudio();
  const stop = start(audio, c);
  await flush();
  const plays = audio.plays, loads = audio.loads;
  audio.dispatchEvent(new Event('ended'));
  await flush();
  assert.equal(audio.plays, plays + 1); assert.equal(audio.loads, loads);
  stop(); done();
});

test('progress and track index are saved every second and on unload, only while playing', async () => {
  const c = setup();
  const audio = fakeAudio();
  const stop = start(audio, c);
  await flush();
  audio.currentTime = 61;
  mock.timers.tick(999); assert.equal(c.l.getItem('radioTime'), null);
  mock.timers.tick(1); assert.equal(c.l.getItem('radioTime'), '61'); assert.equal(c.l.getItem('radioTrackIndex'), '7');
  audio.currentTime = 70; window.dispatchEvent(new Event('beforeunload')); assert.equal(c.l.getItem('radioTime'), '70');
  audio.pause(); audio.currentTime = 99; window.dispatchEvent(new Event('beforeunload')); assert.equal(c.l.getItem('radioTime'), '70');
  stop(); done();
});

test('a tab that becomes visible resumes the radio unless the user muted', async () => {
  const c = setup();
  const audio = fakeAudio();
  const stop = start(audio, c);
  await flush();
  audio.pause(); const plays = audio.plays;
  document.visibilityState = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); await flush();
  assert.equal(audio.plays, plays);
  document.visibilityState = 'visible'; document.dispatchEvent(new Event('visibilitychange')); await flush();
  assert.equal(audio.plays, plays + 1);
  audio.pause(); c.s.setItem('radioPlaying', 'false'); document.dispatchEvent(new Event('visibilitychange')); await flush();
  assert.equal(audio.plays, plays + 1);
  stop(); done();
});

test('cleanup stops listeners, saves the final position and pauses', async () => {
  const c = setup();
  const audio = fakeAudio();
  const stop = start(audio, c);
  await flush();
  audio.currentTime = 33;
  stop();
  assert.equal(c.l.getItem('radioTime'), '33'); assert.equal(audio.paused, true);
  const plays = audio.plays;
  audio.dispatchEvent(new Event('ended')); document.dispatchEvent(new Event('visibilitychange')); mock.timers.tick(10000);
  assert.equal(audio.plays, plays);
  done();
});

test('toggle: pauses and remembers the mute when playing, plays when not', async () => {
  const c = setup();
  const audio = fakeAudio({ paused: false });
  toggleRadio(audio, true, c.setPlaying);
  assert.equal(audio.paused, true); assert.deepEqual(c.states, [false]); assert.equal(c.s.getItem('radioPlaying'), 'false');
  toggleRadio(audio, false, c.setPlaying); await flush();
  assert.equal(audio.paused, false); assert.deepEqual(c.states, [false, true]); assert.equal(c.s.getItem('radioPlaying'), 'true');
  toggleRadio(null, false, c.setPlaying); // no audio yet: nothing happens
  done();
});

test('toggle with a blocked play leaves the state untouched', async () => {
  const c = setup();
  toggleRadio(fakeAudio({ rejectPlay: true }), false, c.setPlaying); await flush();
  assert.deepEqual(c.states, []); done();
});
