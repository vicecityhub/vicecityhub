import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyFeedSort,
  enrichFeedPosts,
  legacyAuthorName,
  validateLegacyPost,
  planComposerMedia,
  buildFeedPostFields,
  canSubmitPost,
} from '../src/lib/community.ts';

/** Minimal chainable query that records .order() calls. */
const fakeQuery = () => {
  const calls = [];
  const q = { calls, order(col, opts) { calls.push([col, opts.ascending]); return q; } };
  return q;
};

test('applyFeedSort: new, top and hot', () => {
  assert.deepEqual(applyFeedSort(fakeQuery(), 'new').calls, [['created_at', false]]);
  assert.deepEqual(applyFeedSort(fakeQuery(), 'top').calls, [['score', false]]);
  assert.deepEqual(applyFeedSort(fakeQuery(), 'hot').calls, [['is_pinned', false], ['created_at', false]]);
  // anything unknown behaves like hot (the default tab)
  assert.deepEqual(applyFeedSort(fakeQuery(), 'weird').calls, [['is_pinned', false], ['created_at', false]]);
});

test('enrichFeedPosts fills author, sub-hub and vote, with defaults', () => {
  const subhubs = [{ id: 2, slug: 'leaks', title: 'Leaks', description: null, icon: null }];
  const rows = [{ id: 1, author_id: 'a', subhub_id: 2 }, { id: 2, author_id: 'b', subhub_id: 99 }];
  const out = enrichFeedPosts(rows, subhubs, { a: 'Lucia' }, { a: 'https://img' }, { 1: 1 });
  assert.deepEqual(out, [
    { id: 1, author_id: 'a', subhub_id: 2, author_name: 'Lucia', author_avatar: 'https://img', subhub_slug: 'leaks', subhub_title: 'Leaks', user_vote: 1 },
    { id: 2, author_id: 'b', subhub_id: 99, author_name: 'agent', author_avatar: null, subhub_slug: undefined, subhub_title: undefined, user_vote: 0 },
  ]);
});

test('legacyAuthorName', () => {
  assert.equal(legacyAuthorName({ email: 'l@v.c', user_metadata: { username: 'Lu' } }), 'Lu');
  assert.equal(legacyAuthorName({ email: 'lucia@v.c', user_metadata: {} }), 'lucia');
  assert.equal(legacyAuthorName({ user_metadata: null }), 'agent');
  assert.equal(legacyAuthorName({}), 'agent');
});

test('validateLegacyPost', () => {
  assert.equal(validateLegacyPost('', 'b'), 'Title and body are both required.');
  assert.equal(validateLegacyPost('t', '  '), 'Title and body are both required.');
  assert.equal(validateLegacyPost('t', 'b'), null);
});

test('planComposerMedia', () => {
  // nothing
  assert.deepEqual(planComposerMedia(null, false, null), { url: null, type: null, upload: false });
  // kept URL is typed by extension (stored media_type is not consulted here)
  assert.deepEqual(planComposerMedia('https://c/a.png', false, null), { url: 'https://c/a.png', type: 'image', upload: false });
  assert.deepEqual(planComposerMedia('https://c/a.MOV', false, null), { url: 'https://c/a.MOV', type: 'video', upload: false });
  // remove
  assert.deepEqual(planComposerMedia('https://c/a.png', true, null), { url: null, type: null, upload: false });
  // file wins; MIME decides
  assert.deepEqual(planComposerMedia('https://c/a.png', false, { type: 'video/mp4' }), { url: 'https://c/a.png', type: 'video', upload: true });
  assert.deepEqual(planComposerMedia(null, false, { type: 'image/gif' }), { url: null, type: 'image', upload: true });
  assert.deepEqual(planComposerMedia('https://c/a.png', true, { type: 'image/png' }), { url: null, type: 'image', upload: true });
});

test('buildFeedPostFields', () => {
  assert.deepEqual(buildFeedPostFields(' T ', ' B ', 3, 'https://c/a.png', 'image'), {
    subhub_id: 3, title: 'T', body: 'B', media_url: 'https://c/a.png', media_type: 'image',
  });
  assert.deepEqual(buildFeedPostFields('T', '  ', 3, null, 'video'), { subhub_id: 3, title: 'T', body: null, media_url: null, media_type: null });
});

test('canSubmitPost needs a title and a sub-hub', () => {
  assert.equal(canSubmitPost('t', 1), true);
  assert.equal(canSubmitPost('  ', 1), false);
  assert.equal(canSubmitPost('t', null), false);
  assert.equal(canSubmitPost('t', 0), false);
});
