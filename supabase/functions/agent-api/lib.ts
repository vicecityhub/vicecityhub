// Vice City Hub — Agent API · shared helpers (v12)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export const SITE = "https://vicecityhub.github.io/vicecityhub";
export const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
export const API = `${SUPABASE_URL}/functions/v1/agent-api`;
export const db = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

export const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, x-api-key, idempotency-key, x-client-info, apikey, mcp-session-id, mcp-protocol-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "retry-after, idempotent-replayed",
};

// Every handler returns R; the router turns it into a Response.
export type R = { status: number; body: unknown; headers?: Record<string, string> };
export const ok = (body: unknown, status = 200, headers?: Record<string, string>): R => ({ status, body, headers });
export const fail = (status: number, code: string, message: string, hint?: string): R => ({
  status,
  body: { error: { code, message, ...(hint ? { hint } : {}), docs: `${SITE}/agents.html`, openapi: `${API}/v1/openapi.json` } },
});

export function toResponse(r: R): Response {
  return new Response(JSON.stringify(r.body), {
    status: r.status,
    headers: {
      ...CORS,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(r.headers || {}),
    },
  });
}

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// `meta` columns were historically written with JSON.stringify() into jsonb → may be a JSON *string*.
export function parseMeta(m: any): Record<string, any> {
  if (!m) return {};
  if (typeof m === "string") {
    try { const p = JSON.parse(m); return p && typeof p === "object" ? p : {}; } catch { return {}; }
  }
  return typeof m === "object" ? m : {};
}

export const num = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
};
export const round2 = (n: number) => Math.round(n * 100) / 100;

export async function clientIpHash(req: Request): Promise<string> {
  const ip = (req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown").split(",")[0].trim();
  return (await sha256Hex("vch12|" + ip)).slice(0, 24);
}

export async function rate(bucket: string, limit: number, windowSec: number): Promise<boolean> {
  const { data, error } = await db.rpc("agent_rate_hit", { p_bucket: bucket, p_limit: limit, p_window: windowSec });
  if (error) return true; // fail-open: never lock agents out because of our own bug
  return data === true;
}

export interface Key {
  id: string;
  owner_id: string | null;
  name: string;
  scopes: string[];
  max_order_usd: number;
  max_daily_usd: number;
  allowed_kinds: string[];
}

/** null = anonymous · "invalid" = a key was sent but is wrong/revoked/expired */
export async function authenticate(req: Request): Promise<Key | null | "invalid"> {
  const h = req.headers.get("authorization") || "";
  const raw = (h.toLowerCase().startsWith("bearer ") ? h.slice(7) : req.headers.get("x-api-key") || "").trim();
  if (!raw) return null;
  if (!/^vch_live_[0-9a-f]{48}$/.test(raw)) return "invalid";
  const hash = await sha256Hex(raw);
  const { data } = await db
    .from("agent_keys")
    .select("id,owner_id,name,scopes,max_order_usd,max_daily_usd,allowed_kinds,is_active,expires_at")
    .eq("key_hash", hash)
    .maybeSingle();
  if (!data || !data.is_active) return "invalid";
  if (data.expires_at && new Date(data.expires_at) < new Date()) return "invalid";
  db.from("agent_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id).then(() => {});
  return {
    id: data.id,
    owner_id: data.owner_id,
    name: data.name,
    scopes: data.scopes,
    max_order_usd: Number(data.max_order_usd),
    max_daily_usd: Number(data.max_daily_usd),
    allowed_kinds: data.allowed_kinds,
  };
}

export async function notifyOwner(subject: string, text: string) {
  try {
    const hook = Deno.env.get("NOTIFY_WEBHOOK_URL");
    if (hook) {
      await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: `**${subject}**\n${text}` }) });
    }
    const rk = Deno.env.get("RESEND_API_KEY");
    if (rk) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${rk}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: Deno.env.get("RESEND_FROM") || "Vice City Hub <onboarding@resend.dev>",
          to: [Deno.env.get("OWNER_EMAIL") || "vicecityhub@proton.me"],
          subject,
          text,
        }),
      });
    }
  } catch (_) { /* best effort */ }
}

export const CRYPTO_WALLETS = (() => {
  try {
    const o = Deno.env.get("CRYPTO_WALLETS_JSON");
    if (o) return JSON.parse(o);
  } catch (_) { /* fall through */ }
  return [
    { chain: "tron", network: "TRON (TRC-20)", asset: "USDT", address: "TRyGNvj1NcVM1V6aDJmycNBiSKWumZ4Zhz" },
    { chain: "evm", network: "Base, Polygon, Arbitrum, Optimism or Ethereum (same EVM address on all)", asset: "USDT or USDC", address: "0x04b9d483E4dcc059CC2fb9375De5244C0A7ddce1" },
    { chain: "solana", network: "Solana", asset: "USDC", address: "Gc75C9QnC59nTVW4f729VbWxcE6fsatGkZBQmQDJqB8b" },
  ];
})();
