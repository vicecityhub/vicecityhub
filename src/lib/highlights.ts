// Pure logic of the Highlights board (no React, no Supabase), so it can be unit-tested in plain Node.
// Docs: docs/HIGHLIGHTS.md

export const BUCKET = 'highlights';
export const MAX_BYTES = 50 * 1024 * 1024;
export const PAGE = 12;
export const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
export const GAMES = ['GTA V', 'GTA Online', 'Red Dead Redemption 2', 'GTA VI', 'Other'];
export const PLATFORMS: [string, string][] = [['ps5', 'PS5'], ['ps4', 'PS4'], ['xbox', 'Xbox'], ['pc', 'PC'], ['other', 'Other']];

export type HlKind = 'all' | 'image' | 'video';
export type HlSort = 'new' | 'top';
export type HlMessage = { ok: boolean; text: string };
export type HlUser = { id: string };

export interface HL {
  id: number; author_id: string; author_name: string; kind: 'image' | 'video'; media_path: string; poster_path: string | null;
  title: string; game: string; platform: string; likes: number; created_at: string;
}

export const KIND_OPTIONS = [['all', 'All'], ['image', 'Screenshots'], ['video', 'Clips']] as const;
export const SORT_OPTIONS = [['new', 'Newest'], ['top', 'Top']] as const;

// ---------- environment ----------

export const isConsole = () => typeof navigator !== 'undefined' && /PlayStation|Nintendo|Xbox/i.test(navigator.userAgent || '');

// ---------- files ----------

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
};

/** Consoles often hand over files with an empty `type`; fall back to the extension. */
export const mimeOf = (f: { type: string; name: string }): string => {
  if (f.type) return f.type;
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  return MIME_BY_EXT[ext] || '';
};

/** Why a picked file cannot be uploaded, or null when it is fine. */
export function checkPickedFile(f: { type: string; name: string; size: number }): string | null {
  const t = mimeOf(f);
  if (OK_TYPES.indexOf(t) < 0) return `That file type (${t || 'unknown'}) is not supported. Use JPG, PNG, WebP, MP4, WebM or MOV.`;
  if (f.size > MAX_BYTES) return `That file is ${(f.size / 1048576).toFixed(0)} MB. The limit is 50 MB: trim the clip in the PS5 Media Gallery first.`;
  return null;
}

/** Suggested title for a freshly picked file: its name without extension, separators as spaces. */
export const titleFromFileName = (name: string): string => name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 60);

/** Why a title is rejected, or null when it is fine. Expects an already trimmed title. */
export const titleError = (t: string): string | null =>
  t.length < 3 ? 'Give it a title (at least 3 characters). "untitled" is not a personality.' : null;

/** Storage keys to clean up: the media file plus the poster when there is one. */
export const storagePaths = (mediaPath: string, posterPath: string | null): string[] => [mediaPath, ...(posterPath ? [posterPath] : [])];

// ---------- upload errors ----------

const parseJsonOrNull = (text: string): any => {
  try { return JSON.parse(text); } catch (_e) { return null; }
};

export const isHttpOk = (status: number) => status >= 200 && status < 300;

/** Message for a failed storage upload: the server's own `message` when the body is JSON, else a generic one. */
export function uploadFailureMessage(status: number, responseText: string): string {
  const body = parseJsonOrNull(responseText);
  return body && body.message ? String(body.message) : `upload failed (${status})`;
}

/** Message for a failed `highlights` insert (the daily limit is raised by a database trigger). */
export const insertFailureMessage = (dbMessage: string): string =>
  /daily_limit/.test(dbMessage) ? 'Daily limit reached: 10 uploads per 24 hours. Quality over quantity, champ.' : dbMessage;

// ---------- gallery ----------

export const platformLabel = (value: string): string => (PLATFORMS.find((p) => p[0] === value) || ['', value])[1];

export function ago(iso: string, now: number = Date.now()): string {
  const s = Math.max(1, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

/** Inclusive row range of one gallery page, as `.range(from, to)` wants it. */
export const pageRange = (page: number): [number, number] => [page * PAGE, page * PAGE + PAGE - 1];

/** A full page means there may be more. */
export const hasMorePages = (rows: unknown[]): boolean => rows.length === PAGE;

export const mergePage = (prev: HL[], rows: HL[], reset: boolean): HL[] => (reset ? rows : [...prev, ...rows]);

/** Copy of the set with `id` added, or removed when `has` says it was already there. */
export function toggledSet(set: Set<number>, id: number, has: boolean): Set<number> {
  const next = new Set(set);
  if (has) next.delete(id); else next.add(id);
  return next;
}

/** Optimistic like counter: +1 or -1 on the one item, never below zero. */
export const withLikeDelta = (items: HL[], id: number, wasLiked: boolean): HL[] =>
  items.map((x) => (x.id === id ? { ...x, likes: Math.max(0, x.likes + (wasLiked ? -1 : 1)) } : x));

export const withoutItem = (items: HL[], id: number): HL[] => items.filter((x) => x.id !== id);

/** A report counts as sent when it went through or the same user had already reported this one. */
export const isReportAccepted = (error: { message: string } | null): boolean => !error || /duplicate/i.test(error.message);

// ---------- phone-code login ----------

export type PollOutcome = 'approved' | 'expired' | 'error' | 'retry';

export const POLL_INTERVAL_MS = 3000;
export const DEFAULT_CODE_TTL_S = 600;

export const codeDeadline = (now: number, expiresIn?: number): number => now + (expiresIn || DEFAULT_CODE_TTL_S) * 1000;

/** HTTP status of /poll to what the console should do next (200 = approved, 410 = expired, anything else = ask again). */
export const pollStatusOutcome = (status: number): PollOutcome => (status === 200 ? 'approved' : status === 410 ? 'expired' : 'retry');

/** The code is 8 letters or digits, dash and case do not matter. */
export const isCodeComplete = (code: string): boolean => code.replace(/[^A-Za-z0-9]/g, '').length === 8;

/** "45s" for fresh requests, minutes once it is older than 90 seconds. */
export const requestAge = (seconds: number): string => (seconds < 90 ? `${seconds}s` : `${Math.round(seconds / 60)} min`);
