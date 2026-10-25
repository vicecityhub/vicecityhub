// Device login for consoles (PS5 browser etc.): type nothing on the console, approve on a phone that is already signed in.
// Deployed with verify_jwt=false: /start and /poll are anonymous by design; /inspect and /approve check the caller's JWT themselves.
//   POST /start             -> { code, secret, expires_in, interval, verify_url }   (console shows `code`, keeps `secret`)
//   POST /poll {secret}     -> 202 pending | 200 { status:"approved", token_hash }  (console then calls supabase.auth.verifyOtp({ token_hash, type:"magiclink" }))
//   POST /inspect {code}    -> { device, requested_ago_s }        (signed-in phone: shows what it is about to approve)
//   POST /approve {code}    -> { ok:true }                        (signed-in phone: links the console to THIS account)
// Security: codes live 10 minutes, the secret never leaves the console and only its hash is stored, the token is handed out once,
// and every step is rate limited. Approving a code lets whoever holds the console session act as the approver - the phone UI warns about that.
// Table: device_logins (supabase/11_highlights.sql). Docs: docs/HIGHLIGHTS.md
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const SITE = "https://vicecityhub.github.io/vicecityhub";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
};
const TTL_S = 600;
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
const enc = new TextEncoder();
async function sha(s: string) {
  const d = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return Array.from(new Uint8Array(d), (b) => b.toString(16).padStart(2, "0")).join("");
}
const rnd = (n: number) => crypto.getRandomValues(new Uint8Array(n));
const b64u = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const normCode = (s: unknown) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const pretty = (c: string) => `${c.slice(0, 4)}-${c.slice(4)}`;

async function rate(bucket: string, limit: number): Promise<boolean> {
  const ws = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
  const { data } = await db.from("agent_rate").select("hits").eq("bucket", bucket).eq("window_start", ws).maybeSingle();
  const hits = (data?.hits ?? 0) + 1;
  if (hits > limit) return false;
  await db.from("agent_rate").upsert({ bucket, window_start: ws, hits }, { onConflict: "bucket,window_start" });
  return true;
}
async function ipKey(req: Request, p: string) {
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim();
  return `${p}:${(await sha("dl|" + (ip || "x"))).slice(0, 12)}`;
}
const deviceLabel = (ua: string | null) => (/PlayStation/i.test(ua || "") ? "PlayStation console browser" : /Nintendo|Xbox/i.test(ua || "") ? "Game console browser" : "another browser");

async function start(req: Request) {
  if (!(await rate(await ipKey(req, "dl:start"), 8))) return json({ error: "too many requests, wait a minute" }, 429);
  const secret = b64u(rnd(32));
  for (let i = 0; i < 5; i++) {
    const code = Array.from(rnd(8), (b) => ALPHABET[b % ALPHABET.length]).join("");
    const { error } = await db.from("device_logins").insert({
      code, secret_hash: await sha(secret), ua: (req.headers.get("user-agent") || "").slice(0, 200),
      expires_at: new Date(Date.now() + TTL_S * 1000).toISOString(),
    });
    if (!error) return json({ code: pretty(code), secret, expires_in: TTL_S, interval: 3, verify_url: `${SITE}/highlights.html#link` });
  }
  return json({ error: "could not create a code, retry" }, 500);
}

async function poll(req: Request, b: any) {
  if (!(await rate(await ipKey(req, "dl:poll"), 40))) return json({ error: "slow down" }, 429);
  const secret = String(b?.secret || "");
  if (secret.length < 20 || secret.length > 80) return json({ error: "bad secret" }, 400);
  const { data: row } = await db.from("device_logins").select("id, expires_at, approved_at, consumed_at, token_hash").eq("secret_hash", await sha(secret)).maybeSingle();
  if (!row || row.consumed_at) return json({ status: "gone" }, 410);
  if (Date.parse(row.expires_at) < Date.now()) return json({ status: "expired" }, 410);
  if (!row.approved_at || !row.token_hash) return json({ status: "pending" }, 202);
  const { data: taken } = await db.from("device_logins").update({ consumed_at: new Date().toISOString(), token_hash: null }).eq("id", row.id).is("consumed_at", null).select("id").maybeSingle();
  if (!taken) return json({ status: "gone" }, 410);
  return json({ status: "approved", token_hash: row.token_hash });
}

async function userFrom(req: Request) {
  const m = (req.headers.get("authorization") || "").match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const { data, error } = await db.auth.getUser(m[1]);
  return error || !data?.user?.email ? null : data.user;
}

async function inspect(req: Request, b: any) {
  const u = await userFrom(req);
  if (!u) return json({ error: "sign in first" }, 401);
  if (!(await rate(`dl:user:${u.id}`, 12)) || !(await rate(await ipKey(req, "dl:ip"), 30))) return json({ error: "too many attempts, wait a minute" }, 429);
  const code = normCode(b?.code);
  if (code.length !== 8) return json({ error: "codes have 8 characters, like ABCD-2345" }, 400);
  const { data: row } = await db.from("device_logins").select("ua, created_at, expires_at, approved_at").eq("code", code).maybeSingle();
  if (!row || row.approved_at || Date.parse(row.expires_at) < Date.now()) return json({ error: "code not found or expired; ask the console for a new one" }, 404);
  return json({ device: deviceLabel(row.ua), requested_ago_s: Math.round((Date.now() - Date.parse(row.created_at)) / 1000) });
}

async function approve(req: Request, b: any) {
  const u = await userFrom(req);
  if (!u) return json({ error: "sign in first" }, 401);
  if (!(await rate(`dl:user:${u.id}`, 12)) || !(await rate(await ipKey(req, "dl:ip"), 30))) return json({ error: "too many attempts, wait a minute" }, 429);
  const code = normCode(b?.code);
  if (code.length !== 8) return json({ error: "codes have 8 characters, like ABCD-2345" }, 400);
  const { data: row } = await db.from("device_logins").select("id, expires_at, approved_at").eq("code", code).maybeSingle();
  if (!row || row.approved_at || Date.parse(row.expires_at) < Date.now()) return json({ error: "code not found or expired; ask the console for a new one" }, 404);
  const gl = await db.auth.admin.generateLink({ type: "magiclink", email: u.email! });
  const token = gl.data?.properties?.hashed_token;
  if (gl.error || !token) { console.error("generateLink", gl.error?.message); return json({ error: "could not link the console, try again" }, 500); }
  const { data: done } = await db.from("device_logins").update({ user_id: u.id, token_hash: token, approved_at: new Date().toISOString() }).eq("id", row.id).is("approved_at", null).select("id").maybeSingle();
  if (!done) return json({ error: "that code was just used" }, 409);
  return json({ ok: true });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "use POST" }, 405);
  try {
    const path = new URL(req.url).pathname.replace(/^.*\/device-login/, "").replace(/\/+$/, "") || "/";
    let b: any = {};
    try { b = await req.json(); } catch { /* empty body is fine for /start */ }
    if (path === "/start") return await start(req);
    if (path === "/poll") return await poll(req, b);
    if (path === "/inspect") return await inspect(req, b);
    if (path === "/approve") return await approve(req, b);
    return json({ error: "not found" }, 404);
  } catch (e) {
    console.error("device-login", (e as Error).message);
    return json({ error: "server error" }, 500);
  }
});
