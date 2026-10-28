import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTsx } from './helpers/renderTsx.mjs';

const PAGES = ['home', 'news', 'market', 'realestate', 'document', 'community', 'profile', 'rp', 'agents', 'highlights'];

const shell = (page) => renderTsx('src/components/Layout.tsx', { activePage: page }, 'CHILD-MARKER');

test('Layout wraps the page: toasts, header nav, children inside <main>, bottom tabs and footer', async () => {
  const html = await shell('home');
  assert.ok(html.startsWith('<div class="min-h-screen vibe-bg scanlines relative flex flex-col'));
  assert.ok(html.includes('fixed bottom-8 right-6'), 'toast container');
  assert.ok(html.includes('<nav class="sticky top-0'), 'header');
  assert.ok(html.includes('aria-label="Toggle menu"'), 'mobile menu button');
  assert.ok(html.includes('aria-label="Quick navigation"'), 'bottom tabs');
  assert.ok(html.includes('<main class="flex-grow min-h-0">CHILD-MARKER</main>'), 'children in main');
  assert.ok(html.includes('<footer'), 'footer');
  // order: toasts, header, main, bottom tabs, footer
  const at = (s) => html.indexOf(s);
  assert.ok(at('fixed bottom-8') < at('<nav class="sticky') && at('<nav class="sticky') < at('<main') && at('<main') < at('Quick navigation') && at('Quick navigation') < at('<footer'));
});

test('on first render every overlay is closed and the visitor is a guest', async () => {
  const html = await shell('home');
  assert.ok(!html.includes('role="dialog"'), 'no modal markup');
  assert.ok(!/aria-modal/.test(html));
  assert.ok(html.includes('aria-expanded="false"'));
  assert.ok(!html.includes('Sign out') && !/Logout/i.test(html), 'no member controls for a guest');
});

test('all ten page keys render, and the active page changes the navigation markup', async () => {
  const seen = new Set();
  for (const page of PAGES) {
    const html = await shell(page);
    assert.ok(html.includes('CHILD-MARKER'), page);
    seen.add(html);
  }
  assert.ok(seen.size >= 6, `active page must be reflected in the markup (got ${seen.size} distinct renders)`);
});
