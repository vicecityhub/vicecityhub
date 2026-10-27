import React, { lazy, Suspense } from 'react';
import OnView from '../OnView';

// The arcade game lives below the forum and is only loaded when the visitor scrolls close to it.
const ViceArcadeGame = lazy(() => import('../ViceArcadeGame'));

/** PLAY GTA VI RIGHT NOW: arcade game, moved here from the home page so the home page stays light. */
export function ArcadePromo() {
  return (
    <div className="mt-12">
        <div className="glass-card overflow-hidden border border-neonPink/30 hover:border-neonPink shadow-2xl flex flex-col md:flex-row">
          <div className="w-full md:w-[420px] flex-shrink-0 flex items-center justify-center p-6 bg-black/40 border-r border-white/5">
            <OnView minHeight={420}><Suspense fallback={null}><ViceArcadeGame /></Suspense></OnView>
          </div>
          <div className="p-8 flex flex-col justify-center flex-grow">
            <div>
              <span className="text-neonPink font-orbitron font-extrabold text-[10px] tracking-widest uppercase flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-neonPink inline-block animate-pulse" />
                Playable Right Now
              </span>
              <h3 className="font-bold text-3xl text-white font-orbitron tracking-wide mb-3 mt-1 uppercase">Play <span className="text-neonPink">GTA6</span> Right Now!</h3>
              <p className="text-xs text-gray-400 leading-relaxed font-bold mb-6 max-w-md">
                Can't wait until November? Dodge the LSPD, stack cash, and chase a high score in Vice City Hustle -- our browser-native arcade tribute while you wait for the real thing to drop.
              </p>
              <ul className="text-xs text-gray-500 font-bold space-y-1.5">
                <li className="flex items-center gap-2"><span className="text-neonCyan">-</span> Arrow keys or tap to dodge traffic</li>
                <li className="flex items-center gap-2"><span className="text-neonCyan">-</span> Collect cash for combo multipliers</li>
                <li className="flex items-center gap-2"><span className="text-neonCyan">-</span> Speed ramps up the longer you survive</li>
                <li className="flex items-center gap-2"><span className="text-neonCyan">-</span> High score saved locally on your device</li>
              </ul>
            </div>
            <div className="flex flex-wrap items-center justify-between border-t border-white/5 pt-6 mt-6 gap-4">
              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-orbitron">No download. No sign-up. Just vibes.</span>
            </div>

          </div>
        </div>
    </div>
  );
}
