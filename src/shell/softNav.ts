// Soft navigation: change pages WITHOUT reloading the document, so the <audio> of Leonida FM (and every other piece of
// document state) survives. Mobile browsers (iOS Safari above all) refuse to start audio in a new document until the
// visitor touches the page again; the only way to keep the music playing "smoothly through every section" is to never
// create a new document.
//
// How a visit works (a page is fetched as plain HTML, exactly what a real navigation would have received):
//   A. fetch + parse the next page, stage its stylesheets (downloaded but not applied) and evaluate its React entry
//      module ahead of time. The current page stays on screen and usable; a newer click simply replaces this visit.
//   B. in ONE synchronous task: run the leave callbacks of the current page (unmount the React root, drop timers),
//      change the URL, merge <head> (title, meta, canonical, JSON-LD, stylesheets), swap <body>, start the next page.
//      Nothing is painted between those steps, so there is no flash of an empty page.
//   C. re-run the scripts of a static page and position the scroll.
// ANY failure on the way ends in a normal navigation to the same URL, so the worst case is today's behaviour.
import { hashId, isHtmlContentType, isManagedHeadElement, isPagePath, planHeadMerge, popAction, softNavSwitch, softTarget } from './navRules.ts';
import type { PageStart } from './types.ts';

export interface SoftNavApi {
  navigate(url: string, opts?: { replace?: boolean }): void;
  refresh(): void;
  definePage(start: PageStart, entry?: string): void;
  onLeave(cb: () => void): void;
  readonly referrer: string;
  readonly enabled: boolean;
}

export interface SoftNavOptions {
  /** Never swap pages (the Vite dev server): links and history behave natively. */
  disabled?: boolean;
}

type Mode = 'push' | 'replace' | 'pop';

interface Plan {
  /** Final URL of the page: redirects resolved, the #hash of the request kept (a response URL never carries it). */
  url: string;
  doc: Document;
  title: string;
  /** Page-specific <head> elements of the next page: signature -> element (still owned by the parsed document). */
  head: Map<string, Element>;
  /** Absolute URL of the React entry module of the next page, or null for a static page. */
  entry: string | null;
}

const FETCH_TIMEOUT_MS = 10000;
const SUBRESOURCE_TIMEOUT_MS = 8000;
const ENTRY_TIMEOUT_MS = 15000;
const SETTLE_TRIES = 40;
const SETTLE_EVERY_MS = 50;
const SHELL_SCRIPT = /vch-shell\.js/;

const safeGet = (key: string): string | null => { try { return localStorage.getItem(key); } catch { return null; } };
const safeSet = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* nothing to do */ } };

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(what + ' timed out')), ms);
    p.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
  });
}

const absolute = (href: string, base: string): string => {
  try { return new URL(href, base).href; } catch { return href; }
};

const relsOf = (el: Element): string[] => (el.getAttribute('rel') || '').toLowerCase().split(/\s+/).filter(Boolean);

const attrsOf = (el: Element): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const a of Array.from(el.attributes)) out[a.name.toLowerCase()] = a.value;
  return out;
};

/** Is this <head> element replaced when the page changes? (<title> is handled separately.) */
const isManaged = (el: Element) => el.tagName !== 'TITLE' && isManagedHeadElement(el.tagName, attrsOf(el));

/**
 * Identity of a <head> element. Links are identified by what they load (rel + absolute URL + media), everything else
 * by its markup: the same stylesheet on two pages must never be removed and added again (that would flash).
 */
function signature(el: Element, base: string): string {
  if (el.tagName === 'LINK') return `link|${relsOf(el).join(' ')}|${absolute(el.getAttribute('href') || '', base)}|${el.getAttribute('media') || ''}`;
  return el.outerHTML;
}

/** The React entry of a page: its module <script src>, ignoring the Vite dev client. */
function findEntry(doc: ParentNode, baseHref: string): string | null {
  for (const s of Array.from(doc.querySelectorAll('script[type="module"][src]'))) {
    const src = s.getAttribute('src') || '';
    if (!src || src.includes('/@vite/') || src.includes('/@react-refresh') || src.includes('/node_modules/')) continue;
    try { return new URL(src, baseHref).href; } catch { /* next */ }
  }
  return null;
}

const supportsModulePreload = (() => {
  try { return !!document.createElement('link').relList.supports('modulepreload'); } catch { return false; }
})();

function createProgressBar() {
  let el: HTMLElement | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  let hide: ReturnType<typeof setTimeout> | undefined;
  let width = 0;
  const calm = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
  const ensure = () => {
    if (el) return el;
    el = document.createElement('div');
    el.id = 'vch-nav-progress';
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = 'position:fixed;top:0;left:0;height:3px;width:0;z-index:2147483000;pointer-events:none;opacity:0;'
      + 'background:linear-gradient(90deg,#FF00FF,#00FFFF);box-shadow:0 0 10px #FF00FF,0 0 4px #00FFFF;';
    document.documentElement.appendChild(el); // on <html>: a body swap never removes it
    return el;
  };
  return {
    start() {
      const bar = ensure();
      clearInterval(timer);
      clearTimeout(hide);
      width = 8;
      bar.style.transition = 'none';
      bar.style.opacity = '1';
      bar.style.width = width + '%';
      void bar.offsetWidth; // apply the reset before the transition is switched back on
      if (!calm()) bar.style.transition = 'width .3s ease, opacity .3s ease';
      timer = setInterval(() => { width += (90 - width) * 0.15; bar.style.width = width + '%'; }, 200);
    },
    done() {
      clearInterval(timer);
      const bar = ensure();
      bar.style.width = '100%';
      hide = setTimeout(() => { bar.style.opacity = '0'; }, 150);
    },
  };
}

export function createSoftNav(base: string, options: SoftNavOptions = {}): SoftNavApi {
  const sw = softNavSwitch(location.search, safeGet('vch_softnav'));
  if (sw.persist) safeSet('vch_softnav', sw.persist);
  const enabled = !options.disabled && sw.enabled
    && typeof fetch === 'function' && typeof DOMParser === 'function' && typeof AbortController === 'function';

  const docToken = Math.random().toString(36).slice(2);
  let entryId = 0;
  let nextId = 1;
  const scrollOf = new Map<number, number>(); // history entry id -> scroll position, for back/forward
  const leave: Array<() => void> = [];
  const pages = new Map<string, PageStart>(); // absolute entry URL -> how that React page starts
  const sheets = new Map<string, { link: HTMLLinkElement; loaded: Promise<void> }>(); // absolute URL -> stylesheet staged in <head> (media=print)
  const hints = new Map<string, HTMLLinkElement>(); // absolute URL -> modulepreload hint added by this shell
  const owned = new Map<string, Element>(); // signature -> live <head> element this shell may remove
  const bar = createProgressBar();

  let entryKey: string | null = null; // entry URL of the page on screen (null: a static page)
  let currentStarted = false; // has the page this document was loaded with started? (a React entry registers a moment after the script ran)
  let currentUrl = location.href;
  let ourEntry = true; // is the current history entry one this shell made (or marked)?
  let referrer = document.referrer;
  let seq = 0;
  let busy = false;
  let pending: { url: string; mode: Mode; y?: number } | null = null;
  let ctl: AbortController | null = null;
  let scrollTaken = false;

  const inScope = (url: string): boolean => {
    try {
      const u = new URL(url);
      return u.origin === location.origin && u.pathname.startsWith(base) && isPagePath(u.pathname);
    } catch { return false; }
  };

  /** A page whose React entry has not registered itself cannot be unmounted: leaving it needs a real navigation. */
  const canSwap = () => enabled && (entryKey === null || pages.has(entryKey));

  const runLeave = () => {
    for (const cb of leave.splice(0)) { try { cb(); } catch (err) { console.warn('[vch-shell] leave callback failed', err); } }
  };
  const runPage = (start: PageStart) => {
    const stop = start();
    if (typeof stop === 'function') leave.push(stop);
  };

  // ---- boot --------------------------------------------------------------------------------------------------
  if (enabled) {
    for (const el of Array.from(document.head.children)) if (isManaged(el)) owned.set(signature(el, location.href), el);
    entryKey = findEntry(document, location.href);
    currentStarted = entryKey === null; // a static page has no entry to wait for
    try {
      const st = history.state;
      if (st === null || typeof st === 'object') history.replaceState({ ...(st || {}), vch: 1, id: entryId, doc: docToken }, '');
    } catch { /* a strange environment: the first soft navigation then simply is not marked */ }
  }

  /** From the first swap on the shell positions the scroll itself (the browser would restore it before the content exists). */
  function takeOverScroll() {
    if (scrollTaken) return;
    scrollTaken = true;
    try { history.scrollRestoration = 'manual'; } catch { /* not supported */ }
  }

  // ---- phase A: fetch, parse, stage -------------------------------------------------------------------------
  /** Add a stylesheet to <head> without applying it (media=print) and resolve once it has loaded. */
  function stageStylesheet(abs: string, src: Element): Promise<void> {
    const known = sheets.get(abs);
    if (known) return known.loaded;
    const applied = Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]')).some(l => l.href === abs);
    if (applied) return Promise.resolve(); // already styling this page: it just stays
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.media = 'print'; // downloads and fires load, but does not style the page that is still on screen
    const cors = src.getAttribute('crossorigin');
    if (cors !== null) link.crossOrigin = cors || 'anonymous';
    const loaded = withTimeout(new Promise<void>((resolve, reject) => {
      link.onload = () => resolve();
      link.onerror = () => reject(new Error('stylesheet failed: ' + abs));
    }), SUBRESOURCE_TIMEOUT_MS, 'stylesheet ' + abs);
    loaded.catch(() => { if (sheets.get(abs)?.link === link) sheets.delete(abs); link.remove(); }); // a failed attempt is forgotten: the next visit tries again
    link.href = abs;
    document.head.appendChild(link);
    sheets.set(abs, { link, loaded });
    return loaded;
  }

  /** A modulepreload hint starts the downloads of the next page's JavaScript while the current page is still shown. */
  function hint(abs: string) {
    if (!supportsModulePreload || hints.has(abs)) return;
    const link = document.createElement('link');
    link.rel = 'modulepreload';
    link.crossOrigin = 'anonymous';
    link.href = abs;
    document.head.appendChild(link);
    hints.set(abs, link);
  }

  async function prepare(url: string, mine: AbortController): Promise<Plan> {
    const timer = setTimeout(() => mine.abort(), FETCH_TIMEOUT_MS);
    let html: string;
    let finalUrl: string;
    try {
      const res = await fetch(url, { signal: mine.signal, credentials: 'same-origin' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      if (!isHtmlContentType(res.headers.get('content-type'))) throw new Error('not an HTML page');
      const target = new URL(res.url || url);
      if (!target.hash) target.hash = new URL(url).hash; // response.url never carries the #fragment of the request
      finalUrl = target.href;
      html = await res.text();
    } finally { clearTimeout(timer); }
    if (!inScope(finalUrl)) throw new Error('left the site: ' + finalUrl);

    const doc = new DOMParser().parseFromString(html, 'text/html');
    // Only pages that carry the shell are swapped in; anything else (reset-password, stale generated pages) gets a real navigation.
    if (!Array.from(doc.querySelectorAll('script[src]')).some(s => SHELL_SCRIPT.test(s.getAttribute('src') || ''))) throw new Error('the page has no shell');

    const head = new Map<string, Element>();
    for (const el of Array.from(doc.head.children)) if (isManaged(el)) head.set(signature(el, finalUrl), el);
    const entry = findEntry(doc, finalUrl);

    const styles: Promise<void>[] = [];
    for (const el of head.values()) {
      if (el.tagName !== 'LINK' || !el.getAttribute('href')) continue;
      const abs = absolute(el.getAttribute('href') || '', finalUrl);
      const rels = relsOf(el);
      if (rels.includes('stylesheet')) styles.push(stageStylesheet(abs, el));
      else if (rels.includes('modulepreload')) hint(abs);
    }
    if (entry) hint(entry);
    await Promise.all(styles);

    if (entry && !pages.has(entry)) {
      // Evaluate the entry now, BEFORE the swap: it only registers how the page starts (definePage), so by the time the
      // body is replaced the page can be mounted in the same task and no empty frame is ever painted.
      await withTimeout(import(/* @vite-ignore */ entry), ENTRY_TIMEOUT_MS, 'entry ' + entry);
      if (!pages.has(entry)) throw new Error('the entry did not register itself: ' + entry);
    }
    return { url: finalUrl, doc, title: doc.title, head, entry };
  }

  // ---- phase B: the synchronous swap -------------------------------------------------------------------------
  /** A copy of a parsed <head> element for the live document (relative URLs are resolved against the page they came from). */
  function liveCopy(src: Element, pageUrl: string): Element {
    if (src.tagName === 'SCRIPT') {
      const s = document.createElement('script'); // JSON-LD: a data block, rebuilt as a fresh element
      for (const a of Array.from(src.attributes)) s.setAttribute(a.name, a.value);
      s.textContent = src.textContent;
      return s;
    }
    const el = document.importNode(src, true);
    if (el.tagName === 'LINK' && el.hasAttribute('href')) el.setAttribute('href', absolute(el.getAttribute('href') || '', pageUrl));
    return el;
  }

  function mergeHead(plan: Plan) {
    const { remove, add } = planHeadMerge(Array.from(owned.keys()), Array.from(plan.head.keys()));
    for (const sig of remove) { owned.get(sig)?.remove(); owned.delete(sig); }
    for (const sig of add) {
      const src = plan.head.get(sig);
      if (!src) continue;
      let live: Element | null = null;
      if (src.tagName === 'LINK' && relsOf(src).includes('stylesheet')) {
        const abs = absolute(src.getAttribute('href') || '', plan.url);
        const staged = sheets.get(abs);
        if (staged) { // downloaded already: switching it on is instant
          staged.link.media = src.getAttribute('media') || 'all';
          sheets.delete(abs);
          live = staged.link;
        }
      }
      if (!live) {
        live = liveCopy(src, plan.url);
        document.head.appendChild(live);
      }
      owned.set(sig, live);
    }
    for (const { link } of sheets.values()) link.remove(); // staged for a visit that never happened
    sheets.clear();
    for (const link of hints.values()) link.remove(); // the real modulepreload elements of the page were added above
    hints.clear();
    if (plan.title) document.title = plan.title;
  }

  function swapBody(plan: Plan) {
    const body = document.body;
    for (const node of Array.from(body.childNodes)) {
      if (node instanceof Element && node.hasAttribute('data-vch-keep')) continue;
      body.removeChild(node);
    }
    const next = plan.doc.body;
    for (const a of Array.from(body.attributes)) if (!next.hasAttribute(a.name)) body.removeAttribute(a.name);
    for (const a of Array.from(next.attributes)) body.setAttribute(a.name, a.value);
    for (const node of Array.from(next.childNodes)) body.appendChild(document.adoptNode(node));
    const lang = plan.doc.documentElement.getAttribute('lang');
    if (lang) document.documentElement.setAttribute('lang', lang);
  }

  function commit(plan: Plan, requested: Mode) {
    takeOverScroll();
    const mode: Mode = requested === 'push' && plan.url === location.href ? 'replace' : requested; // the same address again is not a new history entry
    if (mode !== 'pop') scrollOf.set(entryId, window.scrollY); // (a pop already stored it under the entry being left)
    runLeave();
    // The URL changes FIRST: relative URLs in the incoming markup (images, links) must resolve against the NEW page.
    if (mode === 'push') {
      entryId = nextId++;
      history.pushState({ vch: 1, id: entryId, doc: docToken }, '', plan.url);
    } else if (mode === 'replace') {
      history.replaceState({ vch: 1, id: entryId, doc: docToken }, '', plan.url);
    } else if (location.href !== plan.url) {
      history.replaceState(history.state, '', plan.url); // the server redirected (e.g. a missing trailing slash)
    }
    mergeHead(plan);
    swapBody(plan);
    if (mode !== 'replace') referrer = currentUrl;
    currentUrl = location.href;
    if (mode !== 'pop') ourEntry = true; // (a pop already worked out whether the entry it arrived at is ours)
    entryKey = plan.entry;
  }

  // ---- phase C: static pages and the scroll --------------------------------------------------------------------
  /** Re-create the page's scripts so the browser runs them (scripts parsed by DOMParser are inert), in document order. */
  async function runBodyScripts() {
    for (const old of Array.from(document.body.querySelectorAll('script'))) {
      const type = (old.getAttribute('type') || '').toLowerCase();
      if (type && type !== 'text/javascript' && type !== 'application/javascript' && type !== 'module') continue; // data blocks
      const src = old.getAttribute('src');
      if (src && SHELL_SCRIPT.test(src)) continue; // the shell is already running; running it twice would create a second radio
      const fresh = document.createElement('script');
      for (const a of Array.from(old.attributes)) fresh.setAttribute(a.name, a.value);
      if (src) {
        fresh.async = false;
        await withTimeout(new Promise<void>((resolve, reject) => {
          fresh.onload = () => resolve();
          fresh.onerror = () => reject(new Error('script failed: ' + src));
          old.replaceWith(fresh);
        }), SUBRESOURCE_TIMEOUT_MS, 'script ' + src);
      } else {
        fresh.textContent = old.textContent;
        old.replaceWith(fresh); // an inline script runs synchronously on insertion
      }
    }
  }

  const scrollTopNow = () => {
    try { window.scrollTo({ top: 0, left: 0, behavior: 'instant' }); } catch { window.scrollTo(0, 0); } // 'instant' beats a smooth-scroll stylesheet
  };

  /** Content may still be rendering (data, images): keep trying for a moment until the target exists / the page is tall enough. */
  function settle(mySeq: number, attempt: () => boolean, last?: () => void) {
    let tries = 0;
    const tick = () => {
      if (mySeq !== seq) return;
      if (attempt()) return;
      if (++tries >= SETTLE_TRIES) { if (last) last(); return; }
      setTimeout(tick, SETTLE_EVERY_MS);
    };
    tick();
  }

  function applyScroll(mode: Mode, url: string, y: number | undefined, mySeq: number) {
    scrollTopNow(); // the new page never starts in the middle of where the old one was
    const id = hashId(new URL(url).hash);
    if (id) {
      settle(mySeq, () => {
        const el = document.getElementById(id);
        if (!el) return false;
        el.scrollIntoView();
        return true;
      });
    } else if (y != null && y > 0 && (mode === 'pop' || mode === 'replace')) {
      settle(mySeq, () => {
        if (document.documentElement.scrollHeight - window.innerHeight < y - 1) return false; // not tall enough yet
        window.scrollTo(0, y);
        return true;
      }, () => window.scrollTo(0, y));
    }
  }

  // ---- the visit ---------------------------------------------------------------------------------------------
  function hardNavigate(url: string, why: unknown, replace = false) {
    console.warn('[vch-shell] soft navigation failed, loading the page normally:', url, why);
    bar.done();
    if (replace) location.replace(url); else location.assign(url);
  }

  async function visit(url: string, mode: Mode, y?: number): Promise<void> {
    if (busy) { pending = { url, mode, y }; return; } // last click wins once the swap in progress is complete
    const mySeq = ++seq;
    if (ctl) ctl.abort();
    const mine = ctl = new AbortController();
    bar.start();
    let plan: Plan;
    try {
      plan = await prepare(url, mine);
    } catch (err) {
      if (mySeq !== seq) return; // a newer visit took over (this one was aborted on purpose)
      hardNavigate(url, err, mode === 'replace');
      return;
    }
    if (mySeq !== seq) return;
    busy = true;
    try {
      commit(plan, mode);
      const start = plan.entry ? pages.get(plan.entry) : undefined;
      if (plan.entry && !start) throw new Error('no start function for ' + plan.entry);
      if (start) runPage(start); // synchronous, in the same task as the swap
      applyScroll(mode, plan.url, y, mySeq);
      await runBodyScripts();
    } catch (err) {
      busy = false;
      hardNavigate(plan.url, err, true);
      return;
    }
    busy = false;
    document.dispatchEvent(new CustomEvent('vch:navigate', { detail: { url: plan.url } }));
    bar.done();
    const queued = pending;
    pending = null;
    if (queued) void visit(queued.url, queued.mode, queued.y);
  }

  // ---- events ------------------------------------------------------------------------------------------------
  function onClick(e: MouseEvent) {
    const a = e.target instanceof Element ? e.target.closest('a') : null;
    if (!a) return;
    const t = softTarget(
      { href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel'), download: a.hasAttribute('download'), hard: a.hasAttribute('data-vch-hard') },
      e, location.href, base,
    );
    if (!t) return;
    if (t.kind === 'same') { e.preventDefault(); scrollTopNow(); return; }
    if (!canSwap()) return; // the browser navigates normally
    e.preventDefault();
    void visit(t.url, 'push');
  }

  function onPop(e: PopStateEvent) {
    const to = location.href;
    const arrivingOurs = !!(e.state && e.state.vch);
    const leavingOurs = ourEntry;
    const from = currentUrl;
    const leavingId = entryId;
    ourEntry = arrivingOurs;
    const sameDoc = !!(e.state && e.state.doc === docToken && typeof e.state.id === 'number');
    if (sameDoc) entryId = e.state.id;
    if (popAction(from, to, leavingOurs, arrivingOurs) === 'ignore') { currentUrl = to; return; }
    if (!canSwap()) { location.reload(); return; }
    scrollOf.set(leavingId, window.scrollY);
    void visit(to, 'pop', sameDoc ? scrollOf.get(e.state.id) : undefined);
  }

  if (enabled) {
    document.addEventListener('click', onClick); // bubble phase: a handler that already dealt with the click (preventDefault) wins
    window.addEventListener('popstate', onPop);
  }

  return {
    enabled,
    get referrer() { return referrer; },
    navigate(url, opts) {
      let abs: string;
      try { abs = new URL(url, location.href).href; } catch { return; }
      const replace = !!(opts && opts.replace);
      if (!enabled || !canSwap() || !inScope(abs)) {
        if (replace) location.replace(abs); else location.assign(abs);
        return;
      }
      void visit(abs, replace ? 'replace' : 'push');
    },
    refresh() {
      if (!enabled || !canSwap()) { location.reload(); return; }
      void visit(location.href, 'replace', window.scrollY);
    },
    definePage(start, entry) {
      if (!currentStarted) { // the page this document was loaded with: its entry is evaluating right now
        currentStarted = true;
        if (entryKey) pages.set(entryKey, start);
        if (entry) pages.set(entry, start);
        runPage(start);
        return;
      }
      if (entry) pages.set(entry, start); // the entry of a page about to be shown, evaluated ahead of the swap: it starts at the swap
      else console.warn('[vch-shell] definePage() without an entry URL was ignored');
    },
    onLeave(cb) { leave.push(cb); },
  };
}
