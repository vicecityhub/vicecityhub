// The Wire (news.html): pure helpers for reading, filtering and sorting news rows. No React, no Supabase,
// so every rule is testable from Node (tests/news.test.mjs).

export interface NewsArticle {
  id: number;
  created_at: string;
  type: string;
  title: string;
  body: string;
  meta?: any;
  author_id?: string;
  author_name: string;
  summary?: string;
  category?: string;
  source_url?: string;
  is_published?: boolean;
  is_featured?: boolean;
  sort_order?: number;
}

/** Filter tabs, in display order. 'All' shows everything; the rest match the row's category. */
export const NEWS_TAGS = ['All', 'Official', 'Leaks', 'Rumors', 'Community'];

export interface NewsMeta {
  /** Filter tag / status badge. Rows without a category count as 'Community'. */
  tag: string;
  /** Link to the original source ('' when none). */
  srcUrl: string;
  /** 1-5 importance rating, 0 when unrated. */
  stars: number;
  /** Featured rows are pinned to the top of the feed. */
  important: boolean;
  images: string[];
}

/** `meta` is jsonb that was historically written as a JSON *string* too. Anything unreadable counts as empty. */
function readMetaObject(raw: unknown): any {
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null; // malformed JSON in a row must never break the feed: show the row without stars/images
  }
}

/**
 * Display details of a news row, using the real Supabase schema:
 * category -> tag, source_url -> source link, is_featured -> pin, meta.stars / meta.importance -> rating,
 * meta.images -> gallery (string entries only).
 */
export function getNewsMeta(item: NewsArticle): NewsMeta {
  const tag = item.category && item.category.trim() ? item.category : 'Community';
  const srcUrl = item.source_url || '';
  const important = !!item.is_featured;
  let stars = 0;
  let images: string[] = [];

  const parsed = readMetaObject(item.meta);
  if (parsed) {
    if (parsed.stars) stars = Number(parsed.stars) || 0;
    if (parsed.importance) stars = Number(parsed.importance) || stars;
    if (Array.isArray(parsed.images)) images = parsed.images.filter((u: any) => typeof u === 'string');
  }

  return { tag, srcUrl, stars, important, images };
}

/** Keep the first row of every id. */
export function dedupeById(items: NewsArticle[]): NewsArticle[] {
  const seen = new Set<number>();
  return items.filter(item => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

/** Tag tab (case-insensitive, 'All' = every tag) and a text search over title, body, summary and author. */
export function filterNews(items: NewsArticle[], selectedTag: string, searchQuery: string): NewsArticle[] {
  const query = searchQuery.toLowerCase();
  return items.filter(item => {
    const { tag } = getNewsMeta(item);
    const matchesTag = selectedTag === 'All' || tag.toLowerCase() === selectedTag.toLowerCase();
    const matchesSearch =
      (item.title || '').toLowerCase().includes(query) ||
      (item.body || '').toLowerCase().includes(query) ||
      (item.summary || '').toLowerCase().includes(query) ||
      (item.author_name || '').toLowerCase().includes(query);
    return matchesTag && matchesSearch;
  });
}

/** Pin featured news to the top, newest first within each group. Returns a new array. */
export function sortNews(items: NewsArticle[]): NewsArticle[] {
  return [...items].sort((a, b) => {
    const aImportant = getNewsMeta(a).important;
    const bImportant = getNewsMeta(b).important;
    if (aImportant && !bImportant) return -1;
    if (!aImportant && bImportant) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });
}

/** The feed shown on the page: de-duplicated, filtered, pinned and sorted. */
export function buildFeed(rows: NewsArticle[], selectedTag: string, searchQuery: string): NewsArticle[] {
  return sortNews(filterNews(dedupeById(rows), selectedTag, searchQuery));
}

export type TagKind = 'official' | 'leaks' | 'rumors' | 'community';

/** Official / Leaks / Rumors get their own look; every other tag is treated as community. */
export function tagKind(tag: string): TagKind {
  switch (tag.toLowerCase()) {
    case 'official': return 'official';
    case 'leaks': return 'leaks';
    case 'rumors': return 'rumors';
    default: return 'community';
  }
}

const TAG_STYLES: Record<TagKind, string> = {
  official: 'border-green-500/30 text-green-400 bg-green-500/5 neon-text-green',
  leaks: 'border-neonPink/30 text-neonPink bg-neonPink/5 neon-text-pink',
  rumors: 'border-neonOrange/30 text-neonOrange bg-neonOrange/5',
  community: 'border-neonCyan/30 text-neonCyan bg-neonCyan/5 neon-text-cyan',
};

export const getTagStyle = (tag: string) => TAG_STYLES[tagKind(tag)];

/** Short, readable label for a source link: its host without "www.", upper-cased; 'SOURCE' when not a URL. */
export function getSourceLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toUpperCase();
  } catch {
    return 'SOURCE';
  }
}

/** The text shown on a collapsed card: the summary when it has content, otherwise the body. */
export function previewOf(item: NewsArticle): string {
  return item.summary && item.summary.trim() ? item.summary : item.body;
}
