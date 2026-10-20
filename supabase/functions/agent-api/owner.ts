// Vice City Hub — Agent API · human owner console (mint / list / revoke spend-mandated keys)
//
// A human signs in on the site (Supabase Auth) and delegates a *mandate* to an agent:
// per-order cap, 24h cap, allowed product kinds, optional expiry. The raw key is shown once.
// Hard ceilings below cannot be exceeded by any owner-minted key.
import { CORS, db, fail, num, ok, R, SITE, sha256Hex } from "./lib.ts";

export const HARD_MAX_ORDER_USD = 1_000_000;
export const HARD_MAX_DAILY_USD = 1_000_000;
const MAX_ACTIVE_KEYS = 10;
const KINDS = ["merch", "plan", "domain", "product", "server", "donation"];
const SCOPES = ["read", "quote", "order"];

export async function ownerFromRequest(req: Request): Promise<{ id: string; email: string | null } | null> {
  const h = req.headers.get("authorization") || "";
  const jwt = h.toLowerCase().startsWith("bearer ") ? h.slice(7).trim() : "";
  if (!jwt || jwt.startsWith("vch_live_")) return null;
  const { data, error } = await db.auth.getUser(jwt);
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

const unauth = (): R => fail(401, "owner_auth_required", "Sign in at the Agents page and send your session token as `Authorization: Bearer <access_token>`.", `${SITE}/agents.html`);

export async function ownerRoute(req: Request, path: string, body: any): Promise<R> {
  const me = await ownerFromRequest(req);
  if (!me) return unauth();
  let g: RegExpMatchArray | null;

  if (req.method === "GET" && path === "/v1/owner/keys") {
    const { data, error } = await db
      .from("agent_keys")
      .select("id,name,key_prefix,scopes,max_order_usd,max_daily_usd,allowed_kinds,is_active,created_at,last_used_at,expires_at")
      .eq("owner_id", me.id)
      .order("created_at", { ascending: false });
    if (error) return fail(500, "db_error", "Could not list keys.");
    return ok({ items: data });
  }

  if (req.method === "POST" && path === "/v1/owner/keys") {
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 80) : "";
    if (!name) return fail(422, "invalid_name", "`name` (1-80 chars) is required, e.g. the agent or project this key is for.");
    const maxOrder = num(body?.max_order_usd) ?? 100;
    const maxDaily = num(body?.max_daily_usd) ?? Math.min(maxOrder * 2.5, HARD_MAX_DAILY_USD);
    if (maxOrder <= 0 || maxOrder > HARD_MAX_ORDER_USD) return fail(422, "invalid_limit", `max_order_usd must be between 1 and ${HARD_MAX_ORDER_USD}.`);
    if (maxDaily < maxOrder || maxDaily > HARD_MAX_DAILY_USD) return fail(422, "invalid_limit", `max_daily_usd must be between max_order_usd and ${HARD_MAX_DAILY_USD}.`);
    const kinds: string[] = Array.isArray(body?.allowed_kinds) && body.allowed_kinds.length ? body.allowed_kinds : KINDS;
    if (!kinds.every((k) => KINDS.includes(k))) return fail(422, "invalid_kinds", `allowed_kinds must be a subset of: ${KINDS.join(", ")}`);
    const scopes: string[] = Array.isArray(body?.scopes) && body.scopes.length ? body.scopes : SCOPES;
    if (!scopes.every((s) => SCOPES.includes(s))) return fail(422, "invalid_scopes", `scopes must be a subset of: ${SCOPES.join(", ")}`);
    const days = num(body?.expires_in_days);
    if (days !== null && (days < 1 || days > 365)) return fail(422, "invalid_expiry", "expires_in_days must be 1-365.");

    const { count } = await db.from("agent_keys").select("id", { count: "exact", head: true }).eq("owner_id", me.id).eq("is_active", true);
    if ((count ?? 0) >= MAX_ACTIVE_KEYS) return fail(409, "too_many_keys", `You already have ${MAX_ACTIVE_KEYS} active keys. Revoke one first.`);

    const raw = "vch_live_" + [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const { data, error } = await db.from("agent_keys").insert({
      owner_id: me.id, name, key_prefix: raw.slice(0, 13), key_hash: await sha256Hex(raw),
      scopes, max_order_usd: maxOrder, max_daily_usd: maxDaily, allowed_kinds: kinds,
      expires_at: days ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
      agent_info: { minted_by: "owner-console" },
    }).select("id,created_at,expires_at").single();
    if (error) return fail(500, "db_error", "Could not create the key.");
    return ok({
      api_key: raw, key_id: data.id, key_prefix: raw.slice(0, 13), name, scopes, allowed_kinds: kinds,
      limits: { max_order_usd: maxOrder, max_daily_usd: maxDaily }, expires_at: data.expires_at,
      note: "Store this key now — it is shown once. Give it to your agent as `Authorization: Bearer <api_key>` or as the MCP server header.",
    }, 201);
  }

  if (req.method === "POST" && (g = path.match(/^\/v1\/owner\/keys\/([0-9a-f-]{36})\/revoke$/))) {
    const { data, error } = await db.from("agent_keys").update({ is_active: false }).eq("id", g[1]).eq("owner_id", me.id).select("id").maybeSingle();
    if (error) return fail(500, "db_error", "Could not revoke the key.");
    return data ? ok({ key_id: data.id, is_active: false }) : fail(404, "key_not_found", "No such key for this account.");
  }

  return fail(404, "not_found", `No route for ${req.method} ${path}`);
}

export const OWNER_CORS = CORS;
