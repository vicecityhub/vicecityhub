// Pure rules of the soft (no-reload) navigation. No DOM here: the controller (softNav.ts) feeds these functions plain
// data, so every decision about which click becomes an in-page swap is testable from Node.

export interface ClickInfo {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  defaultPrevented: boolean;
}

/** What the controller read from the clicked <a>: the raw attributes, never the resolved `.href` property. */
export interface LinkInfo {
  href: string | null;
  target?: string | null;
  rel?: string | null;
  download?: boolean;
  /** data-vch-hard: the link must do a real navigation (an escape hatch for pages that need a clean document). */
  hard?: boolean;
}

export type SoftTarget = { kind: 'soft'; url: string } | { kind: 'same' } | null;

/** Is this path a page (HTML document) rather than a file: a directory, an .html file or an extensionless path. */
export function isPagePath(pathname: string): boolean {
  if (pathname.includes('/.well-known/')) return false;
  const last = pathname.slice(pathname.lastIndexOf('/') + 1);
  if (last === '') return true;
  if (/\.html?$/i.test(last)) return true;
  return !last.includes('.');
}

/** Identity of a page: path (index.html folded into its directory) plus query, never the hash. */
export function pageKey(url: string): string {
  const u = new URL(url);
  return u.pathname.replace(/(^|\/)index\.html?$/i, '$1') + u.search; // only a file NAMED index.html folds, not "myindex.html"
}

/**
 * Does this click become a soft navigation?
 *  - { kind: 'soft', url }  swap the page in place
 *  - { kind: 'same' }       the link points at the page that is already open: scroll to the top, never reload
 *  - null                   leave it to the browser (new tab, modifier keys, files, other sites, in-page anchors, ...)
 * `base` is the site base path ('/vicecityhub/'): the shell script lives at `${base}vch-shell.js`.
 */
export function softTarget(link: LinkInfo, click: ClickInfo, here: string, base: string): SoftTarget {
  if (click.defaultPrevented || click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return null;
  if (link.href == null || link.download || link.hard) return null;
  if (link.target && link.target !== '_self') return null;
  if (/(^|\s)external(\s|$)/i.test(link.rel || '')) return null;
  let to: URL;
  let at: URL;
  try {
    at = new URL(here);
    to = new URL(link.href, here);
  } catch {
    return null;
  }
  if (to.protocol !== 'http:' && to.protocol !== 'https:') return null;
  if (to.origin !== at.origin) return null;
  if (!to.pathname.startsWith(base)) return null;
  if (!isPagePath(to.pathname)) return null;
  if (pageKey(to.href) === pageKey(at.href)) return to.hash ? null : { kind: 'same' }; // #anchor: the browser scrolls natively
  return { kind: 'soft', url: to.href };
}

/**
 * popstate (back / forward): swap the page or leave it alone?
 *  - another path: always swap
 *  - same path, different query: swap only between two entries the shell created itself (post.html?id=1 <-> ?id=2).
 *    An entry a page pushed on its own (the Market product modal: ?p=slug) is that page's business and it handles
 *    its own popstate.
 *  - hash only: the browser already scrolled
 */
export function popAction(from: string, to: string, leavingOurs: boolean, arrivingOurs: boolean): 'swap' | 'ignore' {
  const a = new URL(from);
  const b = new URL(to);
  if (pageKey(`${a.origin}${a.pathname}`) !== pageKey(`${b.origin}${b.pathname}`)) return 'swap';
  if (a.search === b.search) return 'ignore';
  return leavingOurs && arrivingOurs ? 'swap' : 'ignore';
}

/** The response is an HTML page (a 404 page or a redirect to some file must fall back to a real navigation). */
export function isHtmlContentType(contentType: string | null): boolean {
  return /^(text\/html|application\/xhtml\+xml)\b/i.test(contentType || '');
}

/** The element id a `#hash` points at ('#a%20b' -> 'a b'); '' for no hash or an undecodable one. */
export function hashId(hash: string): string {
  if (!hash || hash === '#') return '';
  const raw = hash.slice(1);
  try { return decodeURIComponent(raw); } catch { return ''; }
}

/**
 * The debug switch: ?softnav=off turns the soft navigation off for this browser (remembered), ?softnav=on turns it back on.
 * Without a query the remembered choice decides; the default is on.
 */
export function softNavSwitch(search: string, stored: string | null): { enabled: boolean; persist: '0' | '1' | null } {
  const q = new URLSearchParams(search).get('softnav');
  if (q === 'off') return { enabled: false, persist: '0' };
  if (q === 'on') return { enabled: true, persist: '1' };
  return { enabled: stored !== '0', persist: null };
}

// ---- <head> merge ----------------------------------------------------------------------------------------------

const MANAGED_LINK_RELS = ['stylesheet', 'canonical', 'alternate', 'api-catalog', 'service-desc', 'service-doc', 'describedby', 'modulepreload'];

/**
 * Is this <head> element page-specific, i.e. replaced when the page changes? Everything else (fonts, icon, preconnect,
 * scripts added at runtime by third parties) stays exactly as it is. <title> is handled by the controller itself.
 */
export function isManagedHeadElement(tag: string, attrs: Record<string, string | null | undefined>): boolean {
  const t = tag.toLowerCase();
  if (t === 'style') return true;
  if (t === 'script') return (attrs.type || '').toLowerCase() === 'application/ld+json';
  if (t === 'meta') {
    if (attrs.charset != null) return false;
    const name = (attrs.name || '').toLowerCase();
    if (name === 'viewport') return false;
    return !!(attrs.name || attrs.property || attrs['http-equiv'] || attrs.itemprop);
  }
  if (t === 'link') {
    const rels = (attrs.rel || '').toLowerCase().split(/\s+/);
    return rels.some(r => MANAGED_LINK_RELS.includes(r));
  }
  return false;
}

/**
 * Which of the elements this shell owns (signatures of what it put in <head>, or found there at load) go away, and which
 * of the next page's managed elements must be added. Same signature = same element = left untouched (no flicker).
 */
export function planHeadMerge(owned: string[], next: string[]): { remove: string[]; add: string[] } {
  const keep = new Set(next);
  const have = new Set(owned);
  return {
    remove: owned.filter(sig => !keep.has(sig)),
    add: next.filter((sig, i) => !have.has(sig) && next.indexOf(sig) === i),
  };
}
