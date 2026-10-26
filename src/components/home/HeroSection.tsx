import React from 'react';
import { useCountdown } from './useCountdown';

const UNITS = [
  { key: 'days', label: 'Days' },
  { key: 'hours', label: 'Hours' },
  { key: 'minutes', label: 'Mins' },
  { key: 'seconds', label: 'Secs' },
] as const;

interface HeroSectionProps {
  onOpenModal: (id: string, tab?: 'login' | 'register') => void;
}

/** Hero banner with the release countdown and the two call-to-action buttons. */
export function HeroSection({ onOpenModal }: HeroSectionProps) {
  const timeLeft = useCountdown();

  return (
    <header className="flex flex-col items-center justify-center text-center px-6 pt-1 pb-10 lg:pt-2 lg:pb-12 relative overflow-hidden bg-radial-hero">
      <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_80%_50%_at_50%_85%,rgba(255,0,255,0.12)_0%,transparent_60%)]" />

      <div className="relative z-10 flex flex-col items-center max-w-4xl">
        <div className="font-orbitron text-[10px] sm:text-xs font-bold tracking-[0.3em] text-neonCyan uppercase border border-neonCyan/40 px-6 py-1 rounded-full bg-neonCyan/5 shadow-[0_0_15px_rgba(0,255,255,0.15)] mb-2 lg:mb-3">
          Vice City Hub &mdash; GTA VI Official Fan Community
        </div>

        <h1 className="font-orbitron font-black text-5xl sm:text-7xl md:text-8xl lg:text-9xl xl:text-[11rem] leading-[0.85] uppercase tracking-tighter bg-gradient-to-br from-white via-neonPink to-neonOrange bg-clip-text text-transparent filter drop-shadow-2xl">
          GTA VI
        </h1>

        <div className="font-orbitron text-lg sm:text-2xl font-bold tracking-[0.15em] text-neonCyan mt-2 lg:mt-3 uppercase">
          Lucia Caminos &amp; Jason Duval
        </div>

        <p className="text-sm sm:text-base text-gray-400 font-bold max-w-xl mx-auto mt-3 lg:mt-4 leading-relaxed">
          The definitive hub for everything Grand Theft Auto VI. Real news, interactive cartography, syndicate forum posts, Web3 domain listings, and live investor analytics. Zero fluff.
        </p>

        {/* COUNTDOWN TIMER */}
        <div className="countdown mt-6 lg:mt-7" id="countdown">
          {UNITS.map(u => (
            <div key={u.key} className="cd-unit">
              <div className="cd-num">{timeLeft[u.key]}</div>
              <div className="cd-lbl">{u.label}</div>
            </div>
          ))}
        </div>

        {/* CALL TO ACTIONS */}
        <div className="flex flex-wrap gap-4 justify-center mt-5 lg:mt-6">
          <button onClick={() => onOpenModal('sitemap')} className="btn-neon font-orbitron text-xs">
            Explore Hub
          </button>
          <button onClick={() => onOpenModal('auth', 'register')} className="btn-neon btn-neon-cyan font-orbitron text-xs">
            Become a Member
          </button>
        </div>
      </div>
    </header>
  );
}
