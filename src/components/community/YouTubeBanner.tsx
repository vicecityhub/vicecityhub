import React from 'react';

/** Link card to the YouTube community tab. */
export function YouTubeBanner() {
  return (
    <a
      href="https://youtube.com/@vicecity_hub/community?si=G6x0kiCdvueaTgR-"
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-4 rounded-xl p-4 mb-5 transition-all duration-200 hover:-translate-y-0.5 group"
      style={{ background: 'linear-gradient(135deg, rgba(255,0,0,0.1), rgba(255,0,0,0.04))', border: '1px solid rgba(255,0,0,0.25)' }}
    >
      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(255,0,0,0.15)', border: '1px solid rgba(255,0,0,0.4)' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.09 0 12 0 12s0 3.91.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.5 20.5 12 20.5 12 20.5s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.91 24 12 24 12s0-3.91-.5-5.81zM9.75 15.5V8.5l6.5 3.5-6.5 3.5z"/></svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-orbitron font-black text-xs text-white tracking-widest group-hover:text-red-400 transition-colors">VICE CITY HUB — YOUTUBE COMMUNITY</div>
        <p className="text-[10px] text-white/40 mt-0.5">Posts, polls, drops and drama. Join the community tab — we post what doesn't fit in a video.</p>
      </div>
      <div className="font-orbitron font-black text-[9px] text-red-400/70 flex-shrink-0">JOIN ›</div>
    </a>
  );
}
