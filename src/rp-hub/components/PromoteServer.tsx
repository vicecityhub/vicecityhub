import React, { useEffect, useState } from 'react';
import { supa } from '../../lib/SupabaseClient';

/**
 * v13: paid promotion for RP servers. Plans come from `server_promo_plans` (edit prices there, no deploy needed).
 * Requests go to the `growth` edge function, which stores them and emails the owner. Payment is arranged by email;
 * once paid, set rp_servers.promo_tier / promo_until and the card is promoted automatically (and labelled PROMOTED).
 */
const BASE: string = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || 'https://lpglkglhjdqnktybksth.supabase.co';
const API = `${BASE}/functions/v1/growth/promo`;

type Tier = 'bump' | 'featured' | 'headline';
interface Plan { tier: Tier; name: string; price_usd: number; days: number; features: string[] }

export default function PromoteServer() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [open, setOpen] = useState<Tier | null>(null);
  const [serverName, setServerName] = useState('');
  const [email, setEmail] = useState('');
  const [discord, setDiscord] = useState('');
  const [message, setMessage] = useState('');
  const [trap, setTrap] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supa.from('server_promo_plans').select('tier,name,price_usd,days,features').order('sort_order');
      if (data?.length) setPlans(data as Plan[]);
    })();
  }, []);

  if (!plans.length) return null;
  const plan = plans.find((p) => p.tier === open) || null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan || busy) return;
    setBusy(true); setResult(null);
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ server_name: serverName, contact_email: email, discord_url: discord, tier: plan.tier, message, website: trap }),
      });
      const j = await r.json();
      if (j.ok) setResult({ ok: true, text: j.message || 'Request received. We will email you with payment options.' });
      else setResult({ ok: false, text: j.error === 'rate_limited' ? 'Too many requests. Try again later.' : j.error === 'invalid_email' ? 'That email looks off.' : j.error === 'server_name_required' ? 'Tell us the server name.' : 'Something broke. Try again later.' });
    } catch {
      setResult({ ok: false, text: 'Network hiccup. Try again.' });
    }
    setBusy(false);
  };

  const field = 'w-full px-3 py-2 rounded bg-black/50 border border-white/15 text-white text-xs outline-none focus:border-neonPink placeholder-white/25';

  return (
    <>
      <div className="glass-card-static rounded-lg p-4 mb-4 border border-neonPink/25">
        <h3 className="text-[11px] font-orbitron font-black tracking-widest mb-1 text-neonPink">◈ PROMOTE YOUR SERVER</h3>
        <p className="text-[10px] text-white/45 mb-3 leading-relaxed">Run a server nobody has heard of? Fix that. Promoted cards are clearly labelled and sit above the organic list.</p>
        <div className="space-y-2">
          {plans.map((p) => (
            <button key={p.tier} onClick={() => { setOpen(p.tier); setResult(null); }}
              className="w-full text-left p-2.5 rounded transition-all hover:scale-[1.02]"
              style={{ background: 'rgba(255,0,255,0.06)', border: '1px solid rgba(255,0,255,0.25)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-white">{p.name}</span>
                <span className="text-[11px] font-black text-neonCyan">${Number(p.price_usd).toFixed(0)} / {p.days}d</span>
              </div>
              <div className="text-[9px] text-white/40 mt-0.5 leading-snug">{(p.features || []).join(' · ')}</div>
            </button>
          ))}
        </div>
      </div>

      {plan && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }} onClick={() => setOpen(null)}>
          <form onSubmit={submit} onClick={(e) => e.stopPropagation()}
            className="glass-card-static rounded-xl w-full max-w-md p-6 border border-neonPink/50 shadow-[0_0_40px_rgba(255,0,255,0.2)]">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-orbitron font-black text-neonPink text-sm tracking-widest mb-1">{plan.name.toUpperCase()}</div>
                <div className="text-white/60 text-xs">${Number(plan.price_usd).toFixed(2)} for {plan.days} days</div>
              </div>
              <button type="button" onClick={() => setOpen(null)} className="text-white/30 hover:text-white text-xl font-black">✕</button>
            </div>
            {result?.ok ? (
              <div className="text-sm text-neonCyan py-4">{result.text}</div>
            ) : (
              <div className="space-y-2.5">
                <input type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} aria-hidden="true"
                  style={{ position: 'absolute', left: '-9999px', opacity: 0, width: 1, height: 1 }} />
                <input className={field} placeholder="SERVER NAME" value={serverName} maxLength={80} required onChange={(e) => setServerName(e.target.value)} />
                <input className={field} type="email" placeholder="CONTACT EMAIL (we reply here)" value={email} maxLength={254} required onChange={(e) => setEmail(e.target.value)} />
                <input className={field} placeholder="DISCORD INVITE (optional)" value={discord} maxLength={200} onChange={(e) => setDiscord(e.target.value)} />
                <textarea className={field} rows={3} placeholder="Anything we should know? (optional)" value={message} maxLength={1000} onChange={(e) => setMessage(e.target.value)} />
                {result && !result.ok && <div className="text-[11px] text-yellow-300">{result.text}</div>}
                <p className="text-[9px] text-white/35 leading-relaxed">No payment is taken here. We email you payment options (PayPal or crypto). Your server goes live once paid. No guarantees about player counts; we sell visibility, not miracles.</p>
                <button type="submit" disabled={busy || !serverName.trim() || !email.trim()} className="btn-neon w-full justify-center">{busy ? 'SENDING...' : 'SEND REQUEST'}</button>
              </div>
            )}
          </form>
        </div>
      )}
    </>
  );
}
