import React, { useCallback, useMemo, useState } from 'react';
import PromoteServer from './PromoteServer';
import ServerCard from '../servers/ServerCard';
import ConnectModal from '../servers/ConnectModal';
import SubmitServer from '../servers/SubmitServer';
import { useServers } from '../servers/useServers';
import {
  DEFAULT_FILTERS, SORT_LABELS, applyFilters, featureOptions, frameworkOptions, isFiltered, isOnline, languageOptions,
  type Filters, type SortKey,
} from '../servers/filters';
import { FEATURES, FRAMEWORKS, STYLES, type IRpServer } from '../servers/types';
import { ago, fmt } from '../servers/format';

const PAGE = 24;

const selectCls = 'bg-black/40 border border-white/10 rounded px-2 py-1.5 text-[11px] font-bold text-white/80 outline-none focus:border-neonCyan/60 w-full';

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="glass-card-static rounded-lg p-3 border border-white/[0.05] text-center">
      <div className="text-[9px] font-orbitron font-black tracking-widest text-white/30 mb-1">{label}</div>
      <div className="text-lg font-black tabular-nums" style={{ color }}>{value}</div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="glass-card-static rounded-lg border border-white/[0.04] p-4 animate-pulse" aria-hidden>
      <div className="flex gap-3 mb-3"><div className="w-11 h-11 rounded-lg bg-white/5" /><div className="flex-1"><div className="h-3 bg-white/10 rounded w-3/4 mb-2" /><div className="h-2 bg-white/5 rounded w-1/2" /></div></div>
      <div className="h-1.5 bg-white/5 rounded-full mb-3" /><div className="h-2 bg-white/5 rounded mb-1.5" /><div className="h-2 bg-white/5 rounded w-4/5 mb-4" /><div className="h-8 bg-white/5 rounded" />
    </div>
  );
}

export default function ServersTab() {
  const { servers, loading, error, updatedAt, reload } = useServers();
  const [f, setF] = useState<Filters>(DEFAULT_FILTERS);
  const [open, setOpen] = useState<IRpServer | null>(null);
  const [shown, setShown] = useState(PAGE);
  const set = useCallback(<K extends keyof Filters>(k: K, v: Filters[K]) => { setF((p) => ({ ...p, [k]: v })); setShown(PAGE); }, []);

  const langs = useMemo(() => languageOptions(servers), [servers]);
  const fws = useMemo(() => frameworkOptions(servers), [servers]);
  const feats = useMemo(() => featureOptions(servers).filter((k) => FEATURES[k]), [servers]);
  const list = useMemo(() => applyFilters(servers, f), [servers, f]);
  const onlineServers = servers.filter(isOnline);
  const players = onlineServers.reduce((a, s) => a + (s.online_count || 0), 0);
  const close = useCallback(() => setOpen(null), []);

  return (
    <div className="slide-in">
      {open && <ConnectModal server={open} onClose={close} />}

      <div className="mb-5">
        <h1 className="font-orbitron font-black text-2xl tracking-widest mb-1 neon-text-pink">◈ ROLEPLAY SERVERS</h1>
        <p className="text-white/45 text-xs leading-relaxed max-w-2xl">
          Real FiveM servers, checked against the official Cfx.re list every couple of minutes. Player counts are live or hidden, never invented. Click, connect, and pretend you are not in the car chase you swore you would skip.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        <Stat label="SERVERS LISTED" value={fmt(servers.length)} color="#FF00FF" />
        <Stat label="ONLINE NOW" value={fmt(onlineServers.length)} color="#22D65A" />
        <Stat label="PLAYERS IN GAME" value={fmt(players)} color="#00FFFF" />
        <Stat label="LANGUAGES" value={fmt(langs.filter((l) => l.code !== 'xx').length)} color="#facc15" />
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 min-w-0">
          <section aria-label="Filters" className="glass-card-static rounded-lg p-4 mb-4 border border-white/[0.05]">
            <label className="sr-only" htmlFor="rp-search">Search servers</label>
            <input id="rp-search" type="search" value={f.q} onChange={(e) => set('q', e.target.value)} placeholder="Search by name, tag or description…"
              className="w-full bg-transparent text-white text-sm font-bold placeholder-white/25 outline-none pb-3 mb-3 border-b border-neonPink/20" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 mb-3">
              <label className="text-[9px] font-orbitron text-white/30 tracking-widest">STYLE
                <select className={selectCls} value={f.style} onChange={(e) => set('style', e.target.value as Filters['style'])}>
                  <option value="all">Any</option>
                  {(Object.keys(STYLES) as (keyof typeof STYLES)[]).map((k) => <option key={k} value={k}>{STYLES[k]}</option>)}
                </select>
              </label>
              <label className="text-[9px] font-orbitron text-white/30 tracking-widest">ACCESS
                <select className={selectCls} value={f.access} onChange={(e) => set('access', e.target.value as Filters['access'])}>
                  <option value="all">Any</option><option value="public">Open join</option><option value="allowlist">Allowlist</option>
                </select>
              </label>
              <label className="text-[9px] font-orbitron text-white/30 tracking-widest">LANGUAGE
                <select className={selectCls} value={f.lang} onChange={(e) => set('lang', e.target.value)}>
                  <option value="all">Any</option>
                  {langs.map((l) => <option key={l.code} value={l.code}>{l.label} ({l.count})</option>)}
                </select>
              </label>
              <label className="text-[9px] font-orbitron text-white/30 tracking-widest">FRAMEWORK
                <select className={selectCls} value={f.framework} onChange={(e) => set('framework', e.target.value)}>
                  <option value="all">Any</option>
                  {fws.map((k) => <option key={k} value={k}>{FRAMEWORKS[k] || k}</option>)}
                </select>
              </label>
              <label className="text-[9px] font-orbitron text-white/30 tracking-widest">SORT
                <select className={selectCls} value={f.sort} onChange={(e) => set('sort', e.target.value as SortKey)}>
                  {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" aria-pressed={f.onlineOnly} onClick={() => set('onlineOnly', !f.onlineOnly)}
                className={`text-[10px] px-2.5 py-1 rounded-full font-black tracking-wider border transition-all ${f.onlineOnly ? 'border-green-400/60 bg-green-500/15 text-green-300' : 'border-white/10 text-white/40 hover:border-white/25'}`}>
                ● ONLINE ONLY
              </button>
              {feats.map((k) => {
                const on = f.features.includes(k);
                return (
                  <button key={k} type="button" aria-pressed={on} onClick={() => set('features', on ? f.features.filter((x) => x !== k) : [...f.features, k])}
                    className={`text-[10px] px-2.5 py-1 rounded-full font-bold tracking-wider border transition-all ${on ? 'border-neonPink/60 bg-neonPink/15 text-neonPink' : 'border-white/10 text-white/40 hover:border-white/25'}`}>
                    {FEATURES[k]}
                  </button>
                );
              })}
            </div>
          </section>

          <div className="flex items-center justify-between mb-3" aria-live="polite">
            <span className="text-[10px] font-orbitron font-black text-white/30 tracking-widest">
              {list.length} {list.length === 1 ? 'SERVER' : 'SERVERS'}{updatedAt ? ` · UPDATED ${ago(new Date(updatedAt).toISOString()).toUpperCase()}` : ''}
            </span>
            {isFiltered(f) && <button type="button" onClick={() => { setF(DEFAULT_FILTERS); setShown(PAGE); }} className="text-[10px] text-neonPink/70 hover:text-neonPink font-bold tracking-wider">✕ CLEAR FILTERS</button>}
          </div>

          {loading && servers.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} />)}</div>
          ) : error && servers.length === 0 ? (
            <div className="text-center py-14 glass-card-static rounded-lg border border-white/[0.05]">
              <div className="font-orbitron text-sm text-white/50 tracking-widest mb-2">THE SERVER LIST TOOK A COFFEE BREAK</div>
              <p className="text-xs text-white/30 mb-4">Not your fault. Probably ours.</p>
              <button type="button" onClick={reload} className="btn-neon btn-neon-sm">TRY AGAIN</button>
            </div>
          ) : list.length === 0 ? (
            <div className="text-center py-14">
              <div className="font-orbitron text-sm text-white/40 tracking-widest mb-2">NOTHING MATCHES. PICKY, AREN'T WE?</div>
              <button type="button" onClick={() => setF(DEFAULT_FILTERS)} className="text-[11px] text-neonPink/70 hover:text-neonPink font-bold tracking-wider">CLEAR ALL FILTERS</button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {list.slice(0, shown).map((s) => <ServerCard key={s.id} server={s} onOpen={setOpen} />)}
              </div>
              {list.length > shown && (
                <div className="text-center mt-5">
                  <button type="button" onClick={() => setShown((n) => n + PAGE)} className="btn-neon btn-neon-sm">SHOW {Math.min(PAGE, list.length - shown)} MORE</button>
                </div>
              )}
            </>
          )}
        </div>

        <aside className="lg:w-72 xl:w-80 space-y-4">
          <SubmitServer onListed={reload} />
          <PromoteServer />
          <div className="glass-card-static rounded-lg p-3 border border-white/[0.05] text-center">
            <p className="text-[9px] font-orbitron text-white/30 tracking-widest mb-1">DATA SOURCE</p>
            <a href="https://servers.fivem.net" target="_blank" rel="noopener noreferrer" className="text-[10px] font-orbitron font-bold text-neonCyan/60 hover:text-neonCyan tracking-wider">CFX.RE SERVER LIST</a>
            <p className="text-[9px] text-white/25 mt-1">Discord invites validated automatically. Listed servers are third-party; we do not host or endorse them.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
