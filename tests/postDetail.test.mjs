import test from 'node:test';
import assert from 'node:assert/strict';
import { timeAgo } from '../src/lib/timeAgo.ts';
import { isVideoMedia } from '../src/lib/media.ts';
import {
  buildCommentTree,
  enrichComments,
  uniqueAuthorIds,
  commentCountLabel,
  planMediaEdit,
  buildPostUpdate,
} from '../src/lib/postDetail.ts';

const NOW = Date.parse('2026-10-26T12:00:00Z');
const ago = (ms) => new Date(NOW - ms).toISOString();
const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;

test('timeAgo buckets', () => {
  assert.equal(timeAgo(ago(0), NOW), 'just now');
  assert.equal(timeAgo(ago(59 * 1000), NOW), 'just now');
  assert.equal(timeAgo(ago(MIN), NOW), '1m ago');
  assert.equal(timeAgo(ago(59 * MIN), NOW), '59m ago');
  assert.equal(timeAgo(ago(HOUR), NOW), '1h ago');
  assert.equal(timeAgo(ago(23 * HOUR + 59 * MIN), NOW), '23h ago');
  assert.equal(timeAgo(ago(DAY), NOW), '1d ago');
  assert.equal(timeAgo(ago(29 * DAY), NOW), '29d ago');
  assert.equal(timeAgo(ago(30 * DAY), NOW), new Date(NOW - 30 * DAY).toLocaleDateString());
});

test('isVideoMedia: explicit type wins, otherwise the extension decides', () => {
  assert.equal(isVideoMedia('a.png', 'video'), true);
  assert.equal(isVideoMedia('a.mp4', 'image'), false);
  assert.equal(isVideoMedia('a.MP4', null), true);
  assert.equal(isVideoMedia('a.webm'), true);
  assert.equal(isVideoMedia('a.mov', undefined), true);
  assert.equal(isVideoMedia('a.mp4?x=1', null), false);
  assert.equal(isVideoMedia('a.jpg', null), false);
  assert.equal(isVideoMedia(null, null), false);
});

test('buildCommentTree nests replies and keeps orphans at the top level', () => {
  const rows = [
    { id: 1, parent_comment_id: null },
    { id: 2, parent_comment_id: 1 },
    { id: 3, parent_comment_id: 2 },
    { id: 4, parent_comment_id: 1 },
    { id: 5, parent_comment_id: 999 }, // parent missing: becomes a root
    { id: 6, parent_comment_id: null },
  ];
  const tree = buildCommentTree(rows);
  assert.deepEqual(tree.map((n) => n.id), [1, 5, 6]);
  assert.deepEqual(tree[0].children.map((n) => n.id), [2, 4]);
  assert.deepEqual(tree[0].children[0].children.map((n) => n.id), [3]);
  assert.deepEqual(tree[1].children, []);
  // input rows are not mutated
  assert.equal(rows[0].children, undefined);
});

test('buildCommentTree on an empty list', () => {
  assert.deepEqual(buildCommentTree([]), []);
});

test('enrichComments fills name, avatar and vote with defaults', () => {
  const rows = [{ id: 1, author_id: 'a' }, { id: 2, author_id: 'b' }];
  const out = enrichComments(rows, { a: 'Lucia' }, { a: 'https://img' }, { 1: -1 });
  assert.deepEqual(out, [
    { id: 1, author_id: 'a', author_name: 'Lucia', author_avatar: 'https://img', user_vote: -1 },
    { id: 2, author_id: 'b', author_name: 'agent', author_avatar: null, user_vote: 0 },
  ]);
});

test('uniqueAuthorIds and commentCountLabel', () => {
  assert.deepEqual(uniqueAuthorIds([{ author_id: 'a' }, { author_id: 'b' }, { author_id: 'a' }]), ['a', 'b']);
  assert.equal(commentCountLabel(0), 'No comments yet');
  assert.equal(commentCountLabel(1), '1 top-level comments');
  assert.equal(commentCountLabel(7), '7 top-level comments');
});

test('planMediaEdit', () => {
  const img = { media_url: 'https://x/a.png', media_type: 'image' };
  // nothing changed
  assert.deepEqual(planMediaEdit(img, false, null), { url: 'https://x/a.png', type: 'image', upload: false });
  // legacy row without a type stays without one
  assert.deepEqual(planMediaEdit({ media_url: 'https://x/a.mp4' }, false, null), { url: 'https://x/a.mp4', type: null, upload: false });
  // remove
  assert.deepEqual(planMediaEdit(img, true, null), { url: null, type: null, upload: false });
  // new file replaces; MIME type decides
  assert.deepEqual(planMediaEdit(img, false, { type: 'video/mp4' }), { url: 'https://x/a.png', type: 'video', upload: true });
  assert.deepEqual(planMediaEdit(img, false, { type: 'image/webp' }), { url: 'https://x/a.png', type: 'image', upload: true });
  assert.deepEqual(planMediaEdit(img, false, { type: '' }), { url: 'https://x/a.png', type: 'image', upload: true });
  // remove + file: the file wins for the type, url is cleared until the upload returns
  assert.deepEqual(planMediaEdit(img, true, { type: 'video/webm' }), { url: null, type: 'video', upload: true });
});

test('buildPostUpdate trims, nulls empty bodies and drops the type when there is no media', () => {
  assert.deepEqual(buildPostUpdate('  T  ', '  B  ', 'https://x/a.png', 'image'), {
    title: 'T', body: 'B', media_url: 'https://x/a.png', media_type: 'image',
  });
  assert.deepEqual(buildPostUpdate('T', '   ', null, 'video'), { title: 'T', body: null, media_url: null, media_type: null });
  assert.deepEqual(buildPostUpdate('T', '', 'https://x/a.mp4', null), { title: 'T', body: null, media_url: 'https://x/a.mp4', media_type: null });
});
