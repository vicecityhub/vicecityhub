import React, { useState, useEffect, useRef, useCallback } from 'react';

export type TabId = 'servers' | 'glossary' | 'characters' | 'mods' | 'store' | 'community';

interface Tab { id: TabId; label: string; icon: string; badge?: string; badgeType?: 'live'|'hot'|'new'; }

const TABS: Tab[] = [
  { id: 'servers',    label: 'SERVER INTEL',    icon: '\u{1F4E1}', badge: 'LIVE', badgeType: 'live' },
  { id: 'glossary',   label: 'LEONIDA FILES',   icon: '\u{1F4CB}' },
  { id: 'characters', label: 'IDENTITY FORGE',  icon: '\u{1FAAA}', badge: 'HOT',  badgeType: 'hot' },
  { id: 'mods',       label: 'MOD VAULT',       icon: '\u{1F527}' },
  { id: 'store',      label: 'STORE DISTRICT',  icon: '\u{1F3EA}', badge: 'NEW',  badgeType: 'new' },
  { id: 'community',  label: 'COMMUNITY BOARD', icon: '\u{1F3AF}', badge: 'HOT',  badgeType: 'hot' },
];

const AUTOPLAY_MS = 6000;
interface Props { activeTab: TabId; onTabChange: (t: TabId) => void; }

export default function TabNavigation({ activeTab, onTabChange }: Props) {
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(0);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef  = useRef(false);

  const nextTab = useCallback(() => {
    const idx = TABS.findIndex(t => t.id === activeTab);
    const next = TABS[(idx + 1) % TABS.length];
    onTabChange(next.id);
  }, [activeTab, onTabChange]);

  const resetAutoplay = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    progressRef.current = 0;
    setProgress(0);
    const STEP = 50;
    timerRef.current = setInterval(() => {
      if (pausedRef.current) return;
      progressRef.current += (STEP / AUTOPLAY_MS) * 100;
      if (progressRef.current >= 100) {
        progressRef.current = 0;
        setProgress(0);
        nextTab();
      } else {
        setProgress(progressRef.current);
      }
    }, STEP);
  }, [nextTab]);

  useEffect(() => { resetAutoplay(); return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, [activeTab]);

  const handleClick = (id: TabId) => {
    if (id === activeTab) return;
    pausedRef.current = false;
    onTabChange(id);
  };

  const handleMouseEnter = () => { pausedRef.current = true; };
  const handleMouseLeave = () => { pausedRef.current = false; };

  return (
    <div className="sticky top-0 z-50 backdrop-blur-md border-b border-white/[0.06] relative select-none"
      style={{ background: 'rgba(5,5,8,0.96)' }}
      onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>

      <div className="gradient-line" />

      {/* Autoplay progress bar */}
      <div className="absolute bottom-0 left-0 h-[2px] z-10 rounded-r transition-none"
        style={{ width: ${progress}%, background: 'linear-gradient(90deg,var(--neon-pink),var(--neon-cyan))', boxShadow: '0 0 6px rgba(255,0,255,0.7)' }} />

      <div className="max-w-7xl mx-auto px-4">
        <div className="flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const bStyle = tab.badgeType === 'live'
              ? { background:'rgba(239,68,68,0.9)', color:'#fff' }
              : tab.badgeType === 'hot'
              ? { background:'rgba(255,0,255,0.2)', color:'var(--neon-pink)', border:'1px solid rgba(255,0,255,0.4)' }
              : { background:'rgba(0,255,255,0.15)', color:'var(--neon-cyan)', border:'1px solid rgba(0,255,255,0.35)' };
            return (
              <button key={tab.id} onClick={() => handleClick(tab.id)}
                className="relative flex items-center gap-2 px-4 sm:px-5 py-4 font-orbitron font-bold text-[10px] tracking-widest whitespace-nowrap transition-all duration-200 outline-none"
                style={{
                  color: isActive ? 'var(--neon-pink)' : 'rgba(255,255,255,0.38)',
                  borderBottom: isActive ? '2px solid var(--neon-pink)' : '2px solid transparent',
                  background: isActive ? 'rgba(255,0,255,0.07)' : 'transparent',
                  textShadow: isActive ? '0 0 10px rgba(255,0,255,0.8)' : 'none',
                }}>
                <span style={{ display:'inline-block', transform: isActive ? 'scale(1.15)' : 'scale(1)', transition:'transform 0.2s', filter: isActive ? 'drop-shadow(0 0 5px rgba(255,0,255,0.9))' : 'none' }}>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.badge && <span className="text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider" style={{ ...bStyle, animation: tab.badgeType === 'live' ? 'pulse 1.5s infinite' : 'none' }}>{tab.badge}</span>}
                {isActive && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full" style={{ background:'var(--neon-pink)', boxShadow:'0 0 8px var(--neon-pink)', marginBottom:'-1px' }} />}
              </button>
            );
          })}
        </div>

        {/* Mobile dot indicators */}
        <div className="flex justify-center gap-2 py-1.5 sm:hidden">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => handleClick(tab.id)}
              className="rounded-full transition-all duration-300"
              style={{ width: activeTab===tab.id?'20px':'6px', height:'6px', background: activeTab===tab.id?'var(--neon-pink)':'rgba(255,255,255,0.2)', boxShadow: activeTab===tab.id?'0 0 6px var(--neon-pink)':'' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
