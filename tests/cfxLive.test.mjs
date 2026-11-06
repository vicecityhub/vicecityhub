// Characterization of the Cfx.re server-list reader: fetchLive -> toLive field mapping, feature / style / framework detection,
// roleplay filter and display tags. Pure module, fetch is scripted.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { fetchLive, isCode, cleanText, isRoleplay, displayTags, CFX_BASE } from '../supabase/functions/rp-servers/cfx.ts';

const NOW = Date.parse('2026-11-01T12:00:00Z');
Date.now = () => NOW;
let calls;
function script(...replies) {
  calls = [];
  let last;
  globalThis.fetch = async (url, init) => {
    calls.push([String(url), init]);
    const r = last = replies.length ? replies.shift() : last;
    if (r instanceof Error) throw r;
    return r;
  };
}
const json = (body, status = 200) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const live = async (Data, code = 'abc12x') => { script(json({ EndPoint: code, Data })); const r = await fetchLive(code); assert.equal(r.kind, 'ok'); return r.live; };
beforeEach(() => script(json({})));

test('fetchLive: bad codes never reach the network; the code is lower-cased and sent with UA and Accept', async () => {
  for (const bad of ['', 'abc', 'x'.repeat(17), 'ab cde', 'ab-cde', null, undefined]) assert.deepEqual(await fetchLive(bad), { kind: 'gone' });
  assert.equal(calls.length, 0);
  script(json({ Data: { hostname: 'h' } }));
  await fetchLive('ABC12X');
  assert.equal(calls[0][0], `${CFX_BASE}/single/abc12x`);
  assert.match(calls[0][1].headers['User-Agent'], /ViceCityHubBot/);
  assert.equal(calls[0][1].headers.Accept, 'application/json');
  assert.ok(calls[0][1].signal);
});

test('fetchLive: 404 and a body without Data mean gone; other failures retry once, then report the last error', async () => {
  script(json({}, 404)); assert.deepEqual(await fetchLive('abc12x'), { kind: 'gone' }); assert.equal(calls.length, 1);
  script(json({ EndPoint: 'x' })); assert.deepEqual(await fetchLive('abc12x'), { kind: 'gone' });
  script(json({ Data: null })); assert.deepEqual(await fetchLive('abc12x'), { kind: 'gone' });
  script(json({}, 500), json({}, 503)); assert.deepEqual(await fetchLive('abc12x'), { kind: 'error', message: 'http 503' }); assert.equal(calls.length, 2);
  script(new Error('boom'), new Error('bang')); assert.deepEqual(await fetchLive('abc12x'), { kind: 'error', message: 'bang' });
  script(json({}, 500), json({ Data: { hostname: 'h' } })); assert.equal((await fetchLive('abc12x')).kind, 'ok');
  script(new Error('flaky'), json({}, 404)); assert.deepEqual(await fetchLive('abc12x'), { kind: 'gone' });
  script({ status: 200, ok: true, json: async () => { throw new Error('bad json'); } }); assert.deepEqual(await fetchLive('abc12x'), { kind: 'error', message: 'bad json' });
});

test('toLive: an empty record gives safe defaults, keys in a stable order', async () => {
  const l = await live({});
  assert.deepEqual(l, {
    code: 'abc12x', name: '', host_name: '', project_desc: null, gametype: '', gamename: 'gta5', online_count: 0, max_players: 0, peak_players: null, upvotes: 0,
    locale: null, allowlist: false, tags_raw: [], discord_link: null, icon_url: null, banner_url: null, resources_count: 0, owner_name: null, fx_build: null,
    last_seen_at: null, fresh: false, voice: null, framework: null, features: [], style: 'mixed',
  });
  assert.deepEqual(Object.keys(l), ['code', 'name', 'host_name', 'project_desc', 'gametype', 'gamename', 'online_count', 'max_players', 'peak_players', 'upvotes', 'locale', 'allowlist', 'tags_raw', 'discord_link', 'icon_url', 'banner_url', 'resources_count', 'owner_name', 'fx_build', 'last_seen_at', 'fresh', 'voice', 'framework', 'features', 'style']);
});

test('toLive: names and text fields are cleaned and cut', async () => {
  const l = await live({ hostname: '^1Host<b>\nName', gametype: 'x'.repeat(100), ownerName: ' Own ', vars: { sv_projectName: '  ^2Proj  Name ', sv_projectDesc: 'd'.repeat(600) } });
  assert.equal(l.name, 'Proj Name'); assert.equal(l.host_name, 'Host b Name'); assert.equal(l.gametype.length, 60);
  assert.equal(l.project_desc.length, 500); assert.equal(l.owner_name, 'Own');
  assert.equal((await live({ hostname: '^1Only Host' })).name, 'Only Host');
  assert.equal((await live({ hostname: 'h'.repeat(200) })).host_name.length, 140);
  assert.equal((await live({ ownerName: '   ' })).owner_name, null);
  assert.equal((await live({ vars: { sv_projectDesc: ' ^1 ' } })).project_desc, null);
});

test('toLive: players, peak, upvotes and game name', async () => {
  const l = await live({ clients: 12, sv_maxclients: 64, upvotePower: '7', vars: { peak_players: '88', gamename: 'rdr3' } });
  assert.deepEqual([l.online_count, l.max_players, l.upvotes, l.peak_players, l.gamename], [12, 64, 7, 88, 'rdr3']);
  assert.equal((await live({ svMaxclients: 48 })).max_players, 48);
  assert.equal((await live({ sv_maxclients: 0, svMaxclients: 32 })).max_players, 32);
  assert.equal((await live({ clients: '12' })).online_count, 0);
  assert.equal((await live({ clients: NaN })).online_count, 0);
  assert.equal((await live({ vars: { peak_players: 'abc' } })).peak_players, null);
  assert.equal((await live({ vars: { peak_players: '12abc' } })).peak_players, 12);
  assert.equal((await live({ vars: { peak_players: 0 } })).peak_players, 0);
  assert.equal((await live({ sv_maxclients: 'x' })).max_players, NaN);
});

test('toLive: locale must look like a locale; allowlist only for the string "true"', async () => {
  for (const [v, want] of [['en-US', 'en-US'], ['de', 'de'], ['pt-BR', 'pt-BR'], ['xx_YY', null], ['english', null], ['e', null], ['', null], [undefined, null], ['en-U', null]])
    assert.equal((await live({ vars: { locale: v } })).locale, want, String(v));
  for (const [v, want] of [['true', true], [true, true], ['false', false], ['TRUE', false], [undefined, false], [1, false]])
    assert.equal((await live({ vars: { sv_appearAllowlisted: v } })).allowlist, want, String(v));
});

test('toLive: voice is null when unknown, else the string "true"', async () => {
  assert.equal((await live({})).voice, null);
  assert.equal((await live({ vars: { sv_voiceChat: 'true' } })).voice, true);
  assert.equal((await live({ vars: { sv_voiceChat: true } })).voice, true);
  assert.equal((await live({ vars: { sv_voiceChat: 'false' } })).voice, false);
  assert.equal((await live({ vars: { sv_voiceChat: '' } })).voice, false);
});

test('toLive: links - discord must be a non-empty string, icon needs a numeric version, banner a trusted host (cut to 300)', async () => {
  assert.equal((await live({ vars: { discord_link: 'https://discord.gg/x' } })).discord_link, 'https://discord.gg/x');
  for (const v of ['', undefined, 5, null]) assert.equal((await live({ vars: { discord_link: v } })).discord_link, null);
  assert.equal((await live({ iconVersion: 0 })).icon_url, `${CFX_BASE}/icon/abc12x/0.png`);
  assert.equal((await live({ iconVersion: 1234 })).icon_url, `${CFX_BASE}/icon/abc12x/1234.png`);
  for (const v of ['1234', null, undefined]) assert.equal((await live({ iconVersion: v })).icon_url, null);
  const ok = 'https://cfx-server-metadata.cfx-services.net/' + 'a'.repeat(400);
  assert.equal((await live({ vars: { banner_detail: ok } })).banner_url, ok.slice(0, 300));
  assert.equal((await live({ vars: { banner_connecting: 'https://frontend.cfx-services.net/b.png' } })).banner_url, 'https://frontend.cfx-services.net/b.png');
  assert.equal((await live({ vars: { banner_detail: 'https://evil.example/b.png', banner_connecting: 'https://frontend.cfx-services.net/b.png' } })).banner_url, null);
  assert.equal((await live({ vars: { banner_detail: '', banner_connecting: 'https://frontend.cfx-services.net/b.png' } })).banner_url, 'https://frontend.cfx-services.net/b.png');
  assert.equal((await live({ vars: {} })).banner_url, null);
});

test('toLive: build number, resource count, last seen and freshness (20 minutes)', async () => {
  const l = await live({ server: 'FXServer-master SERVER v1.0.0.12345 win32', resources: ['a', 'b', 3] });
  assert.deepEqual([l.fx_build, l.resources_count], ['v1.0.0.12345', 3]);
  assert.equal((await live({ server: 'other' })).fx_build, null);
  assert.equal((await live({ resources: 'nope' })).resources_count, 0);
  const iso = new Date(NOW - 5 * 60_000).toISOString();
  const fresh = await live({ lastSeen: iso });
  assert.deepEqual([fresh.last_seen_at, fresh.fresh], [iso, true]);
  assert.equal((await live({ lastSeen: new Date(NOW - 20 * 60_000).toISOString() })).fresh, false);
  assert.equal((await live({ lastSeen: new Date(NOW - 20 * 60_000 + 1).toISOString() })).fresh, true);
  const bad = await live({ lastSeen: 'garbage' });
  assert.deepEqual([bad.last_seen_at, bad.fresh], [null, false]);
  assert.deepEqual([(await live({})).last_seen_at, (await live({})).fresh], [null, false]);
});

test('tags: split on commas, cleaned to 30 chars, blanks dropped', async () => {
  const l = await live({ vars: { tags: ' roleplay ,, ^1Serious RP , ' + 'x'.repeat(40) + ',  ' } });
  assert.deepEqual(l.tags_raw, ['roleplay', 'Serious RP', 'x'.repeat(30)]);
  assert.deepEqual((await live({ vars: { tags: 5 } })).tags_raw, ['5']);
});

test('framework: first matching core wins, in a fixed order', async () => {
  const fw = async (resources) => (await live({ resources })).framework;
  assert.equal(await fw(['qbx_core', 'qb-core', 'es_extended']), 'qbox');
  assert.equal(await fw(['qb-core', 'es_extended']), 'qbcore');
  assert.equal(await fw(['es_extended', 'vrp']), 'esx');
  assert.equal(await fw(['vrp']), 'vrp');
  assert.equal(await fw(['vrp_basic']), 'vrp');
  assert.equal(await fw(['something']), null);
});

test('style: semi beats serious beats casual, default mixed; reads tags, name and gametype', async () => {
  const st = async (o) => (await live(o)).style;
  assert.equal(await st({ vars: { tags: 'semi-serious' } }), 'semi');
  assert.equal(await st({ vars: { tags: 'semirp, hardcore' } }), 'semi');
  assert.equal(await st({ vars: { tags: 'semi rp' } }), 'semi');
  assert.equal(await st({ vars: { tags: 'hardcore, chill' } }), 'serious');
  assert.equal(await st({ hostname: 'Realistic Life' }), 'serious');
  assert.equal(await st({ gametype: 'MidCore' }), 'serious');
  assert.equal(await st({ vars: { tags: 'chill' } }), 'casual');
  assert.equal(await st({ hostname: 'Newbie friendly' }), 'casual');
  assert.equal(await st({ vars: { tags: 'something' } }), 'mixed');
});

test('features: tag/name regexes and resource regexes, each in its own slot, in a fixed order', async () => {
  const f = async (o) => (await live(o)).features;
  assert.deepEqual(await f({}), []);
  assert.deepEqual(await f({ vars: { tags: 'police, ems, gangs' } }), ['police', 'ems', 'gangs']);
  assert.deepEqual(await f({ hostname: 'LSPD city' }), ['police']);
  assert.deepEqual(await f({ hostname: 'our PD' }), ['police']);
  assert.deepEqual(await f({ hostname: 'upd' }), []);
  assert.deepEqual(await f({ resources: ['esx_policejob'] }), ['police']);
  assert.deepEqual(await f({ resources: ['LSPD-mdt'] }), ['police']);
  assert.deepEqual(await f({ vars: { tags: 'medic' } }), ['ems']);
  assert.deepEqual(await f({ resources: ['ambulancejob'] }), ['ems']);
  assert.deepEqual(await f({ resources: ['gangs-core'] }), ['gangs']);
  for (const [tag, feat] of [['mafia', 'mafia'], ['mc club', 'mafia'], ['cartel', 'mafia'], ['organized', 'mafia'], ['organised', 'mafia'], ['economy', 'economy'], ['jobs', 'jobs'], ['job', 'jobs'], ['business', 'businesses'], ['drugs', 'drugs'], ['heists', 'heists'], ['racing', 'racing'], ['race', 'racing'], ['custom cars', 'custom_cars'], ['addon cars', 'custom_cars'], ['custom vehicles', 'custom_cars'], ['streamer', 'streamer'], ['miami', 'miami'], ['vice city', 'miami'], ['south beach', 'miami'], ['305', 'miami'], ['florida', 'miami'], ['leonida', 'miami']])
    assert.deepEqual(await f({ vars: { tags: tag } }), [feat], tag);
  assert.deepEqual(await f({ resources: ['okokBanking'] }), ['economy']);
  assert.deepEqual(await f({ resources: ['business-mgr'] }), ['businesses']);
  assert.deepEqual(await f({ resources: ['drugs_pack'] }), ['drugs']);
  assert.deepEqual(await f({ resources: ['heist_core'] }), ['heists']);
  assert.deepEqual(await f({ resources: ['racing-lobby'] }), ['racing']);
  assert.deepEqual(await f({ resources: ['pma-voice'] }), ['voice']);
  assert.deepEqual(await f({ resources: ['SaltyChat'] }), ['voice']);
  assert.deepEqual(await f({ resources: ['tokovoip'] }), ['voice']);
  assert.deepEqual(await f({ resources: ['mumble-voip'] }), ['voice']);
  assert.deepEqual(await f({ vars: { tags: 'voice' } }), []);
  assert.deepEqual(await f({ resources: ['mafia_job'] }), []);
  assert.deepEqual(await f({ resources: ['race_track'] }), []);
  assert.deepEqual(await f({ vars: { tags: 'a, drugs, miami, police, voice' }, resources: ['pma-voice', 'banking'] }), ['police', 'economy', 'drugs', 'voice', 'miami']);
  assert.deepEqual(await f({ hostname: 'Miami Police Heist Economy', resources: ['x'] }), ['police', 'economy', 'heists', 'miami']);
  assert.deepEqual(await f({ vars: { sv_projectName: 'Police', tags: 'police' }, resources: ['lspd', 'police'] }), ['police']);
});

test('isCode and cleanText', () => {
  assert.equal(isCode('abc12'), true); assert.equal(isCode('ABC12'), false); assert.equal(isCode('abc1'), false); assert.equal(isCode(12345), false);
  assert.equal(cleanText('^1a\tb\u0000c<d>', 50), 'a b c d'); assert.equal(cleanText(null, 5), ''); assert.equal(cleanText('abcdef', 3), 'abc');
});

const mk = (o = {}) => ({ name: '', host_name: '', gametype: '', tags_raw: [], allowlist: false, voice: null, ...o });

test('isRoleplay: needs a roleplay word, rejects PvP/freeroam names, and PvP tags unless the listing says roleplay', () => {
  assert.equal(isRoleplay(mk({ name: 'Vice City Roleplay' })), true);
  assert.equal(isRoleplay(mk({ name: 'Nothing special' })), false);
  assert.equal(isRoleplay(mk({ tags_raw: ['allowlist'] })), true);
  assert.equal(isRoleplay(mk({ name: 'Freeroam RP' })), false);
  assert.equal(isRoleplay(mk({ host_name: 'Roleplay drift' })), false);
  assert.equal(isRoleplay(mk({ gametype: 'RP deathmatch' })), false);
  assert.equal(isRoleplay(mk({ name: 'Serious RP', tags_raw: ['pvp'] })), false);
  assert.equal(isRoleplay(mk({ name: 'Cool server', tags_raw: ['police', 'pvp'] })), false);
  assert.equal(isRoleplay(mk({ name: 'Cool roleplay', tags_raw: ['pvp'] })), true);
  assert.equal(isRoleplay(mk({ name: 'Cool', tags_raw: ['pvp', 'roleplay'] })), true);
});

test('displayTags: Allowlist/Public first, voice, Title Case, de-duplicated, junk and odd lengths dropped, max 8', () => {
  assert.deepEqual(displayTags(mk()), ['Public']);
  assert.deepEqual(displayTags(mk({ allowlist: true })), ['Allowlist']);
  assert.deepEqual(displayTags(mk({ voice: true })), ['Public', 'In-Game Voice']);
  assert.deepEqual(displayTags(mk({ voice: false })), ['Public']);
  assert.deepEqual(displayTags(mk({ tags_raw: ['serious rp', 'SERIOUS RP', 'police-job', 'x', 'esx', 'default', 'Onesync', 'public', 'a'.repeat(24), 'a'.repeat(25), ''] })),
    ['Public', 'Serious Rp', 'Police-Job', 'A' + 'a'.repeat(23)]);
  assert.deepEqual(displayTags(mk({ allowlist: true, tags_raw: ['allowlist', 'ab'] })), ['Allowlist', 'Ab']);
  assert.deepEqual(displayTags(mk({ tags_raw: ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9'] })), ['Public', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']);
  assert.deepEqual(displayTags(mk({ tags_raw: ['2fast', 'mr. x', 'élan'] })), ['Public', '2fast', 'Mr. X', 'éLan']);
});
