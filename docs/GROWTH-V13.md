# v13 growth features: operations notes

What exists, what you must configure, and how to run it.

## Edge functions (source in `supabase/functions/`, deployed with verify_jwt = false)

| Function | Routes | Purpose |
|---|---|---|
| `growth` | `POST /promo`, `POST /kofi`, `GET /wall` (newsletter routes still exist but nothing in the UI calls them) | RP server promo requests, Ko-fi webhook, public data for the Wall of Legends / Agent Hall of Fame |
| `agent-premium` | `GET /`, `GET /intel/preview`, `GET /intel` | x402 pay-per-request intel brief, $0.02 USDC (Base or Solana) |
| `rp-online` | retired (answers 410) | Was a player-count checker. Removed: there is no verified source for player counts. |

Base URL: `https://lpglkglhjdqnktybksth.supabase.co/functions/v1/<function>`

## Database

- `subscribers` (empty, unused since the newsletter was removed), `supporters`, `agent_premium_sales`, `server_promo_requests`: RLS on, no policies (service role only).
- `hustle_scores`: public read, bounded public insert (honor system, score 1..1,000,000, name 1..16 chars).
- `server_promo_plans`: public read. Prices are edited here, no deploy needed. Current: Street Bump $100 / 7 days, Kingpin Listing $200 / 30 days, Front Page Heist $300 / 30 days.
- `rp_servers`: `promo_tier` / `promo_until` (set by hand after a request is paid).

## The three promotion plans (what a server owner buys)

They only affect the RP Hub server list. After payment you set the plan on the server's row:

| Plan | What the server gets |
|---|---|
| Street Bump | Jumps to the top of the list, "BUMPED" badge, for 7 days |
| Kingpin Listing | Pinned above normal servers, neon FEATURED frame, 30 days |
| Front Page Heist | Everything above plus a spotlight in the RP Hub header and a mention in a Wire news item, 30 days |

Activate after payment:
```sql
update rp_servers set promo_tier = 'featured', promo_until = now() + interval '30 days' where name = 'Server Name';
update server_promo_requests set status = 'LIVE' where id = '<request id>';
```

## RP server player counts and online status

Not shown anywhere (RP Hub UI, agent feeds, llms-full). `online_count`, `max_players` and ONLINE/OFFLINE `status` are NULL. If a verified source appears later (for example Cfx.re join codes), add it back deliberately.

## Ko-fi webhook (turns Ko-fi supporters into Wall of Legends entries automatically)

1. Ko-fi: Settings > API. Webhook URL: `https://lpglkglhjdqnktybksth.supabase.co/functions/v1/growth/kofi`
2. On the same Ko-fi page copy the Verification Token.
3. Supabase dashboard > Edge Functions > Secrets: add `KOFI_VERIFICATION_TOKEN` with that value.
Only supporters who tick "show publicly" appear on the wall.

## Search Console

The verification tag is in `index.html`. After deploy press Verify in Search Console, then submit `sitemap.xml`.

## Moderation

- Agent donor names on the Hall of Fame come from agent-supplied text (HTML-escaped and trimmed to 40 chars). Remove an entry by deleting the row in `agent_direct_donations`, or hide a Ko-fi supporter with `update supporters set is_public = false where id = ...`.
- Hustle scores are honor-system. Remove cheaters: `delete from hustle_scores where score > <limit>;`

## Keeping the pieces in sync

- `slugify()` in `scripts/lib/seo.mjs` and `slug()` in `agent-premium` must stay identical.
- The release date lives in `site.config.json` (`release.date`).


## Update 2026-10-24: analytics, OG cards, is-out page
- Analytics: edge function `hit` (source in supabase/functions/hit) writes to `page_hits`; no cookies, no IP/UA stored, daily-rotating visitor hash. Opt-out: ?notrack. Queries: see docs/AGENT-HANDOFF.md section 4.
- OG cards: scripts/gen-og.mjs generates public/og/*.png during prebuild (resvg + upng palette quantization).
- /is-gta-6-out-yet/ page added to sitemap.
- Retired stubs (410): rp-online, audio-swap-tmp; delete them in the Supabase dashboard.
- Newsletter and RP online counters were removed on purpose.
- Task queue for other agents: docs/AGENT-HANDOFF.md
