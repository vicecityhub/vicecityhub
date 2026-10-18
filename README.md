# Vice City Hub 🌴 — v12 "Open to Agents"

> The GTA VI fan hub for **humans and AI agents**. Neon UI for people, MCP + REST + `llms.txt` + safe auto-buy for machines.

**Live:** https://vicecityhub.github.io/vicecityhub · **Agent docs:** [`/llms.txt`](https://vicecityhub.github.io/vicecityhub/llms.txt) · **Agent console:** [`/agents.html`](https://vicecityhub.github.io/vicecityhub/agents.html)

## What v12 adds

| Layer | What | Where |
|---|---|---|
| Agent API (REST) | catalog, news, RP data, search, quotes, orders, intents | `supabase/functions/agent-api/` |
| MCP server | 17 tools, stateless streamable-HTTP | `…/agent-api/mcp` |
| Discovery | `llms.txt`, `llms-full.txt`, `.well-known/{agent.json,mcp.json,api-catalog,ai-plugin.json,security.txt}`, `openapi.json` | generated → `public/` |
| Static feeds | `data/{news,catalog,rp-*}.json` + manifest `data/index.json` | generated → `public/data/` |
| Per-page SEO/agent markup | `<link>` hints, one JSON-LD `@graph`, `<noscript>` content | `vite-plugins/agent-surface.ts` |
| Agent purchases | price-locked quotes → idempotent orders → PayPal or on-chain stablecoin, human-set spend mandates | `orders.ts`, `verify.ts`, `owner.ts` |
| Human console | mint/revoke spend-limited keys, browse catalog, track orders | `src/pages/Agents.tsx` |

Humans keep the full neon UI (React SPA per page). Nothing was removed from the human experience.

## Single source of truth

`site.config.json` — name, URLs, page list (titles, descriptions, priorities, feeds). The generator, the Vite plugin, `llms.txt`, the sitemap and all JSON-LD read from it. **Add a page → add one entry there.**

## Build pipeline

```
npm run build
 ├─ prebuild  scripts/gen-agent-surface.mjs   live API → public/{llms*.txt, openapi.json, sitemap.xml, .well-known/*, data/*}
 ├─ tsc -b
 └─ vite build   (agentSurface plugin injects discovery links + JSON-LD + <noscript> into every HTML entry)
```

The generator never fails a build: if the API is unreachable it keeps the previous files (`--strict` to fail instead).
CI (`.github/workflows/deploy.yml`) rebuilds on push, manually, and every 6 h after the news agent so feeds stay fresh, then verifies the agent files exist in `dist/`.

## Project map

```
site.config.json            ← edit pages/URLs here
vite-plugins/agent-surface.ts
scripts/
  gen-agent-surface.mjs     ← llms.txt, .well-known, feeds, sitemap
  test-agent-api.mjs        ← 30-check safe smoke test (never moves money)
  news-agent.mjs            ← scheduled news ingestion
  selftest-verify.mjs       ← on-chain verifier self-test
public/                     ← robots.txt + generated agent files (committed so Pages works even if generation fails)
src/{pages,components,lib,rp-hub}
supabase/functions/{agent-api,paypal-checkout,printful-hub,link-preview,…}
docs/legacy/                ← old one-off notes/scripts (kept, not used)
```

## Agent purchase protocol (short)

1. `POST /v1/agents/register` → key (`$100/order`, `$250/day`) — or a human mints a bigger mandate in the console.
2. `POST /v1/quotes` → price locked 15 min.
3. `POST /v1/orders` + `Idempotency-Key` → `next_action` (PayPal `approve_url` or exact-amount stablecoin transfer).
4. `POST /v1/orders/{id}/payment-proof` (crypto) / `capture` (PayPal) → `GET /v1/orders/{id}/status` until `paid`.

Peer listings (partner products, community servers) are intent-only — the Hub never custodies funds for them.

## Develop

```bash
npm ci
npm run dev            # Vite
npm run gen:agent      # regenerate agent surface
npm run typecheck
npm run test:agent     # smoke-test the live Agent API
npm run build
```

Deploy the edge function: `npx supabase functions deploy agent-api --no-verify-jwt --use-api`

## Known platform limits (GitHub Pages project site)

`robots.txt`, `llms.txt` and `/.well-known/*` are served under `/vicecityhub/`, not at the host root. Crawlers and some agents look at `https://vicecityhub.github.io/robots.txt` (root). For full spec-compliant discovery use a custom domain, or publish the same files from a `vicecityhub.github.io` user-site repo. The Agent API itself (Supabase) serves `/v1` index, OpenAPI and MCP from its own root, so it is discoverable regardless.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/vicecityhub)
