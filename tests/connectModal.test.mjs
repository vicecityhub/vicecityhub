// Characterization of the Connect modal markup (initial server render) for every shape of server the UI can meet.
// The expected HTML lives in tests/fixtures/connectModal.golden.json; regenerate it only on purpose with UPDATE_GOLDEN=1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { renderTsx } from './helpers/renderTsx.mjs';

const NOW = Date.parse('2026-11-06T12:00:00Z');
Date.now = () => NOW;
const GOLDEN = new URL('./fixtures/connectModal.golden.json', import.meta.url);

const full = {
  id: 's1', cfx_code: 'abc123', name: 'Vice <RP> & Co', host_name: 'host', project_desc: 'Project desc', description: 'Hub blurb', status: 'ONLINE', live: true,
  online_count: 1234, max_players: 2048, peak_players: 2000, upvotes: 4321, locale: 'pt-BR', rp_style: 'serious', access: 'allowlist', framework: 'qbcore',
  tags: [], features: ['police', 'ems', 'bogus', 'mafia'], icon_url: null, banner_url: null, website_url: 'https://example.com/?a=1&b=2', discord_url: 'https://discord.gg/xyz',
  discord_members: 77332, discord_online: 100, discord_verified: true, resources_count: 300, owner_name: 'Owner', fx_build: 'v1.0.0.1', last_checked_at: '2026-11-06T11:57:00Z',
  last_seen_at: null, promo_tier: null, promo_until: null, is_featured: false, sort_order: 1, source: 'curated', listing_status: 'active', created_at: null,
};
const bare = { ...full, description: null, project_desc: null, live: false, status: 'OFFLINE', online_count: null, max_players: null, peak_players: null, upvotes: 0, locale: null,
  rp_style: null, access: 'public', framework: null, features: [], website_url: null, discord_url: null, discord_members: null, last_checked_at: null };
const VARIANTS = {
  full,
  bare,
  descriptionFallsBackToProjectDesc: { ...full, description: null },
  noBlurbAtAll: { ...full, description: '', project_desc: '' },
  onlineWithoutMax: { ...full, max_players: null },
  liveButNoCount: { ...full, online_count: null },
  zeroPeakAndMembers: { ...full, peak_players: 0, discord_members: 0 },
  unknownFramework: { ...full, framework: 'mystery' },
  everyStyle: { ...full, rp_style: 'casual' },
  publicServer: { ...full, access: 'public' },
  discordOnly: { ...full, website_url: null },
  websiteOnly: { ...full, discord_url: null },
  nullFeatures: { ...full, features: null },
  onlyUnknownFeatures: { ...full, features: ['bogus', 'nope'] },
  staleCheck: { ...full, last_checked_at: '2026-11-01T12:00:00Z' },
  localeWithoutRegion: { ...full, locale: 'de' },
};

const out = {};
for (const [name, server] of Object.entries(VARIANTS)) out[name] = await renderTsx('src/rp-hub/servers/ConnectModal.tsx', { server, onClose() {} });

test('markup of every server shape is unchanged (golden)', () => {
  if (process.env.UPDATE_GOLDEN === '1' || !existsSync(GOLDEN)) { writeFileSync(GOLDEN, JSON.stringify(out, null, 1) + '\n'); return; }
  const golden = JSON.parse(readFileSync(GOLDEN, 'utf8'));
  assert.deepEqual(Object.keys(out), Object.keys(golden));
  for (const name of Object.keys(golden)) assert.equal(out[name], golden[name], name);
});

test('what the markup says: join links, stats rows, optional blocks', () => {
  const f = out.full, b = out.bare;
  assert.match(f, /aria-label="Connect to Vice &lt;RP&gt; &amp; Co"/);
  assert.match(f, /href="fivem:\/\/connect\/cfx\.re\/join\/abc123"/);
  assert.match(f, />connect cfx\.re\/join\/abc123</);
  assert.match(f, /href="https:\/\/cfx\.re\/join\/abc123"/);
  assert.match(f, /href="https:\/\/servers\.fivem\.net\/servers\/detail\/abc123"/);
  assert.match(f, /Checked against the Cfx\.re list 3 min ago/);
  assert.match(f, /Hub blurb/);
  assert.match(f, /allowlist/);
  assert.match(f, /rel="noopener noreferrer nofollow"/);
  assert.match(f, /<dt[^>]*>Players now<\/dt><dd[^>]*>1,234 \/ 2,048<\/dd>/);
  assert.match(f, /<dd[^>]*>77k members<\/dd>/);
  assert.match(f, /<dd[^>]*>Serious RP<\/dd>/);
  assert.match(f, /<dd[^>]*>QBCore<\/dd>/);
  assert.equal((f.match(/tracking-wider border border-neonCyan\/20/g) || []).length, 3);
  assert.match(b, /<dd[^>]*>Offline<\/dd>/);
  assert.doesNotMatch(b, /allowlist|Checked against|>DISCORD<|>WEBSITE<|<p class="text-white\/60/);
  assert.equal((b.match(/tracking-wider border border-neonCyan\/20/g) || []).length, 0);
  assert.match(out.descriptionFallsBackToProjectDesc, /Project desc/);
  assert.match(out.unknownFramework, /<dd[^>]*>mystery<\/dd>/);
  assert.match(out.onlineWithoutMax, /<dd[^>]*>1,234<\/dd>/);
});
