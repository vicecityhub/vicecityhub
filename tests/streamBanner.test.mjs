// Stream trailer banner on the home page: Twitch button, local Twitch icon, click-to-play trailer, and its place above the countdown.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync as w, rmSync } from 'node:fs';
import { renderTsx } from './helpers/renderTsx.mjs';

// StreamBanner and HeroSection are named exports; render them through a tiny default-export entry placed next to them.
async function render(name, props = {}) {
  const entry = `src/components/home/_${name.toLowerCase()}_entry.tsx`;
  w(new URL('../' + entry, import.meta.url), `import { ${name} } from './${name}';\nexport default ${name};\n`);
  try { return await renderTsx(entry, props); }
  finally { rmSync(new URL('../' + entry, import.meta.url), { force: true }); }
}

test('banner: the Twitch button opens the VCH channel in a new tab, safely, with the local Twitch icon', async () => {
  const h = await render('StreamBanner');
  assert.match(h, /<a href="https:\/\/www\.twitch\.tv\/vicecityhub" target="_blank" rel="noopener noreferrer"/);
  assert.match(h, /<img src="\/vicecityhub\/media\/twitch-logo\.jpeg"/);
  assert.match(h, /Watch on Twitch/);
});

test('banner: the trailer is click-to-play (poster only, no YouTube iframe on the first render)', async () => {
  const h = await render('StreamBanner');
  assert.match(h, /qL266kKP5E4/);
  assert.doesNotMatch(h, /<iframe/);
});

test('banner: no fake "LIVE NOW" status (the page cannot know whether the stream is on air)', async () => {
  const h = await render('StreamBanner');
  assert.doesNotMatch(h, /live now/i);
});

test('hero: the banner sits between the intro text and the countdown, the buttons stay after it', async () => {
  const h = await render('HeroSection', { onOpenModal() {} });
  const at = (s) => h.indexOf(s);
  assert.ok(at('<h1') > -1 && at('<h1') < at('qL266kKP5E4'), 'banner comes after the headline');
  assert.ok(at('qL266kKP5E4') < at('id="countdown"'), 'banner comes before the countdown');
  assert.ok(at('id="countdown"') < at('Explore Hub'), 'call-to-action buttons come after the countdown');
});
