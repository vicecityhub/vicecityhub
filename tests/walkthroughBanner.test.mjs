// Home page hero: the full-walkthrough banner (it replaced the stream-announcement banner) and the removed release countdown.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync as w, rmSync } from 'node:fs';
import { renderTsx } from './helpers/renderTsx.mjs';

const PLAYLIST = 'https://www.youtube.com/playlist?list=PLChbuGXLVT8w';

// WalkthroughBanner and HeroSection are named exports; render them through a tiny default-export entry placed next to them.
async function render(name, props = {}) {
  const entry = `src/components/home/_${name.toLowerCase()}_entry.tsx`;
  w(new URL('../' + entry, import.meta.url), `import { ${name} } from './${name}';\nexport default ${name};\n`);
  try { return await renderTsx(entry, props); }
  finally { rmSync(new URL('../' + entry, import.meta.url), { force: true }); }
}

test('banner: the poster and the button both open the walkthrough playlist in a new tab, safely', async () => {
  const h = await render('WalkthroughBanner');
  const links = [...h.matchAll(/<a [^>]*>/g)].map((m) => m[0]);
  assert.equal(links.length, 2, 'poster + button, nothing else is clickable');
  for (const a of links) {
    assert.ok(a.includes(`href="${PLAYLIST}"`), a);
    assert.ok(a.includes('target="_blank"') && a.includes('rel="noopener noreferrer"'), a);
  }
});

test('banner: the share link\'s tracking parameter (si=) is not carried over', async () => {
  const h = await render('WalkthroughBanner');
  assert.doesNotMatch(h, /[?&]si=/);
});

test('banner: the button is the one named link, the poster is hidden from keyboard and screen readers', async () => {
  const h = await render('WalkthroughBanner');
  const [poster, button] = [...h.matchAll(/<a [^>]*>/g)].map((m) => m[0]);
  assert.match(poster, /tabindex="-1"/);
  assert.match(poster, /aria-hidden="true"/);
  assert.doesNotMatch(button, /aria-hidden|tabindex/);
  assert.match(h, /Watch the Playlist<span class="sr-only"> \(opens YouTube in a new tab\)<\/span>/);
});

test('banner: nothing third-party loads with the page (no iframe, no image, no URL but the playlist link)', async () => {
  const h = await render('WalkthroughBanner');
  assert.doesNotMatch(h, /<iframe|<img|ytimg|youtube\.com\/embed|youtube-nocookie/i);
  // (the SVG namespace identifier written by the icons is a name, not an address anything is fetched from)
  const urls = new Set((h.match(/https?:\/\/[^"'\s<)]+/g) || []).filter((u) => u !== 'http://www.w3.org/2000/svg'));
  assert.deepEqual([...urls], [PLAYLIST]);
});

test('banner: a named region with the headline, no fake "live" status', async () => {
  const h = await render('WalkthroughBanner');
  assert.match(h, /<section aria-label="GTA 6 story mode full walkthrough"/);
  assert.match(h, /<h2[^>]*>GTA 6 Story Mode <span[^>]*>Full Walkthrough<\/span><\/h2>/);
  assert.doesNotMatch(h, /live now/i);
});

test('banner: the poster is inline SVG whose ids are unique and all its references resolve', async () => {
  const h = await render('WalkthroughBanner');
  const ids = [...h.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length >= 5, 'gradients, mask and palm are defined');
  assert.equal(new Set(ids).size, ids.length, `duplicate id in ${ids.join(', ')}`);
  const refs = [...h.matchAll(/url\(#([^)]+)\)/g), ...h.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length >= 5);
  for (const r of refs) assert.ok(ids.includes(r), `reference to a missing id: ${r}`);
  assert.match(h, /<svg [^>]*aria-hidden="true"/);
});

test('banner: the pulsing ring respects reduced motion', async () => {
  const h = await render('WalkthroughBanner');
  assert.match(h, /animate-ping motion-reduce:animate-none/);
});

test('hero: no countdown any more, the banner sits between the intro text and the buttons', async () => {
  const h = await render('HeroSection', { onOpenModal() {} });
  const at = (s) => h.indexOf(s);
  assert.doesNotMatch(h, /countdown|cd-unit|cd-num|cd-lbl/i);
  assert.doesNotMatch(h, />(Days|Hours|Mins|Secs)</);
  assert.ok(at('<h1') > -1 && at('<h1') < at(PLAYLIST), 'banner comes after the headline');
  assert.ok(at(PLAYLIST) > -1 && at(PLAYLIST) < at('Explore Hub'), 'call-to-action buttons come after the banner');
  assert.ok(at('Explore Hub') < at('Become a Member'));
});

test('hero: the stream announcement is gone (trailer, Twitch button and Twitch icon)', async () => {
  const h = await render('HeroSection', { onOpenModal() {} });
  assert.doesNotMatch(h, /twitch|qL266kKP5E4|stream trailer/i);
});
