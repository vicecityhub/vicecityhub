import React from 'react';

/** The Wire banner. */
export function NewsHero() {
  return (
  <header className="min-h-[40vh] flex flex-col items-center justify-center text-center px-6 relative overflow-hidden bg-radial-hero py-16">
    <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_80%_50%_at_50%_85%,rgba(255,0,255,0.08)_0%,transparent_60%)]" />
    
    <div className="relative z-10 flex flex-col items-center max-w-4xl">
      <div className="font-orbitron text-[10px] sm:text-xs font-bold tracking-[0.3em] text-neonPink uppercase border border-neonPink/40 px-6 py-2.5 rounded-full bg-neonPink/5 shadow-[0_0_15px_rgba(255,0,255,0.15)] mb-6 animate-pulse">
        DISPATCH STATION &mdash; REAL-TIME INTEL
      </div>

      <h1 className="font-orbitron font-black text-5xl sm:text-7xl uppercase tracking-tighter bg-gradient-to-br from-white via-neonPink to-neonCyan bg-clip-text text-transparent filter drop-shadow-2xl">
        THE WIRE
      </h1>

      <p className="text-xs sm:text-sm text-gray-400 font-bold max-w-lg mx-auto mt-4 leading-relaxed font-rajdhani uppercase tracking-widest">
        Unfiltered database feed of official releases, telemetry leaks, community analysis, and syndication notes.
      </p>
    </div>
  </header>
  );
}
