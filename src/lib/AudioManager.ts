// The shared <audio> element of Leonida FM and its playlist (the radio rules themselves live in radio.ts).
//
// The playlist is the listing of the public `muz` bucket. That listing needs the `muz_public_read` policy on
// storage.objects (supabase/16_muz_public_read.sql): direct file URLs of a public bucket work without it, but the
// list endpoint then answers [] for anon and there is nothing to play.
// The last good playlist is remembered in localStorage: on the next page load the saved track is set synchronously
// (no listing round-trip before the radio can resume on every navigation) and the listing only confirms or corrects it.
const MUZ_PUBLIC_BASE = 'https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/muz/';
const AUDIO_FILE = /\.(ogg|mp3|wav|flac)$/i;

/** Track URLs from the muz bucket listing: audio files only (not the folder placeholder), names URL-encoded, listing order kept. */
export function playlistFromListing(files: unknown): string[] {
  if (!Array.isArray(files)) return [];
  return files
    .filter((f): f is { name: string } => !!f && typeof f.name === 'string' && AUDIO_FILE.test(f.name))
    .map(f => MUZ_PUBLIC_BASE + encodeURIComponent(f.name));
}

/** The playlist remembered from the last good listing: only muz track URLs survive, anything unparsable becomes an empty list. */
export function parseCachedPlaylist(raw: string | null): string[] {
  try {
    const list = JSON.parse(raw || '[]');
    return Array.isArray(list) ? list.filter((u): u is string => typeof u === 'string' && u.startsWith(MUZ_PUBLIC_BASE)) : [];
  } catch {
    return [];
  }
}

const normalize = (url: string) => {
  try { return new URL(url).href; } catch { return url; }
};

/** Position of a track URL in the playlist (the <audio> element reports its src as an absolute URL), or -1. */
export function indexOfTrack(playlist: string[], url: string): number {
  const target = normalize(url);
  return playlist.findIndex(u => normalize(u) === target);
}

const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwZ2xrZ2xoamRxbmt0eWJrc3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMTYzMjUsImV4cCI6MjA5MTU5MjMyNX0.fMZo0fjEfPSf20w-rRQh25zPj7xPVOpU6lO2lon3EEk';
const LIST_URL = 'https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/list/muz';
const CACHE_KEY = 'radioTracks';

let globalAudio: HTMLAudioElement | null = null;
let allTracks: string[] = [];
let tracksReady = false;
let lastIdx = -1;

/** localStorage can throw (private mode, quota): the radio then just works without remembering. */
function remember(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* nothing to do */ }
}

async function fetchTracks(): Promise<string[]> {
  if (tracksReady) return allTracks;
  try {
    const res = await fetch(LIST_URL, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: 'Bearer ' + ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: '', limit: 100, offset: 0 }),
    });
    if (res.ok) {
      const urls = playlistFromListing(await res.json());
      if (urls.length > 0) {
        allTracks = urls;
        tracksReady = true;
        remember(CACHE_KEY, JSON.stringify(urls));
      } else {
        console.warn('[Audio] The muz listing is empty: check the files in the bucket and the muz_public_read policy');
      }
    }
  } catch { /* offline: keep the remembered playlist */ }
  return allTracks;
}

function nextRandom(): number {
  if (allTracks.length <= 1) return 0;
  let idx = lastIdx;
  while (idx === lastIdx) idx = Math.floor(Math.random() * allTracks.length);
  lastIdx = idx;
  return idx;
}

function playNext() {
  if (!globalAudio) return;
  fetchTracks().then(tracks => {
    if (!tracks.length || !globalAudio) return;
    const idx = nextRandom();
    globalAudio.src = tracks[idx];
    remember('radioTrackIndex', String(idx));
    globalAudio.play().catch(() => {});
  });
}

/** Point the shared <audio> at the saved track (or a random one); the radio hook starts playing it. */
function loadStartTrack(audio: HTMLAudioElement, tracks: string[]) {
  const saved = parseInt(localStorage.getItem('radioTrackIndex') || '-1');
  const startIdx = (saved >= 0 && saved < tracks.length) ? saved : nextRandom();
  lastIdx = startIdx;
  audio.src = tracks[startIdx];
}

/** The listing answered after the track was set from the remembered playlist: keep it if it still exists, otherwise switch. */
function reconcile(audio: HTMLAudioElement, tracks: string[]) {
  const now = indexOfTrack(tracks, audio.src);
  if (now >= 0) { lastIdx = now; return; }
  const wasPlaying = !audio.paused;
  lastIdx = -1;
  const idx = nextRandom();
  audio.src = tracks[idx];
  remember('radioTrackIndex', String(idx));
  if (wasPlaying) audio.play().catch(() => {});
}

export function getOrCreateAudio(): HTMLAudioElement {
  if (globalAudio) return globalAudio;
  const audio = new Audio();
  globalAudio = audio;
  audio.preload = 'none'; // do not download a track until playback is actually requested
  audio.loop = false;
  audio.volume = parseFloat(localStorage.getItem('radioVolume') || '0.25');
  audio.addEventListener('ended', playNext);

  const cached = parseCachedPlaylist(localStorage.getItem(CACHE_KEY));
  if (cached.length > 0) {
    allTracks = cached;
    loadStartTrack(audio, cached);
  }

  fetchTracks().then(tracks => {
    if (tracks.length === 0) return;
    if (cached.length > 0) return reconcile(audio, tracks);
    // First visit ever (nothing remembered yet): the track can only be set now.
    loadStartTrack(audio, tracks);
    const sp = sessionStorage.getItem('radioPlaying');
    if (sp === null || sp === 'true') audio.play().catch(() => {});
  });
  return audio;
}

export function getTrackIndex(): number { return lastIdx >= 0 ? lastIdx : 0; }
