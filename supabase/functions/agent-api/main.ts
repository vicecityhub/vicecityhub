// Vice City Hub — Agent API v12 · wiring
// Connects the real helpers (Supabase, handlers, MCP, owner console) to the request pipeline in app.ts.
import { authenticate, CORS, clientIpHash, db, fail, rate, toResponse } from "./lib.ts";
import { catalogItem, catalogList, indexDoc, newsItem, newsList, rpList, search } from "./handlers.ts";
import { donationInfo } from "./donate.ts";
import { x402Donate } from "./x402.ts";
import { cancelOrder, captureOrder, createDonation, createIntent, createOrder, createQuote, getOrder, orderStatus, registerAgent, submitProof, verifyOrder, whoAmI } from "./orders.ts";
import { ownerRoute } from "./owner.ts";
import { mcpHandle } from "./mcp.ts";
import { reconcile } from "./reconcile.ts";
import { createRouter } from "./router.ts";
import { createApp } from "./app.ts";

/** Polling an order also nudges the (globally throttled) reconciler so an agent never waits for the next cron tick. */
function nudgeReconcile() {
  try {
    (globalThis as any).EdgeRuntime?.waitUntil(reconcile());
  } catch (_) {
    // Best effort: outside the edge runtime there is no waitUntil, and the cron job reconciles anyway.
  }
}

/** The request handler for Deno.serve. `spec` is the OpenAPI document served at /v1/openapi.json. */
export function createHandler(spec: unknown) {
  const route = createRouter({
    fail, spec, nudgeReconcile,
    indexDoc, catalogList, catalogItem, reconcile, donationInfo, x402Donate, search, newsList, newsItem, rpList,
    whoAmI, orderStatus, getOrder, registerAgent, createQuote, createOrder, createIntent, createDonation,
    captureOrder, submitProof, verifyOrder, cancelOrder,
  });

  return createApp({
    CORS, clientIpHash, authenticate, rate, fail, toResponse, route, ownerRoute, mcpHandle,
    logEvent: (row) => { db.from("agent_events").insert(row).then(() => {}); },
  });
}
