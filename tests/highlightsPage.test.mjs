// Characterization of the Highlights page markup (initial server render: effects do not run).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderTsx } from './helpers/renderTsx.mjs';

const noop = () => {};

test('signed out: sign-in options first, upload and link blocks ask to sign in, wall is empty while loading', async () => {
  const html = await renderTsx('src/pages/Highlights.tsx', { session: null, onOpenModal: noop });
  assert.match(html, /<h2 id="hl-login"[^>]*>1\. Sign in<\/h2>/);
  assert.match(html, /Get a phone code/);
  assert.match(html, /<h2 id="hl-upload"[^>]*>2\. Post a highlight<\/h2>/);
  assert.match(html, /Sign in first\./);
  assert.match(html, /Your console is showing a code\?/);
  assert.match(html, /The wall/);
  assert.doesNotMatch(html, /Nothing here yet/);
  assert.doesNotMatch(html, /Console browser detected/);
});

test('signed in: no sign-in block, upload form and code entry appear', async () => {
  const html = await renderTsx('src/pages/Highlights.tsx', { session: { user: { id: 'u1' } }, onOpenModal: noop });
  assert.doesNotMatch(html, /hl-login/);
  assert.match(html, /<h2 id="hl-upload"[^>]*>Post a highlight<\/h2>/);
  assert.match(html, /Choose screenshot or clip/);
  assert.match(html, /placeholder="ABCD-2345"/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Check code<\/button>/);
  assert.doesNotMatch(html, /Title \(what happened\?\)/);
});

test('filters: "All" and "Newest" start pressed', async () => {
  const html = await renderTsx('src/pages/Highlights.tsx', { session: null, onOpenModal: noop });
  assert.match(html, /aria-pressed="true"[^>]*>All<\/button>/);
  assert.match(html, /aria-pressed="true"[^>]*>Newest<\/button>/);
  assert.match(html, /aria-pressed="false"[^>]*>Top<\/button>/);
});
