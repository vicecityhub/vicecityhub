// "The Underground Forum" on community.html: the hiring announcement (posts.id = 142, type = 'forum') carries the
// developers' invitation link. The text itself lives in the database, not in the code, so these tests pin down the
// part that IS code: how such a topic is rendered. The link has an "@" in its path; it must become ONE safe,
// clickable link (new tab, noopener), nothing after it may be swallowed, and the card must fetch nothing third-party.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync as w, rmSync } from 'node:fs';
import { renderTsx } from './helpers/renderTsx.mjs';

const INVITE = 'https://ai.lounge.ai/r/@vicecityhub';

/**
 * The "How to Apply" block of the announcement, as stored (line breaks are real newlines; the card shows them with pre-wrap).
 * The address stands alone on its line on purpose: the links of the forum break anywhere (`break-all`), so glued to a sentence
 * it would be torn in the middle of "https://ai.lounge.ai" on a wide screen.
 */
const APPLY = [
  'How to Apply:',
  'Developers: the door is open. Grab your invitation and help me build the hub:',
  INVITE,
  'If you’re ready to secure your seat at the table, send your pitch to the email found in the site contacts. Let’s own the network. To the moon. 🚀',
].join('\n');

/** UndergroundForum is a named export: render it through a tiny default-export entry placed next to it. */
async function renderForum(body, currentUserId = null) {
  const entry = 'src/components/community/_forum_entry.tsx';
  w(new URL('../' + entry, import.meta.url), "import { UndergroundForum } from './UndergroundForum';\nexport default UndergroundForum;\n");
  try {
    const post = { id: 142, title: 'Recruitments Open for the Ultimate Hub', body, author_id: 'u1', author_name: 'VCH', created_at: '2026-04-26T00:27:44Z' };
    const forum = { posts: [post], startNewTopic() {}, startEditing() {}, remove() {} };
    return await renderTsx(entry, { forum, currentUserId });
  } finally {
    rmSync(new URL('../' + entry, import.meta.url), { force: true });
  }
}

const anchors = (h) => [...h.matchAll(/<a\s[^>]*>[^<]*<\/a>/g)].map((m) => m[0]);

test('invite: the address becomes one link that opens in a new tab, safely', async () => {
  const links = anchors(await renderForum(APPLY));
  assert.equal(links.length, 1, 'the only link of the topic is the invitation');
  assert.ok(links[0].includes(`href="${INVITE}"`), links[0]);
  assert.ok(links[0].includes('target="_blank"') && links[0].includes('rel="noopener noreferrer"'), links[0]);
});

test('invite: the link text is the whole address; the "@" and the next line are neither cut off nor pulled in', async () => {
  const h = await renderForum(APPLY);
  const [link] = anchors(h);
  assert.ok(link.endsWith(`>${INVITE}</a>`), link);
  assert.doesNotMatch(link, /If you/);
  // the line breaks around the link survive, so the address stays alone on its line
  assert.ok(h.includes(`build the hub:\n<a `), 'a line break before the link');
  assert.ok(h.includes(`${INVITE}</a>\nIf you’re ready`), 'a line break after the link');
});

test('invite: sits under "How to Apply", before the e-mail line; the closing line is still last', async () => {
  const h = await renderForum(APPLY);
  const at = (s) => h.indexOf(s);
  assert.ok(at('How to Apply:') > -1);
  assert.ok(at('How to Apply:') < at('Developers: the door is open.'));
  assert.ok(at('Developers: the door is open.') < at(INVITE));
  assert.ok(at(INVITE) < at('send your pitch to the email found in the site contacts'));
  assert.ok(at('send your pitch') < at('To the moon.'));
});

test('invite: a full stop, comma or "!" written right after the address stays outside the link (a later edit of the topic)', async () => {
  for (const tail of ['.', ',', '!']) {
    const h = await renderForum(`Join: ${INVITE}${tail}\nNext line`);
    const [link] = anchors(h);
    assert.ok(link.includes(`href="${INVITE}"`), link);
    assert.ok(h.includes(`>${INVITE}</a>${tail}`), `"${tail}" must follow the link, not sit inside it`);
  }
});

test('invite: the forum card fetches nothing third-party (no preview card, image, frame or other address)', async () => {
  const h = await renderForum(APPLY);
  assert.doesNotMatch(h, /<iframe|<img|youtube|ytimg/i);
  // the SVG namespace written by the icons is a name, not an address anything is fetched from
  const urls = new Set((h.match(/https?:\/\/[^"'\s<)]+/g) || []).filter((u) => u !== 'http://www.w3.org/2000/svg'));
  assert.deepEqual([...urls], [INVITE]);
});

test('invite: the author still gets Edit / Delete on the topic (the owner can change the text on the site), a visitor does not', async () => {
  const visitor = await renderForum(APPLY, null);
  assert.doesNotMatch(visitor, /title="Edit topic"|title="Delete topic"/);
  const author = await renderForum(APPLY, 'u1');
  assert.match(author, /title="Edit topic"/);
  assert.match(author, /title="Delete topic"/);
});
