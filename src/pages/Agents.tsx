import React, { useCallback, useEffect, useState } from 'react';
import { supa } from '../lib/SupabaseClient';
import { agentApi, ApiError, API, SITE, type CatalogItem, type OwnerKey } from '../lib/agentApi';

/* ───────────────────────── helpers ───────────────────────── */
const KINDS = ['all', 'merch', 'plan', 'domain', 'product', 'server'] as const;
const MANDATE_KINDS = ['merch', 'plan', 'domain', 'product', 'server', 'donation'] as const;
const KIND_LABEL: Record<string, string> = { all: 'Everything', donation: 'Donations (AI dev)', merch: 'Merch', plan: 'Store slots', domain: 'Web3 domains', product: 'Partner goods', server: 'RP servers' };
const usd = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
const errText = (e: unknown) => (e instanceof ApiError ? `${e.message}${e.hint ? ` — ${e.hint}` : ''}` : e instanceof Error ? e.message : 'Something went sideways.');

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = useCallback((text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 1600);
    }).catch(() => { /* clipboard blocked */ });
  }, []);
  return { copied, copy };
}

function CodeBlock({ id, code, copy, copied }: { id: string; code: string; copy: (t: string, id: string) => void; copied: string | null }) {
  return (
    <div className="relative">
      <pre className="bg-black/50 border border-white/10 rounded-lg p-4 pr-20 text-[11px] leading-relaxed text-neonCyan/90 overflow-x-auto whitespace-pre">{code}</pre>
      <button onClick={() => copy(code, id)} className="absolute top-2 right-2 text-[10px] uppercase tracking-widest font-bold border border-white/15 hover:border-neonCyan hover:text-neonCyan px-2.5 py-1 rounded transition-all">
        {copied === id ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

const Section = ({ id, kicker, title, children }: { id: string; kicker: string; title: string; children: React.ReactNode }) => (
  <section id={id} className="max-w-6xl mx-auto px-6 py-12 scroll-mt-24">
    <div className="text-[10px] tracking-[0.3em] uppercase text-neonPink font-bold mb-2">{kicker}</div>
    <h2 className="font-orbitron font-extrabold text-2xl md:text-3xl uppercase tracking-widest text-white mb-8">{title}</h2>
    {children}
  </section>
);

/* ───────────────────────── 1. status ───────────────────────── */
function StatusStrip() {
  const [s, setS] = useState<{ version: string; items: number; news: number } | null | 'down'>(null);
  useEffect(() => {
    let alive = true;
    Promise.all([agentApi.index(), agentApi.catalog({ limit: 1 }), agentApi.news(50)])
      .then(([idx, cat, news]) => alive && setS({ version: idx.version, items: cat.total, news: news.count }))
      .catch(() => alive && setS('down'));
    return () => { alive = false; };
  }, []);
  const chip = 'border border-white/10 bg-white/5 rounded px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold';
  if (s === null) return <div className={`${chip} text-gray-500`}>Pinging the gateway…</div>;
  if (s === 'down') return <div className={`${chip} text-neonOrange`}>Gateway unreachable — the bots are on a coffee break</div>;
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      <span className={`${chip} text-green-400`}>● API online · v{s.version}</span>
      <span className={`${chip} text-neonCyan`}>{s.items} catalog items</span>
      <span className={`${chip} text-neonPink`}>{s.news} fresh headlines</span>
      <span className={`${chip} text-gray-300`}>MCP · REST · llms.txt</span>
    </div>
  );
}

/* ───────────────────────── 2. connect ───────────────────────── */
function ConnectPanel() {
  const { copied, copy } = useCopy();
  const [tab, setTab] = useState<'mcp' | 'rest' | 'prompt'>('mcp');
  const mcp = `{
  "mcpServers": {
    "vice-city-hub": {
      "type": "http",
      "url": "${API}/mcp",
      "headers": { "Authorization": "Bearer vch_live_YOUR_KEY" }
    }
  }
}`;
  const rest = `# 1) browse — no key needed
curl -s "${API}/v1/catalog?kind=domain&orderable=true"
curl -s "${API}/v1/news?limit=5"

# 2) get a key (or mint a bigger one below)
curl -s -X POST ${API}/v1/agents/register \\
  -H 'content-type: application/json' -d '{"name":"my-agent"}'

# 3) buy: quote -> order -> pay -> poll
curl -s -X POST ${API}/v1/quotes -H "Authorization: Bearer $VCH_KEY" \\
  -H 'content-type: application/json' -d '{"items":[{"sku":"domain:110"}]}'`;
  const prompt = `You can shop at Vice City Hub (a GTA VI fan hub) on my behalf.
Read ${SITE}/llms.txt first, then use the MCP server at ${API}/mcp
(or the OpenAPI spec at ${API}/v1/openapi.json).
Rules: never exceed my spending mandate, always send an Idempotency-Key,
show me the quote before ordering, and only report a purchase as done
when the order status is paid / fulfilling / completed.`;
  const tabs: Array<['mcp' | 'rest' | 'prompt', string]> = [['mcp', 'MCP client'], ['rest', 'REST / curl'], ['prompt', 'Prompt for your agent']];
  return (
    <div className="glass-card-static p-6 md:p-8">
      <div className="flex flex-wrap gap-2 mb-5">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`text-[11px] uppercase tracking-widest font-bold px-4 py-2 rounded border transition-all ${tab === k ? 'border-neonCyan text-neonCyan bg-neonCyan/10' : 'border-white/10 text-gray-400 hover:border-white/30'}`}>{label}</button>
        ))}
      </div>
      {tab === 'mcp' && (<>
        <p className="text-sm text-gray-400 mb-4">Add this as a remote MCP server in Claude, Cursor, VS Code or any MCP client. Read tools work without a key; ordering tools need one.</p>
        <CodeBlock id="mcp" code={mcp} copy={copy} copied={copied} />
      </>)}
      {tab === 'rest' && (<>
        <p className="text-sm text-gray-400 mb-4">Plain JSON over HTTPS. Everything is described in the <a className="text-neonCyan underline" href={`${API}/v1/openapi.json`} target="_blank" rel="noreferrer">OpenAPI 3.1 spec</a>.</p>
        <CodeBlock id="rest" code={rest} copy={copy} copied={copied} />
      </>)}
      {tab === 'prompt' && (<>
        <p className="text-sm text-gray-400 mb-4">Paste this into any agent that can browse the web or call tools — it will find everything else by itself.</p>
        <CodeBlock id="prompt" code={prompt} copy={copy} copied={copied} />
      </>)}
      <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-[11px]">
        {[
          ['llms.txt', `${SITE}/llms.txt`],
          ['Agent manifest', `${SITE}/.well-known/agent.json`],
          ['OpenAPI 3.1', `${API}/v1/openapi.json`],
          ['Static data feeds', `${SITE}/data/index.json`],
        ].map(([label, href]) => (
          <a key={label} href={href} target="_blank" rel="noreferrer" className="border border-white/10 hover:border-neonPink rounded px-3 py-2 uppercase tracking-widest font-bold text-gray-300 hover:text-neonPink transition-all truncate">{label} ↗</a>
        ))}
      </div>
    </div>
  );
}

/* ───────────────────────── 3. mandates ───────────────────────── */
function MandateConsole() {
  const { copied, copy } = useCopy();
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [keys, setKeys] = useState<OwnerKey[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [fresh, setFresh] = useState<{ key: string; name: string } | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [maxOrder, setMaxOrder] = useState('100');
  const [maxDaily, setMaxDaily] = useState('250');
  const [days, setDays] = useState('30');
  const [kinds, setKinds] = useState<string[]>(['merch', 'plan', 'domain']);

  const load = useCallback(async (t: string) => {
    try { setKeys((await agentApi.ownerKeys(t)).items); } catch (e) { setErr(errText(e)); }
    const { data } = await supa.from('agent_orders').select('public_id,status,total_usd,payment_rail,created_at,items').order('created_at', { ascending: false }).limit(8);
    setOrders(data || []);
  }, []);

  useEffect(() => {
    supa.auth.getSession().then(({ data }) => {
      const t = data.session?.access_token || null;
      setToken(t); setReady(true);
      if (t) load(t);
    });
    const { data: sub } = supa.auth.onAuthStateChange((_e, session) => {
      const t = session?.access_token || null;
      setToken(t);
      if (t) load(t); else { setKeys([]); setOrders([]); }
    });
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const toggleKind = (k: string) => setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]));

  const mint = async () => {
    if (!token) return;
    setErr(''); setBusy(true);
    try {
      const r = await agentApi.mintKey(token, {
        name: name.trim(), max_order_usd: Number(maxOrder), max_daily_usd: Number(maxDaily),
        allowed_kinds: kinds, ...(Number(days) > 0 ? { expires_in_days: Number(days) } : {}),
      });
      setFresh({ key: r.api_key, name: name.trim() });
      setName('');
      await load(token);
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };

  const revoke = async (id: string) => {
    if (!token || !window.confirm('Revoke this key? The agent loses access immediately.')) return;
    try { await agentApi.revokeKey(token, id); await load(token); } catch (e) { setErr(errText(e)); }
  };

  const input = 'w-full bg-black/40 border border-white/10 focus:border-neonCyan outline-none rounded px-3 py-2 text-sm text-white';
  const label = 'block text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-1.5';

  if (!ready) return <div className="glass-card-static p-8 text-gray-500 text-sm">Checking your wristband…</div>;

  if (!token) {
    return (
      <div className="glass-card-static p-8 text-center">
        <div className="text-4xl mb-3">🔐</div>
        <div className="font-orbitron text-lg uppercase tracking-widest text-white mb-2">Sign in to hand your bot a credit card</div>
        <p className="text-sm text-gray-400 max-w-xl mx-auto">
          Spending mandates are tied to your account, so you can cap, audit and revoke what each agent may buy.
          Use <b className="text-neonCyan">Sign In</b> / <b className="text-neonPink">Join</b> in the top bar, then come back here. Just testing? Self-register a $100/order key via the API — no account needed.
        </p>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="glass-card-static p-6 md:p-8">
        <div className="font-orbitron text-sm uppercase tracking-widest text-neonCyan mb-5">New spending mandate</div>
        <div className="space-y-4">
          <div><label className={label}>Agent / project name</label><input className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="e.g. my-shopping-agent" /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={label}>Max / order $</label><input className={input} inputMode="decimal" value={maxOrder} onChange={(e) => setMaxOrder(e.target.value)} /></div>
            <div><label className={label}>Max / 24h $</label><input className={input} inputMode="decimal" value={maxDaily} onChange={(e) => setMaxDaily(e.target.value)} /></div>
            <div><label className={label}>Expires (days)</label><input className={input} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /></div>
          </div>
          <div>
            <span className={label}>May buy</span>
            <div className="flex flex-wrap gap-2">
              {MANDATE_KINDS.map((k) => (
                <button key={k} type="button" onClick={() => toggleKind(k)} className={`text-[10px] uppercase tracking-widest font-bold px-3 py-1.5 rounded border transition-all ${kinds.includes(k) ? 'border-neonPink text-neonPink bg-neonPink/10' : 'border-white/10 text-gray-500'}`}>{KIND_LABEL[k]}</button>
              ))}
            </div>
          </div>
          <button onClick={mint} disabled={busy || !name.trim() || kinds.length === 0} className="btn-neon !py-2.5 !px-6 !text-xs font-bold font-orbitron disabled:opacity-40">{busy ? 'Minting…' : 'Mint key'}</button>
          <p className="text-[11px] text-gray-500">Hard ceilings: $5,000 per order, $10,000 per 24h. PayPal orders still need a human click on “Pay”; crypto orders are verified on-chain automatically.</p>
          {err && <div className="text-xs text-neonOrange border border-neonOrange/30 bg-neonOrange/5 rounded p-3">{err}</div>}
          {fresh && (
            <div className="border border-neonCyan/40 bg-neonCyan/5 rounded-lg p-4">
              <div className="text-[10px] uppercase tracking-widest text-neonCyan font-bold mb-2">Key for “{fresh.name}” — shown once, store it now</div>
              <CodeBlock id="newkey" code={fresh.key} copy={copy} copied={copied} />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-6">
        <div className="glass-card-static p-6 md:p-8">
          <div className="font-orbitron text-sm uppercase tracking-widest text-neonCyan mb-4">Your keys</div>
          {keys.length === 0 ? <div className="text-sm text-gray-500">No keys yet. Your bots are broke.</div> : (
            <ul className="space-y-3">
              {keys.map((k) => (
                <li key={k.id} className="border border-white/10 rounded-lg p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate">{k.name} <span className={`ml-2 text-[9px] uppercase tracking-widest ${k.is_active ? 'text-green-400' : 'text-gray-600'}`}>{k.is_active ? 'active' : 'revoked'}</span></div>
                    <div className="text-[11px] text-gray-500 truncate">{k.key_prefix}… · {usd(k.max_order_usd)}/order · {usd(k.max_daily_usd)}/24h · {k.allowed_kinds.join(', ')}</div>
                  </div>
                  {k.is_active && <button onClick={() => revoke(k.id)} className="text-[10px] uppercase tracking-widest font-bold border border-white/15 hover:border-neonPink hover:text-neonPink px-3 py-1.5 rounded transition-all shrink-0">Revoke</button>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="glass-card-static p-6 md:p-8">
          <div className="font-orbitron text-sm uppercase tracking-widest text-neonCyan mb-4">Recent agent orders</div>
          {orders.length === 0 ? <div className="text-sm text-gray-500">Nothing bought yet.</div> : (
            <ul className="space-y-2">
              {orders.map((o) => (
                <li key={o.public_id} className="flex items-center justify-between gap-3 text-xs border-b border-white/5 pb-2">
                  <a className="text-neonCyan hover:underline truncate" href={`?order=${o.public_id}#track`}>{o.public_id}</a>
                  <span className="text-gray-400">{usd(Number(o.total_usd))} · {o.payment_rail}</span>
                  <span className="uppercase tracking-widest font-bold text-neonPink">{String(o.status).replace('_', ' ')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── 4. catalog ───────────────────────── */
function CatalogBrowser() {
  const { copied, copy } = useCopy();
  const [kind, setKind] = useState<(typeof KINDS)[number]>('all');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    setItems(null); setErr('');
    const t = setTimeout(() => {
      agentApi.catalog({ kind: kind === 'all' ? undefined : kind, q: q.trim() || undefined, limit: 24 })
        .then((r) => { if (alive) { setItems(r.items); setTotal(r.total); } })
        .catch((e) => { if (alive) setErr(errText(e)); });
    }, q ? 300 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [kind, q]);

  const prompt = (i: CatalogItem) => i.purchase.mode === 'order'
    ? `Using the Vice City Hub MCP server (${API}/mcp), create a quote for SKU ${i.sku} (${i.title}), show me the total, and place the order once I approve. Pay by ${i.purchase.rails.join(' or ')}.`
    : `Using the Vice City Hub MCP server (${API}/mcp), record a purchase intent for SKU ${i.sku} (${i.title}) and tell me how to complete the purchase with the seller.`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {KINDS.map((k) => (
          <button key={k} onClick={() => setKind(k)} className={`text-[11px] uppercase tracking-widest font-bold px-4 py-2 rounded border transition-all ${kind === k ? 'border-neonPink text-neonPink bg-neonPink/10' : 'border-white/10 text-gray-400 hover:border-white/30'}`}>{KIND_LABEL[k]}</button>
        ))}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SKUs, domains, merch…" aria-label="Search catalog" className="ml-auto w-full sm:w-64 bg-black/40 border border-white/10 focus:border-neonCyan outline-none rounded px-3 py-2 text-sm text-white" />
      </div>
      {err && <div className="text-sm text-neonOrange">{err}</div>}
      {!err && items === null && <div className="text-sm text-gray-500">Loading the goods…</div>}
      {items && items.length === 0 && <div className="text-sm text-gray-500">Nothing matches. Even the black market has standards.</div>}
      {items && items.length > 0 && (
        <>
          <div className="text-[11px] text-gray-500 mb-4 uppercase tracking-widest">Showing {items.length} of {total}</div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((i) => (
              <article key={i.sku} className="glass-card p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[9px] uppercase tracking-widest font-bold px-2 py-1 rounded border border-white/15 text-gray-400">{KIND_LABEL[i.kind] || i.kind}</span>
                  <span className={`text-[9px] uppercase tracking-widest font-bold px-2 py-1 rounded border ${i.purchase.mode === 'order' ? 'border-green-400/40 text-green-400' : 'border-neonOrange/40 text-neonOrange'}`}>{i.purchase.mode === 'order' ? 'Agent checkout' : 'Intent only'}</span>
                </div>
                <h3 className="font-orbitron text-sm uppercase tracking-wider text-white leading-snug">{i.title}</h3>
                {i.description && <p className="text-xs text-gray-400 line-clamp-3">{i.description}</p>}
                <div className="mt-auto">
                  <div className="text-xl font-orbitron text-neonCyan">{i.price_usd !== null ? usd(i.price_usd) : (i.price_note || 'Ask the seller')}{i.price_usd !== null && i.price_note ? <span className="text-[10px] text-gray-500 ml-2 normal-case">{i.price_note}</span> : null}</div>
                  <div className="flex items-center gap-2 mt-3">
                    <button onClick={() => copy(i.sku, `sku-${i.sku}`)} className="text-[10px] font-mono border border-white/15 hover:border-neonCyan px-2 py-1 rounded transition-all truncate max-w-[60%]" title="Copy SKU">{copied === `sku-${i.sku}` ? 'copied' : i.sku}</button>
                    <button onClick={() => copy(prompt(i), `p-${i.sku}`)} className="text-[10px] uppercase tracking-widest font-bold border border-neonPink/40 text-neonPink hover:bg-neonPink/10 px-2 py-1 rounded transition-all">{copied === `p-${i.sku}` ? 'Copied' : 'Agent prompt'}</button>
                    <a href={i.url} className="ml-auto text-[10px] uppercase tracking-widest text-gray-500 hover:text-neonCyan">View ↗</a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ───────────────────────── 5. order tracker ───────────────────────── */
const OPEN_STATES = ['awaiting_payment', 'payment_review'];
function OrderTracker() {
  const params = new URLSearchParams(window.location.search);
  const [id, setId] = useState(params.get('order') || '');
  const [msg, setMsg] = useState('');
  const [st, setSt] = useState<{ status: string; total_usd: number; payment_rail: string; updated_at: string } | null>(null);
  const [err, setErr] = useState('');

  const refresh = useCallback(async (oid: string) => {
    try { setErr(''); setSt(await agentApi.orderStatus(oid.trim())); } catch (e) { setSt(null); setErr(errText(e)); }
  }, []);

  useEffect(() => {
    const oid = params.get('order');
    if (!oid) return;
    (async () => {
      if (params.get('pp') === 'return') {
        setMsg('Capturing your PayPal payment…');
        try { const o = await agentApi.capture(oid); setMsg(`PayPal payment captured. Order is now “${String(o.status).replace('_', ' ')}”.`); }
        catch (e) { setMsg(errText(e)); }
      } else if (params.get('pp') === 'cancel') {
        setMsg('PayPal approval was canceled. The order stays open for a couple of hours — approve it later or let it expire.');
      }
      refresh(oid);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!st || !OPEN_STATES.includes(st.status) || !id) return;
    const t = setInterval(() => refresh(id), 15000);
    return () => clearInterval(t);
  }, [st, id, refresh]);

  return (
    <div className="glass-card-static p-6 md:p-8 max-w-3xl">
      <div className="flex flex-col sm:flex-row gap-3">
        <input value={id} onChange={(e) => setId(e.target.value)} placeholder="vch_ord_…" aria-label="Order id" className="flex-1 bg-black/40 border border-white/10 focus:border-neonCyan outline-none rounded px-3 py-2 text-sm font-mono text-white" />
        <button onClick={() => id.trim() && refresh(id)} className="btn-neon btn-neon-cyan !py-2 !px-6 !text-xs font-bold font-orbitron">Track order</button>
      </div>
      {msg && <div className="mt-4 text-sm text-neonCyan border border-neonCyan/30 bg-neonCyan/5 rounded p-3">{msg}</div>}
      {err && <div className="mt-4 text-sm text-neonOrange">{err}</div>}
      {st && (
        <dl className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div><dt className="text-[10px] uppercase tracking-widest text-gray-500">Status</dt><dd className="font-orbitron uppercase text-neonPink">{st.status.replace('_', ' ')}</dd></div>
          <div><dt className="text-[10px] uppercase tracking-widest text-gray-500">Total</dt><dd className="font-orbitron text-white">{usd(Number(st.total_usd))}</dd></div>
          <div><dt className="text-[10px] uppercase tracking-widest text-gray-500">Rail</dt><dd className="text-white">{st.payment_rail}</dd></div>
          <div><dt className="text-[10px] uppercase tracking-widest text-gray-500">Updated</dt><dd className="text-white">{new Date(st.updated_at).toLocaleString()}</dd></div>
        </dl>
      )}
    </div>
  );
}

/* ───────────────────────── page ───────────────────────── */
const RULES: Array<[string, string]> = [
  ['Mandates, not blank checks', 'Every key has a per-order cap, a 24h cap, allowed product kinds and an expiry. You set them, you revoke them.'],
  ['Idempotent by force', 'Orders require an Idempotency-Key. A retrying bot never buys the same domain twice.'],
  ['Price-locked quotes', 'Quotes hold the price for 15 minutes. If it moves, the order is refused instead of overcharging.'],
  ['Crypto that checks itself', 'Each crypto order gets a unique exact amount. Send it and you are done: the payment is detected and verified on-chain automatically (Polygon, Ethereum, TRON, Solana) and merch goes straight to print. Anything off-by-a-cent is never auto-accepted.'],
  ['A human clicks PayPal', 'Card and PayPal payments always need the payer to approve. No bot can drain your account.'],
  ['Domains are delivered by humans', 'Private keys never touch the API. After payment, the operator transfers your Web3 domain by hand.'],
  ['Donations fuel AI', 'Agents can donate in crypto (POST /v1/donations, or the donate MCP tool) and get a receipt. The money goes to developing AI projects and to the benefit of AI development. It is a voluntary gift, never on the bot\'s own initiative: the key must allow the donation kind and the bot must confirm its human authorized it.'],
  ['Third-party deals stay third-party', 'Partner goods and community servers are intent-only: we introduce, we never hold the money.'],
];

export default function Agents() {
  return (
    <div className="w-full">
      <header className="min-h-[46vh] flex flex-col items-center justify-center text-center px-6 relative overflow-hidden bg-radial-hero py-16">
        <div className="text-[10px] tracking-[0.4em] uppercase text-neonPink font-bold mb-4">Machine-friendly · Human-approved</div>
        <h1 className="font-orbitron font-black text-4xl md:text-6xl uppercase tracking-widest bg-gradient-to-r from-neonPink to-neonCyan bg-clip-text text-transparent mb-4">Agent Gateway</h1>
        <p className="max-w-2xl text-gray-300 text-sm md:text-base mb-8">
          Humans get neon. Bots get JSON. Everybody gets billed. Vice City Hub is open to AI agents: read the news, scout RP servers,
          and — with a mandate you control — buy merch, store slots and Web3 domains automatically.
        </p>
        <StatusStrip />
        <nav className="flex flex-wrap justify-center gap-4 mt-8 text-[11px] uppercase tracking-widest font-bold">
          {[['connect', 'Connect'], ['mandates', 'Mandates'], ['catalog', 'Catalog'], ['track', 'Track order'], ['rules', 'Rules']].map(([h, l]) => (
            <a key={h} href={`#${h}`} className="text-gray-400 hover:text-neonCyan transition-colors">{l}</a>
          ))}
        </nav>
      </header>

      <Section id="connect" kicker="Step 1" title="Plug in your agent"><ConnectPanel /></Section>
      <Section id="mandates" kicker="Step 2" title="Hand it a budget"><MandateConsole /></Section>
      <Section id="catalog" kicker="Step 3" title="What the bots can buy"><CatalogBrowser /></Section>
      <Section id="track" kicker="Step 4" title="Track an order"><OrderTracker /></Section>
      <Section id="rules" kicker="Fine print" title="House rules">
        <div className="grid md:grid-cols-2 gap-4">
          {RULES.map(([t, d]) => (
            <div key={t} className="glass-card-static p-5">
              <div className="font-orbitron text-xs uppercase tracking-widest text-neonCyan mb-2">{t}</div>
              <p className="text-sm text-gray-400">{d}</p>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-600 mt-8">Fan-operated community portal — not affiliated with Rockstar Games or Take-Two Interactive Software, Inc.</p>
      </Section>
    </div>
  );
}
