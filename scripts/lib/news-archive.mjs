/**
 * News archive: the stories that keep their static page (public/n/<id>-<slug>/) after they left the live feed.
 *
 * Why it exists: in CI `public/data/news.json` is rebuilt from the live API and carries only the latest stories (12 at the
 * moment of writing). A page of an older story is still published (its file is tracked in git), but nothing could rebuild
 * it any more, so it froze with the template it was generated from: an old header, an old inline script with its OWN
 * <audio> radio and no persistent shell. Every visit to such a page restarted the music, and on a phone needed another touch.
 * With the story kept here, the generator rebuilds the page from the CURRENT template on every build, exactly like a live one.
 *
 * File: scripts/data/news-archive.json  { "note": "...", "items": [ <story as the live feed returns it> ] }
 * It is NOT published (only public/ is). Add stories with `node scripts/gen-seo-pages.mjs --archive` (copies everything the
 * live feed has right now into the archive) and commit the file.
 *
 * No imports from ./seo.mjs on purpose: it reads site.config.json at import time, and this module is unit-tested on its own.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Location of the archive, relative to the repository root. */
export const ARCHIVE_FILE = 'scripts/data/news-archive.json';

const NOTE =
  'Stories that keep their static page /n/<id>-<slug>/ after they left the live feed (the feed carries only the latest ones). ' +
  'The generator rebuilds each of them from the current page template on every build. Add stories with: node scripts/gen-seo-pages.mjs --archive';

/** A story we can build a page for: an id and a title are the minimum (the path is <id>-<slug of the title>). */
const usable = (n) => !!n && typeof n === 'object' && n.id != null && n.id !== '' && typeof n.title === 'string' && n.title.trim() !== '';

/** Newest first; the id breaks ties (and orders stories without a valid date). Same order the generator always used. */
const newestFirst = (a, b) => new Date(b.published_at) - new Date(a.published_at) || b.id - a.id;

/**
 * The stories to build pages for: the live feed plus the archive, one entry per id, newest first.
 * When both carry the same id the LIVE copy wins (it may have a corrected title, a new rating, a new image).
 * Entries without an id or a title are dropped.
 */
export function mergeNews(live, archive) {
  const byId = new Map();
  for (const list of [archive, live]) {
    if (!Array.isArray(list)) continue;
    for (const n of list) if (usable(n)) byId.set(String(n.id), n);
  }
  return [...byId.values()].sort(newestFirst);
}

/** The archived stories ([] when the file is missing or broken: the build must not depend on it). */
export function readArchive(root) {
  try {
    const j = JSON.parse(readFileSync(join(root, ARCHIVE_FILE), 'utf8'));
    return (Array.isArray(j) ? j : Array.isArray(j?.items) ? j.items : []).filter(usable);
  } catch {
    return [];
  }
}

/**
 * Writes the archive with every story we know: what it already holds plus `live` (the live copy wins).
 * Returns { total, added } where `added` counts ids the archive did not have before.
 */
export function writeArchive(root, live) {
  const before = readArchive(root);
  const known = new Set(before.map((n) => String(n.id)));
  const items = mergeNews(live, before);
  const added = items.filter((n) => !known.has(String(n.id))).length;
  const file = join(root, ARCHIVE_FILE);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ note: NOTE, count: items.length, items }, null, 1) + '\n', 'utf8');
  return { total: items.length, added };
}
