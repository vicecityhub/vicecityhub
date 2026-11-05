// Characterization of the news card markup (initial server render): ribbon, tag, stars, gallery, text, toggle and footer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderTsx } from './helpers/renderTsx.mjs';

// NewsCard is a named export; render it through a tiny default-export entry placed next to it.
import { writeFileSync as w, rmSync } from "node:fs";
const ENTRY = 'src/components/news/_card_entry.tsx';
const base = { id: 1, created_at: '2026-05-01T00:00:00Z', type: 'news', title: 'The Title', body: 'The full body', author_name: 'Op' };
async function card(item, isExpanded = false) {
  w(new URL('../' + ENTRY, import.meta.url), "import { NewsCard } from './NewsCard';\nexport default NewsCard;\n");
  try { return await renderTsx(ENTRY, { item: { ...base, ...item }, isExpanded, onToggle() {} }); }
  finally { rmSync(new URL('../' + ENTRY, import.meta.url), { force: true }); }
}
const count = (html, re) => (html.match(re) || []).length;

test('plain card: community tag, no ribbon, no stars, no gallery, no source link; preview + Read More', async () => {
  const h = await card({ summary: 'Short preview' });
  assert.match(h, />Community</);
  assert.doesNotMatch(h, /Featured/);
  assert.doesNotMatch(h, /Importance:/);
  assert.doesNotMatch(h, /<img/);
  assert.match(h, /Short preview/);
  assert.doesNotMatch(h, /The full body/);
  assert.match(h, /Read More ▼/);
  assert.match(h, /line-clamp-4 md:line-clamp-6/);
  assert.match(h, /min-h-\[250px\]/);
  assert.match(h, /Operator: <span class="text-neonCyan">Op<\/span>/);
  assert.doesNotMatch(h, /ExternalLink|target="_blank"/);
});

test('expanded card shows the whole body, a Collapse toggle and the scroll box', async () => {
  const h = await card({ summary: 'Short preview' }, true);
  assert.match(h, /The full body/);
  assert.doesNotMatch(h, /Short preview/);
  assert.match(h, /Collapse ▲/);
  assert.match(h, /max-height:38vh;overflow-y:auto/);
  assert.match(h, /min-h-0 overflow-visible/);
  assert.doesNotMatch(h, /line-clamp/);
});

test('without a summary the collapsed card previews the body', async () => {
  assert.match(await card({ summary: '  ' }), /The full body/);
});

test('featured: ribbon, orange border and top margin', async () => {
  const h = await card({ is_featured: true });
  assert.match(h, /Featured/);
  assert.match(h, /border-neonOrange\/50/);
  assert.match(h, /<div class="mt-5">/);
  const plain = await card({});
  assert.match(plain, /border-white\/5/);
  assert.match(plain, /<div class="">/);
});

test('stars: five icons, filled up to the rating, with a title', async () => {
  const h = await card({ meta: { stars: 3 } });
  assert.match(h, /title="Importance: 3\/5"/);
  assert.equal(count(h, /text-neonOrange fill-neonOrange/g), 3);
  assert.equal(count(h, /text-gray-700/g), 2);
});

test('tag decides the badge colours', async () => {
  for (const [category, cls] of [['Official', /text-green-400/], ['Leaks', /text-neonPink/], ['Rumors', /text-neonOrange/], ['Whatever', /text-neonCyan/]]) {
    const h = await card({ category });
    assert.match(h, cls, category);
    assert.match(h, new RegExp(`>${category}<`));
  }
});

test('gallery: 1 / 2 / 3+ columns; collapsed shows three thumbnails, expanded shows all', async () => {
  assert.match(await card({ meta: { images: ['a.png'] } }), /grid-cols-1/);
  assert.match(await card({ meta: { images: ['a.png', 'b.png'] } }), /grid-cols-2/);
  const five = { meta: { images: ['1', '2', '3', '4', '5'].map((n) => `${n}.png`) } };
  const collapsed = await card(five);
  assert.match(collapsed, /grid-cols-3/);
  assert.equal(count(collapsed, /<img/g), 3);
  assert.equal(count(await card(five, true), /<img/g), 5);
  assert.match(collapsed, /href="1\.png" target="_blank" rel="noopener noreferrer"/);
  assert.match(collapsed, /loading="lazy"/);
});

test('source link: labelled with the host, SOURCE when it is not a URL', async () => {
  const h = await card({ source_url: 'https://www.example.com/story' });
  assert.match(h, /href="https:\/\/www\.example\.com\/story" target="_blank" rel="noopener noreferrer"/);
  assert.match(h, />EXAMPLE\.COM </);
  assert.match(await card({ source_url: 'not a url' }), />SOURCE </);
});

test('the date is the locale date of created_at', async () => {
  assert.ok((await card({})).includes(new Date('2026-05-01T00:00:00Z').toLocaleDateString()));
});
