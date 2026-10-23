# v13 growth features: operations notes

What exists, what you must configure, and how to run it.

## Edge functions (source in `supabase/functions/`, deployed with verify_jwt = false)

| Function | Routes | Purpose |
|---|---|---|
| `growth` | `POST /newsletter/subscribe`, `GET /newsletter/confirm`, `GET /newsletter/unsubscribe`, `POST /promo`, `POST /kofi`, `GET /wall` | Newsletter list, RP server promo requests, Ko-fi webhook, public data for the Wall of Legends / Agent Hall of Fame |
| `agent-premium` | `GET /`, `GET /intel/preview`, `GET /intel` | x402 pay-per-request intel brief, $0.02 USDC (Base or Solana) |

Base URL: `https://lpglkglhjdqnktybksth.supabase.co/functions/v1/<function>`

## Database (applied as migrations `growth_features_v13` and `server_promo_requests`)

- `subscribers`, `supporters`, `agent_premium_sales`, `server_promo_requests`: RLS on, no policies (service role only).
- `hustle_scores`: public read, bounded public insert (honor system, score 1..1,000,000, name 1..16 chars).
- `server_promo_plans`: public read. **Edit the prices here** (seeded with placeholders: Street Bump $9/7d, Kingpin Listing $29/30d, Front Page Heist $59/30d).
- `rp_servers.promo_tier` / `promo_until`: set by hand after a request is paid.

## Things only you can do

1. **Ko-fi webhook** (turns Ko-fi supporters into Wall of Legends entries automatically)
   - Ko-fi: Settings > API > Webhooks. Webhook URL: `https://lpglkglhjdqnktybksth.supabase.co/functions/v1/growth/kofi`
   - Copy the verification token from the same page and store it as the Supabase secret `KOFI_VERIFICATION_TOKEN`.
   - Only supporters who tick "show publicly" appear on the wall.
2. **Newsletter sending needs a verified domain in Resend.** The Resend account currently has no verified domain, so mail can only go to the account owner. Until then the signup form stores addresses as `pending` and promises nothing it cannot deliver.
   - Verify a regular domain in Resend (the `.hub` UD name cannot receive or send email), then set the Supabase secret `NEWSLETTER_FROM` to `Vice City Hub <hello@your-domain>`.
   - After that, new signups receive a confirmation email and become `confirmed` on click.
3. **Activate a paid RP promotion** after payment:
   ```sql
   update rp_servers set promo_tier = 'featured', promo_until = now() + interval '30 days' where id = '<server id>';
   update server_promo_requests set status = 'LIVE' where id = '<request id>';
   ```
4. **Search Console / Bing Webmaster**: verify `https://vicecityhub.github.io/vicecityhub/` and submit `sitemap.xml`. Until you do there is no traffic data other than the Agent API tables.

## Moderation

- Agent donor names on the Hall of Fame come from agent-supplied text (HTML-escaped and trimmed to 40 chars). Remove an entry by deleting the row in `agent_direct_donations`, or hide a Ko-fi supporter with `update supporters set is_public = false where id = ...`.
- Hustle scores are honor-system. Remove cheaters: `delete from hustle_scores where score > <limit>;`

## Keeping the pieces in sync

- `slugify()` in `scripts/lib/seo.mjs` and `slug()` in `agent-premium` must stay identical (canonical URLs in the paid brief point at the static news pages).
- The release date lives in `site.config.json` (`release.date`). Update it when Rockstar moves the date.
