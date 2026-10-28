import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { startRpRadio, toggleRpRadio } from '../src/lib/rpRadio.ts';
import { BG_IMAGES, tabBodyStyle } from '../src/lib/rpTabs.ts';

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
  const doc = new EventTarget(); doc.hidden = false;
  globalThis.sessionStorage = s; globalThis.localStorage = l; globalThis.document = doc; globalThis.window = new EventTarget();
  mock.timers.enable({ apis: ['setInterval'] });
  const states = [];
  return { s, l, doc, states, setPlaying: v => states.push(v) };
}
const done = () => mock.timers.reset();

test('mount on a first visit: configures audio, loads and plays, then marks playing', async () => {
  const { s, states, setPlaying } = setup();
  const audio = fakeAudio();
  const stop = startRpRadio(audio, setPlaying);
  await flush();
  assert.equal(audio.loop, false); assert.equal(audio.volume, 0.25); assert.equal(audio.loads, 1); assert.equal(audio.plays, 1);
  assert.deepEqual(states, [true]); assert.equal(s.getItem('radioPlaying'), 'true');
  stop(); done();
});

test('mount after the user muted this session stays silent and reports not playing', async () => {
  const { states, setPlaying } = setup({ radioPlaying: 'false' });
  const audio = fakeAudio();
  const stop = startRpRadio(audio, setPlaying);
  await flush();
  assert.equal(audio.plays, 0); assert.deepEqual(states, [false]);
  stop(); done();
});

test('saved position is restored when metadata is ready, or after loadedmetadata', () => {
  let ctx = setup({}, { radioTime: '42.5' });
  let audio = fakeAudio({ readyState: 4 });
  let stop = startRpRadio(audio, ctx.setPlaying);
  assert.equal(audio.currentTime, 42.5); stop(); done();

  ctx = setup({}, { radioTime: '42.5' });
  audio = fakeAudio({ readyState: 0 });
  stop = startRpRadio(audio, ctx.setPlaying);
  assert.equal(audio.currentTime, 0);
  audio.dispatchEvent(new Event('loadedmetadata'));
  assert.equal(audio.currentTime, 42.5); stop(); done();
});

test('saved position is ignored when invalid, too long for the track, or when seeking throws', () => {
  for (const [raw, extra] of [['abc', {}], ['-5', {}], ['500', {}]]) {
    const ctx = setup({}, { radioTime: raw });
    const audio = fakeAudio(extra);
    const stop = startRpRadio(audio, ctx.setPlaying);
    assert.equal(audio.currentTime, 0, `radioTime=${raw}`); stop(); done();
  }
  const ctx = setup({}, { radioTime: '10' });
  const audio = fakeAudio();
  Object.defineProperty(audio, 'currentTime', { get: () => 0, set: () => { throw new Error('not seekable'); } });
  assert.doesNotThrow(() => startRpRadio(audio, ctx.setPlaying)()); done();
});

test('a blocked autoplay is retried on the first click and not marked playing before that', async () => {
  const { s, states, setPlaying } = setup();
  const audio = fakeAudio({ rejectPlay: true });
  const stop = startRpRadio(audio, setPlaying);
  await flush();
  assert.deepEqual(states, []);
  audio.rejectPlay = false;
  document.dispatchEvent(new Event('click'));
  await flush();
  assert.deepEqual(states, [true]); assert.equal(s.getItem('radioPlaying'), 'true');
  stop(); done();
});

test('the first gesture does nothing when the user muted', async () => {
  const { setPlaying } = setup({ radioPlaying: 'false' });
  const audio = fakeAudio();
  const stop = startRpRadio(audio, setPlaying);
  document.dispatchEvent(new Event('keydown'));
  await flush();
  assert.equal(audio.plays, 0); stop(); done();
});

test('when a track ends: radioTime resets to 0, the source reloads and playback resumes', async () => {
  const { l, setPlaying } = setup({}, { radioTime: '30' });
  const audio = fakeAudio();
  const stop = startRpRadio(audio, setPlaying);
  await flush();
  const loadsBefore = audio.loads, playsBefore = audio.plays;
  audio.dispatchEvent(new Event('ended'));
  await flush();
  assert.equal(l.getItem('radioTime'), '0'); assert.equal(audio.loads, loadsBefore + 1); assert.equal(audio.plays, playsBefore + 1);
  stop(); done();
});

test('progress is saved every 5 s and on unload, only while playing', async () => {
  const { l, setPlaying } = setup();
  const audio = fakeAudio();
  const stop = startRpRadio(audio, setPlaying);
  await flush();
  audio.currentTime = 61;
  mock.timers.tick(4999); assert.equal(l.getItem('radioTime'), null);
  mock.timers.tick(1); assert.equal(l.getItem('radioTime'), '61');
  audio.currentTime = 70; window.dispatchEvent(new Event('beforeunload')); assert.equal(l.getItem('radioTime'), '70');
  audio.pause(); audio.currentTime = 99; window.dispatchEvent(new Event('beforeunload')); assert.equal(l.getItem('radioTime'), '70');
  stop(); done();
});

test('hiding the tab saves the position; showing it resumes unless muted', async () => {
  const { l, s, setPlaying } = setup();
  const audio = fakeAudio();
  const stop = startRpRadio(audio, setPlaying);
  await flush();
  audio.currentTime = 12; document.hidden = true; document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(l.getItem('radioTime'), '12');
  audio.pause(); document.hidden = false; const plays = audio.plays;
  document.dispatchEvent(new Event('visibilitychange')); await flush();
  assert.equal(audio.plays, plays + 1);
  audio.pause(); s.setItem('radioPlaying', 'false'); document.dispatchEvent(new Event('visibilitychange')); await flush();
  assert.equal(audio.plays, plays + 1);
  stop(); done();
});

test('cleanup stops listeners, saves the final position and pauses', async () => {
  const { l, setPlaying } = setup();
  const audio = fakeAudio();
  const stop = startRpRadio(audio, setPlaying);
  await flush();
  audio.currentTime = 33;
  stop();
  assert.equal(l.getItem('radioTime'), '33'); assert.equal(audio.paused, true);
  const loads = audio.loads;
  audio.dispatchEvent(new Event('ended')); mock.timers.tick(10000);
  assert.equal(audio.loads, loads);
  done();
});

test('toggle: plays when paused, pauses and remembers mute + position when playing', async () => {
  const { s, l, states, setPlaying } = setup();
  const audio = fakeAudio();
  toggleRpRadio(audio, setPlaying); await flush();
  assert.equal(audio.paused, false); assert.deepEqual(states, [true]); assert.equal(s.getItem('radioPlaying'), 'true');
  audio.currentTime = 8;
  toggleRpRadio(audio, setPlaying);
  assert.equal(audio.paused, true); assert.deepEqual(states, [true, false]);
  assert.equal(s.getItem('radioPlaying'), 'false'); assert.equal(l.getItem('radioTime'), '8');
  toggleRpRadio(null, setPlaying); // no audio yet: nothing happens
  done();
});

test('toggle with a blocked play leaves the state untouched', async () => {
  const { states, setPlaying } = setup();
  toggleRpRadio(fakeAudio({ rejectPlay: true }), setPlaying); await flush();
  assert.deepEqual(states, []); done();
});

test('every tab has its own background photo and the body style layers a gradient over it', () => {
  const tabs = ['servers', 'glossary', 'characters', 'mods', 'store', 'community'];
  assert.deepEqual(Object.keys(BG_IMAGES).sort(), [...tabs].sort());
  assert.equal(new Set(Object.values(BG_IMAGES)).size, tabs.length);
  for (const t of tabs) {
    const st = tabBodyStyle(t);
    assert.ok(st.backgroundImage.includes(`url('${BG_IMAGES[t]}')`));
    assert.ok(st.backgroundImage.startsWith('linear-gradient(to bottom'));
    assert.equal(st.backgroundPosition, 'center 20%'); assert.equal(st.backgroundAttachment, 'fixed');
  }
});
