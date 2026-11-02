/** Small display helpers for the RP servers section. Pure, no side effects. */

export const fmt = (n: number | null | undefined): string => (typeof n === 'number' && Number.isFinite(n) ? n.toLocaleString('en-US') : '–');

/** 77332 -> 77.3k, 1200000 -> 1.2M. Used for Discord member counts. */
export function compact(n: number | null | undefined): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '–';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, '')}k`;
  return String(n);
}

let names: Intl.DisplayNames | null | undefined;
/** pt-BR -> "Portuguese". Falls back to the raw code. */
export function langName(locale: string | null | undefined): string {
  if (!locale) return 'Unknown';
  try {
    names ??= new Intl.DisplayNames(['en'], { type: 'language' });
    return names.of(locale.slice(0, 2).toLowerCase()) || locale;
  } catch {
    return locale;
  }
}

/** Language code used for filtering: "pt-BR" -> "pt". */
export const langCode = (locale: string | null | undefined): string => (locale ? locale.slice(0, 2).toLowerCase() : 'xx');

/** Flag emoji from the region part of the locale (en-US -> US flag). Plain globe when there is no region. */
export function flag(locale: string | null | undefined): string {
  const m = /-([A-Za-z]{2})$/.exec(locale || '');
  if (!m) return '\u{1F310}';
  return String.fromCodePoint(...[...m[1].toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

/** "3 min ago" style text from an ISO date. Empty string when unknown. */
export function ago(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

/** Accepts a bare code, cfx.re/join/<code>, or servers.fivem.net/servers/detail/<code>. Returns lowercase code or null. */
export function parseCfxInput(input: string): string | null {
  const s = input.trim().toLowerCase();
  const m = /(?:cfx\.re\/join\/|servers\/detail\/|connect\s+cfx\.re\/join\/)([a-z0-9]{5,16})/.exec(s) || /^([a-z0-9]{5,16})$/.exec(s);
  return m ? m[1] : null;
}
