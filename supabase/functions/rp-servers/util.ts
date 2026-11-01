// Deno-specific helpers for the rp-servers edge function. Service-role client: never expose it.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
export const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers } });

export async function sha(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}
export const ipHash = async (req: Request) =>
  (await sha("vch-rp|" + ((req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "?"))).slice(0, 24);

/** Fixed-window rate limit on table agent_rate. true = allowed. */
export async function rate(bucket: string, limit: number, windowSec: number): Promise<boolean> {
  const ws = new Date(Math.floor(Date.now() / 1000 / windowSec) * windowSec * 1000).toISOString();
  const { data } = await db.from("agent_rate").select("hits").eq("bucket", bucket).eq("window_start", ws).maybeSingle();
  const hits = (data?.hits ?? 0) + 1;
  if (hits > limit) return false;
  await db.from("agent_rate").upsert({ bucket, window_start: ws, hits }, { onConflict: "bucket,window_start" });
  return true;
}

/** Cron throttle on agent_cache.refresh_lock: true = allowed (and the lock is taken). Best effort. */
export async function throttle(key: string, seconds: number): Promise<boolean> {
  const { data } = await db.from("agent_cache").select("refresh_lock").eq("key", key).maybeSingle();
  if (data?.refresh_lock && Date.now() - Date.parse(data.refresh_lock) < seconds * 1000) return false;
  const now = new Date().toISOString();
  await db.from("agent_cache").upsert({ key, value: {}, refresh_lock: now, updated_at: now }, { onConflict: "key" });
  return true;
}

/** Runs fn over items with at most n in flight. */
export async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}
