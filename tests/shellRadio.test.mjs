// Leonida FM: the radio core of the persistent shell (src/shell/radio.ts) and its pure playlist rules (src/shell/playlist.ts).
// The radio is driven with a fake <audio> element that follows the rules of the real one where they matter here:
//   * autoplay policy: play() is rejected (and the element stays paused) until a user gesture unlocked it;
//   * the load algorithm: assigning a new src stops the element, play() has to be called again;
//   * a track that plays to its end is paused first, then `pause` and `ended` fire; `ended` stays true until the next src;
//   * events arrive asynchronously, `play` fires when play() is CALLED (even for a file that then fails), `playing` only
//     when sound really starts.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRadio } from '../src/shell/radio.ts';
import {
  MUZ_PUBLIC_BASE, indexOfTrack, parseCachedPlaylist, parseSavedTrackIndex, parseVolume, pickRandomIndex, playlistFromListing,
} from '../src/shell/playlist.ts';

const NAME_A = 'GTA 6 Official Home Screen Music (10 Minute Extended Loop).ogg';
const NAME_B = 'Grand Theft Auto VI - Viva Leonida (XMB  Console Menu Screen Theme).ogg';
const NAME_C = 'Vice City Nights.mp3';
const urlOf = name => MUZ_PUBLIC_BASE + encodeURIComponent(name);
const URL_A = urlOf(NAME_A);
const URL_B = urlOf(NAME_B);
const URL_C = urlOf(NAME_C);
const OLD_1 = MUZ_PUBLIC_BASE + '1.ogg';
const OLD_2 = MUZ_PUBLIC_BASE + '2.ogg';
const LISTING = [{ name: '.emptyFolderPlaceholder' }, { name: NAME_A }, { name: NAME_B }, { name: NAME_C }];

// ================================================================================================================
// playlist rules
// ================================================================================================================

test('playlistFromListing: audio files only, URL-encoded, in listing order; the folder placeholder is dropped', () => {
  assert.deepEqual(playlistFromListing(LISTING), [URL_A, URL_B, URL_C]);
  assert.equal(URL_A, MUZ_PUBLIC_BASE + 'GTA%206%20Official%20Home%20Screen%20Music%20(10%20Minute%20Extended%20Loop).ogg');
  const mixed = [{ name: 'a.OGG' }, { name: 'b.mp3' }, { name: 'c.wav' }, { name: 'd.flac' }, { name: 'e.txt' }, { name: 'f.png' }, { name: 'readme' }, { name: 'ogg' }];
  assert.deepEqual(playlistFromListing(mixed).map(u => decodeURIComponent(u.slice(MUZ_PUBLIC_BASE.length))), ['a.OGG', 'b.mp3', 'c.wav', 'd.flac']);
});

test('playlistFromListing: characters that break a URL are encoded', () => {
  const [url] = playlistFromListing([{ name: 'Beat #1 & more?.mp3' }]);
  assert.equal(url, MUZ_PUBLIC_BASE + 'Beat%20%231%20%26%20more%3F.mp3');
  assert.equal(new URL(url).hash, '');
  assert.equal(new URL(url).search, '');
});

test('playlistFromListing: anything that is not a listing gives an empty playlist', () => {
  for (const bad of [null, undefined, {}, 'x', 42, [], [null], [{}], [{ name: 5 }], { message: 'denied' }])
    assert.deepEqual(playlistFromListing(bad), [], JSON.stringify(bad));
});

test('parseCachedPlaylist: only muz track URLs survive; garbage becomes an empty list', () => {
  assert.deepEqual(parseCachedPlaylist(JSON.stringify([URL_A, URL_B])), [URL_A, URL_B]);
  assert.deepEqual(parseCachedPlaylist(JSON.stringify([URL_A, 'https://evil.example/x.ogg', 7, null, URL_B])), [URL_A, URL_B]);
  for (const bad of [null, '', 'not json', '{}', '"x"', '42', 'null']) assert.deepEqual(parseCachedPlaylist(bad), [], String(bad));
});

test('indexOfTrack: finds a track by URL however the browser spells it, -1 when absent or empty', () => {
  const list = [URL_A, URL_B, URL_C];
  assert.equal(indexOfTrack(list, URL_B), 1);
  assert.equal(indexOfTrack(list, URL_B.replace('https://', 'HTTPS://')), 1);
  assert.equal(indexOfTrack(list, MUZ_PUBLIC_BASE + 'nope.ogg'), -1);
  assert.equal(indexOfTrack(list, ''), -1);
  assert.equal(indexOfTrack([], URL_A), -1);
});

test('pickRandomIndex: never the same track twice in a row, always inside the playlist', () => {
  for (let previous = 0; previous < 4; previous++) {
    for (const r of [0, 0.01, 0.25, 0.5, 0.74, 0.99, 0.999999]) {
      const i = pickRandomIndex(4, previous, () => r);
      assert.ok(i >= 0 && i < 4 && i !== previous, `previous=${previous} r=${r} -> ${i}`);
    }
  }
  for (let n = 0; n < 500; n++) {
    const i = pickRandomIndex(3, n % 3); // the real Math.random
    assert.ok(i >= 0 && i < 3 && i !== n % 3, `n=${n} -> ${i}`);
  }
});

test('pickRandomIndex: a one-track or empty playlist can only give index 0', () => {
  assert.equal(pickRandomIndex(1, 0), 0);
  assert.equal(pickRandomIndex(1, -1), 0);
  assert.equal(pickRandomIndex(0, -1), 0);
});

test('pickRandomIndex: the whole playlist is reachable, and a broken random source still ends on a valid different track', () => {
  const seen = new Set();
  for (const r of [0, 0.3, 0.6, 0.99]) seen.add(pickRandomIndex(4, -1, () => r));
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3]);
  for (const bad of [NaN, -1, 2, Infinity, undefined]) {
    const i = pickRandomIndex(3, 1, () => bad);
    assert.ok(i >= 0 && i < 3 && i !== 1, String(bad));
  }
});

test('parseSavedTrackIndex: a saved index counts only while it points into the playlist', () => {
  assert.equal(parseSavedTrackIndex('0', 3), 0);
  assert.equal(parseSavedTrackIndex('2', 3), 2);
  assert.equal(parseSavedTrackIndex('1.9', 3), 1);
  for (const bad of ['3', '-1', null, '', 'abc']) assert.equal(parseSavedTrackIndex(bad, 3), -1, String(bad));
  assert.equal(parseSavedTrackIndex('1', 0), -1);
});

test('parseVolume: [0, 1] is kept, everything else becomes the quiet default 0.25', () => {
  assert.equal(parseVolume('0.6'), 0.6);
  assert.equal(parseVolume('0'), 0);
  assert.equal(parseVolume('1'), 1);
  for (const bad of [null, '', '2', '-0.1', 'loud']) assert.equal(parseVolume(bad), 0.25, String(bad));
  assert.equal(parseVolume('x', 0.4), 0.4);
});

// ================================================================================================================
// the radio core
// ================================================================================================================

class FakeAudio extends EventTarget {
  constructor(options = {}) {
    super();
    this._src = '';
    this._time = 0;
    this.paused = true;
    this.ended = false;
    this.duration = 200;
    this.readyState = 4;
    this.loop = true;
    this.volume = 1;
    this.preload = '';
    this.plays = 0; // play() calls
    this.srcs = []; // every src assignment, in order
    this.blocked = false; // the autoplay policy: play() is rejected until something unlocks the element
    this.noPromise = false; // an old browser: play() returns undefined
    this.failing = new Set(); // sources that cannot be loaded
    this.seekThrows = false;
    Object.assign(this, options);
  }

  get src() { return this._src; }
  set src(value) {
    this._src = new URL(value).href; // a real element reads its src back as an absolute URL
    this.srcs.push(this._src);
    this.ended = false;
    this._time = 0;
    this.paused = true; // the load algorithm: a new source stops the element, play() has to be called again
  }

  get currentTime() { return this._time; }
  set currentTime(value) {
    if (this.seekThrows && value !== 0) throw new Error('not seekable yet');
    this._time = value;
  }

  fire(type) { Promise.resolve().then(() => this.dispatchEvent(new Event(type))); }

  play() {
    this.plays++;
    if (this.srcs.length > 100) throw new Error('runaway: more than 100 loads'); // an endless skip loop fails the test instead of hanging it
    if (this.blocked) return Promise.reject(Object.assign(new Error('play() failed because the user did not interact with the document first'), { name: 'NotAllowedError' }));
    if (this.paused) { this.paused = false; this.fire('play'); }
    this.fire(this.failing.has(this._src) ? 'error' : 'playing'); // a broken file never reaches `playing`; paused stays false
    return this.noPromise ? undefined : Promise.resolve();
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    this.fire('pause');
  }

  /** The track plays to its end: the element pauses itself, then `pause` and `ended` fire. */
  finish() {
    this.paused = true;
    this.ended = true;
    this._time = this.duration;
    this.fire('pause');
    this.fire('ended');
  }
}

const store = (initial = {}) => {
  const map = new Map(Object.entries(initial));
  return { map, getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => { map.set(key, String(value)); } };
};
const settle = () => new Promise(resolve => setImmediate(resolve)); // lets every queued event and promise run
const seq = (...values) => { let i = 0; return () => values[i++ % values.length]; };
/** A random source that draws the given indexes from a THREE-track playlist, over and over. */
const picks = (...indexes) => seq(...indexes.map(i => (i + 0.5) / 3));
const BUTTON = { id: 'radio' };

/** What the radio remembers from an earlier page: the playlist of LISTING and the index of the track that was playing. */
const remembered = (index, extra = {}) => ({ radioTracks: JSON.stringify([URL_A, URL_B, URL_C]), radioTrackIndex: String(index), ...extra });

function setup({ local = {}, session = {}, listing = LISTING, offline = false, held = false, audio = {}, rand = picks(1, 2, 0), isToggle, localStore, sessionStore } = {}) {
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const win = new EventTarget();
  const el = new FakeAudio(audio);
  const localStorage = localStore || store(local);
  const sessionStorage = sessionStore || store(session);
  const warnings = [];
  const states = [];
  const requests = { listing: 0 };
  let open = null;
  const gate = held ? new Promise(resolve => { open = resolve; }) : Promise.resolve();
  mock.timers.enable({ apis: ['setInterval'] });
  const radio = createRadio({
    audio: el, local: localStorage, session: sessionStorage, doc, win, rand, isToggle,
    warn: message => warnings.push(message),
    listing: async () => { requests.listing++; await gate; if (offline) throw new Error('offline'); return listing; },
  });
  radio.subscribe(on => states.push(on));
  return {
    radio, audio: el, local: localStorage, session: sessionStorage, doc, win, warnings, states, requests,
    release: () => { if (open) open(); },
    unlock: () => { el.blocked = false; },
    /** A user gesture reaching the document (it does NOT unlock the element: call unlock() first for that). */
    gesture: async (type = 'click', target = null) => {
      const event = new Event(type);
      if (target) Object.defineProperty(event, 'target', { value: target });
      doc.dispatchEvent(event);
      await settle();
    },
    visibility: async state => { doc.visibilityState = state; doc.dispatchEvent(new Event('visibilitychange')); await settle(); },
    dispose: () => { radio.dispose(); mock.timers.reset(); },
  };
}

function scenario(name, options, body) {
  test(name, async () => {
    const c = setup(options);
    try { await body(c); } finally { c.dispose(); }
  });
}

// ---- start ---------------------------------------------------------------------------------------------------------

scenario('first visit: silent until the listing answers, then a random track from it is chosen, remembered and started',
  { held: true, audio: { blocked: true }, rand: picks(1) }, async c => {
    await settle();
    assert.deepEqual(c.audio.srcs, [], 'no playlist, no track');
    assert.equal(c.audio.plays, 0);
    assert.equal(c.audio.loop, false, 'the track must be able to end');
    assert.equal(c.audio.volume, 0.25);
    assert.equal(c.audio.preload, 'auto');
    c.release();
    await settle();
    assert.deepEqual(c.audio.srcs, [URL_B]);
    assert.equal(c.audio.plays, 1, 'tried at once; the browser refuses until the first touch');
    assert.equal(c.radio.isPlaying(), false);
    assert.deepEqual(JSON.parse(c.local.getItem('radioTracks')), [URL_A, URL_B, URL_C]);
    assert.equal(c.local.getItem('radioTrackIndex'), '1');
    assert.equal(c.radio.trackIndex(), 1);
    assert.equal(c.requests.listing, 1, 'one listing request per document');
  });

scenario('next page load: the remembered playlist gives the saved track at once, before the listing answers, and it starts',
  { held: true, local: remembered(2) }, async c => {
    assert.deepEqual(c.audio.srcs, [URL_C]);
    assert.equal(c.audio.plays, 1);
    assert.equal(c.radio.isPlaying(), true);
    assert.equal(c.radio.trackIndex(), 2);
    c.release();
    await settle();
    assert.deepEqual(c.audio.srcs, [URL_C], 'an unchanged listing never touches the track');
    assert.equal(c.audio.plays, 1);
    assert.equal(c.requests.listing, 1);
  });

scenario('a fresh page load on a phone: the saved track and position come back and the first touch starts them from the same second',
  { local: remembered(2, { radioTime: '95.5' }), audio: { blocked: true } }, async c => {
    await settle();
    assert.deepEqual(c.audio.srcs, [URL_C]);
    assert.equal(c.audio.currentTime, 95.5);
    assert.equal(c.radio.isPlaying(), false);
    c.unlock();
    await c.gesture('touchstart');
    assert.equal(c.radio.isPlaying(), true);
    assert.equal(c.audio.currentTime, 95.5);
    assert.deepEqual(c.audio.srcs, [URL_C], 'the same track, no new random pick');
  });

scenario('the saved position is applied once the metadata is there', { local: remembered(0, { radioTime: '42.5' }), audio: { readyState: 0 } }, async c => {
  assert.equal(c.audio.currentTime, 0);
  c.audio.readyState = 1;
  c.audio.dispatchEvent(new Event('loadedmetadata'));
  assert.equal(c.audio.currentTime, 42.5);
});

scenario('...but not for a track that was replaced before the metadata arrived', { local: remembered(0, { radioTime: '42.5' }), audio: { readyState: 0 } }, async c => {
  await settle();
  c.audio.src = URL_B;
  c.audio.dispatchEvent(new Event('loadedmetadata'));
  assert.equal(c.audio.currentTime, 0);
});

test('a saved position that is invalid, past the end of the track or not seekable is ignored', async () => {
  for (const raw of ['abc', '-5', '0', '500', 'Infinity', '']) {
    const c = setup({ local: remembered(0, { radioTime: raw }) });
    try {
      await settle();
      assert.equal(c.audio.currentTime, 0, `radioTime=${JSON.stringify(raw)}`);
      assert.equal(c.audio.srcs.length, 1);
    } finally { c.dispose(); }
  }
  const c = setup({ local: remembered(0, { radioTime: '30' }), audio: { seekThrows: true } });
  try {
    await settle();
    assert.equal(c.audio.currentTime, 0);
    assert.equal(c.audio.srcs.length, 1);
    assert.equal(c.radio.isPlaying(), true);
  } finally { c.dispose(); }
});

scenario('volume: restored from storage', { local: remembered(0, { radioVolume: '0.6' }) }, async c => {
  assert.equal(c.audio.volume, 0.6);
});

scenario('volume: an invalid saved value becomes the quiet default', { local: remembered(0, { radioVolume: '7' }) }, async c => {
  assert.equal(c.audio.volume, 0.25);
});

scenario('a muted session stays silent: the track is prepared but nothing plays, not on a gesture, not on visibility',
  { session: { radioPlaying: 'false' }, local: remembered(0) }, async c => {
    await settle();
    assert.equal(c.audio.preload, 'metadata', 'no whole tracks downloaded while muted');
    assert.deepEqual(c.audio.srcs, [URL_A]);
    assert.equal(c.audio.plays, 0);
    for (const type of ['click', 'keydown', 'touchstart', 'touchend']) await c.gesture(type);
    await c.visibility('hidden');
    await c.visibility('visible');
    assert.equal(c.audio.plays, 0);
    assert.equal(c.radio.isPlaying(), false);
  });

// ---- the autoplay policy and gestures ------------------------------------------------------------------------------

scenario('a refused autoplay is retried on EVERY gesture until it works, then gestures leave the audio alone',
  { local: remembered(0), audio: { blocked: true } }, async c => {
    await settle();
    assert.equal(c.audio.plays, 1, 'the attempt at load');
    assert.equal(c.radio.isPlaying(), false);
    const types = ['click', 'keydown', 'touchstart', 'touchend'];
    for (const [i, type] of types.entries()) {
      await c.gesture(type);
      assert.equal(c.audio.plays, 2 + i, `${type} retried the play`);
    }
    assert.deepEqual(c.states, [], 'nothing was heard, so nobody was told it plays');
    c.unlock();
    await c.gesture('click');
    assert.equal(c.audio.plays, 6);
    assert.equal(c.radio.isPlaying(), true);
    assert.deepEqual(c.states, [true]);
    await c.gesture('click');
    await c.gesture('touchend');
    assert.equal(c.audio.plays, 6, 'playing: gestures do nothing');
  });

scenario('a gesture on the radio button itself is ignored by the gesture handler: the button decides',
  { local: remembered(0), audio: { blocked: true }, isToggle: target => target === BUTTON }, async c => {
    await settle();
    const before = c.audio.plays;
    c.unlock();
    await c.gesture('click', BUTTON);
    assert.equal(c.audio.plays, before);
    assert.equal(c.radio.isPlaying(), false);
    await c.gesture('click');
    assert.equal(c.audio.plays, before + 1);
    assert.equal(c.radio.isPlaying(), true);
  });

scenario('after the first touch the music carries on through several track changes without another touch',
  { local: remembered(0), audio: { blocked: true }, rand: picks(1, 2, 0) }, async c => {
    await settle();
    assert.equal(c.radio.isPlaying(), false, 'blocked until a touch');
    c.unlock();
    await c.gesture('touchend');
    assert.equal(c.radio.isPlaying(), true);
    for (let i = 0; i < 3; i++) {
      c.audio.finish();
      await settle();
      assert.equal(c.radio.isPlaying(), true, `track ${i + 2} plays`);
    }
    assert.equal(c.audio.srcs.length, 4);
    assert.equal(c.states.includes(false), false, 'the button never flickered to muted');
  });

// ---- the end of a track ---------------------------------------------------------------------------------------------

scenario('a track that ends is followed by another random track on the same element, without any gesture',
  { local: remembered(0), rand: picks(0, 2) }, async c => {
    await settle();
    assert.deepEqual(c.audio.srcs, [URL_A]);
    c.audio.finish();
    await settle();
    // the first draw is the track that just ended (index 0): it is drawn again until it differs
    assert.deepEqual(c.audio.srcs, [URL_A, URL_C]);
    assert.equal(c.audio.plays, 2);
    assert.equal(c.radio.isPlaying(), true);
    assert.equal(c.local.getItem('radioTrackIndex'), '2');
    assert.equal(c.local.getItem('radioTime'), '0');
    assert.equal(c.radio.trackIndex(), 2);
  });

scenario('between two tracks the button never flickers to "muted"', { local: remembered(1) }, async c => {
  await settle();
  c.audio.finish();
  await settle();
  assert.equal(c.states.includes(false), false);
  assert.equal(c.states.at(-1), true);
  assert.equal(c.radio.isPlaying(), true);
});

scenario('a muted radio does not start the next track when a track ends', { local: remembered(0) }, async c => {
  await settle();
  c.radio.toggle();
  await settle();
  c.audio.dispatchEvent(new Event('ended'));
  await settle();
  assert.deepEqual(c.audio.srcs, [URL_A]);
  assert.equal(c.audio.plays, 1);
  assert.equal(c.radio.isPlaying(), false);
});

scenario('a one-track playlist plays that track again when it ends',
  { local: { radioTracks: JSON.stringify([URL_A]), radioTrackIndex: '0' }, listing: [{ name: NAME_A }] }, async c => {
    await settle();
    c.audio.finish();
    await settle();
    assert.deepEqual(c.audio.srcs, [URL_A, URL_A]);
    assert.equal(c.audio.plays, 2);
    assert.equal(c.radio.isPlaying(), true);
  });

scenario('an old browser whose play() returns nothing works the same', { local: remembered(0), audio: { noPromise: true } }, async c => {
  await settle();
  assert.equal(c.radio.isPlaying(), true);
  c.audio.finish();
  await settle();
  assert.equal(c.audio.plays, 2);
  assert.equal(c.radio.isPlaying(), true);
});

// ---- broken tracks ---------------------------------------------------------------------------------------------------

scenario('a broken track is skipped and the music goes on; a track that plays resets the count',
  { local: remembered(0), audio: { failing: new Set([URL_A]) }, rand: picks(1, 2, 0) }, async c => {
    await settle();
    assert.deepEqual(c.audio.srcs, [URL_A, URL_B], 'A failed, B was drawn');
    assert.equal(c.radio.isPlaying(), true);
    c.audio.failing.add(URL_B); // B breaks in the middle: counting starts from zero again
    c.audio.dispatchEvent(new Event('error'));
    await settle();
    assert.deepEqual(c.audio.srcs, [URL_A, URL_B, URL_C]);
    assert.equal(c.radio.isPlaying(), true);
  });

scenario('a bucket full of broken files is skipped three times at most, never in an endless loop',
  { local: remembered(0), audio: { failing: new Set([URL_A, URL_B, URL_C]) }, rand: picks(1, 2, 0, 1) }, async c => {
    await settle();
    assert.deepEqual(c.audio.srcs, [URL_A, URL_B, URL_C, URL_A], 'the first load plus three skips');
    await settle();
    await settle();
    assert.equal(c.audio.srcs.length, 4, 'and then it stops');
  });

scenario('a muted radio does not skip a broken track', { session: { radioPlaying: 'false' }, local: remembered(0) }, async c => {
  await settle();
  c.audio.dispatchEvent(new Event('error'));
  await settle();
  assert.deepEqual(c.audio.srcs, [URL_A]);
});

scenario('a one-track playlist has nothing to skip to',
  { local: { radioTracks: JSON.stringify([URL_A]), radioTrackIndex: '0' }, listing: [{ name: NAME_A }], audio: { failing: new Set([URL_A]) } }, async c => {
    await settle();
    await settle();
    assert.deepEqual(c.audio.srcs, [URL_A]);
  });

// ---- saving, visibility, the button ---------------------------------------------------------------------------------

scenario('progress is saved every second and on pagehide / beforeunload, but only while playing', { local: remembered(2) }, async c => {
  await settle();
  c.audio.currentTime = 61;
  mock.timers.tick(999);
  assert.equal(c.local.getItem('radioTime'), null);
  mock.timers.tick(1);
  assert.equal(c.local.getItem('radioTime'), '61');
  assert.equal(c.local.getItem('radioTrackIndex'), '2');
  c.audio.currentTime = 70;
  c.win.dispatchEvent(new Event('pagehide'));
  assert.equal(c.local.getItem('radioTime'), '70');
  c.audio.currentTime = 80;
  c.win.dispatchEvent(new Event('beforeunload'));
  assert.equal(c.local.getItem('radioTime'), '80');
  c.audio.pause();
  await settle();
  assert.equal(c.local.getItem('radioTime'), '80');
  c.audio.currentTime = 99;
  mock.timers.tick(5000);
  c.win.dispatchEvent(new Event('pagehide'));
  assert.equal(c.local.getItem('radioTime'), '80', 'a paused radio saves nothing');
});

scenario('a tab that comes back to the foreground resumes the music the browser paused', { local: remembered(0) }, async c => {
  await settle();
  c.audio.pause(); // the browser paused the background tab: the user did not mute
  await settle();
  assert.equal(c.radio.isPlaying(), false);
  await c.visibility('hidden');
  assert.equal(c.audio.plays, 1);
  await c.visibility('visible');
  assert.equal(c.audio.plays, 2);
  assert.equal(c.radio.isPlaying(), true);
});

scenario('...but a radio the user muted stays muted when the tab comes back', { local: remembered(0) }, async c => {
  await settle();
  c.radio.toggle();
  await settle();
  await c.visibility('visible');
  assert.equal(c.audio.plays, 1);
  assert.equal(c.radio.isPlaying(), false);
});

scenario('the radio button pauses and remembers the mute for the session; gestures do not wake it; the next press plays again',
  { local: remembered(1, { radioTime: '10' }) }, async c => {
    await settle();
    assert.equal(c.radio.isPlaying(), true);
    c.audio.currentTime = 33;
    c.radio.toggle();
    assert.equal(c.audio.paused, true);
    assert.equal(c.session.getItem('radioPlaying'), 'false');
    assert.equal(c.local.getItem('radioTime'), '33');
    assert.equal(c.states.at(-1), false);
    for (const type of ['click', 'touchend', 'keydown']) await c.gesture(type);
    assert.equal(c.audio.paused, true);
    assert.equal(c.audio.plays, 1);
    c.radio.toggle();
    await settle();
    assert.equal(c.session.getItem('radioPlaying'), 'true');
    assert.equal(c.radio.isPlaying(), true);
    assert.equal(c.states.at(-1), true);
  });

scenario('pressing the button while the browser still refuses audio keeps the wish: the next gesture plays',
  { local: remembered(0), audio: { blocked: true }, session: { radioPlaying: 'false' } }, async c => {
    await settle();
    assert.equal(c.audio.plays, 0);
    c.radio.toggle();
    await settle();
    assert.equal(c.session.getItem('radioPlaying'), 'true');
    assert.equal(c.radio.isPlaying(), false);
    assert.equal(c.audio.plays, 1);
    c.unlock();
    await c.gesture('touchend');
    assert.equal(c.radio.isPlaying(), true);
  });

scenario('subscribers hear the changes until they unsubscribe; a broken subscriber does not silence the others', { local: remembered(0) }, async c => {
  await settle();
  const seen = [];
  c.radio.subscribe(() => { throw new Error('boom'); });
  const off = c.radio.subscribe(on => seen.push(on));
  c.radio.toggle();
  await settle();
  assert.ok(seen.length >= 1 && seen.every(on => on === false), JSON.stringify(seen));
  const heard = seen.length;
  off();
  c.radio.toggle();
  await settle();
  assert.equal(seen.length, heard);
  assert.equal(c.radio.isPlaying(), true);
});

// ---- the playlist changes ---------------------------------------------------------------------------------------------

scenario('a file added to the bucket: the playing track stays and the saved index follows the new order', {
  local: { radioTracks: JSON.stringify([URL_A, URL_B]), radioTrackIndex: '1' },
  listing: [{ name: '.emptyFolderPlaceholder' }, { name: 'AAA new.ogg' }, { name: NAME_A }, { name: NAME_B }],
}, async c => {
  await settle();
  assert.deepEqual(c.audio.srcs, [URL_B]);
  assert.equal(c.audio.plays, 1);
  assert.equal(c.radio.trackIndex(), 2);
  assert.equal(c.local.getItem('radioTrackIndex'), '2');
  assert.equal(JSON.parse(c.local.getItem('radioTracks')).length, 3);
});

scenario('the current track was deleted from the bucket: another one from the new listing replaces it and keeps playing', {
  held: true,
  local: { radioTracks: JSON.stringify([OLD_1, OLD_2]), radioTrackIndex: '0', radioTime: '50' },
  rand: picks(1),
}, async c => {
  assert.deepEqual(c.audio.srcs, [OLD_1], 'the remembered list gives the track at once');
  assert.equal(c.audio.plays, 1);
  c.release();
  await settle();
  assert.deepEqual(c.audio.srcs, [OLD_1, URL_B]);
  assert.equal(c.audio.plays, 2);
  assert.equal(c.radio.isPlaying(), true);
  assert.equal(c.local.getItem('radioTime'), '0');
  assert.equal(c.local.getItem('radioTrackIndex'), '1');
  assert.deepEqual(JSON.parse(c.local.getItem('radioTracks')), [URL_A, URL_B, URL_C]);
});

scenario('...and when the radio was not playing, the replacement does not start', {
  held: true,
  session: { radioPlaying: 'false' },
  local: { radioTracks: JSON.stringify([OLD_1, OLD_2]), radioTrackIndex: '0' },
  rand: picks(2),
}, async c => {
  c.release();
  await settle();
  assert.deepEqual(c.audio.srcs, [OLD_1, URL_C]);
  assert.equal(c.audio.plays, 0);
  assert.equal(c.radio.isPlaying(), false);
});

scenario('listing unreachable: the remembered playlist keeps the radio working', { offline: true, local: remembered(1) }, async c => {
  await settle();
  assert.deepEqual(c.audio.srcs, [URL_B]);
  assert.equal(c.radio.isPlaying(), true);
  assert.equal(c.warnings.length, 0, 'being offline is not worth a console warning');
  c.audio.finish();
  await settle();
  assert.equal(c.audio.srcs.length, 2);
  assert.equal(c.radio.isPlaying(), true);
});

scenario('listing unreachable and nothing remembered: no track, no crash, nothing plays', { offline: true }, async c => {
  await settle();
  assert.deepEqual(c.audio.srcs, []);
  assert.equal(c.audio.plays, 0);
  assert.equal(c.radio.isPlaying(), false);
  assert.equal(c.radio.trackIndex(), 0);
  await c.gesture('click');
  c.radio.toggle();
  await settle();
  assert.equal(c.audio.plays, 0);
});

scenario('an empty listing (the policy is missing) is reported in the console and plays nothing; stray events cannot hang it',
  { listing: [{ name: '.emptyFolderPlaceholder' }] }, async c => {
    await settle();
    assert.equal(c.warnings.length, 1);
    assert.match(c.warnings[0], /muz_public_read/);
    assert.deepEqual(c.audio.srcs, []);
    c.audio.dispatchEvent(new Event('ended'));
    c.audio.dispatchEvent(new Event('error'));
    await settle();
    assert.deepEqual(c.audio.srcs, []);
    assert.equal(c.radio.isPlaying(), false);
  });

// ---- robustness -------------------------------------------------------------------------------------------------------

test('storage that throws (private mode) never breaks the radio', async () => {
  const denied = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const c = setup({ localStore: denied, sessionStore: denied, rand: picks(2) });
  try {
    await settle();
    assert.deepEqual(c.audio.srcs, [URL_C]);
    assert.equal(c.radio.isPlaying(), true);
    c.audio.finish();
    await settle();
    assert.equal(c.audio.srcs.length, 2);
    assert.equal(c.radio.isPlaying(), true);
    c.radio.toggle();
    assert.equal(c.audio.paused, true);
    c.radio.toggle();
    await settle();
    assert.equal(c.radio.isPlaying(), true);
  } finally { c.dispose(); }
});

scenario('dispose: nothing reacts any more', { local: remembered(0) }, async c => {
  await settle();
  c.radio.dispose();
  const plays = c.audio.plays;
  const time = c.local.getItem('radioTime');
  c.audio.finish();
  c.audio.dispatchEvent(new Event('error'));
  await c.gesture('click');
  await c.visibility('visible');
  c.audio.currentTime = 12;
  mock.timers.tick(5000);
  c.win.dispatchEvent(new Event('pagehide'));
  await settle();
  assert.equal(c.audio.plays, plays);
  assert.equal(c.audio.srcs.length, 1);
  assert.equal(c.local.getItem('radioTime'), time);
  assert.deepEqual(c.states, [true], 'only what happened before dispose');
});

test('the radio uses the one element it was given for its whole life', () => {
  const c = setup({ local: remembered(0) });
  try { assert.equal(c.radio.audio, c.audio); } finally { c.dispose(); }
});
