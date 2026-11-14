// Leonida FM playlist and the shared <audio>: URL building, the playlist remembered across page loads, a deleted
// track, an unreachable or empty listing. Every "page load" is a fresh copy of the module, like a real navigation.
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import { playlistFromListing, parseCachedPlaylist, indexOfTrack } from '../src/lib/AudioManager.ts';

const BASE = 'https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/muz/';
const NAME_A = 'GTA 6 Official Home Screen Music (10 Minute Extended Loop).ogg';
const NAME_B = 'Grand Theft Auto VI - Viva Leonida (XMB  Console Menu Screen Theme).ogg';
const URL_A = BASE + 'GTA%206%20Official%20Home%20Screen%20Music%20(10%20Minute%20Extended%20Loop).ogg';
const URL_B = BASE + 'Grand%20Theft%20Auto%20VI%20-%20Viva%20Leonida%20(XMB%20%20Console%20Menu%20Screen%20Theme).ogg';
const LISTING = [{ name: '.emptyFolderPlaceholder' }, { name: NAME_A }, { name: NAME_B }];

test('playlistFromListing: audio files only, names URL-encoded, listing order kept', () => {
  assert.deepEqual(playlistFromListing(LISTING), [URL_A, URL_B]);
  const mixed = [{ name: 'cover.jpg' }, { name: 'notes.txt' }, { name: 'a.m4a' }, { name: 'LOUD.MP3' }, { name: 'x.flac' }, { name: 'y.wav' }];
  assert.deepEqual(playlistFromListing(mixed), [BASE + 'LOUD.MP3', BASE + 'x.flac', BASE + 'y.wav']);
});

test('playlistFromListing: anything that is not a listing becomes an empty playlist', () => {
  for (const bad of [null, undefined, {}, 'x', 42, [null, 1, {}, { name: 5 }]]) assert.deepEqual(playlistFromListing(bad), []);
});

test('parseCachedPlaylist: keeps only track URLs of the muz bucket, garbage becomes an empty list', () => {
  assert.deepEqual(parseCachedPlaylist(JSON.stringify([URL_A, 'https://evil.example/x.ogg', 7, URL_B])), [URL_A, URL_B]);
  for (const bad of [null, '', 'not json', '{}', '"x"']) assert.deepEqual(parseCachedPlaylist(bad), []);
});

test('indexOfTrack: finds a track by URL, -1 when it is not in the playlist', () => {
  assert.equal(indexOfTrack([URL_A, URL_B], URL_B), 1);
  assert.equal(indexOfTrack([URL_A, URL_B], BASE + '1.ogg'), -1);
  assert.equal(indexOfTrack([URL_A, URL_B], ''), -1);
});

class FakeAudio extends EventTarget {
  constructor() {
    super();
    Object.assign(this, { paused: true, plays: 0, srcs: [], preload: '', loop: true, volume: 1 });
    this._src = '';
  }
  get src() { return this._src; }
  set src(v) { this._src = new URL(v).href; this.srcs.push(this._src); }
  play() { this.plays++; this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}

const flush = () => new Promise(r => setImmediate(r));
const store = (init = {}) => { const m = new Map(Object.entries(init)); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };
const remembered = (...urls) => ({ radioTracks: JSON.stringify(urls) });

let pageNo = 0;
/** One page load: fresh storage and a fresh module copy; the listing answers only after release(). */
async function page({ local = {}, session = {}, listing = LISTING, offline = false } = {}) {
  globalThis.localStorage = store(local);
  globalThis.sessionStorage = store(session);
  globalThis.Audio = FakeAudio;
  let release;
  const gate = new Promise(r => { release = r; });
  globalThis.fetch = async () => { await gate; if (offline) throw new Error('offline'); return { ok: true, json: async () => listing }; };
  const mod = await import(`../src/lib/AudioManager.ts?page=${++pageNo}`);
  return { mod, local: globalThis.localStorage, release, audio: mod.getOrCreateAudio() };
}

test('first visit: the listing becomes the playlist, a track is loaded from it and the playlist is remembered', async () => {
  const p = await page();
  assert.deepEqual(p.audio.srcs, [], 'nothing to play before the listing answers');
  p.release(); await flush();
  assert.ok([URL_A, URL_B].includes(p.audio.src));
  assert.deepEqual(JSON.parse(p.local.getItem('radioTracks')), [URL_A, URL_B]);
  assert.equal(p.mod.getTrackIndex(), [URL_A, URL_B].indexOf(p.audio.src));
  assert.equal(p.audio.plays, 1, 'tries to start (the browser may still block it)');
});

test('next page load: the saved track is set at once from the remembered playlist, before the listing answers', async () => {
  const p = await page({ local: { ...remembered(URL_A, URL_B), radioTrackIndex: '1' } });
  assert.deepEqual(p.audio.srcs, [URL_B], 'set synchronously, no listing round-trip');
  assert.equal(p.mod.getTrackIndex(), 1);
  p.release(); await flush();
  assert.deepEqual(p.audio.srcs, [URL_B], 'an unchanged listing does not touch the track');
  assert.equal(p.audio.plays, 0, 'starting playback is the radio hook job, not the manager one');
});

test('a file added to the bucket: the current track stays and the saved index follows the new order', async () => {
  const added = [{ name: 'AAA first.ogg' }, ...LISTING];
  const p = await page({ local: { ...remembered(URL_A, URL_B), radioTrackIndex: '1' }, listing: added });
  p.release(); await flush();
  assert.deepEqual(p.audio.srcs, [URL_B]);
  assert.equal(p.mod.getTrackIndex(), 2);
  assert.equal(JSON.parse(p.local.getItem('radioTracks')).length, 3);
});

test('a track deleted from the bucket is replaced once the listing answers, and keeps playing if it was playing', async () => {
  const p = await page({ local: { ...remembered(BASE + '1.ogg', BASE + '2.ogg'), radioTrackIndex: '0' } });
  assert.equal(p.audio.src, BASE + '1.ogg');
  p.audio.paused = false;
  p.release(); await flush();
  assert.ok([URL_A, URL_B].includes(p.audio.src));
  assert.equal(p.audio.plays, 1);
  assert.equal(p.mod.getTrackIndex(), [URL_A, URL_B].indexOf(p.audio.src));
  assert.deepEqual(JSON.parse(p.local.getItem('radioTracks')), [URL_A, URL_B]);
  assert.equal(p.local.getItem('radioTrackIndex'), String(p.mod.getTrackIndex()));
});

test('listing unreachable: the remembered playlist keeps working', async () => {
  const p = await page({ local: { ...remembered(URL_A, URL_B), radioTrackIndex: '0' }, offline: true });
  p.release(); await flush();
  assert.deepEqual(p.audio.srcs, [URL_A]);
});

test('listing unreachable and nothing remembered: no track and no crash', async () => {
  const p = await page({ offline: true });
  p.release(); await flush();
  assert.deepEqual(p.audio.srcs, []);
  assert.equal(p.mod.getTrackIndex(), 0);
});

test('empty listing: warns, plays nothing, and the end of a track cannot hang the page', async () => {
  const warn = mock.method(console, 'warn', () => {});
  const p = await page({ listing: [{ name: '.emptyFolderPlaceholder' }] });
  p.release(); await flush();
  assert.deepEqual(p.audio.srcs, []);
  assert.equal(warn.mock.callCount(), 1);
  p.audio.dispatchEvent(new Event('ended')); await flush();
  assert.deepEqual(p.audio.srcs, []);
  warn.mock.restore();
});

test('end of a track: the next one is another track of the playlist, remembered for the next page', async () => {
  const p = await page({ local: { ...remembered(URL_A, URL_B), radioTrackIndex: '0' } });
  p.release(); await flush();
  p.audio.dispatchEvent(new Event('ended')); await flush();
  assert.equal(p.audio.src, URL_B);
  assert.equal(p.local.getItem('radioTrackIndex'), '1');
  assert.equal(p.audio.plays, 1);
});
