# RP Hub · Servers: real servers, live data, one-click connect

Status: in progress (started 2026-10-31). Owner decision: the RP section must list **real** servers with full info and a way to connect.
No invented plaques. Everything below was **verified live on 2026-10-31**.

## 1. Hard rules (inherited from AGENT-HANDOFF.md section 0 and 5)
1. **No invented data.** No hand-typed player counts, votes, viewer numbers, codes, dates, "partnerships". A field we cannot verify is `null` and the UI hides it.
2. Every listed server has a **valid Cfx.re join code that answered the live API** on the day it was added, and a Discord invite that Discord's own API confirmed as valid.
3. We never claim affiliation. Names of well-known private communities (e.g. NoPixel) are **not** listed unless the listing's Discord guild name matches the brand (impersonation protection).
4. Site UI language: American English with GTA sarcasm, but the facts (numbers, rules, access) are exact. Dialogue with the owner: Russian.
5. Only FiveM exists: RAGE:MP was shut down by Take-Two (2026-05-29). Do not add RAGE:MP/alt:V entries.
6. No new npm dependencies for the UI (React 18 + Tailwind + `clsx` already present). Animations: CSS only.
7. Never show player lists, owner avatars or any personal data from the API. Never store IPs.
8. Do not run `git add/commit/push` (the commander does it). Do not touch files you do not own (section 6).

## 2. Verified facts about the Cfx.re API (the old URL is dead)
- The old `servers-frontend.fivem.net/api/servers/single/...` now returns 404 everywhere. The official list frontend now uses:
  - Base: `https://frontend.cfx-services.net/api/servers`
  - One server: `GET {base}/single/<code>` → JSON `{ EndPoint, Data }`. **Code must be lowercase** (uppercase = 404). 404 = unknown/offline listing.
    `Data` keys: `hostname, gametype, mapname, clients, sv_maxclients, svMaxclients, server (build string), enhancedHostSupport, vars, resources[], players[], ownerName, ownerProfile, ownerAvatar, upvotePower, burstPower, lastSeen (ISO), iconVersion, support_status, private, fallback, connectEndPoints`.
    `Data.vars` keys seen: `tags, locale, gamename (gta5|rdr3), sv_projectName, sv_projectDesc, discord_link, banner_connecting, banner_detail, icon_url, peak_players, premium, onesync_enabled, sv_voiceChat, sv_appearAllowlisted ("true" = padlock/allowlist), sv_maxClients, txAdmin-version`.
  - Whole list: `GET {base}/streamRedir/` (about 21 MB, length-prefixed protobuf: 4-byte little-endian length + `Server{1:EndPoint string, 2:ServerData}`; ServerData fields: 1 svMaxclients, 2 clients, 4 hostname, 5 gametype, 8 resources[], 11 iconVersion, 12 vars map, 17 upvotePower). Decoder: `C:\Users\sarma\OneDrive\Documents\vice_hub_agent\cfx_candidates.mjs`. Output already on disk: `cfx_all_gta5.json` (31k GTA V servers, compact rows) and `cfx_rp_candidates.json`. The stream does **not** include `discord_link`; the single endpoint does.
  - CORS is inconsistent (sometimes `*`, sometimes none): the browser must never call it directly. Everything goes through our edge function / table.
  - Join links: `fivem://connect/cfx.re/join/<code>` (launch FiveM), `https://cfx.re/join/<code>` (web), F8 console: `connect cfx.re/join/<code>`. Official page: `https://servers.fivem.net/servers/detail/<code>`.
- Discord invite check (public, no key): `GET https://discord.com/api/v10/invites/<code>?with_counts=true` → `guild.name, guild.features[] (VERIFIED/PARTNERED/COMMUNITY), approximate_member_count, approximate_presence_count`. 404/10006 = invalid or expired.
- The user's PowerShell mangles inline quotes: write scripts to `.mjs` files and run `node file.mjs`. Node 24 is installed, global `fetch` works, real internet is available on the user's machine (the cloud workspace shell is allow-listed and cannot reach these hosts).

## 3. Database (migration 14 already applied to project `lpglkglhjdqnktybksth`)
Table `public.rp_servers`, public SELECT only where `listing_status='active'`; writes only by service role (edge functions).
Existing columns kept: `id, name, logo_url, status, online_count, max_players, tags, description, connect_url, discord_url, is_featured, sort_order, created_at, promo_tier, promo_until`.
New: `cfx_code (unique, ^[a-z0-9]{5,16}$), host_name, project_desc, locale, rp_style (serious|semi|casual|mixed), access (public|allowlist), framework, features text[], icon_url, banner_url, website_url, discord_members, discord_online, discord_verified, discord_checked_at, upvotes, peak_players, resources_count, owner_name, fx_build, live, last_checked_at, last_seen_at, listing_status (active|pending|hidden|dead), source (curated|submitted)`.
TypeScript contract: `src/rp-hub/servers/types.ts` (**read it first**; it also defines the only allowed `features` keys and all connect-link helpers).
`status` semantics: `ONLINE` / `OFFLINE` written by sync only. `access` tells whitelist: `allowlist` means "needs approval first" (join the Discord).
The 6 old placeholder rows are `hidden` (not deleted). The 6 invented `server_news` rows were deleted (backup: `vice_hub_agent\_backup_2026-10-31_rp`). `server_news` is no longer shown in the UI.
Helper table available to functions: `agent_rate(bucket text, window_start timestamptz, hits int)` for rate limits; `agent_cache(key text pk, value jsonb, refresh_lock timestamptz, updated_at)` for throttle locks. Both service-role only.

## 4. Edge function `rp-servers` (verify_jwt=false, public, own input validation; pattern = `supabase/functions/growth/index.ts`)
Files: `index.ts` (router, CORS `*`, JSON helpers), `cfx.ts` (fetch/normalize/classify), `discord.ts` (invite enrichment), `submit.ts` (lookup + submit), `util.ts` (rate limit, sha256, sanitize, throttle lock).
Routes (all JSON, `Cache-Control: no-store` except health):
| Route | What it does |
|---|---|
| `GET /sync` | Refreshes live fields of active/dead listings, oldest `last_checked_at` first, max 60 per run, concurrency 6, 8 s timeout per fetch, 45 s total budget. Throttle: refuse (`{ok:true, skipped:true}`) if the last run was < 90 s ago (lock in `agent_cache` key `rp-sync`). Safe to call without credentials (cron calls it every 2 minutes). |
| `GET /enrich` | Discord invite check for up to 20 listings with the oldest `discord_checked_at` (throttle 10 min, key `rp-enrich`). Invalid invite → `discord_url=null`, members null. |
| `GET /lookup?code=` | Public preview of a code (validates, returns what would be listed + `reasons[]` if rejected). Rate: 20/hour per IP hash. |
| `POST /submit` `{code, company}` | Self-service listing, fully automatic, no human. `company` is a honeypot (non-empty → pretend success). Rate: 3/hour per IP hash, 40/day global. Auto-approve only if: live API answers 200, `gamename=gta5`, `lastSeen` < 20 min, ≥ 5 players online right now, tags/gametype say roleplay, a valid `discord_link` in the listing, name/description pass the blocklist. Data is taken **only from the listing**, never from the request. Result `listing_status='active', source='submitted'`. Duplicate → 409 with the existing listing. |
| `GET /health` | `{ok, listed, live, last_sync_at, last_enrich_at}` (cache 30 s). |
Normalization (sync): `name` = cleaned `sv_projectName` (fallback hostname), strip `^\d` colour codes, control chars, `<>`, collapse spaces, max 80. `online_count=clients`, `max_players=sv_maxclients`, `peak_players=int(vars.peak_players)`, `upvotes=upvotePower`, `locale=vars.locale`, `resources_count=resources.length`, `owner_name=ownerName`, `fx_build` short (e.g. `1.0.0.37850`), `icon_url=https://frontend.cfx-services.net/api/servers/icon/<code>/<iconVersion>.png` when `iconVersion` is a number, `banner_url` only if it starts with `https://cfx-server-metadata.cfx-services.net/` or `https://frontend.cfx-services.net/` else null. `access='allowlist'` if `sv_appearAllowlisted==='true'`, otherwise keep the curated value. `live` = 200 and `lastSeen` < 20 min; then `status='ONLINE'`, else `status='OFFLINE'`. `last_seen_at=lastSeen`. A listing not seen for 14 days → `listing_status='dead'` (hidden by RLS); a dead one that answers again → `active`. Never auto-activate `hidden`.
Cron (added after deploy, same style as `07_v12_crypto_reconcile_cron.sql`): `rp-servers-sync` `*/2 * * * *` → `net.http_get(.../rp-servers/sync)`, `rp-servers-enrich` `*/15 * * * *` → `/enrich`.

## 5. Seed format (`supabase/seed/rp_servers.seed.json`, produced by Curation, inserted by the commander)
Array of objects:
```json
{ "cfx_code":"5dg4mr", "name":"District 99", "description":"<=220 chars, factual, EN, light GTA humour allowed, no claims we cannot back up",
  "rp_style":"semi", "access":"public", "framework":"custom", "locale":"en-US",
  "tags":["Public","Voice","Police","Gangs"], "features":["police","gangs","economy"],
  "discord_url":"https://discord.gg/xxxx", "website_url":null,
  "evidence":{"checked_at":"2026-10-31T10:00:00Z","players":777,"max":2048,"discord_guild":"District 99","discord_members":12345,"discord_verified":false} }
```
Selection policy: GTA V RP only; live now; `discord_url` valid per Discord API with >= 150 members; no NSFW/hate/scam; no duplicates of the same community (keep the flagship instance, mention siblings in `description` only if verified); no impersonators of famous brands (rule 1.3); mix: ~75-90 servers total, English first, plus the biggest RP communities per language (pt-BR, es, fr, de, tr, ar, ru, pl, asian locales), allowlist and public, serious/semi/casual, and a **Miami / Vice City themed** group (on-brand for the Hub; feature key `miami`).

## 6. File ownership (nobody edits files outside their list)
- Backend: `supabase/functions/rp-servers/*`, `supabase/15_rp_servers_cron.sql`; the live-fields table migration was applied in Supabase and its file is no longer in the repo. Tests: `tests/cfxLive.test.mjs`, `tests/rpServersCron.test.mjs` (they replaced the old selftest script).
- Curation: `supabase/seed/*` and scratch files in `vice_hub_agent\curation\`.
- Frontend: `src/rp-hub/servers/*` (except `types.ts`, read-only), `src/rp-hub/components/ServersTab.tsx`, the fake server mocks (already deleted).
- Surfaces/SEO: the RP servers page generator (its script is no longer in the repo), `supabase/functions/agent-api/handlers.ts` (+`mcp.ts` if it lists servers), `scripts/gen-agent-surface.mjs`, `vite-plugins/agent-surface.ts`, `package.json` (only the `prebuild` script line). `scripts/gen-seo-pages.mjs` is dirty from another session: **do not edit it**.
- Commander only: git, DB writes/seed insert, cron SQL apply, `docs/AGENT-HANDOFF.md`, `docs/RP-SERVERS.md`, memory.

## 7. Verification commands (PowerShell on the user's machine, repo `C:\Users\sarma\Documents\deployd\hub`)
```
$env:NODE_ENV=''; npx tsc --noEmit -p tsconfig.app.json
npm run build            # runs prebuild generators + tsc -b + vite build
npm run verify:dist
```
`node_modules` is installed. If a command needs `npm install`, run `$env:NODE_ENV=''; npm install --include=dev` first.

## 9. Status (2026-11-02)
- DONE: edge function `rp-servers` deployed (verify_jwt=false), cron `rp-servers-sync` every 2 min and `rp-servers-enrich` every 15 min (migration 15), 100 curated servers seeded from `supabase/seed/rp_servers.seed.json` (rebuild with `node scripts/build-rp-seed.mjs <verified.json>`), new UI in `src/rp-hub/servers` + `ServersTab.tsx`, old fake servers deleted.
- Seed is loaded by pg_net from the raw GitHub JSON (no manual SQL paste needed): `net.http_get` the raw URL, then `jsonb_to_recordset` upsert on `cfx_code`.
- TODO: agent-api `/v1/rp/servers` still selects the old columns and has no `listing_status` filter (only active rows exist today, so it is correct for now); add fivem:// links and the filter on next agent-api deploy. Static `/rp-servers/` SEO page (gen-rp-servers-page.mjs) not built yet. 291 candidates from the first verify run failed with api error (rate limit) and could be re-verified to widen the list.
