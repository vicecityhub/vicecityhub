import test from 'node:test';
import assert from 'node:assert/strict';
import { containsUrl, cardHasMedia, showsLinkPreview, hasOwnerMenu, voteTone, scorePrefix, authorInitial } from '../src/lib/postCard.ts';

test('containsUrl finds http and https links only', () => {
  assert.equal(containsUrl('see https://x.test'), true);
  assert.equal(containsUrl('see http://x.test'), true);
  assert.equal(containsUrl('see x.test'), false);
  assert.equal(containsUrl('ftp://x.test'), false);
  assert.equal(containsUrl(''), false);
  assert.equal(containsUrl(null), false);
  assert.equal(containsUrl(undefined), false);
});

test('cardHasMedia: media or a link in the body makes the card tall', () => {
  assert.equal(cardHasMedia({ media_url: 'https://c/a.png', body: null }), true);
  assert.equal(cardHasMedia({ media_url: null, body: 'look https://x.test' }), true);
  assert.equal(cardHasMedia({ media_url: null, body: 'plain text' }), false);
  assert.equal(cardHasMedia({ media_url: null, body: null }), false);
});

test('showsLinkPreview only without media', () => {
  assert.equal(showsLinkPreview({ media_url: null, body: 'https://x.test' }), true);
  assert.equal(showsLinkPreview({ media_url: 'https://c/a.png', body: 'https://x.test' }), false);
  assert.equal(showsLinkPreview({ media_url: null, body: 'nope' }), false);
  assert.equal(showsLinkPreview({ media_url: null, body: null }), false);
});

test('hasOwnerMenu needs a signed-in author and at least one action', () => {
  assert.equal(hasOwnerMenu(true, 'u1', 'u1', true, false), true);
  assert.equal(hasOwnerMenu(true, 'u1', 'u1', false, true), true);
  assert.equal(hasOwnerMenu(true, 'u1', 'u1', false, false), false);
  assert.equal(hasOwnerMenu(true, 'u2', 'u1', true, true), false);
  assert.equal(hasOwnerMenu(false, 'u1', 'u1', true, true), false);
  assert.equal(hasOwnerMenu(true, null, 'u1', true, true), false);
  assert.equal(hasOwnerMenu(true, undefined, 'u1', true, true), false);
  assert.equal(hasOwnerMenu(true, '', '', true, true), false);
});

test('voteTone, scorePrefix and authorInitial', () => {
  assert.equal(voteTone(1), 'text-neonOrange');
  assert.equal(voteTone(-1), 'text-neonCyan');
  assert.equal(voteTone(0), 'text-gray-400');
  assert.equal(voteTone(undefined), 'text-gray-400');
  assert.equal(scorePrefix(0), '+');
  assert.equal(scorePrefix(5), '+');
  assert.equal(scorePrefix(-1), '');
  assert.equal(authorInitial('lucia'), 'L');
  assert.equal(authorInitial(''), 'A');
  assert.equal(authorInitial(undefined), 'A');
});
