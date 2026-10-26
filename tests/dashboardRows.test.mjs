import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_FORMS,
  EMPTY_PROFILE_FORM,
  buildDashRow,
  getPostPrice,
  validateEditedPost,
  buildEditMeta,
  profileFormFromRow,
  buildProfilePayload,
  avatarStoragePath,
} from '../src/lib/dashboardRows.ts';

const author = { id: 'u1', name: 'Lucia' };
const withForms = (patch) => ({ ...EMPTY_FORMS, ...patch });

test('forum: title and body are required', () => {
  const r = buildDashRow('forum', withForms({ forum: { title: 'T', body: '   ' } }), author);
  assert.deepEqual(r, { ok: false, error: 'Title and body required.' });
});

test('forum: builds a posts row and clears only the forum form', () => {
  const forms = withForms({ forum: { title: 'Map vs RDR2', body: 'Long take' }, domain: { name: 'keep.me', price: '1', desc: 'd' } });
  const r = buildDashRow('forum', forms, author);
  assert.equal(r.ok, true);
  assert.equal(r.table, 'posts');
  assert.deepEqual(r.row, { author_id: 'u1', author_name: 'Lucia', type: 'forum', title: 'Map vs RDR2', body: 'Long take' });
  assert.deepEqual(r.next.forum, EMPTY_FORMS.forum);
  assert.deepEqual(r.next.domain, forms.domain);
});

test('domain: a name with a dot gets a lower-cased tag, key order is price then tag', () => {
  const r = buildDashRow('domain', withForms({ domain: { name: 'Vice.NFT', price: '1500', desc: 'Premium' } }), author);
  assert.equal(r.ok, true);
  assert.equal(r.row.meta, '{"price":"1500","tag":"nft"}');
  assert.equal(r.row.title, 'Vice.NFT');
  assert.equal(r.row.body, 'Premium');
  assert.deepEqual(r.next.domain, EMPTY_FORMS.domain);
});

test('domain: no dot means no tag; blank name is rejected', () => {
  const ok = buildDashRow('domain', withForms({ domain: { name: 'plainname', price: '5', desc: '' } }), author);
  assert.equal(ok.row.meta, '{"price":"5"}');
  const bad = buildDashRow('domain', withForms({ domain: { name: '  ', price: '5', desc: '' } }), author);
  assert.deepEqual(bad, { ok: false, error: 'Domain name required.' });
});

test('news: headline and source are required', () => {
  const noTitle = buildDashRow('news', withForms({ news: { ...EMPTY_FORMS.news, src: 'Reddit' } }), author);
  assert.deepEqual(noTitle, { ok: false, error: 'Headline and source name required.' });
  const noSrc = buildDashRow('news', withForms({ news: { ...EMPTY_FORMS.news, title: 'Leak' } }), author);
  assert.deepEqual(noSrc, { ok: false, error: 'Headline and source name required.' });
});

test('news: empty body falls back to the default text and an empty summary', () => {
  const r = buildDashRow('news', withForms({ news: { ...EMPTY_FORMS.news, title: 'Leak', src: 'Reddit', url: 'https://x', tag: 'Leaks', stars: 4, featured: true } }), author);
  assert.equal(r.ok, true);
  assert.equal(r.table, 'news');
  assert.deepEqual(r.row, {
    author_id: 'u1',
    author_name: 'Lucia',
    type: 'news',
    title: 'Leak',
    body: 'Community submitted news',
    summary: '',
    category: 'Leaks',
    source_url: 'https://x',
    is_published: true,
    is_featured: true,
    meta: '{"source_name":"Reddit","stars":4}',
  });
});

test('news: summary is the first 180 characters of the body', () => {
  const body = 'x'.repeat(300);
  const r = buildDashRow('news', withForms({ news: { ...EMPTY_FORMS.news, title: 'T', src: 'S', body } }), author);
  assert.equal(r.row.body, body);
  assert.equal(r.row.summary.length, 180);
});

test('news: after publishing everything is cleared except the category tag', () => {
  const r = buildDashRow('news', withForms({ news: { title: 'T', body: 'B', tag: 'Rumors', src: 'S', url: 'U', featured: true, stars: 5 } }), author);
  assert.deepEqual(r.next.news, { title: '', body: '', tag: 'Rumors', src: '', url: '', featured: false, stars: 0 });
});

test('stream and podcast rows and validation', () => {
  const s = buildDashRow('stream', withForms({ stream: { name: 'GTASeries', plat: 'YT', yt: 'https://y', tw: 'https://t', desc: 'Files' } }), author);
  assert.equal(s.row.meta, '{"platform":"YT","yt":"https://y","tw":"https://t"}');
  assert.deepEqual(s.next.stream, EMPTY_FORMS.stream);
  assert.deepEqual(buildDashRow('stream', EMPTY_FORMS, author), { ok: false, error: 'Channel name required.' });

  const p = buildDashRow('podcast', withForms({ podcast: { name: 'Radio Leonida', url: 'https://p', desc: 'Weekly' } }), author);
  assert.equal(p.row.meta, '{"url":"https://p"}');
  assert.deepEqual(p.next.podcast, EMPTY_FORMS.podcast);
  assert.deepEqual(buildDashRow('podcast', EMPTY_FORMS, author), { ok: false, error: 'Show name required.' });
});

test('buildDashRow does not mutate the forms it receives', () => {
  const forms = withForms({ forum: { title: 'T', body: 'B' } });
  const snapshot = structuredClone(forms);
  buildDashRow('forum', forms, author);
  assert.deepEqual(forms, snapshot);
});

test('getPostPrice reads JSON strings and objects and swallows bad input', () => {
  assert.equal(getPostPrice('{"price":"1500","tag":"nft"}'), '1500');
  assert.equal(getPostPrice({ price: '7' }), '7');
  assert.equal(getPostPrice({ tag: 'nft' }), '');
  assert.equal(getPostPrice('{not json'), '');
  assert.equal(getPostPrice('null'), '');
  assert.equal(getPostPrice(null), '');
  assert.equal(getPostPrice(undefined), '');
  assert.equal(getPostPrice(''), '');
});

test('validateEditedPost and buildEditMeta', () => {
  assert.equal(validateEditedPost('', 'b'), 'Title and body required.');
  assert.equal(validateEditedPost('t', '  '), 'Title and body required.');
  assert.equal(validateEditedPost('t', 'b'), null);

  assert.equal(buildEditMeta('domain', 'Vice.NFT', '99'), '{"price":"99","tag":"nft"}');
  assert.equal(buildEditMeta('domain', 'plain', '99'), '{"price":"99","tag":"nft"}');
  assert.equal(buildEditMeta('forum', 'Vice.NFT', '99'), null);
});

test('profile form mapping and payload', () => {
  assert.deepEqual(profileFormFromRow({}), EMPTY_PROFILE_FORM);
  assert.deepEqual(
    profileFormFromRow({ display_name: 'L', bio: 'b', rsc_username: 'r', psn_username: 'p', platform: 'xbox', gang_tag: 'VCH' }),
    { displayName: 'L', bio: 'b', rsc: 'r', psn: 'p', platform: 'xbox', gangTag: 'VCH' },
  );
  assert.deepEqual(buildProfilePayload('u1', { displayName: ' Lu ', bio: '  ', rsc: ' r ', psn: '', platform: 'pc', gangTag: ' ' }), {
    user_id: 'u1',
    display_name: 'Lu',
    bio: null,
    rsc_username: 'r',
    psn_username: null,
    platform: 'pc',
    gang_tag: null,
  });
});

test('avatarStoragePath keeps the lower-cased extension and defaults to jpg', () => {
  assert.equal(avatarStoragePath('u1', 'Me.PNG'), 'u1/avatar.png');
  assert.equal(avatarStoragePath('u1', 'photo.final.webp'), 'u1/avatar.webp');
  // a name without a dot is its own "extension" (same as the original inline code)
  assert.equal(avatarStoragePath('u1', 'blob'), 'u1/avatar.blob');
  assert.equal(avatarStoragePath('u1', ''), 'u1/avatar.jpg');
});
