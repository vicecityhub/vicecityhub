import React, { useState, useEffect, useRef, useCallback } from 'react';
export type TabId = 'servers' | 'glossary' | 'characters' | 'mods' | 'store' | 'community';
interface Tab { id: TabId; label: string; icon: string; badge?: string; badgeType?: 'live'|'hot'|'new'; }
const TABS: Tab[] = [
  { id: 'servers',    label: 'SERVER INTEL',    icon: '📡', badge: 'LIVE', badgeType: 'live' },
  { id: 'glossary',   label: 'LEONIDA FILES',   icon: '📋' },
  { id: 'characters', label: 'IDENTITY FORGE',  icon: '🪪', badge: 'HOT',  badgeType: 'hot' },
  { id: 'mods',       label: 'MOD VAULT',       icon: '🔧' },
  { id: 'store',      label: 'STORE DISTRICT',  icon: '🏪', badge: 'NEW',  badgeType: 'new' },
  { id: 'community',  label: 'COMMUNITY BOARD', icon: '🎯', badge: 'HOT',  badgeType: 'hot' },
];
const AUTOPLAY_MS = 6000;
const TICK_MS = 50;
const STEP = (TICK_MS / AUTOPLAY_MS) * 100;
interface Props { activeTab: TabId; onTabChange: (t: TabId) => void; }
export default function TabNavigation({ activeTab, onTabChange }: Props) {
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pausedRef = useRef(false);
  const progressRef = useRef(0);
  const advanceTab = useCallback(() => {
    const idx = TABS.findIndex(t => t.id === activeTab);
    onTabChange(TABS[(idx + 1) % TABS.length].id);
  }, [activeTab, onTabChange]);
  useEffect(() => {
    progressRef.current = 0; setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      if (pausedRef.current) return;
      progressRef.current = Math.min(progressRef.current + STEP, 100);
      setProgress(progressRef.current);
      if (progressRef.current >= 100) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = null; progressRef.current = 0; advanceTab();
      }
    }, TICK_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeTab, advanceTab]);
  const handleClick = (id: TabId) => { if (id !== activeTab) { pausedRef.current = false; onTabChange(id); } };
  return (
    <div className="sticky top-0 z-50 backdrop-blur-md border-b border-white/[0.06] relative select-none"
      style={{ background: 'rgba(5,5,8,0.96)' }}
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}>
      <div className="gradient-line" />
      <div className="absolute bottom-0 left-0 h-[3px] z-20 pointer-events-none"
        style={{ width: progress + '%', background: 'linear-gradient(90deg,var(--neon-pink),var(--neon-cyan))', boxShadow: '0 0 8px rgba(255,0,255,0.8)', transition: 'width ' + TICK_MS + 'ms linear' }} />
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            const bStyle: React.CSSProperties = tab.badgeType === 'live'
              ? { background: 'rgba(239,68,68,0.9)', color: '#fff' }
              : tab.badgeType === 'hot'
              ? { background: 'rgba(255,0,255,0.2)', color: 'var(--neon-pink)', border: '1px solid rgba(255,0,255,0.4)' }
              : { background: 'rgba(0,255,255,0.15)', color: 'var(--neon-cyan)', border: '1px solid rgba(0,255,255,0.35)' };
            return (
              <button key={tab.id} onClick={() => handleClick(tab.id)}
                className="relative flex items-center gap-2 px-4 sm:px-5 py-4 font-orbitron font-bold text-[10px] tracking-widest whitespace-nowrap transition-colors duration-200 outline-none"
                style={{ color: isActive ? 'var(--neon-pink)' : 'rgba(255,255,255,0.38)', borderBottom: isActive ? '2px solid var(--neon-pink)' : '2px solid transparent', background: isActive ? 'rgba(255,0,255,0.07)' : 'transparent', textShadow: isActive ? '0 0 10px rgba(255,0,255,0.8)' : 'none' }}>
                <span style={{ display: 'inline-block', transform: isActive ? 'scale(1.15)' : 'scale(1)', filter: isActive ? 'drop-shadow(0 0 5px rgba(255,0,255,0.9))' : 'none', transition: 'transform 0.2s,filter 0.2s' }}>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.badge && <span className="text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider" style={{ ...bStyle, animation: tab.badgeType === 'live' ? 'pulse 1.5s infinite' : 'none' }}>{tab.badge}</span>}
                {isActive && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--neon-pink)', boxShadow: '0 0 8px var(--neon-pink)', marginBottom: '-1px' }} />}
              </button>
            );
          })}
        </div>
        <div className="flex justify-center gap-2 py-1.5 sm:hidden">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => handleClick(tab.id)} className="rounded-full transition-all duration-300"
              style={{ width: activeTab === tab.id ? '20px' : '6px', height: '6px', background: activeTab === tab.id ? 'var(--neon-pink)' : 'rgba(255,255,255,0.2)', boxShadow: activeTab === tab.id ? '0 0 6px var(--neon-pink)' : 'none' }} />
          ))}
        </div>
      </div>
    </div>
  );
}
