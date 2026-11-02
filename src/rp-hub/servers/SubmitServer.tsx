import React, { useState } from 'react';
import { RP_API_BASE } from './types';
import { fmt, parseCfxInput } from './format';

interface Lookup {
  ok: boolean;
  reasons: string[];
  preview?: { name: string; players: number; max: number; discord_members: number | null };
  existing?: { id: string; name: string };
  error?: string;
}

/** Self-service listing. The server verifies everything against the live Cfx.re list and Discord; nothing here is trusted. */
export default function SubmitServer({ onListed }: { onListed: () => void }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Lookup | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const code = parseCfxInput(input);

  const check = async () => {
    if (!code) { setErr('Paste a join link like cfx.re/join/abc123 or just the code.'); return; }
    setBusy(true); setErr(null); setRes(null); setDone(null);
    try {
      const r = await fetch(`${RP_API_BASE}/lookup?code=${code}`);
      const j = (await r.json()) as Lookup;
      if (r.status === 429) setErr('Slow down. Try again in an hour.');
      else setRes(j);
    } catch { setErr('Could not reach the checker. Try again in a minute.'); }
    finally { setBusy(false); }
  };

  const submit = async () => {
    if (!code) return;
    setBusy(true); setErr(null);
    try {
      const r = await fetch(`${RP_API_BASE}/submit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, company: '' }) });
      const j = await r.json();
      if (j.ok && j.listed) { setDone(j.server?.name || 'Your server'); setRes(null); setInput(''); onListed(); }
      else if (r.status === 429) setErr('Too many submissions from your network. Try again later.');
      else setRes({ ok: false, reasons: j.reasons || ['Rejected.'], existing: j.existing });
    } catch { setErr('Submission failed. Try again in a minute.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="glass-card-static rounded-lg p-4 border border-white/[0.05]">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        className="w-full flex items-center justify-between text-left">
        <h3 className="text-[11px] font-orbitron font-black tracking-widest text-neonCyan">◈ LIST YOUR SERVER (FREE)</h3>
        <span className="text-white/40 text-xs">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="mt-3">
          <p className="text-[11px] text-white/45 leading-relaxed mb-3">
            Paste your Cfx.re join link. We check it live: online with 5+ players, roleplay tags, a working Discord with 100+ members. Pass, and you are listed instantly. No forms, no waiting, no begging.
          </p>
          <label className="sr-only" htmlFor="rp-submit-code">Cfx.re join link or code</label>
          <input id="rp-submit-code" value={input} onChange={(e) => { setInput(e.target.value); setRes(null); setErr(null); }}
            placeholder="cfx.re/join/abc123" autoComplete="off" spellCheck={false}
            className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-sm text-white placeholder-white/20 outline-none focus:border-neonCyan/60 mb-2" />
          <button type="button" onClick={check} disabled={busy || !input.trim()} className="btn-neon btn-neon-cyan btn-neon-sm w-full justify-center disabled:opacity-40">
            {busy && !res ? 'CHECKING…' : 'CHECK MY SERVER'}
          </button>

          {err && <p role="alert" className="text-[11px] text-red-400 mt-2">{err}</p>}
          {done && <p role="status" className="text-[11px] text-green-400 mt-2">✓ {done} is listed. Look for it in the grid. Try not to let it go to your head.</p>}

          {res && (
            <div className="mt-3 text-[11px]" role="status">
              {res.preview && (
                <div className="mb-2 text-white/70"><b>{res.preview.name}</b> · {fmt(res.preview.players)} online{res.preview.discord_members ? ` · ${fmt(res.preview.discord_members)} Discord members` : ''}</div>
              )}
              {res.ok ? (
                <button type="button" onClick={submit} disabled={busy} className="btn-neon btn-neon-sm w-full justify-center">{busy ? 'LISTING…' : '✓ ALL CHECKS PASSED · LIST IT'}</button>
              ) : (
                <ul className="list-disc pl-4 space-y-1 text-red-300/90">{(res.reasons || []).map((r) => <li key={r}>{r}</li>)}</ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
