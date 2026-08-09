import { getOrCreateAudio } from '../lib/AudioManager';
import React, { useState, useRef, useEffect } from 'react'
import TabNavigation, { TabId } from '../rp-hub/components/TabNavigation'
import ServersTab    from '../rp-hub/components/ServersTab'
import GlossaryTab   from '../rp-hub/components/GlossaryTab'
import CharactersTab from '../rp-hub/components/CharactersTab'
import ModsTab       from '../rp-hub/components/ModsTab'
import StoreTab      from '../rp-hub/components/StoreTab'
import CommunityTab  from '../rp-hub/components/CommunityTab'

// â”€â”€ Ñ‚Ðµ Ð¶Ðµ Ñ‚Ñ€ÐµÐºÐ¸ Ñ‡Ñ‚Ð¾ Ð² Layout.tsx Ð³Ð»Ð°Ð²Ð½Ð¾Ð³Ð¾ Ñ…Ð°Ð±Ð° â”€â”€
;

const SUPABASE_STORE = 'https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/design%20photos'
const BG_IMAGES: Record<TabId, string> = {
  servers:    `${SUPABASE_STORE}/Wheelie%20Chase.jpg`,
  glossary:   `${SUPABASE_STORE}/Lucia%20_%20Jason%20_%20Halftone%20Wash.jpg`,
  characters: `${SUPABASE_STORE}/Poolside%20Boss%20_%20Bold%20Ink.jpg`,
  mods:       `${SUPABASE_STORE}/Halftone%20Wash.jpg`,
  store:      'https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/design%20photos/Yacht%20Captain%20_%20Halftone%20Wash.png',
  community:  'https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/design%20photos/Pegassi%20Supercar%20v2.jpg',
}

// â”€â”€ Radio hook â€” Ð¸Ð´ÐµÐ½Ñ‚Ð¸Ñ‡Ð½Ð°Ñ Ð»Ð¾Ð³Ð¸ÐºÐ° Layout.tsx â”€â”€
function useRadio() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    const savedTrackIndex = localStorage.getItem('radioTrackIndex')
    const audio = getOrCreateAudio()
    let trackIndex = savedTrackIndex
      ? parseInt(savedTrackIndex)
    }

    // Ð—Ð°Ð³Ñ€ÑƒÐ¶Ð°ÐµÐ¼ Ð²ÑÐµ Ñ‚Ñ€ÐµÐºÐ¸ Ð¸Ð· muz bucket

    audio.loop = false
    audio.volume = 0.25
    audioRef.current = audio

    // Ð’Ð¾ÑÑÑ‚Ð°Ð½Ð°Ð²Ð»Ð¸Ð²Ð°ÐµÐ¼: Ð¸Ð³Ñ€Ð°Ð»Ð¾ Ð´Ð¾ Ð¿ÐµÑ€ÐµÑ…Ð¾Ð´Ð° ÑÑŽÐ´Ð° Ð¸Ð»Ð¸ Ð½ÐµÑ‚
    const savedPlaying = sessionStorage.getItem('radioPlaying')
    const shouldPlay = savedPlaying === null || savedPlaying === 'true'

    // Ð’Ð¾ÑÑÑ‚Ð°Ð½Ð°Ð²Ð»Ð¸Ð²Ð°ÐµÐ¼ Ð¿Ð¾Ð·Ð¸Ñ†Ð¸ÑŽ Ñ‚Ñ€ÐµÐºÐ°
    const savedTime = parseFloat(localStorage.getItem('radioTime') || '0')
    const restoreTime = !isNaN(savedTime) && isFinite(savedTime) && savedTime >= 0 ? savedTime : 0
    if (restoreTime > 0) {
      const applyTime = () => {
        if (audio.duration && restoreTime < audio.duration) {
          try { audio.currentTime = restoreTime } catch (_) {}
        }
      }
      if (audio.readyState >= 1) applyTime()
      else audio.addEventListener('loadedmetadata', applyTime, { once: true })
    }

    audio.load()

    const markPlaying = () => {
      setIsPlaying(true)
      sessionStorage.setItem('radioPlaying', 'true')
    }

    // ÐŸÐ¾Ð¿Ñ‹Ñ‚ÐºÐ° Ð½ÐµÐ¼ÐµÐ´Ð»ÐµÐ½Ð½Ð¾Ð³Ð¾ Ð·Ð°Ð¿ÑƒÑÐºÐ° (Ñ€Ð°Ð±Ð¾Ñ‚Ð°ÐµÑ‚ Ð¿Ð¾ÑÐ»Ðµ Ð¿ÐµÑ€Ð²Ð¾Ð³Ð¾ Ð²Ð·Ð°Ð¸Ð¼Ð¾Ð´ÐµÐ¹ÑÑ‚Ð²Ð¸Ñ Ñ ÑÐ°Ð¹Ñ‚Ð¾Ð¼)
    if (shouldPlay) {
      const p = audio.play()
      if (p && typeof p.then === 'function') {
        p.then(markPlaying).catch(() => {
          // Autoplay blocked â€” Ð¿Ð¾Ð´Ñ…Ð²Ð°Ñ‚Ð¸Ð¼ Ð¿Ñ€Ð¸ Ð¿ÐµÑ€Ð²Ð¾Ð¼ ÐºÐ»Ð¸ÐºÐµ Ð½Ð¸Ð¶Ðµ
        })
      }
    } else {
      setIsPlaying(false)
    }

    // Fallback â€” Ð¿ÐµÑ€Ð²Ñ‹Ð¹ Ð¶ÐµÑÑ‚ Ð¿Ð¾Ð»ÑŒÐ·Ð¾Ð²Ð°Ñ‚ÐµÐ»Ñ Ð·Ð°Ð¿ÑƒÑÐºÐ°ÐµÑ‚ Ñ€Ð°Ð´Ð¸Ð¾
    const onFirstGesture = () => {
      if (!audioRef.current) return
      const still = sessionStorage.getItem('radioPlaying') !== 'false'
      if (still && audioRef.current.paused) {
        audioRef.current.play().then(markPlaying).catch(() => {})
      }
    }
    document.addEventListener('click',   onFirstGesture, { capture: true, once: true })
    document.addEventListener('keydown', onFirstGesture, { capture: true, once: true })
    document.addEventListener('touchend',onFirstGesture, { capture: true, once: true })

    // Ð¡Ð»ÐµÐ´ÑƒÑŽÑ‰Ð¸Ð¹ Ñ‚Ñ€ÐµÐº ÐºÐ¾Ð³Ð´Ð° Ñ‚ÐµÐºÑƒÑ‰Ð¸Ð¹ Ð·Ð°ÐºÐ°Ð½Ñ‡Ð¸Ð²Ð°ÐµÑ‚ÑÑ
    const onEnded = () => {
      localStorage.setItem('radioTrackIndex', next.toString())
      localStorage.setItem('radioTime', '0')
      if (audioRef.current) {
        // AudioManager handles src
        audioRef.current.load()
        audioRef.current.play().then(markPlaying).catch(() => {})
      }
    }
    audio.addEventListener('ended', onEnded)

    // Ð¡Ð¾Ñ…Ñ€Ð°Ð½ÑÐµÐ¼ Ð¿Ñ€Ð¾Ð³Ñ€ÐµÑÑ Ð¿Ñ€Ð¸ ÑƒÑ…Ð¾Ð´Ðµ ÑÐ¾ ÑÑ‚Ñ€Ð°Ð½Ð¸Ñ†Ñ‹
    const saveProgress = () => {
      if (audioRef.current && !audioRef.current.paused) {
        localStorage.setItem('radioTime', audioRef.current.currentTime.toString())
        localStorage.setItem('radioTrackIndex', trackIndex.toString())
      }
    }
    window.addEventListener('beforeunload', saveProgress)
    const saveInterval = setInterval(saveProgress, 5000)

    // ÐŸÐ°ÑƒÐ·Ð° ÐºÐ¾Ð³Ð´Ð° Ð²ÐºÐ»Ð°Ð´ÐºÐ° ÑÐºÑ€Ñ‹Ñ‚Ð°, Ð²Ð¾Ð·Ð¾Ð±Ð½Ð¾Ð²Ð»ÐµÐ½Ð¸Ðµ ÐºÐ¾Ð³Ð´Ð° Ð²Ð¸Ð´Ð½Ð°
    const onVisibilityChange = () => {
      if (!audioRef.current) return
      if (document.hidden) {
        saveProgress()
      } else {
        const still = sessionStorage.getItem('radioPlaying') !== 'false'
        if (still && audioRef.current.paused) {
          audioRef.current.play().then(markPlaying).catch(() => {})
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(saveInterval)
      window.removeEventListener('beforeunload', saveProgress)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      audio.removeEventListener('ended', onEnded)
      saveProgress()
      audio.pause()
    }
  }, [])

  const toggle = () => {
    if (!audioRef.current) return
    if (audioRef.current.paused) {
      audioRef.current.play().then(() => {
        setIsPlaying(true)
        sessionStorage.setItem('radioPlaying', 'true')
      }).catch(() => {})
    } else {
      audioRef.current.pause()
      setIsPlaying(false)
      sessionStorage.setItem('radioPlaying', 'false')
      if (audioRef.current) {
        localStorage.setItem('radioTime', audioRef.current.currentTime.toString())
      }
    }
  }

  return { isPlaying, toggle }
}

// â”€â”€ Ð˜ÐºÐ¾Ð½ÐºÐ¸ (SVG inline â€” Ð±ÐµÐ· Ð´Ð¾Ð¿. Ð·Ð°Ð²Ð¸ÑÐ¸Ð¼Ð¾ÑÑ‚ÐµÐ¹) â”€â”€
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

export default function RPHub() {
  const [activeTab, setActiveTab] = useState<TabId>('servers')
  const { isPlaying, toggle } = useRadio()

  return (
    <div className="min-h-screen vibe-bg scanlines">

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          HEADER â€” sticky, Ñ ÐºÐ½Ð¾Ð¿ÐºÐ¾Ð¹ â† Ð½Ð°Ð·Ð°Ð´ Ð¸ Ñ€Ð°Ð´Ð¸Ð¾
          Ð˜Ð´ÐµÐ½Ñ‚Ð¸Ñ‡ÐµÐ½ Ð¿Ð¾ Ð²Ñ‹ÑÐ¾Ñ‚Ðµ Ð¸ ÑÑ‚Ð¸Ð»ÑŽ Layout.tsx (h-[75px])
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <header
        className="sticky top-0 z-[500] h-[75px] flex items-center justify-between px-4 sm:px-6 lg:px-12 shadow-2xl"
        style={{
          background: 'rgba(7,7,15,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        {/* â”€â”€ Ð›ÐµÐ²Ñ‹Ð¹ Ð±Ð»Ð¾Ðº: Ð»Ð¾Ð³Ð¾Ñ‚Ð¸Ð¿ + ÑÑ‚Ñ€ÐµÐ»ÐºÐ° Ð½Ð°Ð·Ð°Ð´ â”€â”€ */}
        <a
          href="./index.html"
          className="flex items-center gap-2 hover:scale-105 transition-transform"
          aria-label="Back to Vice City Hub"
        >
          {/* Ð¡Ñ‚Ñ€ÐµÐ»ÐºÐ° â€” Ð²ÑÐµÐ³Ð´Ð° Ð²Ð¸Ð´Ð½Ð° */}
          <span
            className="font-orbitron font-black text-lg leading-none"
            style={{ color: '#FF00FF', filter: 'drop-shadow(0 0 8px rgba(255,0,255,0.8))' }}
          >
            â†
          </span>
          {/* ÐŸÐ¾Ð»Ð½Ð¾Ðµ Ð½Ð°Ð·Ð²Ð°Ð½Ð¸Ðµ â€” ÑÐºÑ€Ñ‹Ñ‚Ð¾ Ð½Ð° xs, Ð²Ð¸Ð´Ð½Ð¾ Ð½Ð°Ñ‡Ð¸Ð½Ð°Ñ Ñ sm */}
          <span className="hidden sm:block font-orbitron font-extrabold text-xl tracking-widest bg-gradient-to-r from-[#FF00FF] to-[#00FFFF] bg-clip-text text-transparent">
            VICE CITY HUB
          </span>
          {/* ÐšÐ¾Ñ€Ð¾Ñ‚ÐºÐ¾Ðµ â€” Ñ‚Ð¾Ð»ÑŒÐºÐ¾ xs */}
          <span className="sm:hidden font-orbitron font-bold text-sm tracking-widest text-neonPink/80">
            HUB
          </span>
        </a>

        {/* â”€â”€ Ð¦ÐµÐ½Ñ‚Ñ€: Ð½Ð°Ð·Ð²Ð°Ð½Ð¸Ðµ Ñ€Ð°Ð·Ð´ÐµÐ»Ð° (Ñ‚Ð¾Ð»ÑŒÐºÐ¾ lg) â”€â”€ */}
        <div className="hidden lg:block absolute left-1/2 -translate-x-1/2 pointer-events-none">
          <span
            className="font-orbitron font-black text-sm tracking-[0.25em] bg-gradient-to-r from-[#FF00FF] via-[#CC00FF] to-[#00FFFF] bg-clip-text text-transparent"
            style={{ filter: 'drop-shadow(0 0 6px rgba(255,0,255,0.35))' }}
          >
            GTA 6 RP &amp; MODDING HUB
          </span>
        </div>

        {/* â”€â”€ ÐŸÑ€Ð°Ð²Ñ‹Ð¹ Ð±Ð»Ð¾Ðº: Ð¸Ð¼Ñ Ñ€Ð°Ð·Ð´ÐµÐ»Ð° (mobile) + ÐºÐ½Ð¾Ð¿ÐºÐ° Ñ€Ð°Ð´Ð¸Ð¾ â”€â”€ */}
        <div className="flex items-center gap-3">
          {/* ÐÐ°Ð·Ð²Ð°Ð½Ð¸Ðµ Ñ€Ð°Ð·Ð´ÐµÐ»Ð° Ð½Ð° Ð¼Ð¾Ð±Ð°Ð¹Ð»Ðµ */}
          <span className="lg:hidden font-orbitron font-black text-[10px] tracking-wider bg-gradient-to-r from-[#FF00FF] to-[#00FFFF] bg-clip-text text-transparent">
            RP HUB
          </span>

          {/* ÐšÐ½Ð¾Ð¿ÐºÐ° Leonida FM â€” Ð¸Ð´ÐµÐ½Ñ‚Ð¸Ñ‡Ð½Ð° Layout.tsx */}
          <button
            onClick={toggle}
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

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          PAGE HERO
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
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
            Leonida State Â· San Andreas Â· Est. 2025
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
            Server Intel Â· Leonida Files Â· Identity Forge Â· Mod Vault Â· Store District
          </p>
          <div className="flex flex-wrap gap-2 sm:gap-3 mt-3">
            {[
              { label: 'â— FiveM / NoPixel', c: 'rgba(255,0,255' },
              { label: 'â— GTA 6 Ready',     c: 'rgba(0,255,255' },
              { label: 'â— v11 Build',        c: 'rgba(255,225,53' },
            ].map(b => (
              <span key={b.label} className="font-orbitron text-[9px] font-bold px-2 py-1 rounded"
                style={{ background: `${b.c},0.08)`, border: `1px solid ${b.c},0.25)`, color: `${b.c},0.85)` }}>
                {b.label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* â”€â”€ TABS â”€â”€ */}
      <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
          CONTENT â€” per-tab background Ð¸Ð· Supabase Storage
          â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <div
        className="relative min-h-screen"
        style={{
          backgroundImage: `linear-gradient(to bottom,
            rgba(5,5,8,0.90) 0%,
            rgba(5,5,8,0.78) 20%,
            rgba(5,5,8,0.82) 80%,
            rgba(5,5,8,0.95) 100%
          ), url('${BG_IMAGES[activeTab]}')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 20%',
          backgroundAttachment: 'fixed',
          transition: 'background-image 0.5s ease',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-7">
          {activeTab === 'servers'    && <ServersTab />}
          {activeTab === 'glossary'   && <GlossaryTab />}
          {activeTab === 'characters' && <CharactersTab />}
          {activeTab === 'mods'       && <ModsTab />}
          {activeTab === 'store'      && <StoreTab />}
          {activeTab === 'community'   && <CommunityTab />}
        </div>
      </div>

      {/* â”€â”€ FOOTER â”€â”€ */}
      <footer className="border-t py-6 text-center" style={{ borderColor: 'rgba(255,0,255,0.08)', background: 'var(--darker-bg)' }}>
        <div className="gradient-line mb-4" />
        <a
          href="./index.html"
          className="inline-flex items-center gap-2 font-orbitron text-[10px] tracking-widest text-neonPink/40 hover:text-neonPink transition-colors mb-3"
        >
          â† BACK TO VICE CITY HUB
        </a>
        <p className="font-orbitron text-[8px] text-white/10 tracking-widest">
          NOT AFFILIATED WITH ROCKSTAR GAMES Â· ALL DATA COMMUNITY-SOURCED Â· OBVIOUSLY
        </p>
      </footer>
    </div>
  )
}


