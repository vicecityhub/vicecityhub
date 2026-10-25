# ADR-0002: First-party analytics without cookies

- Status: accepted
- Date: 2026-10-24
- Deciders: Ser, Claude

## Context
The owner needs real traffic numbers without ads, cookies or third-party trackers.

## Decision
- Edge function `hit` (`supabase/functions/hit/index.ts`, verify_jwt=false) writes rows to `public.page_hits` (RLS on, service role only).
- Stored: path, referrer host, utm/ref tag, device class, daily-rotating visitor hash. Not stored: IP, User-Agent, cookies.
- Accepts only the Hub origin, filters bots, rate-limits per visitor hash, always answers 204.
- Clients: `src/lib/analytics.ts` (React) and an inline beacon in `scripts/lib/seo.mjs` (static pages). `?notrack` and Do-Not-Track are respected.

## Consequences
- Unique visitors are per day only (the hash rotates), by design.
- Do not add cookies, localStorage identifiers or third-party scripts.
- Query examples live in `docs/AGENT-HANDOFF.md`.
