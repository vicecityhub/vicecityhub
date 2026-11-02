import type { IRpServer, RpStyle } from './types';
import { langCode, langName } from './format';

export type SortKey = 'players' | 'discord' | 'upvotes' | 'name' | 'curated';

export interface Filters {
  q: string;
  style: RpStyle | 'all';
  access: 'all' | 'public' | 'allowlist';
  lang: string; // 'all' or a 2-letter code
  framework: string; // 'all' or a framework key
  features: string[];
  onlineOnly: boolean;
  sort: SortKey;
}

export const DEFAULT_FILTERS: Filters = { q: '', style: 'all', access: 'all', lang: 'all', framework: 'all', features: [], onlineOnly: false, sort: 'players' };

export const SORT_LABELS: Record<SortKey, string> = {
  players: 'Most players now',
  discord: 'Biggest Discord',
  upvotes: 'Most upvoted',
  name: 'A to Z',
  curated: 'Hub order',
};

export const isFiltered = (f: Filters): boolean =>
  !!f.q || f.style !== 'all' || f.access !== 'all' || f.lang !== 'all' || f.framework !== 'all' || f.features.length > 0 || f.onlineOnly;

/** Paid promotion that has not expired yet (2 = headline, 1 = featured/bump, 0 = none). */
export function promoRank(s: IRpServer, now = Date.now()): number {
  if (!s.promo_tier || !s.promo_until || Date.parse(s.promo_until) <= now) return 0;
  return s.promo_tier === 'headline' ? 3 : s.promo_tier === 'featured' ? 2 : 1;
}

export const isOnline = (s: IRpServer): boolean => s.live && typeof s.online_count === 'number';

export function applyFilters(list: IRpServer[], f: Filters, now = Date.now()): IRpServer[] {
  const q = f.q.trim().toLowerCase();
  const out = list.filter((s) => {
    if (f.onlineOnly && !isOnline(s)) return false;
    if (f.style !== 'all' && s.rp_style !== f.style) return false;
    if (f.access !== 'all' && s.access !== f.access) return false;
    if (f.lang !== 'all' && langCode(s.locale) !== f.lang) return false;
    if (f.framework !== 'all' && s.framework !== f.framework) return false;
    if (f.features.length && !f.features.every((k) => (s.features || []).includes(k))) return false;
    if (q) {
      const hay = `${s.name} ${s.host_name || ''} ${(s.tags || []).join(' ')} ${s.description || ''} ${s.project_desc || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
  const num = (v: number | null | undefined) => (typeof v === 'number' ? v : -1);
  const cmp: Record<SortKey, (a: IRpServer, b: IRpServer) => number> = {
    players: (a, b) => num(b.online_count) - num(a.online_count) || num(b.discord_members) - num(a.discord_members),
    discord: (a, b) => num(b.discord_members) - num(a.discord_members),
    upvotes: (a, b) => b.upvotes - a.upvotes || num(b.online_count) - num(a.online_count),
    name: (a, b) => a.name.localeCompare(b.name),
    curated: (a, b) => num(a.sort_order) - num(b.sort_order),
  };
  return out.sort((a, b) => promoRank(b, now) - promoRank(a, now) || cmp[f.sort](a, b));
}

export interface LangOption { code: string; label: string; count: number }
export function languageOptions(list: IRpServer[]): LangOption[] {
  const m = new Map<string, number>();
  for (const s of list) m.set(langCode(s.locale), (m.get(langCode(s.locale)) || 0) + 1);
  return [...m.entries()]
    .map(([code, count]) => ({ code, count, label: code === 'xx' ? 'Unknown' : langName(code) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export function frameworkOptions(list: IRpServer[]): string[] {
  return [...new Set(list.map((s) => s.framework).filter((x): x is string => !!x))].sort();
}

export function featureOptions(list: IRpServer[]): string[] {
  const c = new Map<string, number>();
  for (const s of list) for (const k of s.features || []) c.set(k, (c.get(k) || 0) + 1);
  return [...c.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
}
