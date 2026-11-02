import React, { useState } from 'react';
import { FEATURES, FRAMEWORKS, STYLES, type IRpServer } from './types';
import { compact, flag, fmt, langName } from './format';
import { isOnline, promoRank } from './filters';

const PROMO_LABEL = ['', 'BUMPED', 'FEATURED', 'HEADLINE'];

function Icon({ s }: { s: IRpServer }) {
  const [bad, setBad] = useState(false);
  if (s.icon_url && !bad) {
    return <img src={s.icon_url} alt="" width={44} height={44} loading="lazy" decoding="async" onError={() => setBad(true)}
      className="w-11 h-11 rounded-lg object-cover shrink-0 border border-white/10 bg-black/40" />;
  }
  return (
    <div aria-hidden className="w-11 h-11 rounded-lg shrink-0 flex items-center justify-center font-orbitron font-black text-neonPink border border-neonPink/30 bg-neonPink/10">
      {s.name.trim().charAt(0).toUpperCase() || '?'}
    </div>
  );
}

function Players({ s }: { s: IRpServer }) {
  if (!isOnline(s)) {
    return <div className="text-[10px] font-orbitron font-black tracking-widest text-white/30 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-red-500/70" />OFFLINE RIGHT NOW</div>;
  }
  const online = s.online_count as number;
  const max = s.max_players || 0;
  const pct = max > 0 ? Math.min(100, (online / max) * 100) : 0;
  const color = pct > 85 ? '#ef4444' : pct > 60 ? '#f59e0b' : '#22D65A';
  return (
    <div>
      <div className="flex items-center justify-between text-[10px] mb-1">
        <span className="flex items-center gap-1.5 font-orbitron font-black tracking-widest text-[#22D65A]"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />LIVE</span>
        <span className="font-black tabular-nums" style={{ color }}>{fmt(online)}{max ? ` / ${fmt(max)}` : ''} players</span>
      </div>
      {max > 0 && (
        <div className="h-1.5 rounded-full overflow-hidden bg-white/[0.06]" role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={online} aria-label="Players online">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
        </div>
      )}
    </div>
  );
}

export default function ServerCard({ server: s, onOpen }: { server: IRpServer; onOpen: (s: IRpServer) => void }) {
  const promo = promoRank(s);
  const blurb = s.description || s.project_desc || '';
  const feats = (s.features || []).filter((k) => FEATURES[k]).slice(0, 4);
  return (
    <article className="glass-card rounded-lg overflow-hidden flex flex-col relative group transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,0,255,0.18)] hover:-translate-y-0.5"
      style={promo ? { boxShadow: '0 0 0 1px #FF2D78, 0 0 22px rgba(255,45,120,0.3)' } : undefined}>
      <div className="h-0.5 w-full bg-gradient-to-r from-neonPink to-transparent" />
      {promo > 0 && (
        <span className="absolute top-0 right-3 text-[8px] px-2 py-0.5 rounded-b font-orbitron font-black tracking-widest bg-[#FF2D78] text-white" title="Paid placement">AD · {PROMO_LABEL[promo]}</span>
      )}
      <div className="p-4 flex flex-col flex-1 gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <Icon s={s} />
          <div className="min-w-0 flex-1">
            <h3 className="font-black text-sm text-white leading-tight truncate" title={s.name}>{s.name}</h3>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-[10px] text-white/50 font-bold">
              <span title={langName(s.locale)}>{flag(s.locale)} {langName(s.locale)}</span>
              {s.framework && <span className="text-white/35">· {FRAMEWORKS[s.framework] || s.framework}</span>}
            </div>
          </div>
        </div>

        <Players s={s} />

        <div className="flex flex-wrap gap-1">
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider border ${s.access === 'allowlist' ? 'bg-purple-500/10 border-purple-400/30 text-purple-300' : 'bg-green-500/10 border-green-400/30 text-green-300'}`}>
            {s.access === 'allowlist' ? '🔒 ALLOWLIST' : 'OPEN JOIN'}
          </span>
          {s.rp_style && s.rp_style !== 'mixed' && (
            <span className="text-[9px] px-1.5 py-0.5 rounded font-black tracking-wider border border-white/10 text-white/60 bg-white/[0.03]">{STYLES[s.rp_style].toUpperCase()}</span>
          )}
          {feats.map((k) => (
            <span key={k} className="text-[9px] px-1.5 py-0.5 rounded font-bold tracking-wider border border-neonCyan/20 text-neonCyan/70 bg-neonCyan/5">{FEATURES[k]}</span>
          ))}
        </div>

        {blurb && <p className="text-white/50 text-xs leading-relaxed line-clamp-2">{blurb}</p>}

        <div className="flex gap-2 mt-auto pt-1">
          <button type="button" onClick={() => onOpen(s)} className="btn-neon btn-neon-sm flex-1 justify-center" aria-label={`Connect to ${s.name}`}>▶ CONNECT</button>
          {s.discord_url && (
            <a href={s.discord_url} target="_blank" rel="noopener noreferrer" className="btn-neon btn-neon-cyan btn-neon-sm px-3" title={s.discord_members ? `${fmt(s.discord_members)} members` : 'Discord'}>
              DISCORD{s.discord_members ? ` ${compact(s.discord_members)}` : ''}
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
