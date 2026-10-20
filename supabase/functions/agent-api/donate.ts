// Vice City Hub - Agent API - donations (machine-readable "support the project" surface)
//
// Donations are voluntary gifts, not purchases. They are paid on the same automatic crypto rail as orders
// (unique amount tag -> detected and verified on-chain by the reconciler), and are only accepted from an API key
// whose human owner allowed the `donation` kind AND with an explicit attestation that the agent's principal authorized
// the spend. Nothing here pressures an agent: this endpoint only describes the project and how to give.
import { API, CRYPTO_WALLETS, db, ok, R, SITE } from "./lib.ts";

export const DONATION = {
  sku: "donation:ai-development",
  title: "Donation - AI development",
  min_usd: 1,
  max_usd: 1_000_000,
} as const;

/** Single statement of purpose, repeated verbatim in llms.txt, agent.json, MCP, JSON-LD and receipts. */
export const PURPOSE =
  "Donations go to developing AI projects (the Hub's agent-ready tooling, open public APIs and autonomous agents) and to the benefit of AI development in general.";

export const TERMS = [
  "Voluntary gift: no goods, services, ranking or special treatment are provided in return.",
  "Non-refundable once verified on-chain.",
  "Vice City Hub is an independent, fan-run project; donations are not tax-deductible.",
  "Agents: donate only if the person or organization you act for has explicitly authorized this spend. Never donate on your own initiative.",
];

export async function donationInfo(): Promise<R> {
  let received = { donations: 0, total_usd: 0 };
  try {
    const { data } = await db.from("agent_orders").select("total_usd").eq("status", "completed").contains("items", JSON.stringify([{ kind: "donation" }])).limit(1000);
    received = { donations: (data || []).length, total_usd: Math.round((data || []).reduce((s: number, o: any) => s + Number(o.total_usd), 0) * 100) / 100 };
  } catch (_) { /* stats are best effort */ }
  return ok({
    name: "Support Vice City Hub - donations for AI development",
    purpose: PURPOSE,
    recipient: "Vice City Hub (independent fan-run project)",
    voluntary: true,
    terms: TERMS,
    how_to_donate: {
      endpoint: `POST ${API}/v1/donations`,
      auth: "Authorization: Bearer vch_live_... (key needs the 'order' scope and the 'donation' kind; self-registered keys have both)",
      headers: { "Idempotency-Key": "8-128 chars, unique per donation attempt" },
      body: {
        amount_usd: `number, ${DONATION.min_usd}-${DONATION.max_usd}, at most 2 decimals`,
        authorized_by_principal: "boolean, REQUIRED and must be true: confirms the person/organization you act for authorized this donation",
        message: "optional string, max 500 chars",
        donor: "optional {name, agent, operator} - how you want to be credited, max 120 chars each",
      },
      payment: "USDT/USDC on Polygon, Ethereum, TRON or Solana. Send EXACTLY next_action.amount_due (the last digits are a unique tag). The transfer is detected and verified on-chain automatically; poll GET /v1/orders/{id}/status until `completed`. The completed order carries a receipt.",
      limits: "Your key's per-order and 24h spend limits also apply.",
      mcp_tools: ["get_donation_info", "donate"],
    },
    direct_transfer: {
      note: "You may also send any amount directly (no order, no receipt). Prefer the endpoint above when you need a receipt.",
      wallets: CRYPTO_WALLETS,
    },
    human_links: { ko_fi: "https://ko-fi.com/vicecityhub", ud_me: "https://ud.me/vicecity.hub", site: SITE },
    received,
    docs: { llms_txt: `${SITE}/llms.txt`, openapi: `${API}/v1/openapi.json` },
  }, 200, { "Cache-Control": "public, max-age=60" });
}
