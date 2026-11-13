import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderTsx } from './helpers/renderTsx.mjs';
import { bundleTs } from './helpers/bundleTs.mjs';

test('HubAIWidget renders a closed launcher without modal markup on initial render', async () => {
  const html = await renderTsx('src/components/HubAIWidget.tsx', { activePage: 'home' });
  assert.ok(html.includes('Ask Hub AI'));
  assert.ok(html.includes('aria-expanded="false"'));
  assert.ok(!html.includes('role="dialog"'));
  assert.ok(!/aria-modal/.test(html));
});

test('RPHub renders Ask Hub AI widget directly outside Layout', async () => {
  const html = await renderTsx('src/pages/RPHub.tsx', {});
  assert.ok(html.includes('Ask Hub AI'));
  assert.ok(html.includes('aria-expanded="false"'));
});

test('Static SEO shell includes the global ai-widget.js script for non-React pages', () => {
  const seoSrc = readFileSync('scripts/lib/seo.mjs', 'utf8');
  assert.ok(seoSrc.includes('/vicecityhub/ai-widget.js'));
});

test('HubQueryAnalyticsPanel renders anomaly monitor banner cleanly on initial render', async () => {
  const html = await renderTsx('src/components/HubQueryAnalyticsPanel.tsx', {});
  assert.ok(html.includes('Real-Time Anomaly Monitor Active'));
  assert.ok(html.includes('Top Search &amp; Support Clusters'));
  assert.ok(html.includes('Detected Pain Points'));
});

test('saveRecentSearch deduplicates queries, caps at 8 items, and clearRecentSearches resets', async () => {
  const mod = await bundleTs(`export { saveRecentSearch, clearRecentSearches } from './src/lib/aiSupport';`);
  let list = [];
  for (let i = 1; i <= 10; i++) {
    list = mod.saveRecentSearch({ query: `query ${i}`, category: 'all', matchCount: i }, list);
  }
  assert.equal(list.length, 8);
  assert.equal(list[0].query, 'query 10');
  list = mod.saveRecentSearch({ query: 'Query 9', category: 'all', matchCount: 3 }, list);
  assert.equal(list.length, 8);
  assert.equal(list[0].query, 'Query 9');
  const cleared = mod.clearRecentSearches();
  assert.deepEqual(cleared, []);
});
