import React from 'react';
import LazyVideo from '../LazyVideo';

const GIFT_SET_URL = 'https://store.rockstargames.com/ru/merchandise/gtavi-goodtime-state-vice-city-collection';

type HoverTarget = React.MouseEvent<HTMLAnchorElement>;

const setHover = (e: HoverTarget, on: boolean) => {
  const el = e.currentTarget as HTMLAnchorElement;
  el.style.background = on ? 'var(--neon-orange)' : 'transparent';
  el.style.color = on ? '#000' : 'var(--neon-orange)';
  el.style.boxShadow = on ? '0 0 20px var(--neon-orange)' : 'none';
};

/** "Vice City Gift Set" banner: text + CTA on the left, looping video on the right. */
export function GiftSetBanner() {
  return (
    <section className="py-4 px-6 max-w-[1280px] mx-auto">
      {/* Desktop: flex-row | Mobile: flex-col */}
      <div className="flex flex-col sm:flex-row rounded-xl overflow-hidden border border-neonOrange/50 shadow-[0_0_40px_rgba(255,107,53,0.2)] bg-black">
        {/* Text side */}
        <div className="flex-shrink-0 sm:w-72 flex flex-col justify-center px-6 py-6 bg-black"
          style={{borderBottom: '1px solid rgba(255,107,53,0.2)'}}>
          <p className="text-[9px] font-orbitron font-bold text-neonOrange uppercase tracking-[0.25em] mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-neonOrange inline-block animate-pulse" />
            LIMITED DROP
          </p>
          <h2 className="font-orbitron font-extrabold text-xl sm:text-2xl text-white uppercase leading-tight mb-3">
            Vice City<br />
            Gift <span className="text-neonOrange">Set</span>
          </h2>
          <p className="text-[10px] text-white/50 leading-relaxed mb-4">
            Rockstar's official Goodtime State Vice City Collection just dropped. Limited merch, straight from the source — check it out before it's gone.
          </p>
          <a
            href={GIFT_SET_URL}
            target="_blank"
            rel="noreferrer"
            className="font-orbitron text-xs w-fit px-4 py-2 rounded transition-all duration-200"
            style={{
              border: '1px solid var(--neon-orange)',
              color: 'var(--neon-orange)',
              background: 'transparent',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={e => setHover(e, true)}
            onMouseLeave={e => setHover(e, false)}
          >
            SEE THE GIFT SET →
          </a>
        </div>
        {/* Video side — original proportions, no stretching */}
        <div className="flex-1 bg-black flex items-center justify-center p-0" style={{minHeight: '180px'}}>
          <LazyVideo
            src={`${import.meta.env.BASE_URL}media/pozor.webm`}
            className="block"
            style={{width: '100%', height: '100%', objectFit: 'contain', maxHeight: '320px'}}
          />
        </div>
      </div>
    </section>
  );
}
