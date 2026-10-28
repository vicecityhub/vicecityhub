import React from 'react'

/** Back link and the legal one-liner. */
export default function RpFooter() {
  return (
    <footer className="border-t py-6 text-center" style={{ borderColor: 'rgba(255,0,255,0.08)', background: 'var(--darker-bg)' }}>
      <div className="gradient-line mb-4" />
      <a
        href="./index.html"
        className="inline-flex items-center gap-2 font-orbitron text-[10px] tracking-widest text-neonPink/40 hover:text-neonPink transition-colors mb-3"
      >
        {'\u00AB'} BACK TO VICE CITY HUB
      </a>
      <p className="font-orbitron text-[8px] text-white/10 tracking-widest">
        NOT AFFILIATED WITH ROCKSTAR GAMES - ALL DATA COMMUNITY-SOURCED - OBVIOUSLY
      </p>
    </footer>
  )
}
