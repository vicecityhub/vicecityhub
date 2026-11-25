// Home page hero: the full-walkthrough banner (it replaced the stream-announcement banner) and the removed release countdown.
// The poster is the owner's screenshot from the project's own Supabase Storage, with an iridescent film and a light streak over it;
// the whole banner is one click target to the YouTube playlist.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync as w, rmSync } from 'node:fs';
import { renderTsx } from './helpers/renderTsx.mjs';

const PLAYLIST = 'https://www.youtube.com/playlist?list=PLChbuGXLVT8w';
// as the owner gave it (2026-11-25): a screenshot in the public bucket "design photos"
const POSTER = 'https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/design%20photos/Screenshot%202026-11-25%2000-24-19.png';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

// WalkthroughBanner and HeroSection are named exports; render them through a tiny default-export entry placed next to them.
async function render(name, props = {}) {
  const entry = `src/components/home/_${name.toLowerCase()}_entry.tsx`;
  w(new URL('../' + entry, import.meta.url), `import { ${name} } from './${name}';\nexport default ${name};\n`);
  try { return await renderTsx(entry, props); }
  finally { rmSync(new URL('../' + entry, import.meta.url), { force: true }); }
}

const openTags = (h, tag) => [...h.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'g'))].map((m) => m[0]);
// every address in the markup (the SVG namespace written by the icons is a name, not an address anything is fetched from)
const addressesIn = (h) => new Set((h.match(/https?:\/\/[^"'\s<)]+/g) || []).filter((u) => u !== SVG_NAMESPACE));

/** tailwind.config.js is a CommonJS file in a "type": "module" package: evaluate it on its own, the plugin is not needed here. */
function tailwindConfig() {
  const src = readFileSync(new URL('../tailwind.config.js', import.meta.url), 'utf8');
  const module = { exports: {} };
  new Function('module', 'exports', 'require', src)(module, module.exports, () => ({}));
  return module.exports;
}

test('banner: the whole banner is one click target to the playlist, and the button is the one real link', async () => {
  const h = await render('WalkthroughBanner');
  const links = openTags(h, 'a');
  assert.equal(links.length, 2, 'overlay + button, nothing else is clickable');
  for (const a of links) {
    assert.ok(a.includes(`href="${PLAYLIST}"`), a);
    assert.ok(a.includes('target="_blank"') && a.includes('rel="noopener noreferrer"'), a);
  }
  const [overlay, button] = links;
  // the overlay is empty, covers the whole card and is out of the keyboard and screen-reader way
  assert.match(overlay, /class="absolute inset-0 z-10"/);
  assert.match(overlay, /tabindex="-1"/);
  assert.match(overlay, /aria-hidden="true"/);
  assert.ok(h.includes(`${overlay}</a>`), 'the overlay link has no content of its own');
  // the button sits above the overlay: it is what keyboard users reach and what is announced
  assert.doesNotMatch(button, /aria-hidden|tabindex/);
  assert.match(button, /\bz-20\b/);
});

test('banner: the share link\'s tracking parameter (si=) is not carried over', async () => {
  const h = await render('WalkthroughBanner');
  assert.doesNotMatch(h, /[?&]si=/);
});

test('banner: the button names the link and says that it opens a new tab', async () => {
  const h = await render('WalkthroughBanner');
  assert.match(h, /Watch the Playlist<span class="sr-only"> \(opens YouTube in a new tab\)<\/span>/);
});

test('banner: the poster is the owner\'s screenshot from the project\'s Supabase Storage, sized, decorative and not lazy', async () => {
  const h = await render('WalkthroughBanner');
  const imgs = openTags(h, 'img');
  assert.equal(imgs.length, 1, 'one picture');
  const [img] = imgs;
  assert.ok(img.includes(`src="${POSTER}"`), img);
  assert.match(img, / alt=""/, 'decorative: the heading and the button say what the banner is');
  assert.match(img, / width="\d+"/);
  assert.match(img, / height="\d+"/);
  assert.match(img, / decoding="async"/);
  assert.doesNotMatch(img, /loading="lazy"/, 'it is in the first screen: lazy loading would only delay it');
  assert.match(img, /class="absolute inset-0 h-full w-full object-cover/, 'fills the 16:9 box, so nothing shifts while it loads');
});

test('banner: the picture address is a PUBLIC one of the project\'s own storage (a signed address is a credential and expires)', async () => {
  const [img] = openTags(await render('WalkthroughBanner'), 'img');
  const url = new URL(img.match(/ src="([^"]+)"/)[1]);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.host, 'lpglkglhjdqnktybksth.supabase.co');
  assert.ok(url.pathname.startsWith('/storage/v1/object/public/'), url.pathname);
  assert.equal(url.search, '', 'no token, no query');
});

test('banner: loads nothing from third parties (no iframe, no YouTube thumbnail): only the poster, and the playlist link on click', async () => {
  const h = await render('WalkthroughBanner');
  assert.doesNotMatch(h, /<iframe|ytimg|youtube\.com\/embed|youtube-nocookie/i);
  assert.deepEqual([...addressesIn(h)].sort(), [PLAYLIST, POSTER].sort());
});

test('banner: a named region with the headline, no fake "live" status', async () => {
  const h = await render('WalkthroughBanner');
  assert.match(h, /<section aria-label="GTA 6 story mode full walkthrough"/);
  assert.match(h, /<h2[^>]*>GTA 6 Story Mode <span[^>]*>Full Walkthrough<\/span><\/h2>/);
  assert.doesNotMatch(h, /live now/i);
});

test('banner: the old drawn poster is gone, every icon left in the banner is hidden from screen readers', async () => {
  const h = await render('WalkthroughBanner');
  assert.doesNotMatch(h, /wb-sky|wb-sun|wb-palm|viewBox="0 0 640 360"/);
  const svgs = openTags(h, 'svg');
  assert.ok(svgs.length >= 2, 'play icon and YouTube icon');
  for (const s of svgs) assert.match(s, /aria-hidden="true"/, s);
});

test('banner: iridescence = two decorative layers (colors flowing over the picture, a light streak), click-through and stopped by reduced motion', async () => {
  const h = await render('WalkthroughBanner');
  const layers = [...h.matchAll(/<span aria-hidden="true" class="pointer-events-none[^"]*">/g)];
  assert.equal(layers.length, 2, 'two wrappers, hidden from assistive tech and never in the way of a click');
  assert.match(h, /vch-holo [^"]*animate-vch-holo motion-reduce:animate-none/);
  assert.match(h, /vch-sheen [^"]*animate-vch-sheen motion-reduce:animate-none/);
  // the film blends into the picture only inside the poster box
  assert.match(h, /class="relative isolate w-full /);
  assert.match(h, /mix-blend-overlay/);
});

test('banner: the pulsing ring and the zoom on hover respect reduced motion too', async () => {
  const h = await render('WalkthroughBanner');
  assert.match(h, /animate-ping motion-reduce:animate-none/);
  assert.match(h, /group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100/);
});

test('banner: the animations the layers use exist (tailwind.config.js + index.css), move only transform and loop without a seam', () => {
  const ext = tailwindConfig().theme.extend;
  const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
  for (const name of ['vch-holo', 'vch-sheen']) {
    assert.ok(ext.keyframes[name], `keyframes ${name}`);
    assert.match(ext.animation[name], new RegExp(`^${name} [\\d.]+s .*\\binfinite$`), `animation ${name} repeats`);
    assert.match(css, new RegExp(`\\.${name}\\s*\\{`), `.${name} is defined in index.css`);
    const props = new Set(Object.values(ext.keyframes[name]).flatMap((frame) => Object.keys(frame)));
    assert.deepEqual([...props], ['transform'], `${name} moves only transform (no repaint of the picture)`);
  }
  // the film is two color cycles wide (w-[200%]); a loop shifts it by exactly one cycle = half its width
  assert.equal(ext.keyframes['vch-holo'].from.transform, 'translateX(0)');
  assert.equal(ext.keyframes['vch-holo'].to.transform, 'translateX(-50%)');
  const cycle = css.match(/\.vch-holo\s*\{[^}]*linear-gradient\(([^;]*)\);/s)[1].match(/#[0-9a-f]{6}\s+[\d.]+%/gi);
  const first = cycle.slice(0, 4).map((s) => s.split(/\s+/)[0]);
  const second = cycle.slice(4, 8).map((s) => s.split(/\s+/)[0]);
  assert.deepEqual(first, second, 'the second half of the film repeats the first');
  assert.equal(cycle[0].split(/\s+/)[0], cycle[cycle.length - 1].split(/\s+/)[0], 'it ends in the color it starts with');
  // the streak waits off the poster when nothing moves (reduced motion)
  assert.match(css, /\.vch-sheen\s*\{[^}]*transform:\s*translateX\(-150%\)/s);
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
