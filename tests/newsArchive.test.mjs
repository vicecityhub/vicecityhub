// The news archive: stories that keep their static page after they left the live feed, so the generator rebuilds the page
// from the CURRENT template (shell tag, one shared radio) instead of leaving a frozen copy with its own <audio>.
// Pure functions: scripts/lib/news-archive.mjs. The last tests run the real generator in a scratch copy of the repo.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ARCHIVE_FILE, mergeNews, readArchive, writeArchive } from '../scripts/lib/news-archive.mjs';

const story = (id, over = {}) => ({ id, title: `Story ${id}`, summary: `Summary ${id}`, published_at: '2026-10-01T10:00:00+00:00', ...over });
const ids = (list) => list.map((n) => n.id);

const scratch = (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'vch-news-archive-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
};

// ---- mergeNews ---------------------------------------------------------------------------------------------------

test('mergeNews: live stories and archived stories end up in one list, one entry per id', () => {
  const merged = mergeNews([story(3), story(2)], [story(2), story(1)]);
  assert.deepEqual(ids(merged).sort(), [1, 2, 3]);
});

test('mergeNews: when an id is in both, the LIVE copy wins (corrected title, new rating)', () => {
  const merged = mergeNews([story(7, { title: 'Corrected title', stars: 5 })], [story(7, { title: 'Old title', stars: 2 })]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].title, 'Corrected title');
  assert.equal(merged[0].stars, 5);
});

test('mergeNews: newest first, the id breaks ties (stories imported in one batch share a timestamp)', () => {
  const same = '2026-10-21T14:03:13+00:00';
  const merged = mergeNews(
    [story(11, { published_at: same }), story(13, { published_at: same })],
    [story(12, { published_at: same }), story(99, { published_at: '2026-09-01T00:00:00+00:00' }), story(5, { published_at: '2026-11-01T00:00:00+00:00' })],
  );
  assert.deepEqual(ids(merged), [5, 13, 12, 11, 99]);
});

test('mergeNews: an id given as a string and as a number is the same story', () => {
  const merged = mergeNews([story('4372', { title: 'Live' })], [story(4372, { title: 'Archived' })]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].title, 'Live');
});

test('mergeNews: entries without an id or a title are dropped, bad input never throws', () => {
  const merged = mergeNews([null, undefined, 5, 'x', {}, { id: 1 }, { title: 'No id' }, { id: 2, title: '   ' }, story(3)], [{ id: '', title: 'Empty id' }, story(4)]);
  assert.deepEqual(ids(merged), [4, 3]);
  for (const bad of [undefined, null, 'x', 5, {}]) assert.deepEqual(mergeNews(bad, bad), []);
  assert.deepEqual(ids(mergeNews(undefined, [story(1)])), [1]);
  assert.deepEqual(ids(mergeNews([story(1)], null)), [1]);
});

test('mergeNews: does not modify its inputs', () => {
  const live = [story(2), story(1)];
  const archive = [story(1), story(3)];
  const copy = JSON.stringify([live, archive]);
  mergeNews(live, archive);
  assert.equal(JSON.stringify([live, archive]), copy);
});

// ---- readArchive / writeArchive ----------------------------------------------------------------------------------

test('readArchive: a missing, empty or broken file gives [] (the build must never depend on it)', (t) => {
  const root = scratch(t);
  assert.deepEqual(readArchive(root), []);
  mkdirSync(join(root, 'scripts', 'data'), { recursive: true });
  writeFileSync(join(root, ARCHIVE_FILE), '');
  assert.deepEqual(readArchive(root), []);
  writeFileSync(join(root, ARCHIVE_FILE), '{ not json');
  assert.deepEqual(readArchive(root), []);
  writeFileSync(join(root, ARCHIVE_FILE), '{"items": "nope"}');
  assert.deepEqual(readArchive(root), []);
});

test('readArchive: understands { items: [...] } and a bare array, and skips unusable entries', (t) => {
  const root = scratch(t);
  mkdirSync(join(root, 'scripts', 'data'), { recursive: true });
  writeFileSync(join(root, ARCHIVE_FILE), JSON.stringify({ items: [story(1), { id: 2 }, story(3)] }));
  assert.deepEqual(ids(readArchive(root)), [1, 3]);
  writeFileSync(join(root, ARCHIVE_FILE), JSON.stringify([story(4), null, story(5)]));
  assert.deepEqual(ids(readArchive(root)), [4, 5]);
});

test('writeArchive: creates the file, counts what is new, keeps what it had, lets the live copy win', (t) => {
  const root = scratch(t);
  let r = writeArchive(root, [story(1), story(2)]);
  assert.deepEqual(r, { total: 2, added: 2 });
  assert.deepEqual(ids(readArchive(root)), [2, 1]);

  r = writeArchive(root, [story(2, { title: 'Corrected' }), story(3, { published_at: '2026-11-01T00:00:00+00:00' })]);
  assert.deepEqual(r, { total: 3, added: 1 });
  const items = readArchive(root);
  assert.deepEqual(ids(items), [3, 2, 1], 'story 1 left the live feed but stays in the archive');
  assert.equal(items.find((n) => n.id === 2).title, 'Corrected');
});

test('writeArchive: writing the same stories again changes nothing (no noisy diffs)', (t) => {
  const root = scratch(t);
  writeArchive(root, [story(1), story(2)]);
  const first = readFileSync(join(root, ARCHIVE_FILE), 'utf8');
  const r = writeArchive(root, [story(2), story(1)]);
  assert.equal(r.added, 0);
  assert.equal(readFileSync(join(root, ARCHIVE_FILE), 'utf8'), first);
  assert.ok(first.endsWith('\n'));
});

// ---- the archive that is committed ---------------------------------------------------------------------------------

const committed = JSON.parse(readFileSync(ARCHIVE_FILE, 'utf8'));

test('the committed archive: valid, ids unique, newest first, every story has what a page needs', () => {
  assert.ok(Array.isArray(committed.items) && committed.items.length > 0);
  assert.equal(committed.count, committed.items.length);
  const seen = new Set();
  for (const n of committed.items) {
    assert.ok(Number.isInteger(n.id), `id of ${JSON.stringify(n.title)}`);
    assert.ok(!seen.has(n.id), `id ${n.id} is listed twice`);
    seen.add(n.id);
    for (const k of ['title', 'summary', 'category', 'published_at'])
      assert.ok(typeof n[k] === 'string' && n[k].trim(), `story ${n.id}: ${k}`);
    assert.ok(!Number.isNaN(new Date(n.published_at).getTime()), `story ${n.id}: published_at is a date`);
  }
  assert.deepEqual(ids(committed.items), ids(mergeNews([], committed.items)), 'stored in the order the generator uses');
});

test('the committed archive: carries no credentials', () => {
  const raw = readFileSync(ARCHIVE_FILE, 'utf8');
  assert.ok(!/service_role|eyJhbGci|sk_(live|test)_|-----BEGIN|apikey|api_key/i.test(raw));
});

test('the committed archive is not published: only public/ ends up on the site', () => {
  assert.ok(!ARCHIVE_FILE.startsWith('public/'));
});

// ---- the generator, run for real in a scratch copy of the repository ------------------------------------------------

/** A minimal checkout: the generator and its helpers, the site config (the growth endpoint points at a closed port, so no
 *  network is needed), the nav data, a stand-in for the built shell, the live feed and (optionally) the archive. */
function checkout(t, { live, archive = committed, files = {} }) {
  const root = scratch(t);
  mkdirSync(join(root, 'scripts', 'data'), { recursive: true });
  mkdirSync(join(root, 'src', 'lib'), { recursive: true });
  mkdirSync(join(root, 'public', 'data'), { recursive: true });
  cpSync('scripts/gen-seo-pages.mjs', join(root, 'scripts', 'gen-seo-pages.mjs'));
  cpSync('scripts/lib', join(root, 'scripts', 'lib'), { recursive: true });
  cpSync('src/lib/nav.json', join(root, 'src', 'lib', 'nav.json'));
  const cfg = JSON.parse(readFileSync('site.config.json', 'utf8'));
  cfg.api = 'http://127.0.0.1:9/agent-api';
  writeFileSync(join(root, 'site.config.json'), JSON.stringify(cfg));
  writeFileSync(join(root, 'public', 'vch-shell.js'), '/* stand-in for the built shell */(function(){})();');
  writeFileSync(join(root, 'public', 'data', 'news.json'), JSON.stringify({ items: live }));
  if (archive) writeFileSync(join(root, ARCHIVE_FILE), JSON.stringify(archive));
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(join(root, rel, '..'), { recursive: true });
    writeFileSync(join(root, rel), content);
  }
  return root;
}
const generate = (root, ...args) => spawnSync(process.execPath, ['scripts/gen-seo-pages.mjs', ...args], { cwd: root, encoding: 'utf8', timeout: 90_000 });
const newsDirs = (root) => readdirSync(join(root, 'public', 'n'), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();

test('generator: a story that is only in the archive gets its page rebuilt from the current template, next to the live ones', (t) => {
  const liveStory = story(99001, { title: 'A brand new story from the live feed', category: 'Official', body: 'Body of the live story.' });
  const root = checkout(t, { live: [liveStory] });
  const r = generate(root);
  assert.equal(r.status, 0, r.stderr);

  const dirs = newsDirs(root);
  assert.equal(dirs.length, committed.items.length + 1, 'one page per archived story plus the live one');
  assert.ok(dirs.some((d) => d.startsWith('99001-')), 'live story');

  for (const d of dirs) {
    const h = readFileSync(join(root, 'public', 'n', d, 'index.html'), 'utf8');
    assert.ok(h.includes('data-vch-radio'), `${d}: the radio button carries the marker of the current template`);
    assert.equal((h.match(/vch-shell\.js\?v=[0-9a-f]{10}/g) || []).length, 1, `${d}: loads the shell exactly once`);
    assert.ok(!/new Audio\(|radioTrackIndex/.test(h), `${d}: no second radio of its own`);
    assert.ok(h.indexOf('vch-shell.js') < h.indexOf('window.vchShell'), `${d}: shell is loaded before the script that uses it`);
  }
  assert.match(r.stdout, new RegExp(`${dirs.length} news pages \\(1 live, ${committed.items.length} from the archive\\)`));
  assert.ok(!/have no story data/.test(r.stderr), 'nothing is left over');
});

test('generator: archived stories are linked from the news archive page, the sitemap and the feed', (t) => {
  const root = checkout(t, { live: [story(99002, { title: 'Another live story' })] });
  assert.equal(generate(root).status, 0);
  const oldest = committed.items[committed.items.length - 1];
  const slugDir = newsDirs(root).find((d) => d.startsWith(`${oldest.id}-`));
  assert.ok(slugDir, 'page of the oldest archived story');
  assert.ok(readFileSync(join(root, 'public', 'n', 'index.html'), 'utf8').includes(`/n/${slugDir}/`), 'news archive page');
  assert.ok(readFileSync(join(root, 'public', 'sitemap.xml'), 'utf8').includes(`/n/${slugDir}/`), 'sitemap');
  assert.ok(readFileSync(join(root, 'public', 'feed.xml'), 'utf8').includes('Another live story'), 'feed');
});

test('generator: an older frozen copy of an archived page is overwritten by the current template', (t) => {
  const first = committed.items[0];
  const probe = checkout(t, { live: [] });
  assert.equal(generate(probe).status, 0);
  const dir = newsDirs(probe).find((d) => d.startsWith(`${first.id}-`));
  const frozen = '<!doctype html><html><body><button id="radio"></button><script>(function(){var a=new Audio();})();</script></body></html>';
  const root = checkout(t, { live: [], files: { [`public/n/${dir}/index.html`]: frozen } });
  assert.equal(generate(root).status, 0);
  const h = readFileSync(join(root, 'public', 'n', dir, 'index.html'), 'utf8');
  assert.ok(h.includes('data-vch-radio') && !h.includes('new Audio('));
});

test('generator: a page whose story is nowhere is left alone and reported (it cannot be rebuilt)', (t) => {
  const orphan = 'public/n/12-forgotten-story/index.html';
  const root = checkout(t, { live: [story(99003)], files: { [orphan]: '<html>frozen</html>' } });
  const r = generate(root);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readFileSync(join(root, orphan), 'utf8'), '<html>frozen</html>');
  assert.match(r.stderr, /1 news page\(s\) have no story data and are not rebuilt/);
  assert.match(r.stderr, /12-forgotten-story/);
});

test('generator: without an archive file the live stories still get their pages (no crash)', (t) => {
  const root = checkout(t, { live: [story(99004, { title: 'Only live' })], archive: null });
  const r = generate(root);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(newsDirs(root).map((d) => d.split('-')[0]), ['99004']);
});

test('generator --archive: copies the live stories into the archive, keeps the old ones, and still builds', (t) => {
  const small = { items: [story(1), story(2)] };
  const root = checkout(t, { live: [story(2, { title: 'Corrected title' }), story(3)], archive: small });
  const r = generate(root, '--archive');
  assert.equal(r.status, 0, r.stderr);
  const after = readArchive(root);
  assert.deepEqual(ids(after).sort(), [1, 2, 3]);
  assert.equal(after.find((n) => n.id === 2).title, 'Corrected title');
  assert.match(r.stdout, /archive: 3 stories \(1 added\)/);
  assert.equal(newsDirs(root).length, 3);
  assert.ok(existsSync(join(root, 'public', 'n', 'index.html')));
});
