import React, { useState, useEffect, useRef } from 'react';

export type TabId = 'servers' | 'glossary' | 'characters' | 'mods' | 'store' | 'community';

interface Tab { id: TabId; label: string; icon: string; badge?: string; badgeColor?: string; }

const TABS: Tab[] = [
  { id: 'servers',    label: 'SERVER INTEL',    icon: '\u{1F4E1}', badge: 'LIVE', badgeColor: 'red' },
  { id: 'glossary',   label: 'LEONIDA FILES',   icon: '\u{1F4CB}' },
  { id: 'characters', label: 'IDENTITY FORGE',  icon: '\u{1FAAA}', badge: 'HOT', badgeColor: 'pink' },
  { id: 'mods',       label: 'MOD VAULT',       icon: '\u{1F527}' },
  { id: 'store',      label: 'STORE DISTRICT',  icon: '\u{1F3EA}', badge: 'NEW', badgeColor: 'cyan' },
  { id: 'community',  label: 'COMMUNITY BOARD', icon: '\u{1F3AF}', badge: 'HOT', badgeColor: 'red' },
];

interface Props { activeTab: TabId; onTabChange: (t: TabId) => void; }

export default function TabNavigation({ activeTab, onTabChange }: Props) {
  const [loadingTab, setLoadingTab] = useState<TabId | null>(null);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleClick = (id: TabId) => {
    if (id === activeTab || loadingTab) return;
    setLoadingTab(id);
    setProgress(0);
    let p = 0;
    if (progressRef.current) clearInterval(progressRef.current);
    progressRef.current = setInterval(() => {
      p += Math.random() * 30 + 15;
      if (p >= 100) {
        p = 100;
        clearInterval(progressRef.current!);
        setProgress(100);
        setTimeout(() => {
          onTabChange(id);
          setLoadingTab(null);
          setProgress(0);
        }, 80);
      } else {
        setProgress(Math.min(p, 99));
      }
    }, 55);
  };

  useEffect(() => () => { if (progressRef.current) clearInterval(progressRef.current); }, []);


  return (
    <div className="sticky top-0 z-50 backdrop-blur-md border-b border-white/[0.06] relative"
      style={{ background: 'rgba(5,5,8,0.96)' }}>
      <div className="gradient-line" />

      {/* Progress bar */}
      {loadingTab && (
        <div className="absolute bottom-0 left-0 h-[2px] z-10 rounded-r transition-all"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, var(--neon-pink), var(--neon-cyan))',
            boxShadow: '0 0 8px rgba(255,0,255,0.8)',
            transition: 'width 0.055s linear',
          }} />
      )}
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(tab => {
            const isActive   = activeTab  === tab.id;
            const isLoading  = loadingTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => handleClick(tab.id)}
                className="relative flex items-center gap-2 px-4 sm:px-5 py-4 font-orbitron font-bold
                  text-[10px] tracking-widest whitespace-nowrap transition-all duration-200 outline-none"
                style={{
                  color: isActive
                    ? 'var(--neon-pink)'
                    : isLoading ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.38)',
                  borderBottom: isActive ? '2px solid var(--neon-pink)' : isLoading ? '2px solid rgba(255,0,255,0.4)' : '2px solid transparent',
                  background: isActive
                    ? 'rgba(255,0,255,0.06)'
                    : isLoading ? 'rgba(255,0,255,0.04)' : 'transparent',
                  textShadow: isActive ? '0 0 8px rgba(255,0,255,0.7)' : 'none',
                }}
              >
                {/* Loading shimmer bar */}
                {isLoading && (
                  <span
                    className="absolute bottom-0 left-0 h-[2px] rounded"
                    style={{
                      background: 'linear-gradient(90deg, var(--neon-pink), var(--neon-cyan))',
                      animation: 'tabLoadBar 0.28s ease-out forwards',
                    }}
                  />
                )}

                <span style={{ filter: isActive ? 'drop-shadow(0 0 4px rgba(255,0,255,0.8))' : 'none', transform: isActive ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.2s', display: 'inline-block' }}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>

                {tab.badge && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider flex-shrink-0"
                    style={{
                      background: tab.badgeColor === 'red'
                        ? 'rgba(239,68,68,0.85)'
                        : tab.badgeColor === 'pink'
                        ? 'rgba(255,0,255,0.2)'
                        : 'rgba(0,255,255,0.15)',
                      color: tab.badgeColor === 'red'
                        ? '#fff'
                        : tab.badgeColor === 'pink'
                        ? 'var(--neon-pink)'
                        : 'var(--neon-cyan)',
                      border: tab.badge === 'LIVE' ? 'none' : `1px solid ${
                        tab.badgeColor === 'pink' ? 'rgba(255,0,255,0.4)' : 'rgba(0,255,255,0.35)'
                      }`,
                      animation: tab.badge === 'LIVE' ? 'pulse 1.5s infinite' : 'none',
                    }}>
                    {tab.badge}
                  </span>
                )}
                {isActive && <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: 'var(--neon-pink)', boxShadow: '0 0 6px var(--neon-pink)', marginBottom: '-1px' }} />}
              </button>
            );
          })}
        </div>
      </div>

    </div>
  );
}
