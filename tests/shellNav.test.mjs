// The rules of the soft (no-reload) navigation: which click becomes an in-page swap, which entry a back/forward press
// swaps, which <head> elements belong to a page. Pure functions, no DOM: src/shell/navRules.ts.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashId, isHtmlContentType, isManagedHeadElement, isPagePath, pageKey, planHeadMerge, popAction, softNavSwitch, softTarget,
} from '../src/shell/navRules.ts';

const BASE = '/vicecityhub/';
const HERE = 'https://vicecityhub.github.io/vicecityhub/news.html';
const SITE = 'https://vicecityhub.github.io';
const click = (over = {}) => ({ button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false, ...over });
const go = (href, link = {}, ev = {}, here = HERE) => softTarget({ href, ...link }, click(ev), here, BASE);
const soft = url => ({ kind: 'soft', url });

// ---- which paths are pages -------------------------------------------------------------------------------------

test('isPagePath: directories, .html files and extensionless paths are pages; files and .well-known are not', () => {
  for (const p of ['/vicecityhub/', '/vicecityhub/news.html', '/vicecityhub/rp/index.htm', '/vicecityhub/vehicles', '/vicecityhub/n/4372-some-story/'])
    assert.equal(isPagePath(p), true, p);
  for (const p of ['/vicecityhub/feed.xml', '/vicecityhub/llms.txt', '/vicecityhub/data/news.json', '/vicecityhub/assets/js/x.js', '/vicecityhub/x.PDF', '/vicecityhub/.well-known/security.txt', '/vicecityhub/.well-known/mcp/server-card.json'])
    assert.equal(isPagePath(p), false, p);
});

test('pageKey: index.html folds into its directory, the query counts, the hash never does', () => {
  assert.equal(pageKey(`${SITE}/vicecityhub/index.html`), '/vicecityhub/');
  assert.equal(pageKey(`${SITE}/vicecityhub/`), '/vicecityhub/');
  assert.equal(pageKey(`${SITE}/vicecityhub/vehicles/index.html?x=1#top`), '/vicecityhub/vehicles/?x=1');
  assert.equal(pageKey(`${SITE}/vicecityhub/news.html#a`), '/vicecityhub/news.html');
  assert.equal(pageKey(`${SITE}/vicecityhub/post.html?id=7`), '/vicecityhub/post.html?id=7');
});

test('pageKey: only a file NAMED index.html folds (myindex.html is another page)', () => {
  assert.equal(pageKey(`${SITE}/vicecityhub/myindex.html`), '/vicecityhub/myindex.html');
  assert.notEqual(pageKey(`${SITE}/vicecityhub/myindex.html`), pageKey(`${SITE}/vicecityhub/my`));
});

// ---- which clicks are soft --------------------------------------------------------------------------------------

test('softTarget: links to other pages of the site are soft, whatever way the href is written', () => {
  assert.deepEqual(go('market.html'), soft(`${SITE}/vicecityhub/market.html`));
  assert.deepEqual(go('/vicecityhub/rp.html'), soft(`${SITE}/vicecityhub/rp.html`));
  assert.deepEqual(go('/vicecityhub/vehicles/'), soft(`${SITE}/vicecityhub/vehicles/`));
  assert.deepEqual(go('/vicecityhub/vehicles'), soft(`${SITE}/vicecityhub/vehicles`));
  assert.deepEqual(go('https://vicecityhub.github.io/vicecityhub/community.html'), soft(`${SITE}/vicecityhub/community.html`));
  assert.deepEqual(go('../vicecityhub/agents.html'), soft(`${SITE}/vicecityhub/agents.html`));
  assert.deepEqual(go('/vicecityhub/'), soft(`${SITE}/vicecityhub/`));
});

test('softTarget: the query and the hash of the target are kept', () => {
  assert.deepEqual(go('post.html?id=5'), soft(`${SITE}/vicecityhub/post.html?id=5`));
  assert.deepEqual(go('market.html#domains'), soft(`${SITE}/vicecityhub/market.html#domains`));
  assert.deepEqual(go('/vicecityhub/rp.html?tab=servers#top'), soft(`${SITE}/vicecityhub/rp.html?tab=servers#top`));
});

test('softTarget: a link to the page that is already open scrolls to the top (same), it never reloads', () => {
  assert.deepEqual(go('news.html'), { kind: 'same' });
  assert.deepEqual(go('/vicecityhub/news.html'), { kind: 'same' });
  assert.deepEqual(go('/vicecityhub/', {}, {}, `${SITE}/vicecityhub/index.html`), { kind: 'same' });
  assert.deepEqual(go('index.html', {}, {}, `${SITE}/vicecityhub/`), { kind: 'same' });
  assert.deepEqual(go('./', {}, {}, `${SITE}/vicecityhub/`), { kind: 'same' });
});

test('softTarget: an #anchor of the open page is left to the browser (it scrolls natively)', () => {
  assert.equal(go('#top'), null);
  assert.equal(go('news.html#archive'), null);
  assert.equal(go('/vicecityhub/news.html#archive'), null);
});

test('softTarget: the same path with another query is another page (post.html?id=1 -> ?id=2)', () => {
  const here = `${SITE}/vicecityhub/post.html?id=1`;
  assert.deepEqual(go('post.html?id=2', {}, {}, here), soft(`${SITE}/vicecityhub/post.html?id=2`));
  assert.deepEqual(go('post.html?id=1', {}, {}, here), { kind: 'same' });
});

test('softTarget: modifier keys, other buttons and handled clicks stay with the browser', () => {
  for (const ev of [{ button: 1 }, { button: 2 }, { metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { defaultPrevented: true }])
    assert.equal(go('market.html', {}, ev), null, JSON.stringify(ev));
});

test('softTarget: new tabs, downloads, external links and opt-outs stay with the browser', () => {
  assert.equal(go('market.html', { target: '_blank' }), null);
  assert.equal(go('market.html', { target: 'somewindow' }), null);
  assert.deepEqual(go('market.html', { target: '_self' }), soft(`${SITE}/vicecityhub/market.html`));
  assert.deepEqual(go('market.html', { target: '' }), soft(`${SITE}/vicecityhub/market.html`));
  assert.equal(go('market.html', { download: true }), null);
  assert.equal(go('market.html', { hard: true }), null);
  assert.equal(go('market.html', { rel: 'external' }), null);
  assert.equal(go('market.html', { rel: 'noopener External' }), null);
  assert.deepEqual(go('market.html', { rel: 'noopener noreferrer' }), soft(`${SITE}/vicecityhub/market.html`));
  assert.deepEqual(go('market.html', { rel: 'externally' }), soft(`${SITE}/vicecityhub/market.html`));
});

test('softTarget: other sites, other schemes and paths outside the site never become soft', () => {
  assert.equal(go('https://www.youtube.com/@vicecity_hub'), null);
  assert.equal(go('https://vicecityhub.github.io.evil.example/vicecityhub/news.html'), null);
  assert.equal(go('http://vicecityhub.github.io/vicecityhub/market.html'), null);
  assert.equal(go('mailto:hello@example.com'), null);
  assert.equal(go('tel:+10000000'), null);
  assert.equal(go('javascript:void(0)'), null);
  assert.equal(go('/other-project/index.html'), null);
  assert.equal(go('/vicecityhub'), null); // not under the base path with its trailing slash: the browser decides
  assert.equal(go('/vicecityhubx/news.html'), null);
});

test('softTarget: files are not pages', () => {
  for (const href of ['feed.xml', 'llms.txt', 'data/news.json', 'sitemap.xml', '.well-known/security.txt', 'docs/guide.pdf'])
    assert.equal(go(href), null, href);
});

test('softTarget: missing or unparsable input never throws', () => {
  assert.equal(go(null), null);
  assert.equal(go(undefined), null);
  assert.equal(go('http://'), null);
  assert.equal(go('market.html', {}, {}, 'not a url'), null);
});

// ---- back / forward ---------------------------------------------------------------------------------------------

test('popAction: another path is always swapped', () => {
  assert.equal(popAction(`${SITE}/vicecityhub/news.html`, `${SITE}/vicecityhub/market.html`, false, false), 'swap');
  assert.equal(popAction(`${SITE}/vicecityhub/`, `${SITE}/vicecityhub/rp.html`, true, true), 'swap');
});

test('popAction: index.html and its directory are the same path', () => {
  assert.equal(popAction(`${SITE}/vicecityhub/`, `${SITE}/vicecityhub/index.html`, true, true), 'ignore');
});

test('popAction: a hash-only change is the browser\'s business', () => {
  assert.equal(popAction(`${SITE}/vicecityhub/news.html#a`, `${SITE}/vicecityhub/news.html#b`, true, true), 'ignore');
  assert.equal(popAction(`${SITE}/vicecityhub/news.html`, `${SITE}/vicecityhub/news.html#b`, false, false), 'ignore');
});

test('popAction: same path, another query is swapped only between two entries the shell created', () => {
  const a = `${SITE}/vicecityhub/post.html?id=1`;
  const b = `${SITE}/vicecityhub/post.html?id=2`;
  assert.equal(popAction(a, b, true, true), 'swap');
  // the Market product modal pushes ?p=slug itself and handles its own popstate
  const market = `${SITE}/vicecityhub/market.html`;
  assert.equal(popAction(market, `${market}?p=hoodie`, true, false), 'ignore');
  assert.equal(popAction(`${market}?p=hoodie`, market, false, true), 'ignore');
  assert.equal(popAction(`${market}?p=a`, `${market}?p=b`, false, false), 'ignore');
});

// ---- responses and hashes ---------------------------------------------------------------------------------------

test('isHtmlContentType: only HTML documents may be swapped in', () => {
  for (const ct of ['text/html', 'text/html; charset=utf-8', 'TEXT/HTML;charset=UTF-8', 'application/xhtml+xml']) assert.equal(isHtmlContentType(ct), true, ct);
  for (const ct of ['text/plain', 'application/json', 'application/octet-stream', 'text/htmlx', 'image/png', '', null]) assert.equal(isHtmlContentType(ct), false, String(ct));
});

test('hashId: the element id a hash points at, decoded; empty when there is none or it cannot be decoded', () => {
  assert.equal(hashId('#top'), 'top');
  assert.equal(hashId('#a%20b'), 'a b');
  assert.equal(hashId('#%D0%BF%D1%80%D0%B8%D0%B2%D0%B5%D1%82'), 'привет');
  for (const bad of ['', '#', '#%E0%A4%A']) assert.equal(hashId(bad), '', JSON.stringify(bad));
});

// ---- the debug switch -------------------------------------------------------------------------------------------

test('softNavSwitch: ?softnav=off|on decide and are remembered, otherwise the remembered choice, default on', () => {
  assert.deepEqual(softNavSwitch('?softnav=off', null), { enabled: false, persist: '0' });
  assert.deepEqual(softNavSwitch('?softnav=off', '1'), { enabled: false, persist: '0' });
  assert.deepEqual(softNavSwitch('?x=1&softnav=on', '0'), { enabled: true, persist: '1' });
  assert.deepEqual(softNavSwitch('', null), { enabled: true, persist: null });
  assert.deepEqual(softNavSwitch('', '1'), { enabled: true, persist: null });
  assert.deepEqual(softNavSwitch('', '0'), { enabled: false, persist: null });
  assert.deepEqual(softNavSwitch('?softnav=maybe', '0'), { enabled: false, persist: null });
});

// ---- <head> merge -----------------------------------------------------------------------------------------------

test('isManagedHeadElement: what describes the page is replaced with it', () => {
  assert.equal(isManagedHeadElement('style', {}), true);
  assert.equal(isManagedHeadElement('script', { type: 'application/ld+json' }), true);
  assert.equal(isManagedHeadElement('SCRIPT', { type: 'Application/LD+JSON' }), true);
  assert.equal(isManagedHeadElement('meta', { name: 'description' }), true);
  assert.equal(isManagedHeadElement('meta', { property: 'og:title' }), true);
  assert.equal(isManagedHeadElement('meta', { 'http-equiv': 'refresh' }), true);
  assert.equal(isManagedHeadElement('meta', { itemprop: 'name' }), true);
  for (const rel of ['stylesheet', 'canonical', 'alternate', 'modulepreload', 'api-catalog', 'service-desc', 'alternate stylesheet'])
    assert.equal(isManagedHeadElement('link', { rel }), true, rel);
});

test('isManagedHeadElement: fonts, icons, charset, viewport and foreign scripts stay where they are', () => {
  assert.equal(isManagedHeadElement('meta', { charset: 'utf-8' }), false);
  assert.equal(isManagedHeadElement('meta', { name: 'viewport' }), false);
  assert.equal(isManagedHeadElement('meta', { name: 'ViewPort' }), false);
  assert.equal(isManagedHeadElement('meta', {}), false);
  assert.equal(isManagedHeadElement('script', { type: 'module' }), false);
  assert.equal(isManagedHeadElement('script', {}), false);
  assert.equal(isManagedHeadElement('title', {}), false);
  assert.equal(isManagedHeadElement('base', {}), false);
  for (const rel of ['icon', 'apple-touch-icon', 'preconnect', 'dns-prefetch', 'preload', ''])
    assert.equal(isManagedHeadElement('link', { rel }), false, JSON.stringify(rel));
  assert.equal(isManagedHeadElement('link', {}), false);
});

test('planHeadMerge: unchanged elements stay (no flicker), old ones go, new ones come, duplicates once', () => {
  assert.deepEqual(planHeadMerge(['a', 'b', 'c'], ['b', 'c', 'd']), { remove: ['a'], add: ['d'] });
  assert.deepEqual(planHeadMerge(['a', 'b'], ['a', 'b']), { remove: [], add: [] });
  assert.deepEqual(planHeadMerge([], ['x', 'y', 'x']), { remove: [], add: ['x', 'y'] });
  assert.deepEqual(planHeadMerge(['x', 'y'], []), { remove: ['x', 'y'], add: [] });
  assert.deepEqual(planHeadMerge([], []), { remove: [], add: [] });
});
