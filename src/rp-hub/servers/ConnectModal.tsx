import React, { useEffect, useRef, useState } from 'react';
import { FEATURES, FRAMEWORKS, STYLES, cfxJoinWeb, cfxListUrl, fivemConsoleCmd, fivemJoinUri, type IRpServer } from './types';
import { ago, compact, flag, fmt, langName } from './format';
import { isOnline } from './filters';

/** Esc closes, the close button gets focus, the page behind does not scroll; everything is put back on unmount. */
function useModalChrome(onClose: () => void, closeRef: React.RefObject<HTMLButtonElement>) {
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; prev?.focus?.(); };
  }, [onClose]);
}

/** Copies the F8 command; "copied" shows for 2 seconds. When the clipboard is blocked, the command is shown in a prompt instead. */
function useCopyCommand(cmd: string): [boolean, () => Promise<void>] {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this and paste it into the FiveM F8 console:', cmd);
    }
  };
  return [copied, copy];
}

const playersNow = (s: IRpServer): string => {
  if (!isOnline(s)) return 'Offline';
  return `${fmt(s.online_count)}${s.max_players ? ` / ${fmt(s.max_players)}` : ''}`;
};
function orDash<T>(v: T | null | undefined, show: (v: T) => string): string {
  return v ? show(v) : '–';
}

/** The label / value rows under the buttons. A missing number or name shows as a dash, never as a made-up value. */
function serverStats(s: IRpServer): [string, string][] {
  return [
    ['Players now', playersNow(s)],
    ['Peak seen', orDash(s.peak_players, fmt)],
    ['Discord', orDash(s.discord_members, (n) => `${compact(n)} members`)],
    ['Language', `${flag(s.locale)} ${langName(s.locale)}`],
    ['Access', s.access === 'allowlist' ? 'Allowlist' : 'Open join'],
    ['Style', orDash(s.rp_style, (k) => STYLES[k])],
    ['Framework', orDash(s.framework, (k) => FRAMEWORKS[k] || k)],
    ['Upvotes', fmt(s.upvotes)],
  ];
}

function Header({ s, closeRef, onClose }: { s: IRpServer; closeRef: React.RefObject<HTMLButtonElement>; onClose: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0">
        <div className="font-orbitron font-black text-neonPink text-[11px] tracking-widest mb-1">CONNECT TO SERVER</div>
        <h2 className="text-white font-black text-lg leading-tight break-words">{s.name}</h2>
        {s.last_checked_at && <div className="text-[10px] text-white/30 mt-1">Checked against the Cfx.re list {ago(s.last_checked_at)}</div>}
      </div>
      <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="text-white/40 hover:text-white text-xl font-black leading-none p-1">✕</button>
    </div>
  );
}

const ALLOWLIST_NOTICE = (
  <div className="mb-4 p-3 rounded-lg text-xs leading-relaxed bg-purple-500/10 border border-purple-400/30 text-purple-200">
    🔒 This server uses an allowlist. FiveM will let you click, but you need approval first. Join their Discord, apply, and wait. Yes, like a nightclub with worse music.
  </div>
);

function OneClickOption({ code }: { code: string }) {
  return (
    <div className="mb-4 p-4 rounded-lg bg-neonPink/[0.06] border border-neonPink/20">
      <div className="font-orbitron font-black text-[10px] text-neonPink tracking-widest mb-3">OPTION 1 · ONE CLICK</div>
      <a href={fivemJoinUri(code)} className="btn-neon justify-center w-full text-center mb-2">▶ LAUNCH FIVEM AND JOIN</a>
      <p className="text-[10px] text-white/40 leading-relaxed">Needs FiveM installed on this device. If nothing opens, your browser blocked it, so use option 2.</p>
    </div>
  );
}

function ConsoleOption({ cmd }: { cmd: string }) {
  const [copied, copy] = useCopyCommand(cmd);
  return (
    <div className="mb-4 p-4 rounded-lg bg-neonCyan/[0.05] border border-neonCyan/20">
      <div className="font-orbitron font-black text-[10px] text-neonCyan tracking-widest mb-3">OPTION 2 · F8 CONSOLE</div>
      <div className="flex items-center gap-2 mb-2">
        <code className="flex-1 font-mono text-xs text-white bg-black/50 rounded px-3 py-2 border border-white/10 truncate select-all">{cmd}</code>
        <button type="button" onClick={copy} className={`btn-neon btn-neon-sm ${copied ? 'btn-neon-cyan' : ''}`}>{copied ? '✓ COPIED' : 'COPY'}</button>
      </div>
      <p className="text-[10px] text-white/40">Open FiveM, press F8, paste, hit Enter.</p>
    </div>
  );
}

function LinkRow({ s }: { s: IRpServer }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <a href={cfxJoinWeb(s.cfx_code)} target="_blank" rel="noopener noreferrer" className="btn-neon btn-neon-sm flex-1 justify-center text-center">CFX.RE LINK</a>
      {s.discord_url && <a href={s.discord_url} target="_blank" rel="noopener noreferrer" className="btn-neon btn-neon-cyan btn-neon-sm flex-1 justify-center text-center">DISCORD</a>}
      {s.website_url && <a href={s.website_url} target="_blank" rel="noopener noreferrer nofollow" className="btn-neon btn-neon-sm flex-1 justify-center text-center">WEBSITE</a>}
      <a href={cfxListUrl(s.cfx_code)} target="_blank" rel="noopener noreferrer" className="btn-neon btn-neon-sm flex-1 justify-center text-center">OFFICIAL LIST</a>
    </div>
  );
}

function Stats({ s }: { s: IRpServer }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs mb-3">
      {serverStats(s).map(([k, v]) => (
        <div key={k} className="flex justify-between gap-2 border-b border-white/[0.05] pb-1">
          <dt className="text-white/35">{k}</dt><dd className="text-white/80 font-bold text-right">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Feature chips; keys the UI has no label for are skipped, and the whole row is absent when the list is empty. */
function FeatureChips({ features }: { features: string[] | null }) {
  if (!(features || []).length) return null;
  return (
    <div className="flex flex-wrap gap-1 mb-1">
      {features!.filter((k) => FEATURES[k]).map((k) => (
        <span key={k} className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider border border-neonCyan/20 text-neonCyan/70 bg-neonCyan/5">{FEATURES[k]}</span>
      ))}
    </div>
  );
}

export default function ConnectModal({ server: s, onClose }: { server: IRpServer; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useModalChrome(onClose, closeRef);
  const blurb = s.description || s.project_desc;

  return (
    <div className="fixed inset-0 z-[600] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/85 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Connect to ${s.name}`}
        className="glass-card-static w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-xl sm:rounded-xl p-5 border border-neonPink/50 shadow-[0_0_40px_rgba(255,0,255,0.2)] slide-in"
        onClick={(e) => e.stopPropagation()}>
        <Header s={s} closeRef={closeRef} onClose={onClose} />
        {blurb && <p className="text-white/60 text-xs leading-relaxed mb-4">{blurb}</p>}
        {s.access === 'allowlist' && ALLOWLIST_NOTICE}
        <OneClickOption code={s.cfx_code} />
        <ConsoleOption cmd={fivemConsoleCmd(s.cfx_code)} />
        <LinkRow s={s} />
        <Stats s={s} />
        <FeatureChips features={s.features} />
        <p className="text-[9px] text-white/25 mt-3">Player counts come straight from the public Cfx.re server list. We do not run, host or endorse these servers; join at your own risk and rules-read.</p>
      </div>
    </div>
  );
}
