// Vice City Hub - Agent API - automatic crypto settlement (background reconciler)
//
// Agents only have to SEND the exact tagged amount. This job (pg_cron every minute, plus a throttled kick whenever
// someone polls an order's status) finds the incoming stablecoin transfer by its unique amount, then runs the normal
// on-chain verification. Nothing here can mark an order paid by itself: matching only proposes a tx hash, and
// verifyCrypto() (wallet, token, exact amount, newer than the order, finality) decides.
//
// The endpoint is idempotent and public on purpose: it holds no secrets, exposes only counters, and is
// globally throttled, so anyone poking it just triggers one more safe scan.
import { db, ok, R, rate } from "./lib.ts";
import { scanIncoming } from "./verify.ts";
import { recheckOrder, retryFulfilment, settleFromScan } from "./orders.ts";

/** "19.009286" -> 19009286n (amount_due is always stored with exactly 6 decimals) */
const unitsOf = (s: unknown): bigint | null => (typeof s === "string" && /^\d+\.\d{6}$/.test(s) ? BigInt(s.replace(".", "")) : null);

export async function reconcile(): Promise<R> {
  if (!(await rate("reconcile:global", 4, 60))) return ok({ skipped: "throttled" });

  const nowIso = new Date().toISOString();
  const [aw, pr] = await Promise.all([
    db.from("agent_orders").select("*").eq("payment_rail", "crypto").eq("status", "awaiting_payment").gt("expires_at", nowIso).limit(200),
    db.from("agent_orders").select("*").eq("payment_rail", "crypto").eq("status", "payment_review").limit(100),
  ]);
  const awaiting: any[] = aw.data || [];
  const reviewing: any[] = (pr.data || []).filter((o: any) => o.payment?.proof?.verification === "pending_confirmations");

  let rechecked = 0;
  for (const o of reviewing) { await recheckOrder(o); rechecked++; }

  // self-healing: verified-paid merch orders that never reached Printful (give the first attempt 2 min to finish)
  const stale = new Date(Date.now() - 120_000).toISOString();
  const { data: paid } = await db.from("agent_orders").select("*").eq("status", "paid").lt("updated_at", stale).limit(20);
  let fulfilmentRetried = 0;
  for (const o of (paid || []).filter((x: any) => !x.fulfillment?.printful_order_id && (x.items || []).some((i: any) => i.kind === "merch"))) {
    const r = await retryFulfilment(o);
    if (r === "fulfilled" || r === "retry_failed") fulfilmentRetried++;
  }

  let scanned = 0, matched = 0;
  const chainsWithErrors: string[] = [];
  if (awaiting.length) {
    const since = Math.min(...awaiting.map((o: any) => new Date(o.created_at).getTime()));
    const scan = await scanIncoming(since);
    scanned = scan.items.length;
    for (const e of scan.errors) chainsWithErrors.push(e.split(":")[0]);

    const byUnits = new Map<string, typeof scan.items>();
    for (const c of scan.items) {
      const k = c.units.toString();
      byUnits.set(k, [...(byUnits.get(k) || []), c]);
    }
    for (const o of awaiting) {
      const due = unitsOf(o.payment?.crypto?.amount_due);
      if (due === null) continue;
      for (const c of byUnits.get(due.toString()) || []) {
        const r = await settleFromScan(o, c);
        if (r !== "claimed_by_other_order") { matched++; break; }
      }
    }
  }
  return ok({ awaiting_orders: awaiting.length, rechecked, fulfilment_retried: fulfilmentRetried, scanned_transfers: scanned, matched, chains_with_errors: [...new Set(chainsWithErrors)] });
}
