import React, { useState, useEffect, useRef } from 'react';

export type TabId = 'servers' | 'glossary' | 'characters' | 'mods' | 'store' | 'community';

interface Tab { id: TabId; label: string; badge?: string; badgeType?: 'live'|'hot'|'new'; }

const TABS: Tab[] = [
  { id: 'servers',    label: 'SERVER INTEL',    badge: 'LIVE', badgeType: 'live' },
  { id: 'glossary',   label: 'LEONIDA FILES' },
  { id: 'characters', label: 'IDENTITY FORGE',  badge: 'HOT', badgeType: 'hot' },
  { id: 'mods',       label: 'MOD VAULT' },
  { id: 'store',      label: 'STORE DISTRICT',  badge: 'NEW', badgeType: 'new' },
  { id: 'community',  label: 'COMMUNITY BOARD', badge: 'HOT', badgeType: 'hot' },
];

interface Props { activeTab: TabId; onTabChange: (t: TabId) => void; }

export default function TabNavigation({ activeTab, onTabChange }: Props) {
  const [glowIdx, setGlowIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cycle glow through inactive tabs every 1.5s — purely visual, no content switch
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setGlowIdx(i => (i + 1) % TABS.length);
    }, 1500);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  return (
    <div
      className="sticky top-0 z-50 border-b border-white/[0.07]"
      style={{ background: 'rgba(5,5,8,0.96)', backdropFilter: 'blur(16px)' }}
    >
      <div className="gradient-line" />
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TABS.map((tab, idx) => {
            const isActive = activeTab === tab.id;
            const isGlow   = !isActive && glowIdx === idx;

            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className="relative flex items-center gap-2 px-4 sm:px-5 py-4
                           font-orbitron font-bold text-[10px] tracking-widest
                           whitespace-nowrap transition-all duration-300 outline-none"
                style={{
                  color: isActive
                    ? 'var(--neon-pink)'
                    : isGlow
                    ? 'rgba(255,255,255,0.75)'
                    : 'rgba(255,255,255,0.35)',
                  borderBottom: isActive
                    ? '2px solid var(--neon-pink)'
                    : isGlow
                    ? '2px solid rgba(255,0,255,0.3)'
                    : '2px solid transparent',
                  background: isActive
                    ? 'rgba(255,0,255,0.07)'
                    : isGlow
                    ? 'rgba(255,0,255,0.03)'
                    : 'transparent',
                  textShadow: isActive
                    ? '0 0 12px rgba(255,0,255,0.9)'
                    : isGlow
                    ? '0 0 6px rgba(255,0,255,0.4)'
                    : 'none',
                }}
              >
                <span>{tab.label}</span>

                {tab.badge && (
                  <span
                    className="text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider"
                    style={
                      tab.badgeType === 'live'
                        ? { background: 'rgba(239,68,68,0.9)', color: '#fff', animation: 'pulse 1.5s infinite' }
                        : tab.badgeType === 'hot'
                        ? { background: 'rgba(255,0,255,0.2)', color: 'var(--neon-pink)', border: '1px solid rgba(255,0,255,0.4)' }
                        : { background: 'rgba(0,255,255,0.15)', color: 'var(--neon-cyan)', border: '1px solid rgba(0,255,255,0.35)' }
                    }
                  >
                    {tab.badge}
                  </span>
                )}

                {/* Active indicator dot */}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
                    style={{
                      background: 'var(--neon-pink)',
                      boxShadow: '0 0 8px var(--neon-pink)',
                      marginBottom: '-1px',
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Mobile dot indicators */}
        <div className="flex justify-center gap-1.5 py-1.5 sm:hidden">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="rounded-full transition-all duration-300"
              style={{
                width: activeTab === tab.id ? '18px' : '6px',
                height: '6px',
                background: activeTab === tab.id ? 'var(--neon-pink)' : 'rgba(255,255,255,0.2)',
                boxShadow: activeTab === tab.id ? '0 0 6px var(--neon-pink)' : 'none',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
