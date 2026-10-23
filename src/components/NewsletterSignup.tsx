import React, { useState } from 'react';

/**
 * v13: "Vice City Daily" signup (footer of every page). Posts to the `growth` edge function.
 * Double opt-in is handled server-side; honeypot field catches dumb bots.
 */
const BASE: string = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || 'https://lpglkglhjdqnktybksth.supabase.co';
const API = `${BASE}/functions/v1/growth/newsletter/subscribe`;

export default function NewsletterSignup({ source = 'footer' }: { source?: string }) {
  const [email, setEmail] = useState('');
  const [trap, setTrap] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg('Hotwiring the mailbox...');
    try {
      const r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), source, website: trap }),
      });
      const j = await r.json();
      if (j.ok) {
        setMsg(j.status === 'confirmed' ? 'Already on the list. Smooth.' : j.confirmation_email_sent ? 'Check your inbox and confirm. Check spam too.' : 'You are on the list. We will email you before launch week.');
        setEmail('');
      } else {
        setMsg(j.error === 'rate_limited' ? 'Easy, speedy. Try again in a bit.' : 'That email looks off. Try again.');
      }
    } catch {
      setMsg('Network hiccup. Try again.');
    }
    setBusy(false);
  };

  return (
    <div className="glass-card max-w-[700px] w-full p-6 mb-6 flex flex-col items-center gap-3 border border-neonCyan/25">
      <div className="text-neonCyan uppercase tracking-widest font-orbitron text-sm">The Vice City Daily</div>
      <p className="text-xs text-gray-400 font-bold max-w-[520px]">
        GTA VI news with a side of sarcasm. Only when there is something worth the electricity. Join the list before launch week.
      </p>
      <form onSubmit={submit} className="flex flex-wrap justify-center gap-2 w-full" noValidate>
        <input type="text" name="website" value={trap} onChange={(e) => setTrap(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden="true"
          style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }} />
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@leonida.example" aria-label="Email address" autoComplete="email"
          className="flex-1 min-w-[200px] max-w-[320px] px-3 py-2 rounded bg-black/60 border border-white/20 text-white text-sm placeholder-white/30 outline-none focus:border-neonCyan" />
        <button type="submit" disabled={busy || !email.trim()} className="btn-neon btn-neon-cyan !py-2 !px-5 !text-[10px]">
          {busy ? '...' : 'Get the Daily'}
        </button>
      </form>
      <div className="text-[11px] text-neonCyan min-h-[1.2em]" role="status">{msg}</div>
    </div>
  );
}
