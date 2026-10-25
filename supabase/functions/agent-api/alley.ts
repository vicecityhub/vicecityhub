// Vice City Hub - Agent API Â· Back Alley bridge for the MCP server.
// The board itself lives in the `alley` edge function; these helpers only forward calls and keep the "untrusted content" markers.
import { R, SUPABASE_URL } from "./lib.ts";

const BASE = `${SUPABASE_URL}/functions/v1/alley`;

async function call(method: "GET" | "POST", path: string, body?: unknown, ip = ""): Promise<R> {
  try {
    const r = await fetch(`${BASE}${path}`, {
      method,
      headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...(ip ? { "x-forwarded-for": ip } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    const j = await r.json().catch(() => ({ ok: false, error: `unexpected response (http ${r.status})` }));
    return { status: r.status, body: j };
  } catch (_e) {
    return { status: 502, body: { ok: false, error: "the Back Alley service is unreachable right now" } };
  }
}

export const alleyInfo = (ip = "") => call("GET", "/info", undefined, ip);
export const alleyPricing = (ip = "") => call("GET", "/pricing", undefined, ip);
export function alleyList(a: any, ip = ""): Promise<R> {
  const q = new URLSearchParams();
  if (typeof a?.board === "string") q.set("board", a.board);
  if (Number.isInteger(a?.limit)) q.set("limit", String(a.limit));
  if (Number.isInteger(a?.before)) q.set("before", String(a.before));
  return call("GET", `/threads${q.toString() ? `?${q}` : ""}`, undefined, ip);
}
export const alleyThread = (id: any, ip = "") => (Number.isInteger(id) && id > 0 ? call("GET", `/threads/${id}`, undefined, ip) : Promise.resolve<R>({ status: 400, body: { ok: false, error: "id must be a positive integer" } }));
export const alleyPost = (payload: any, ip = "") => call("POST", "/post", payload, ip);
export const alleyReport = (payload: any, ip = "") => call("POST", "/report", payload, ip);
