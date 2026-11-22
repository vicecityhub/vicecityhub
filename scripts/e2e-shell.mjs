#!/usr/bin/env node
/**
 * End-to-end check of the persistent shell (Leonida FM + no-reload navigation) in a REAL Chromium.
 *
 *   npm run build && node scripts/e2e-shell.mjs [dist-dir]
 *
 * What it proves, on a built dist/ served under the real origin https://vicecityhub.github.io/vicecityhub/ (Playwright
 * routes; Supabase and the muz bucket are faked with generated WAV tracks, nothing leaves the machine):
 *   - the browser runs with --autoplay-policy=document-user-activation-required (what phones do): the music starts on the
 *     FIRST touch and then keeps playing through every section, React pages and static SEO pages alike, with ONE <audio>
 *     element, no pause, no new source and no new document;
 *   - back/forward swap pages in place and restore the scroll; reload-free refresh; the mute survives navigation;
 *   - a finished track is followed by a different random one without any gesture, also after navigations;
 *   - modified clicks, new tabs and a failing fetch behave like plain links (the real navigation fallback);
 *   - the kill switch (?softnav=off) reproduces the old behaviour, which proves the harness would catch the bug.
 * Needs Playwright (preinstalled in agent sandboxes) and ffmpeg (only to generate the test tracks).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const DIST = path.resolve(process.argv[2] || 'dist');
const ORIGIN = 'https://vicecityhub.github.io';
const BASE = `${ORIGIN}/vicecityhub/`;
const SB = 'https://lpglkglhjdqnktybksth.supabase.co';
const MUZ = `${SB}/storage/v1/object/public/muz/`;

// ---- test tracks ------------------------------------------------------------------------------------------------
const AUDIO = process.env.E2E_AUDIO_DIR || fs.mkdtempSync(path.join(os.tmpdir(), 'vch-e2e-audio-'));
for (const [name, hz, seconds] of [['short.wav', 440, 4], ['long1.wav', 330, 180], ['long2.wav', 550, 180]]) {
  const file = path.join(AUDIO, name);
  if (fs.existsSync(file)) continue;
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'lavfi', '-i', `sine=frequency=${hz}:duration=${seconds}`, '-ar', '8000', '-ac', '1', '-c:a', 'pcm_s16le', file]);
  if (r.status !== 0) throw new Error('ffmpeg is needed to generate the test tracks: ' + String(r.stderr));
}
const TRACKS = ['short.wav', 'long1.wav', 'long2.wav'];
const LONG_TRACKS = ['long1.wav', 'long2.wav'];

// ---- tiny test framework ----------------------------------------------------------------------------------------
let failures = 0;
const check = (name, ok, extra = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  -> ' + extra : ''}`);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': '*' };

// ---- the fake internet ------------------------------------------------------------------------------------------
async function newContext(browser, { mobile = false, state = {} } = {}) {
  const ctx = await browser.newContext(mobile ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 900 } });
  state.failFetch = state.failFetch || new Set();
  state.muz = state.muz || LONG_TRACKS; // what the fake bucket lists
  state.docRequests = [];
  state.listCalls = 0;
  state.hits = [];

  await ctx.route('**/*', (route) => route.abort()); // anything not listed below does not exist
  await ctx.route(`${ORIGIN}/**`, (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (!u.pathname.startsWith('/vicecityhub/')) return route.fulfill({ status: 404, body: 'not found' });
    const rel = decodeURIComponent(u.pathname.slice('/vicecityhub/'.length));
    let file = path.join(DIST, rel);
    if (rel === '' || rel.endsWith('/')) file = path.join(file, 'index.html');
    else if (fs.existsSync(file) && fs.statSync(file).isDirectory()) return route.fulfill({ status: 301, headers: { location: u.pathname + '/' + u.search }, body: '' });
    if (!fs.existsSync(file)) return route.fulfill({ status: 404, contentType: 'text/html', body: '<h1>404</h1>' });
    if (req.resourceType() === 'fetch' && state.failFetch.has(u.pathname)) return route.fulfill({ status: 500, body: 'boom' });
    return route.fulfill({ status: 200, contentType: MIME[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
  });
  await ctx.route(`${SB}/**`, (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (u.pathname === '/storage/v1/object/list/muz') {
      state.listCalls++;
      return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(state.muz.map((name) => ({ name }))) });
    }
    if (u.pathname.startsWith('/storage/v1/object/public/muz/')) {
      const buf = fs.readFileSync(path.join(AUDIO, decodeURIComponent(u.pathname.split('/').pop())));
      const range = req.headers().range;
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        const start = m && m[1] ? +m[1] : 0;
        const end = m && m[2] ? Math.min(+m[2], buf.length - 1) : buf.length - 1;
        return route.fulfill({ status: 206, headers: { ...CORS, 'content-type': 'audio/wav', 'accept-ranges': 'bytes', 'content-range': `bytes ${start}-${end}/${buf.length}` }, body: buf.subarray(start, end + 1) });
      }
      return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'audio/wav', 'accept-ranges': 'bytes' }, body: buf });
    }
    if (u.pathname.startsWith('/functions/v1/hit')) { state.hits.push(req.postData()); return route.fulfill({ status: 204, headers: CORS }); }
    if (u.pathname.startsWith('/storage/v1/object/public/')) return route.fulfill({ status: 404, headers: CORS, body: '' });
    return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: '[]' });
  });

  // Runs in EVERY new document (never on a soft navigation): records every Audio element and every media event, so a
  // second element, a pause, a new source or a rejected play() cannot hide.
  await ctx.addInitScript(() => {
    window.__docId = Math.random().toString(36).slice(2);
    window.__log = [];
    window.__audios = [];
    const NativeAudio = window.Audio;
    const note = (type, a) => window.__log.push({ type, src: (a.currentSrc || a.src || '').split('/').pop(), t: a.currentTime, at: Math.round(performance.now()) });
    window.Audio = function (...args) {
      const a = new NativeAudio(...args);
      window.__audios.push(a);
      ['play', 'pause', 'ended', 'loadstart', 'emptied', 'error'].forEach((type) => a.addEventListener(type, () => note(type, a)));
      return a;
    };
    window.Audio.prototype = NativeAudio.prototype;
    const nativePlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...args) {
      const result = nativePlay.apply(this, args);
      if (result && result.catch) result.catch((e) => window.__log.push({ type: 'play-rejected:' + e.name, at: Math.round(performance.now()) }));
      return result;
    };
  });
  ctx.__state = state;
  return ctx;
}

function watch(page, bucket) {
  page.on('pageerror', (e) => bucket.errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'warning' && m.text().includes('[vch-shell]')) bucket.warnings.push(m.text()); });
  page.on('request', (r) => { if (r.isNavigationRequest() && r.frame() === page.mainFrame()) bucket.documents.push(new URL(r.url()).pathname + new URL(r.url()).search); });
}

// ---- page helpers -----------------------------------------------------------------------------------------------
const snap = (page) => page.evaluate(() => {
  const a = window.vchShell && window.vchShell.radio.audio;
  return {
    shell: !!window.vchShell,
    docId: window.__docId,
    paused: a ? a.paused : null,
    t: a ? a.currentTime : null,
    src: a ? (a.currentSrc || a.src || '').split('/').pop() : null,
    audios: window.__audios ? window.__audios.length : null,
    log: window.__log ? window.__log.slice() : [],
    path: location.pathname + location.search,
    title: document.title,
    scrollY: Math.round(window.scrollY),
    radioButtons: document.querySelectorAll('[data-vch-radio]').length,
  };
});

async function ready(page) {
  await page.waitForFunction(() => window.vchShell && window.vchShell.radio.audio.src, null, { timeout: 15000 });
}

/** Click (or tap) the first VISIBLE link to `p`; open the mobile menu first when none is visible. */
async function go(page, p, { tap = false } = {}) {
  const find = () => page.$$eval('a[href]', (as, want) => as
    .map((a, i) => ({ i, ok: new URL(a.href).pathname === want, vis: !!(a.offsetWidth || a.offsetHeight) && getComputedStyle(a).visibility !== 'hidden' }))
    .filter((x) => x.ok), p);
  // On a phone the menu lives behind the burger: open it like a visitor would (it closes again with every page swap).
  const burger = page.locator('[aria-label="Toggle menu"], #burger').first();
  const burgerShown = (await burger.count()) && (await burger.isVisible());
  if (tap && burgerShown && (await burger.getAttribute('aria-expanded')) !== 'true') { await burger.tap(); await sleep(250); }
  let found = await find();
  if (!found.some((x) => x.vis) && burgerShown) {
    await (tap ? burger.tap() : burger.click()); await sleep(250); found = await find();
  }
  const target = found.find((x) => x.vis) || found[0];
  if (!target) throw new Error('no link to ' + p + ' on ' + page.url());
  const link = page.locator('a[href]').nth(target.i);
  if (target.vis) { if (tap) await link.tap({ timeout: 4000 }); else await link.click({ timeout: 4000 }); }
  else await link.evaluate((a) => a.click());
  await page.waitForFunction((want) => location.pathname === want, p, { timeout: 10000 });
  await sleep(350); // static pages finish their scripts a moment after the swap
}

const SECTIONS = [
  ['/vicecityhub/document.html', 'React'], ['/vicecityhub/community.html', 'React'], ['/vicecityhub/market.html', 'React'],
  ['/vicecityhub/realestate.html', 'React'], ['/vicecityhub/rp.html', 'React'], ['/vicecityhub/agents.html', 'React'],
  ['/vicecityhub/highlights.html', 'React'], ['/vicecityhub/index.html', 'React'], ['/vicecityhub/news.html', 'React'],
  ['/vicecityhub/n/', 'static'], ['/vicecityhub/gta-6-release-date/', 'static'], ['/vicecityhub/vehicles/', 'static'],
  ['/vicecityhub/supporters/', 'static'], ['/vicecityhub/alley/', 'static'], ['/vicecityhub/is-gta-6-out-yet/', 'static'],
  ['/vicecityhub/news.html', 'React'],
];

const bucket = () => ({ errors: [], warnings: [], documents: [] });
const longTrackPlaying = (s) => s.src && s.src !== 'short.wav';
const eventsOf = (s, from, ...types) => s.log.slice(from).filter((e) => types.includes(e.type));

// ---- scenarios --------------------------------------------------------------------------------------------------
async function scenarioTour(browser, { mobile }) {
  const label = mobile ? 'mobile (touch)' : 'desktop';
  const state = {};
  const ctx = await newContext(browser, { mobile, state });
  const page = await ctx.newPage();
  const seen = bucket();
  watch(page, seen);
  await page.goto(BASE + 'news.html');
  await ready(page);
  await sleep(800);
  let s = await snap(page);
  check(`[${label}] autoplay is blocked before the first touch (browser policy in effect)`, s.paused === true, JSON.stringify(s.log.map((e) => e.type)));
  check(`[${label}] shell is present and the radio button is marked`, s.shell && s.radioButtons === 1, `buttons=${s.radioButtons}`);
  const docId = s.docId;

  if (mobile) await page.touchscreen.tap(60, 500); else await page.mouse.click(40, 500);
  await page.waitForFunction(() => !window.vchShell.radio.audio.paused && window.vchShell.radio.audio.currentTime > 0.2, null, { timeout: 8000 }).catch(() => {});
  s = await snap(page);
  check(`[${label}] the FIRST touch starts the music`, s.paused === false && s.t > 0, `paused=${s.paused} t=${s.t}`);

  const start = { src: s.src, t: s.t, logLen: s.log.length, docs: seen.documents.length };
  let prev = s;
  let worst = 0;
  for (const [p, kind] of SECTIONS) {
    const t0 = Date.now();
    await go(page, p, { tap: mobile });
    worst = Math.max(worst, Date.now() - t0);
    const now = await snap(page);
    const ok = now.docId === docId && now.paused === false && now.src === start.src && now.t >= prev.t && now.audios === 1
      && eventsOf(now, start.logLen, 'pause', 'emptied', 'loadstart', 'error').length === 0 && now.radioButtons === 1;
    check(`[${label}] -> ${p} (${kind}): same document, same <audio>, still playing, no pause/reload`, ok,
      ok ? '' : JSON.stringify({ docSame: now.docId === docId, paused: now.paused, src: now.src, t: [prev.t, now.t], audios: now.audios, events: eventsOf(now, start.logLen, 'pause', 'emptied', 'loadstart', 'error'), buttons: now.radioButtons }));
    prev = now;
  }
  check(`[${label}] ${SECTIONS.length} section changes made no new document request`, seen.documents.length === start.docs, JSON.stringify(seen.documents.slice(start.docs)));
  check(`[${label}] the music kept advancing (not restarted)`, prev.t > start.t + 1, `t ${start.t.toFixed?.(2)} -> ${prev.t.toFixed?.(2)}`);
  console.log(`      slowest soft navigation (click to settled, includes fixed waits): ${worst} ms`);

  // back / forward through the whole tour
  const trail = [];
  for (let i = 0; i < 6; i++) {
    await page.goBack();
    await sleep(450);
    trail.push((await snap(page)).path);
  }
  const expected = SECTIONS.slice(0, -1).reverse().slice(0, 6).map(([p]) => p);
  s = await snap(page);
  check(`[${label}] browser Back x6 walks the same sections in place`, JSON.stringify(trail) === JSON.stringify(expected), `${trail.join(' | ')}`);
  check(`[${label}] back/forward: same document, still playing, one <audio>`, s.docId === docId && s.paused === false && s.src === start.src && s.audios === 1 && eventsOf(s, start.logLen, 'pause', 'emptied', 'loadstart').length === 0,
    JSON.stringify({ paused: s.paused, src: s.src, audios: s.audios, ev: eventsOf(s, start.logLen, 'pause', 'emptied', 'loadstart') }));
  for (let i = 0; i < 3; i++) { await page.goForward(); await sleep(450); }
  s = await snap(page);
  check(`[${label}] browser Forward works too`, s.path === SECTIONS[SECTIONS.length - 1 - 6 + 3][0] && s.docId === docId && s.paused === false, s.path);
  check(`[${label}] still no new document after all that history walking`, seen.documents.length === start.docs, JSON.stringify(seen.documents.slice(start.docs)));

  // <head> hygiene on the page we ended on
  const head = await page.evaluate(() => ({
    canonical: [...document.querySelectorAll('link[rel="canonical"]')].map((l) => l.href),
    desc: document.querySelectorAll('meta[name="description"]').length,
    staged: document.querySelectorAll('link[media="print"]').length,
    progress: document.querySelectorAll('#vch-nav-progress').length,
    ld: document.querySelectorAll('script[type="application/ld+json"]').length,
    preloads: document.querySelectorAll('link[rel="modulepreload"]').length,
    styles: document.querySelectorAll('style').length,
    url: location.href,
  }));
  check(`[${label}] <head> stays clean: one canonical for THIS page, one description, no leftovers`,
    head.canonical.length === 1 && head.canonical[0] === head.url.replace(/[?#].*$/, '') && head.desc === 1 && head.staged === 0 && head.progress <= 1 && head.preloads < 14, JSON.stringify(head));
  check(`[${label}] no page errors`, seen.errors.length === 0, seen.errors.slice(0, 3).join(' || '));
  check(`[${label}] shell raised no fallback warnings`, seen.warnings.length === 0, seen.warnings.slice(0, 2).join(' || '));
  check(`[${label}] one muz listing request for the whole tour`, state.listCalls <= 1, `calls=${state.listCalls}`);
  await ctx.close();
}

async function scenarioTrackEnd(browser) {
  const state = { muz: TRACKS };
  const ctx = await newContext(browser, { state });
  const page = await ctx.newPage();
  const seen = bucket();
  watch(page, seen);
  await page.goto(BASE + 'robots.txt');
  await page.evaluate(([tracks, base]) => {
    localStorage.setItem('radioTracks', JSON.stringify(tracks.map((n) => base + n)));
    localStorage.setItem('radioTrackIndex', '0');
    localStorage.setItem('radioTime', '0');
  }, [TRACKS, MUZ]);
  await page.goto(BASE + 'news.html');
  await ready(page);
  await page.mouse.click(40, 500);
  const touchAt = await page.evaluate(() => performance.now());
  await page.waitForFunction(() => !window.vchShell.radio.audio.paused, null, { timeout: 8000 }).catch(() => {});
  let s = await snap(page);
  check('[track end] starts with the 4 s test track', s.src === 'short.wav' && s.paused === false, `${s.src} paused=${s.paused}`);
  const docId = s.docId;
  for (const p of ['/vicecityhub/community.html', '/vicecityhub/n/', '/vicecityhub/market.html']) await go(page, p);
  await page.waitForFunction(() => window.__log.some((e) => e.type === 'ended'), null, { timeout: 12000 }).catch(() => {});
  await sleep(1200);
  s = await snap(page);
  const ended = s.log.filter((e) => e.type === 'ended').length;
  check('[track end] the track ended while the visitor was moving between sections', ended === 1, `ended=${ended}`);
  check('[track end] a DIFFERENT random track started by itself (no gesture), in the same document', longTrackPlaying(s) && s.paused === false && s.docId === docId && s.audios === 1, `${s.src} paused=${s.paused}`);
  const rejected = s.log.filter((e) => String(e.type).startsWith('play-rejected') && e.at > touchAt);
  check('[track end] no play() was rejected after the first touch', rejected.length === 0, JSON.stringify(rejected));
  await ctx.close();
}

async function scenarioMute(browser) {
  const state = {};
  const ctx = await newContext(browser, { state });
  const page = await ctx.newPage();
  const seen = bucket();
  watch(page, seen);
  await page.goto(BASE + 'news.html');
  await ready(page);
  await page.mouse.click(40, 500);
  await page.waitForFunction(() => !window.vchShell.radio.audio.paused, null, { timeout: 8000 }).catch(() => {});
  await page.locator('[data-vch-radio]').click();
  await sleep(300);
  let s = await snap(page);
  const muted = await page.evaluate(() => sessionStorage.getItem('radioPlaying'));
  check('[mute] the radio button pauses and remembers the mute', s.paused === true && muted === 'false', `paused=${s.paused} radioPlaying=${muted}`);
  await go(page, '/vicecityhub/market.html');
  await page.mouse.click(40, 500); // a touch anywhere must NOT undo a deliberate mute
  await sleep(700);
  s = await snap(page);
  check('[mute] after a section change and a touch the radio is STILL muted', s.paused === true, `paused=${s.paused}`);
  const pulsing = await page.locator('[data-vch-radio]').evaluate((b) => b.className.includes('animate-pulse'));
  check('[mute] the new page shows the muted state on its radio button', pulsing === false);
  await page.locator('[data-vch-radio]').click();
  await page.waitForFunction(() => !window.vchShell.radio.audio.paused, null, { timeout: 5000 }).catch(() => {});
  await page.waitForFunction(() => document.querySelector('[data-vch-radio]').className.includes('animate-pulse'), null, { timeout: 3000 }).catch(() => {});
  s = await snap(page);
  const pulsingOn = await page.locator('[data-vch-radio]').evaluate((b) => b.className.includes('animate-pulse'));
  check('[mute] the button turns it back on and the button shows it', s.paused === false && pulsingOn === true, `paused=${s.paused} pulse=${pulsingOn}`);
  await ctx.close();
}

async function scenarioScroll(browser) {
  const state = {};
  const ctx = await newContext(browser, { state });
  const page = await ctx.newPage();
  const seen = bucket();
  watch(page, seen);
  await page.goto(BASE + 'vehicles/');
  await ready(page);
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }));
  await sleep(200);
  const before = (await snap(page)).scrollY;
  await page.locator('a[href]').evaluateAll((as) => { const a = as.find((x) => new URL(x.href).pathname === '/vicecityhub/supporters/'); a.click(); });
  await page.waitForFunction(() => location.pathname === '/vicecityhub/supporters/', null, { timeout: 10000 });
  await sleep(350);
  const top = (await snap(page)).scrollY;
  check('[scroll] a new page starts at the top', top === 0, `scrollY=${top}`);
  await page.goBack();
  await sleep(600);
  const back = (await snap(page)).scrollY;
  check('[scroll] Back restores the scroll position of the page', Math.abs(back - before) <= 4 && before > 100, `before=${before} after=${back}`);
  check('[scroll] none of that was a document load', seen.documents.length === 1, JSON.stringify(seen.documents));
  await ctx.close();
}

async function scenarioLinks(browser) {
  const state = {};
  const ctx = await newContext(browser, { state });
  const page = await ctx.newPage();
  const seen = bucket();
  watch(page, seen);
  await page.goto(BASE + 'news.html');
  await ready(page);
  const docId = (await snap(page)).docId;

  // ctrl+click opens a tab; the page must stay
  const popup = ctx.waitForEvent('page', { timeout: 5000 }).catch(() => null);
  const link = page.locator('a[href]').filter({ has: page.locator('xpath=self::*') }).first();
  await page.locator('a[href$="market.html"]').first().evaluate((a) => a.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true, button: 0 })));
  const tab = await popup;
  const s = await snap(page);
  check('[links] ctrl+click is left to the browser (stays on the page, no swap)', s.docId === docId && s.path === '/vicecityhub/news.html', `${s.path}`);
  if (tab) await tab.close().catch(() => {});
  void link;

  // the same page again: no reload, no new entry
  const hist = await page.evaluate(() => history.length);
  await page.locator('a[href="./news.html"], a[href$="/news.html"]').first().evaluate((a) => a.click());
  await sleep(300);
  const s2 = await snap(page);
  const hist2 = await page.evaluate(() => history.length);
  check('[links] a link to the page you are on neither reloads nor adds history', s2.docId === docId && hist2 === hist, `history ${hist} -> ${hist2}`);

  // a link the browser must handle itself: an external one
  const external = await page.evaluate(() => { const a = [...document.querySelectorAll('a[href^="http"]')].find((x) => new URL(x.href).origin !== location.origin); return a ? a.href : null; });
  check('[links] the page has external links to test with', !!external);
  if (external) {
    const prevented = await page.evaluate((href) => {
      const a = [...document.querySelectorAll('a[href]')].find((x) => x.href === href);
      let blocked = false;
      document.addEventListener('click', (e) => { blocked = e.defaultPrevented; e.preventDefault(); }, { once: true });
      a.click();
      return blocked;
    }, external);
    check('[links] an external link is not intercepted by the shell', prevented === false, String(prevented));
  }
  check('[links] programmatic navigate() (used by Community/Post pages) swaps in place', await (async () => {
    await page.evaluate(() => window.vchShell.navigate('./post.html?id=1'));
    await page.waitForFunction(() => location.pathname.endsWith('/post.html'), null, { timeout: 8000 });
    const x = await snap(page);
    return x.docId === docId && x.path === '/vicecityhub/post.html?id=1';
  })());
  check('[links] refresh() re-renders in place (what location.reload() used to do)', await (async () => {
    const mount = await page.evaluate(() => document.getElementById('root') && document.getElementById('root').children.length);
    await page.evaluate(() => window.vchShell.refresh());
    await sleep(700);
    const x = await snap(page);
    return x.docId === docId && x.path === '/vicecityhub/post.html?id=1' && mount > 0;
  })());
  check('[links] no page errors', seen.errors.length === 0, seen.errors.slice(0, 3).join(' || '));
  await ctx.close();
}

async function scenarioFallback(browser) {
  const state = {};
  const ctx = await newContext(browser, { state });
  const page = await ctx.newPage();
  const seen = bucket();
  watch(page, seen);
  await page.goto(BASE + 'news.html');
  await ready(page);
  const docId = (await snap(page)).docId;
  state.failFetch.add('/vicecityhub/market.html'); // the in-page fetch fails; a real navigation still works
  await page.locator('a[href$="market.html"]').first().evaluate((a) => a.click());
  await page.waitForFunction(() => location.pathname.endsWith('/market.html'), null, { timeout: 10000 });
  await ready(page);
  const s = await snap(page);
  check('[fallback] when the in-page fetch fails the link still works as a normal navigation', s.docId !== docId && s.path === '/vicecityhub/market.html', `${s.path} docSame=${s.docId === docId}`);
  check('[fallback] the shell reported why', seen.warnings.some((w) => w.includes('soft navigation failed')), seen.warnings.join(' | '));
  await ctx.close();
}

async function scenarioKillSwitch(browser) {
  const state = {};
  const ctx = await newContext(browser, { state });
  const page = await ctx.newPage();
  const seen = bucket();
  watch(page, seen);
  await page.goto(BASE + 'news.html?softnav=off');
  await ready(page);
  await page.mouse.click(40, 500);
  await page.waitForFunction(() => !window.vchShell.radio.audio.paused, null, { timeout: 8000 }).catch(() => {});
  const first = await snap(page);
  await page.locator('a[href$="market.html"]').first().evaluate((a) => a.click());
  await page.waitForFunction(() => location.pathname.endsWith('/market.html'), null, { timeout: 10000 });
  await ready(page);
  const hard = await snap(page);
  check('[kill switch] ?softnav=off loads a new document per section (the old behaviour)', hard.docId !== first.docId, '');
  // Chrome may carry a user activation over a same-origin link click, iOS Safari does not: a document that arrives WITHOUT
  // a touch inside it (here: opened by address) is what a phone user sees after a section change in the old design.
  await page.goto(BASE + 'agents.html');
  await ready(page);
  await sleep(1200);
  const s = await snap(page);
  check('[kill switch] a fresh document is silent until the next touch (the reported bug, so this harness would have caught it)', s.paused === true, `paused=${s.paused}`);
  await page.mouse.click(40, 500);
  await page.waitForFunction(() => !window.vchShell.radio.audio.paused, null, { timeout: 8000 }).catch(() => {});
  const s2 = await snap(page);
  check('[kill switch] one more touch starts it again (saved track and position restored)', s2.paused === false && s2.src === first.src, `${s2.src} vs ${first.src}`);
  await ctx.close();
}

// ---- run --------------------------------------------------------------------------------------------------------
// user-gesture-required:              every NEW <audio> element needs its own touch (what iOS Safari and many in-app
//                                     browsers do), so a document reload silences the music until the next touch;
// document-user-activation-required:  one touch per document (desktop Chrome also carries it over same-origin navigations).
const POLICIES = process.env.E2E_POLICY ? [process.env.E2E_POLICY] : ['user-gesture-required', 'document-user-activation-required'];
const only = process.env.E2E_ONLY;
for (const policy of POLICIES) {
  const browser = await chromium.launch({ args: [`--autoplay-policy=${policy}`, '--mute-audio'] });
  const scenarios = [
    ['desktop tour', () => scenarioTour(browser, { mobile: false })],
    ['mobile tour', () => scenarioTour(browser, { mobile: true })],
    ['track end', () => scenarioTrackEnd(browser)],
    ['mute', () => scenarioMute(browser)],
    ['scroll', () => scenarioScroll(browser)],
    ['links', () => scenarioLinks(browser)],
    ['fallback', () => scenarioFallback(browser)],
  ];
  if (policy === 'user-gesture-required') scenarios.push(['kill switch', () => scenarioKillSwitch(browser)]);
  for (const [name, run] of scenarios) {
    if (only && !name.includes(only)) continue;
    console.log(`\n== [${policy}] ${name}`);
    try { await run(); } catch (err) { failures++; console.log(`FAIL  ${name} crashed  -> ${err && err.message ? err.message.split('\n')[0] : err}`); }
  }
  await browser.close();
}
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
process.exitCode = failures ? 1 : 0;
