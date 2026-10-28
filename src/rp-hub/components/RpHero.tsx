import React from 'react'

/** Title block under the header. */
export default function RpHero() {
  return (
    <div
      className="relative overflow-hidden"
      style={{ background: 'var(--darker-bg)', borderBottom: '1px solid rgba(255,0,255,0.1)' }}
    >
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-20 left-1/3 w-[500px] h-[280px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(ellipse, rgba(255,0,255,0.5) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[180px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(ellipse, rgba(0,255,255,0.5) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      </div>
      <div className="gradient-line" />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-5 sm:py-7">
        <div className="font-orbitron text-[9px] tracking-[0.4em] text-white/20 mb-2 uppercase">
          Leonida State - San Andreas - Est. 2025
        </div>
        <h1 className="font-orbitron font-extrabold tracking-widest leading-none">
          <span
            className="block text-2xl sm:text-4xl lg:text-5xl bg-gradient-to-r from-[#FF00FF] via-[#CC00FF] to-[#00FFFF] bg-clip-text text-transparent"
            style={{ filter: 'drop-shadow(0 0 14px rgba(255,0,255,0.5)) drop-shadow(0 0 28px rgba(0,255,255,0.2))' }}
          >
            GTA 6 RP &amp; MODDING HUB
          </span>
        </h1>
        <p className="font-rajdhani text-white/30 text-xs sm:text-sm tracking-[0.2em] mt-2 uppercase">
          Server Intel - Leonida Files - Identity Forge - Mod Vault - Store District
        </p>
        <div className="flex flex-wrap gap-2 sm:gap-3 mt-3">
          {[
            { label: '* FiveM / NoPixel', c: 'rgba(255,0,255' },
            { label: '* GTA 6 Ready',     c: 'rgba(0,255,255' },
            { label: '* v11 Build',        c: 'rgba(255,225,53' },
          ].map(b => (
            <span key={b.label} className="font-orbitron text-[9px] font-bold px-2 py-1 rounded"
              style={{ background: `${b.c},0.08)`, border: `1px solid ${b.c},0.25)`, color: `${b.c},0.85)` }}>
              {b.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
