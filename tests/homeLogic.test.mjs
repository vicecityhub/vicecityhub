import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CARD_SCROLL_STEP,
  EMPTY_MEDIA_FORM,
  mediaTabLabel,
  cardsForTab,
  mediaFormFromCard,
  buildMediaPayload,
  isCardOwner,
  nextScrollLeft,
  groupMapComments,
  commentAuthorName,
} from '../src/lib/homeLogic.ts';

test('mediaTabLabel', () => {
  assert.equal(mediaTabLabel('trailer'), 'Trailers');
  assert.equal(mediaTabLabel('podcast'), 'Podcasts');
  assert.equal(mediaTabLabel('streamer'), 'Streamers');
  assert.equal(mediaTabLabel('reel'), 'Fan Videos');
});

const card = (over) => ({ id: 1, author_id: 'u1', type: 'trailer', title: 'T', description: null, youtube_id: null, thumbnail_url: null, external_url: null, twitch_url: null, is_pinned: false, created_at: '2026-10-01', ...over });

test('cardsForTab keeps order and filters by type', () => {
  const cards = [card({ id: 1 }), card({ id: 2, type: 'podcast' }), card({ id: 3 })];
  assert.deepEqual(cardsForTab(cards, 'trailer').map(c => c.id), [1, 3]);
  assert.deepEqual(cardsForTab(cards, 'reel'), []);
});

test('mediaFormFromCard turns nulls into empty strings', () => {
  assert.deepEqual(mediaFormFromCard(card({ title: 'X', description: 'D', youtube_id: 'abc', external_url: 'https://x' })), { title: 'X', description: 'D', youtube_id: 'abc', external_url: 'https://x' });
  assert.deepEqual(mediaFormFromCard(card({ title: 'X' })), { title: 'X', description: '', youtube_id: '', external_url: '' });
});

test('buildMediaPayload trims text, stores blanks as null and takes the tab type', () => {
  assert.deepEqual(buildMediaPayload({ title: '  Trailer 4 ', description: '   ', youtube_id: ' EiQ ', external_url: '' }, 'reel'), {
    title: 'Trailer 4',
    description: null,
    youtube_id: 'EiQ',
    external_url: null,
    type: 'reel',
  });
  assert.deepEqual(buildMediaPayload(EMPTY_MEDIA_FORM, 'trailer'), { title: '', description: null, youtube_id: null, external_url: null, type: 'trailer' });
});

test('isCardOwner needs a signed-in user that matches the author', () => {
  assert.equal(isCardOwner('u1', card({ author_id: 'u1' })), true);
  assert.equal(isCardOwner('u2', card({ author_id: 'u1' })), false);
  assert.equal(isCardOwner(null, card({ author_id: null })), false);
  assert.equal(isCardOwner('u1', card({ author_id: null })), false);
});

test('nextScrollLeft moves one card (360 + 24) and wraps to 0 within 10 px of the end', () => {
  assert.equal(CARD_SCROLL_STEP, 384);
  assert.equal(nextScrollLeft(0, 1000, 3000), 384);
  assert.equal(nextScrollLeft(384, 1000, 3000), 768);
  // 1990 + 1000 >= 3000 - 10 -> at end
  assert.equal(nextScrollLeft(1990, 1000, 3000), 0);
  // one pixel short of "at end"
  assert.equal(nextScrollLeft(1989, 1000, 3000), 1989 + 384);
});

test('groupMapComments always has map1 and map2, groups by map_id and keeps order', () => {
  assert.deepEqual(groupMapComments(null), { map1: [], map2: [] });
  assert.deepEqual(groupMapComments(undefined), { map1: [], map2: [] });
  const rows = [{ id: 3, map_id: 'map1' }, { id: 2, map_id: 'map3' }, { id: 1, map_id: 'map1' }];
  const g = groupMapComments(rows);
  assert.deepEqual(g.map1.map(r => r.id), [3, 1]);
  assert.deepEqual(g.map2, []);
  assert.deepEqual(g.map3.map(r => r.id), [2]);
});

test('commentAuthorName: username, then e-mail local part, then Anon', () => {
  assert.equal(commentAuthorName({ user_metadata: { username: 'Lucia' }, email: 'l@x.y' }), 'Lucia');
  assert.equal(commentAuthorName({ user_metadata: {}, email: 'jason@x.y' }), 'jason');
  assert.equal(commentAuthorName({ user_metadata: null }), 'Anon');
  assert.equal(commentAuthorName(null), 'Anon');
});
