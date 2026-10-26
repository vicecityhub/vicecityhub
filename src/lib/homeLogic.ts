// Pure logic of the home page (no React, no Supabase). Extracted from pages/Home.tsx; behaviour is unchanged.

// ---------- release countdown

export interface TimeLeft { days: string; hours: string; minutes: string; seconds: string }

export const COUNTDOWN_INITIAL: TimeLeft = { days: '000', hours: '00', minutes: '00', seconds: '00' };

/** GTA VI release moment the countdown runs to. */
export const RELEASE_DATE_MS = new Date('2026-11-19T00:00:00Z').getTime();

const SECOND = 1000;
const MINUTE = SECOND * 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;

/** Time left until `targetMs`, zero-padded for display; null once the target has passed. */
export function computeTimeLeft(targetMs: number, nowMs: number): TimeLeft | null {
  const distance = targetMs - nowMs;
  if (distance < 0) return null;
  return {
    days: String(Math.floor(distance / DAY)).padStart(3, '0'),
    hours: String(Math.floor((distance % DAY) / HOUR)).padStart(2, '0'),
    minutes: String(Math.floor((distance % HOUR) / MINUTE)).padStart(2, '0'),
    seconds: String(Math.floor((distance % MINUTE) / SECOND)).padStart(2, '0'),
  };
}

// ---------- community media cards

export type MediaType = 'trailer' | 'podcast' | 'streamer' | 'reel';

export const MEDIA_TABS: readonly MediaType[] = ['trailer', 'podcast', 'streamer', 'reel'];

export interface MediaCard {
  id: number;
  author_id: string | null;
  type: MediaType;
  title: string;
  description: string | null;
  youtube_id: string | null;
  thumbnail_url: string | null;
  external_url: string | null;
  twitch_url: string | null;
  is_pinned: boolean;
  created_at: string;
}

export interface MediaForm { title: string; description: string; youtube_id: string; external_url: string }

export const EMPTY_MEDIA_FORM: MediaForm = { title: '', description: '', youtube_id: '', external_url: '' };

export function mediaTabLabel(tab: MediaType): string {
  return tab === 'trailer' ? 'Trailers' : tab === 'podcast' ? 'Podcasts' : tab === 'streamer' ? 'Streamers' : 'Fan Videos';
}

export function cardsForTab(cards: MediaCard[], tab: MediaType): MediaCard[] {
  return cards.filter(c => c.type === tab);
}

export function mediaFormFromCard(card: MediaCard): MediaForm {
  return {
    title: card.title,
    description: card.description || '',
    youtube_id: card.youtube_id || '',
    external_url: card.external_url || '',
  };
}

/** Row sent to `media_cards`: trimmed text, blanks stored as null, type taken from the active tab. */
export function buildMediaPayload(form: MediaForm, type: MediaType) {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    youtube_id: form.youtube_id.trim() || null,
    external_url: form.external_url.trim() || null,
    type,
  };
}

/** Only the card's author sees the edit/delete controls. */
export function isCardOwner(currentUserId: string | null, card: MediaCard): boolean {
  return !!currentUserId && currentUserId === card.author_id;
}

// ---------- carousel auto-scroll

/** Card width (360) plus the gap (24). */
export const CARD_SCROLL_STEP = 360 + 24;

/** Where the auto-scroll goes next: one card to the right, or back to the start when at the end. */
export function nextScrollLeft(scrollLeft: number, clientWidth: number, scrollWidth: number): number {
  const atEnd = scrollLeft + clientWidth >= scrollWidth - 10;
  return atEnd ? 0 : scrollLeft + CARD_SCROLL_STEP;
}

// ---------- map comments

export type MapComments = { [mapId: string]: any[] };

export const EMPTY_MAP_COMMENTS = (): MapComments => ({ map1: [], map2: [] });

/** Group comment rows by `map_id`, keeping row order; map1 and map2 always exist. */
export function groupMapComments(rows: any[] | null | undefined): MapComments {
  const grouped = EMPTY_MAP_COMMENTS();
  (rows || []).forEach((c: any) => {
    if (!grouped[c.map_id]) grouped[c.map_id] = [];
    grouped[c.map_id].push(c);
  });
  return grouped;
}

/** Name shown on a new comment: username, else e-mail local part, else "Anon". */
export function commentAuthorName(user: { email?: string | null; user_metadata?: { username?: string } | null } | null | undefined): string {
  return user?.user_metadata?.username || user?.email?.split('@')[0] || 'Anon';
}
