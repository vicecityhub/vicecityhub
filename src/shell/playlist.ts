// Pure playlist rules of Leonida FM. No DOM, no storage: everything here is testable from Node.
//
// The playlist is the listing of the public `muz` bucket. That listing needs the `muz_public_read` policy on
// storage.objects (supabase/16_muz_public_read.sql): direct file URLs of a public bucket work without it, but the
// list endpoint then answers [] for anon and there is nothing to play.

export const MUZ_PUBLIC_BASE = 'https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/muz/';
export const MUZ_LIST_URL = 'https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/list/muz';
/** Public anon key (the same one every page of the site already ships); it only allows what the RLS policies allow. */
export const MUZ_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwZ2xrZ2xoamRxbmt0eWJrc3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMTYzMjUsImV4cCI6MjA5MTU5MjMyNX0.fMZo0fjEfPSf20w-rRQh25zPj7xPVOpU6lO2lon3EEk';

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
  if (!url) return -1;
  const target = normalize(url);
  return playlist.findIndex(u => normalize(u) === target);
}

/**
 * A random track index that differs from the previous one (a one-track playlist can only repeat). `rand` is Math.random-like.
 * Never loops forever: after a few unlucky draws it simply takes the next track.
 */
export function pickRandomIndex(length: number, previous: number, rand: () => number = Math.random): number {
  if (length <= 1) return 0;
  for (let attempt = 0; attempt < 8; attempt++) {
    const idx = Math.min(length - 1, Math.floor(rand() * length));
    if (Number.isInteger(idx) && idx >= 0 && idx !== previous) return idx;
  }
  return (previous + 1 + length) % length;
}

/** The saved track index when it still points into the playlist, otherwise -1. */
export function parseSavedTrackIndex(raw: string | null, length: number): number {
  const n = parseInt(raw || '-1', 10);
  return Number.isInteger(n) && n >= 0 && n < length ? n : -1;
}

/** Volume from localStorage clamped to [0, 1]; the default is a quiet background level. */
export function parseVolume(raw: string | null, fallback = 0.25): number {
  const v = parseFloat(raw || '');
  return isFinite(v) && v >= 0 && v <= 1 ? v : fallback;
}
