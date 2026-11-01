// Builds the curated RP server seed from the live-verified candidate list (vice_hub_agent/curation/verified.json).
// Usage: node scripts/build-rp-seed.mjs <verified.json>
// Output: supabase/seed/rp_servers.seed.json, supabase/seed/16_rp_servers_seed.sql, plus *.partN.sql chunks (<=30 rows each).
// Descriptions are templated from verified facts only (style, access, language, framework, features). No invented claims, no player counts.
import fs from 'node:fs';
import path from 'node:path';

const src = process.argv[2];
if (!src) { console.error('usage: node scripts/build-rp-seed.mjs <verified.json>'); process.exit(1); }
const all = JSON.parse(fs.readFileSync(src, 'utf8'));
const OUT = path.resolve('supabase/seed');
fs.mkdirSync(OUT, { recursive: true });

const QUOTA = { en: 45, fr: 10, pt: 8, es: 6, ar: 6, pl: 4, tr: 3, ro: 3, ko: 3, he: 2, th: 2, sr: 2, de: 2, id: 1, da: 1, cs: 1, it: 1, bs: 1 };
const clean = (s) => String(s || '').normalize('NFKC').replace(/[\p{Extended_Pictographic}\p{So}\p{Sm}]/gu, ' ').replace(/[​-‏️]/g, '').replace(/\s+/g, ' ').trim();
// Promo cruft that goes stale in a day ("WIPOU HJ 21-OUT", "LAUNCHED NOW 20-OCT", "#EVENT HALLOWEEN").
const title = (s) => clean(s).replace(/\s*(?:#|\b)(?:wipou|launched now|event|meilleur|new season|hj)\b.*$/i, '').replace(/[\s#\-–—|]+$/g, '').trim();
const norm = (s) => clean(s).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const langName = new Intl.DisplayNames(['en'], { type: 'language' });
const FW = { qbcore: 'QBCore', qbox: 'Qbox', esx: 'ESX', vrp: 'vRP' };
const FEAT = { police: 'police', ems: 'EMS', gangs: 'gangs', mafia: 'mafia', economy: 'economy', jobs: 'jobs', businesses: 'businesses', drugs: 'drugs', heists: 'heists', racing: 'racing', custom_cars: 'custom cars', voice: 'in-game voice', streamer: 'streamer-friendly', miami: 'Miami theme' };
const STY = { serious: 'Serious', semi: 'Semi-serious', casual: 'Casual', mixed: 'General' };
const JUNK = new Set(['default', 'official', 'enhanced', 'onesync', 'rp', 'roleplay', 'esx', 'qb', 'vrp', 'fivem']);

const seen = new Set(), names = new Set(), per = {}, picked = [];
for (const s of [...all].sort((a, b) => b.players - a.players)) {
  const lang = (s.locale || 'xx').slice(0, 2).toLowerCase();
  if (!QUOTA[lang] || (per[lang] || 0) >= QUOTA[lang]) continue;
  const name = title(s.name).slice(0, 60);
  if (name.length < 3) continue;
  const inv = s.invite.toLowerCase(), nk = norm(name).slice(0, 12);
  if (seen.has(inv) || names.has(nk)) continue;
  seen.add(inv); names.add(nk); per[lang] = (per[lang] || 0) + 1;
  const feats = (s.features || []).filter((f) => FEAT[f]);
  let lg = ''; try { lg = s.locale ? langName.of(s.locale.slice(0, 2)) : ''; } catch { /* ignore */ }
  const parts = [`${STY[s.style] || 'General'} ${s.allowlist ? 'allowlist' : 'public'} FiveM roleplay server${lg && lg !== 'English' ? ` (${lg})` : ''}.`];
  if (s.framework) parts.push(`Built on ${FW[s.framework]}.`);
  if (feats.length) parts.push(`Features: ${feats.slice(0, 6).map((f) => FEAT[f]).join(', ')}.`);
  let description = parts.join(' ');
  if (description.length > 220) description = description.slice(0, 217).replace(/[ ,;:]+\S*$/, '') + '...';
  const tags = [s.allowlist ? 'Allowlist' : 'Public', ...(s.features.includes('voice') ? ['In-Game Voice'] : []),
    ...(s.tags || []).map((t) => clean(t)).filter((t) => t.length >= 2 && t.length <= 24 && !JUNK.has(t.toLowerCase()))]
    .filter((t, i, a) => a.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i).slice(0, 8);
  picked.push({
    cfx_code: s.code, name, description, locale: s.locale, rp_style: s.style, access: s.allowlist ? 'allowlist' : 'public',
    framework: s.framework, features: s.features, tags,
    icon_url: s.icon != null ? `https://frontend.cfx-services.net/api/servers/icon/${s.code}/${s.icon}.png` : null,
    discord_url: s.discord.url, discord_members: s.discord.members, discord_online: s.discord.online, discord_verified: !!(s.discord.verified || s.discord.partnered),
    discord_checked_at: s.checked_at, max_players: s.max || null, peak_players: s.peak, resources_count: s.resources, fx_build: s.build,
  });
}
picked.forEach((p, i) => { p.sort_order = (i + 1) * 10; });
fs.writeFileSync(path.join(OUT, 'rp_servers.seed.json'), JSON.stringify(picked, null, 1));

const q = (v) => (v == null ? 'null' : `$q$${String(v).replace(/\$q\$/g, '')}$q$`);
const n = (v) => (Number.isFinite(v) ? String(Math.trunc(v)) : 'null');
const arr = (a) => `array[${a.map(q).join(',')}]::text[]`;
const COLS = 'cfx_code,name,description,locale,rp_style,access,framework,features,tags,icon_url,discord_url,discord_members,discord_online,discord_verified,discord_checked_at,max_players,peak_players,resources_count,fx_build,connect_url,listing_status,source,status,live,sort_order';
const row = (p) => `(${[q(p.cfx_code), q(p.name), q(p.description), q(p.locale), q(p.rp_style), q(p.access), q(p.framework), arr(p.features), arr(p.tags), q(p.icon_url), q(p.discord_url), n(p.discord_members), n(p.discord_online), p.discord_verified, q(p.discord_checked_at) + '::timestamptz', n(p.max_players), n(p.peak_players), n(p.resources_count), q(p.fx_build), q('https://cfx.re/join/' + p.cfx_code), q('active'), q('curated'), q('OFFLINE'), 'false', p.sort_order].join(',')})`;
const SET = COLS.split(',').filter((c) => !['cfx_code', 'listing_status', 'status', 'live'].includes(c)).map((c) => `${c}=excluded.${c}`).join(',');
const stmt = (rows) => `insert into public.rp_servers (${COLS}) values\n${rows.map(row).join(',\n')}\non conflict (cfx_code) where cfx_code is not null do update set ${SET};\n`;
fs.writeFileSync(path.join(OUT, '16_rp_servers_seed.sql'), `-- Curated RP servers. Generated by scripts/build-rp-seed.mjs from live-verified data (Cfx.re API + Discord invite API).\n-- Live fields (players, status) are filled by the rp-servers edge function /sync.\n` + stmt(picked));
for (let i = 0; i < picked.length; i += 30) fs.writeFileSync(path.join(OUT, `16_rp_servers_seed.part${i / 30 + 1}.sql`), stmt(picked.slice(i, i + 30)));
console.log('picked', picked.length, JSON.stringify(per));
