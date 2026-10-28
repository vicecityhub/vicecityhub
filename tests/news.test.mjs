import test from 'node:test';
import assert from 'node:assert/strict';
import { NEWS_TAGS, getNewsMeta, dedupeById, filterNews, sortNews, buildFeed, tagKind, getTagStyle, getSourceLabel, previewOf } from '../src/lib/news.ts';

const row = (id, o = {}) => ({ id, created_at: '2026-05-01T00:00:00Z', type: 'news', title: `T${id}`, body: `B${id}`, author_name: `A${id}`, ...o });

test('getNewsMeta: category falls back to Community; blank counts as missing', () => {
  assert.equal(getNewsMeta(row(1)).tag, 'Community');
  assert.equal(getNewsMeta(row(1, { category: '   ' })).tag, 'Community');
  assert.equal(getNewsMeta(row(1, { category: 'Leaks' })).tag, 'Leaks');
});

test('getNewsMeta: source url and featured flag', () => {
  const m = getNewsMeta(row(1, { source_url: 'https://x.test', is_featured: true }));
  assert.equal(m.srcUrl, 'https://x.test'); assert.equal(m.important, true);
  const n = getNewsMeta(row(2));
  assert.equal(n.srcUrl, ''); assert.equal(n.important, false);
});

test('getNewsMeta: stars and images from object or JSON-string meta', () => {
  assert.deepEqual(getNewsMeta(row(1, { meta: { stars: 4, images: ['a', 'b'] } })).stars, 4);
  const m = getNewsMeta(row(1, { meta: '{"stars":"3","images":["a",5,null,"b"]}' }));
  assert.equal(m.stars, 3); assert.deepEqual(m.images, ['a', 'b']);
});

test('getNewsMeta: importance overrides stars when it is a real number, else stars stay', () => {
  assert.equal(getNewsMeta(row(1, { meta: { stars: 2, importance: 5 } })).stars, 5);
  assert.equal(getNewsMeta(row(1, { meta: { stars: 2, importance: 'x' } })).stars, 2);
  assert.equal(getNewsMeta(row(1, { meta: { stars: 'x' } })).stars, 0);
});

test('getNewsMeta: malformed, null, empty or non-object meta never throws and means no stars/images', () => {
  for (const meta of ['{not json', 'null', '', null, undefined, 0, '0', '"str"', 5, true, { images: 'nope' }]) {
    const m = getNewsMeta(row(1, { meta }));
    assert.equal(m.stars, 0, String(meta)); assert.deepEqual(m.images, [], String(meta));
  }
});

test('dedupeById keeps the first row of each id and preserves order', () => {
  const out = dedupeById([row(1), row(2, { title: 'first 2' }), row(2, { title: 'dup 2' }), row(3), row(1, { title: 'dup 1' })]);
  assert.deepEqual(out.map(r => r.id), [1, 2, 3]); assert.equal(out[1].title, 'first 2');
});

test('filterNews: tag is case-insensitive, All shows everything, uncategorised rows are Community', () => {
  const rows = [row(1, { category: 'Official' }), row(2, { category: 'leaks' }), row(3), row(4, { category: '' })];
  assert.deepEqual(filterNews(rows, 'All', '').map(r => r.id), [1, 2, 3, 4]);
  assert.deepEqual(filterNews(rows, 'LEAKS', '').map(r => r.id), [2]);
  assert.deepEqual(filterNews(rows, 'official', '').map(r => r.id), [1]);
  assert.deepEqual(filterNews(rows, 'Community', '').map(r => r.id), [3, 4]);
  assert.deepEqual(filterNews(rows, 'Rumors', '').map(r => r.id), []);
});

test('filterNews: search is case-insensitive over title, body, summary and author', () => {
  const rows = [row(1, { title: 'Port Gellhorn' }), row(2, { body: 'about the PORT again' }), row(3, { summary: 'a port summary' }), row(4, { author_name: 'Portman' }), row(5)];
  assert.deepEqual(filterNews(rows, 'All', 'port').map(r => r.id), [1, 2, 3, 4]);
  assert.deepEqual(filterNews(rows, 'All', 'PORTM').map(r => r.id), [4]);
  assert.deepEqual(filterNews(rows, 'All', 'zzz').map(r => r.id), []);
  const sparse = [{ id: 9, created_at: '2026-01-01T00:00:00Z', type: 'news' }]; // missing title/body/author must not throw
  assert.deepEqual(filterNews(sparse, 'All', 'x'), []);
});

test('filterNews: tag and search combine', () => {
  const rows = [row(1, { category: 'Leaks', title: 'map' }), row(2, { category: 'Official', title: 'map' })];
  assert.deepEqual(filterNews(rows, 'Leaks', 'map').map(r => r.id), [1]);
});

test('sortNews: featured first, then newest; input array is not mutated', () => {
  const rows = [
    row(1, { created_at: '2026-01-01T00:00:00Z' }),
    row(2, { created_at: '2026-03-01T00:00:00Z', is_featured: true }),
    row(3, { created_at: '2026-02-01T00:00:00Z' }),
    row(4, { created_at: '2026-01-15T00:00:00Z', is_featured: true }),
  ];
  const copy = [...rows];
  assert.deepEqual(sortNews(rows).map(r => r.id), [2, 4, 3, 1]);
  assert.deepEqual(rows, copy);
});

test('buildFeed: de-duplicates, filters and sorts in one go', () => {
  const rows = [row(1, { category: 'Leaks' }), row(1, { category: 'Leaks', title: 'dup' }), row(2, { category: 'Leaks', is_featured: true }), row(3, { category: 'Official' })];
  assert.deepEqual(buildFeed(rows, 'Leaks', '').map(r => r.id), [2, 1]);
});

test('tags: known kinds, case-insensitive; everything else is community; each kind has a distinct style', () => {
  assert.equal(tagKind('OFFICIAL'), 'official'); assert.equal(tagKind('Leaks'), 'leaks'); assert.equal(tagKind('rumors'), 'rumors');
  assert.equal(tagKind('Community'), 'community'); assert.equal(tagKind('whatever'), 'community');
  const styles = ['official', 'leaks', 'rumors', 'community'].map(getTagStyle);
  assert.equal(new Set(styles).size, 4);
  assert.equal(getTagStyle('Nope'), getTagStyle('Community'));
  assert.deepEqual(NEWS_TAGS, ['All', 'Official', 'Leaks', 'Rumors', 'Community']);
});

test('getSourceLabel: upper-case host without www; SOURCE for anything that is not a URL', () => {
  assert.equal(getSourceLabel('https://www.take2games.com/path?x=1'), 'TAKE2GAMES.COM');
  assert.equal(getSourceLabel('https://map.stateofleonida.net'), 'MAP.STATEOFLEONIDA.NET');
  assert.equal(getSourceLabel('not a url'), 'SOURCE'); assert.equal(getSourceLabel(''), 'SOURCE');
});

test('previewOf: summary when it has text, otherwise the body', () => {
  assert.equal(previewOf(row(1, { summary: 'short' })), 'short');
  assert.equal(previewOf(row(1, { summary: '   ' })), 'B1');
  assert.equal(previewOf(row(1)), 'B1');
});
