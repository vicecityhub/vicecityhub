import React from 'react'

const IconVolume = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
  </svg>
)
const IconMute = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <line x1="23" y1="9" x2="17" y2="15"/>
    <line x1="17" y1="9" x2="23" y2="15"/>
  </svg>
)

interface Props { isPlaying: boolean; onToggle: (e: React.MouseEvent) => void }

/** Sticky top bar: logo, page title and the Leonida FM button. */
export default function RpHeader({ isPlaying, onToggle }: Props) {
  return (
    <header
      className="sticky top-0 z-[500] h-[75px] flex items-center justify-between px-4 sm:px-6 lg:px-12 shadow-2xl"
      style={{
        background: 'rgba(7,7,15,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <a
        href="./index.html"
        className="flex items-center gap-2 hover:scale-105 transition-transform"
        aria-label="Back to Vice City Hub"
      >
        <span
          className="font-orbitron font-black text-lg leading-none"
          style={{ color: '#FF00FF', filter: 'drop-shadow(0 0 8px rgba(255,0,255,0.8))' }}
        >
          VCH
        </span>
        <span className="hidden sm:block font-orbitron font-extrabold text-xl tracking-widest bg-gradient-to-r from-[#FF00FF] to-[#00FFFF] bg-clip-text text-transparent">
          VICE CITY HUB
        </span>
        <span className="sm:hidden font-orbitron font-bold text-sm tracking-widest text-neonPink/80">
          HUB
        </span>
      </a>

      <div className="hidden lg:block absolute left-1/2 -translate-x-1/2 pointer-events-none">
        <span
          className="font-orbitron font-black text-sm tracking-[0.25em] bg-gradient-to-r from-[#FF00FF] via-[#CC00FF] to-[#00FFFF] bg-clip-text text-transparent"
          style={{ filter: 'drop-shadow(0 0 6px rgba(255,0,255,0.35))' }}
        >
          GTA 6 RP &amp; MODDING HUB
        </span>
      </div>

      <div className="flex items-center gap-3">
        <span className="lg:hidden font-orbitron font-black text-[10px] tracking-wider bg-gradient-to-r from-[#FF00FF] to-[#00FFFF] bg-clip-text text-transparent">
          RP HUB
        </span>

        <button
          onClick={onToggle}
          title={isPlaying ? 'Pause Leonida FM' : 'Play Leonida FM'}
          className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${
            isPlaying
              ? 'text-neonPink border-neonPink shadow-[0_0_15px_rgba(255,0,255,0.4)] animate-pulse'
              : 'text-neonCyan border-neonCyan hover:shadow-[0_0_10px_rgba(0,255,255,0.3)]'
          }`}
        >
          {isPlaying ? <IconVolume /> : <IconMute />}
        </button>
      </div>
    </header>
  )
}
