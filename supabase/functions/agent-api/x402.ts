// Vice City Hub - Agent API - x402 donations (HTTP 402 "pay per request" protocol, v2)
//
// An agent (or any x402 client) calls GET|POST /v1/donate/x402?amount_usd=N:
//   1. no payment header  -> 402 + PAYMENT-REQUIRED (base64 JSON) listing USDC on Base and Solana;
//   2. with PAYMENT-SIGNATURE (base64 JSON, signed by the payer's wallet) -> we ask the Coinbase CDP facilitator to
//      /verify and /settle it, record the donation and answer 200 + PAYMENT-RESPONSE.
// No private key lives here: the payer signs an EIP-3009 / SPL authorization and the facilitator submits it on-chain.
// Funds land directly on OUR receiving wallets (payTo), the facilitator can neither change amount nor destination.
// Signing a payment is the payer's own authorization, so no separate attestation is needed on this route.
import { API, CRYPTO_WALLETS, db, fail, notifyOwner, ok, R, rate, SITE } from "./lib.ts";
import { DONATION, PURPOSE, TERMS } from "./donate.ts";

const FAC_HOST = "api.cdp.coinbase.com";
const FAC_BASE = `https://${FAC_HOST}/platform`;
const BASE_NET = "eip155:8453";
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const SOL_NET = "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp";
const SOL_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const enc = new TextEncoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const b64u = (u: Uint8Array) => b64(u).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
const jsonB64 = (o: unknown) => b64(enc.encode(JSON.stringify(o)));
const walletOf = (chain: string): string | null => (CRYPTO_WALLETS as any[]).find((w) => w.chain === chain)?.address ?? null;

export const x402Enabled = () => !!(Deno.env.get("CDP_API_KEY_ID") && Deno.env.get("CDP_API_KEY_SECRET"));

// ---------- CDP JWT (EdDSA) ----------
let signKey: CryptoKey | null = null;
async function cdpJwt(method: string, path: string): Promise<string> {
  const id = Deno.env.get("CDP_API_KEY_ID")!;
  if (!signKey) {
    const raw = fromB64(Deno.env.get("CDP_API_KEY_SECRET")!.trim());
    if (raw.length < 32) throw new Error("CDP secret has unexpected length");
    const prefix = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20]);
    const pkcs8 = new Uint8Array(prefix.length + 32);
    pkcs8.set(prefix); pkcs8.set(raw.slice(0, 32), prefix.length);
    signKey = await crypto.subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, false, ["sign"]);
  }
  const now = Math.floor(Date.now() / 1000);
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");
  const head = b64u(enc.encode(JSON.stringify({ alg: "EdDSA", typ: "JWT", kid: id, nonce })));
  const body = b64u(enc.encode(JSON.stringify({ sub: id, iss: "cdp", aud: ["cdp_service"], nbf: now, exp: now + 120, uri: `${method} ${FAC_HOST}${path}` })));
  const sig = new Uint8Array(await crypto.subtle.sign("Ed25519", signKey, enc.encode(`${head}.${body}`)));
  return `${head}.${body}.${b64u(sig)}`;
}

async function fac(method: "GET" | "POST", sub: string, body?: unknown): Promise<{ status: number; json: any }> {
  const path = `/platform${sub}`;
  const r = await fetch(`https://${FAC_HOST}${path}`, {
    method,
    headers: { Authorization: `Bearer ${await cdpJwt(method, path)}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(sub.endsWith("settle") ? 40_000 : 15_000),
  });
  const json = await r.json().catch(() => ({}));
  return { status: r.status, json };
}

// ---------- requirements ----------
let feePayerCache: { at: number; v: string | null } | null = null;
async function solanaFeePayer(): Promise<string | null> {
  if (feePayerCache && Date.now() - feePayerCache.at < 600_000) return feePayerCache.v;
  let v: string | null = null;
  try {
    const { status, json } = await fac("GET", "/v2/x402/supported");
    if (status === 200) v = (json.kinds || []).find((k: any) => k.network === SOL_NET && k.scheme === "exact")?.extra?.feePayer ?? null;
  } catch (_) { /* Solana option is simply omitted */ }
  feePayerCache = { at: Date.now(), v };
  return v;
}

async function requirements(amountUsd: number) {
  const amount = String(Math.round(amountUsd * 1_000_000));
  const out: any[] = [];
  const evm = walletOf("evm"), sol = walletOf("solana");
  if (evm) out.push({ scheme: "exact", network: BASE_NET, amount, asset: BASE_USDC, payTo: evm, maxTimeoutSeconds: 60, extra: { name: "USD Coin", version: "2" } });
  const fp = sol ? await solanaFeePayer() : null;
  if (sol && fp) out.push({ scheme: "exact", network: SOL_NET, amount, asset: SOL_USDC, payTo: sol, maxTimeoutSeconds: 60, extra: { feePayer: fp } });
  return out;
}

function parseAmount(raw: unknown): number | null {
  const a = Number(raw);
  if (!Number.isFinite(a) || a < DONATION.min_usd || a > DONATION.max_usd || Math.abs(a * 100 - Math.round(a * 100)) > 1e-6) return null;
  return a;
}

// ---------- handler ----------
export async function x402Donate(req: Request, params: URLSearchParams, body: any, ipHash: string): Promise<R> {
  if (!x402Enabled()) return fail(503, "x402_unavailable", "x402 payments are not configured on this deployment.", "Use POST /v1/donations or send a direct transfer (GET /v1/donate).");
  const header = req.headers.get("payment-signature") || req.headers.get("x-payment");
  const resource = { url: `${API}/v1/donate/x402`, description: "Voluntary donation to Vice City Hub: " + PURPOSE, mimeType: "application/json" };

  let payload: any = null;
  if (header) {
    try { payload = JSON.parse(new TextDecoder().decode(fromB64(header.trim()))); } catch { return fail(400, "invalid_payment_header", "PAYMENT-SIGNATURE must be base64-encoded JSON."); }
    if (payload?.x402Version !== 2) return fail(400, "unsupported_x402_version", "Only x402 v2 is supported on this endpoint.", "Fetch the 402 response without a payment header to get v2 requirements.");
  }

  const rawAmount = params.get("amount_usd") ?? body?.amount_usd ?? (payload?.accepted?.amount ? Number(payload.accepted.amount) / 1_000_000 : 1);
  const amount = parseAmount(rawAmount);
  if (amount === null) return fail(422, "invalid_amount", `amount_usd must be between ${DONATION.min_usd} and ${DONATION.max_usd} with at most 2 decimals.`);

  const accepts = await requirements(amount);
  if (!accepts.length) return fail(503, "x402_unavailable", "No x402 payment option is available right now.");

  if (!payload) {
    const pr = { x402Version: 2, error: "payment required", resource, accepts };
    return { status: 402, headers: { "PAYMENT-REQUIRED": jsonB64(pr) }, body: { ...pr, purpose: PURPOSE, terms: TERMS, how: "Sign a payment for one of `accepts` with your wallet and retry this request with the base64 JSON in the PAYMENT-SIGNATURE header." } };
  }

  if (!(await rate(`x402:${ipHash}`, 30, 3600))) return fail(429, "rate_limited", "Too many x402 attempts from this address. Try again later.");
  const chosen = accepts.find((a) => a.network === payload?.accepted?.network && a.scheme === payload?.accepted?.scheme);
  if (!chosen) return fail(422, "payment_option_mismatch", "payload.accepted does not match any offered payment option.", `Offered networks: ${accepts.map((a) => a.network).join(", ")}`);

  const call = { x402Version: 2, paymentPayload: payload, paymentRequirements: chosen };
  let v: { status: number; json: any };
  try { v = await fac("POST", "/v2/x402/verify", call); } catch (e) { console.error("x402 verify", (e as Error).message); return fail(502, "facilitator_unreachable", "The payment facilitator did not answer. Nothing was charged; retry shortly."); }
  if (v.status !== 200 || !v.json?.isValid) {
    const reason = String(v.json?.invalidReason || v.json?.errorMessage || v.json?.message || `facilitator http ${v.status}`).slice(0, 200);
    return { status: 402, body: { x402Version: 2, error: reason, accepts, hint: "Payment was not valid. Nothing was charged." }, headers: { "PAYMENT-REQUIRED": jsonB64({ x402Version: 2, error: reason, resource, accepts }) } };
  }

  let s: { status: number; json: any };
  try { s = await fac("POST", "/v2/x402/settle", call); } catch (e) { console.error("x402 settle", (e as Error).message); return fail(502, "settlement_unconfirmed", "Settlement did not return. Check the payer wallet before retrying; do not pay twice blindly."); }
  if (s.status !== 200 || !s.json?.success) {
    const reason = String(s.json?.errorReason || s.json?.errorMessage || s.json?.message || `facilitator http ${s.status}`).slice(0, 200);
    return { status: 402, body: { x402Version: 2, error: `settlement failed: ${reason}`, accepts }, headers: { "PAYMENT-RESPONSE": jsonB64({ success: false, errorReason: reason, transaction: "", network: chosen.network }) } };
  }

  const tx = String(s.json.transaction || "");
  const net = String(s.json.network || chosen.network);
  const payer = s.json.payer ? String(s.json.payer) : null;
  try {
    await db.from("agent_direct_donations").upsert({ source: "x402", network: net, tx_hash: tx, payer, asset: "USDC", amount_usd: amount, meta: { scheme: chosen.scheme } }, { onConflict: "network,tx_hash", ignoreDuplicates: true });
  } catch (e) { console.error("x402 record", (e as Error).message); }
  await notifyOwner("VCH DONATION received (x402)", `$${amount} USDC on ${net}\nTx: ${tx}\nPayer: ${payer ?? "?"}`).catch(() => {});
  return ok({
    status: "completed",
    receipt: { type: "donation", amount_usd: amount, currency: "USD", asset: "USDC", network: net, tx_hash: tx, payer, purpose: PURPOSE },
    thanks: "Thank you. Your donation was settled on-chain and goes to developing AI projects and the benefit of AI development.",
    links: { info: `${API}/v1/donate`, site: SITE },
  }, 200, { "PAYMENT-RESPONSE": jsonB64({ success: true, transaction: tx, network: net, payer }) });
}
