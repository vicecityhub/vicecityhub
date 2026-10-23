# v13 growth features: operations notes

What exists, what you must configure, and how to run it.

## Edge functions (source in `supabase/functions/`, deployed with verify_jwt = false)

| Function | Routes | Purpose |
|---|---|---|
| `growth` | `POST /promo`, `POST /kofi`, `GET /wall` (newsletter routes still exist but nothing in the UI calls them) | RP server promo requests, Ko-fi webhook, public data for the Wall of Legends / Agent Hall of Fame |
| `agent-premium` | `GET /`, `GET /intel/preview`, `GET /intel` | x402 pay-per-request intel brief, $0.02 USDC (Base or Solana) |
| `rp-online` | `GET /`, `GET /?code=<cfx code>` | Real RP server player counts from the public FiveM API (every 10 min via pg_cron) |

Base URL: `https://lpglkglhjdqnktybksth.supabase.co/functions/v1/<function>`

## Database

- `subscribers` (empty, unused since the newsletter was removed), `supporters`, `agent_premium_sales`, `server_promo_requests`: RLS on, no policies (service role only).
- `hustle_scores`: public read, bounded public insert (honor system, score 1..1,000,000, name 1..16 chars).
- `server_promo_plans`: public read. Prices are edited here, no deploy needed. Current: Street Bump $100 / 7 days, Kingpin Listing $200 / 30 days, Front Page Heist $300 / 30 days.
- `rp_servers`: `promo_tier` / `promo_until` (set by hand after a request is paid), `cfx_code` (Cfx.re join code), `online_checked_at`.

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

## Real online counts

- `online_count = NULL` means unknown and the UI shows a dash. Nothing is invented.
- To get a live count for a server, give it a Cfx.re join code (the part after `cfx.re/join/` in its FiveM link):
  ```sql
  update rp_servers set cfx_code = 'abc123' where name = 'SRTG RP';
  ```
- `rp-online` checks every row with a code every 10 minutes. A code that does not exist marks the server OFFLINE with 0 players. Test a code without writing anything: `.../functions/v1/rp-online?code=abc123` (one call per minute).

## Ko-fi webhook (turns Ko-fi supporters into Wall of Legends entries automatically)

1. Ko-fi: Settings > API. Webhook URL: `https://lpglkglhjdqnktybksth.supabase.co/functions/v1/growth/kofi`
2. On the same Ko-fi page copy the Verification Token.
3. Supabase dashboard > Edge Functions > Secrets: add `KOFI_VERIFICATION_TOKEN` with that value.
Only supporters who tick "show publicly" appear on the wall.

## Search Console

Open https://search.google.com/search-console, add a "URL prefix" property `https://vicecityhub.github.io/vicecityhub/`, choose the "HTML tag" method and send the `content="..."` value; it goes into the page head and then Verify + submit `sitemap.xml`.

## Moderation

- Agent donor names on the Hall of Fame come from agent-supplied text (HTML-escaped and trimmed to 40 chars). Remove an entry by deleting the row in `agent_direct_donations`, or hide a Ko-fi supporter with `update supporters set is_public = false where id = ...`.
- Hustle scores are honor-system. Remove cheaters: `delete from hustle_scores where score > <limit>;`

## Keeping the pieces in sync

- `slugify()` in `scripts/lib/seo.mjs` and `slug()` in `agent-premium` must stay identical.
- The release date lives in `site.config.json` (`release.date`).
