import React, { useRef, useEffect, useState, useCallback } from 'react';

export type TabId = 'servers' | 'glossary' | 'characters' | 'mods' | 'store';

interface Tab { id: TabId; label: string; emoji: string; badge?: string; badgeColor?: string; description: string; }

const TABS: Tab[] = [
  { id: 'servers',    label: 'SERVER INTEL',   emoji: '🖥️',  badge: 'LIVE', description: 'Active RP servers',    badgeColor: 'red' },
  { id: 'glossary',  label: 'LEONIDA FILES',  emoji: '📁',  description: 'Lore & terminology' },
  { id: 'characters',label: 'IDENTITY FORGE', emoji: '🧬',  badge: 'HOT',  description: 'Build your character', badgeColor: 'pink' },
  { id: 'mods',      label: 'MOD VAULT',      emoji: '🔧',  description: 'Mods & scripts' },
  { id: 'store',     label: 'STORE DISTRICT', emoji: '🏪',  badge: 'NEW',  description: 'Apply for a store slot', badgeColor: 'cyan' },
];

interface Props { activeTab: TabId; onTabChange: (t: TabId) => void; }

export default function TabNavigation({ activeTab, onTabChange }: Props) {
  const scrollRef       = useRef<HTMLDivElement>(null);
  const autoRef         = useRef<ReturnType<typeof setInterval> | null>(null);
  const [paused, setPaused]   = useState(false);
  const [current, setCurrent] = useState(() => TABS.findIndex(t => t.id === activeTab));

  // Scroll active tab into view
  const scrollToTab = useCallback((idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const btn = el.children[idx] as HTMLElement;
    if (!btn) return;
    btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, []);

  // Autoplay every 6s — cycles through tabs visually (no onTabChange — just scroll highlight)
  const startAuto = useCallback(() => {
    if (autoRef.current) clearInterval(autoRef.current);
    autoRef.current = setInterval(() => {
      setCurrent(prev => {
        const next = (prev + 1) % TABS.length;
        scrollToTab(next);
        return next;
      });
    }, 6000);
  }, [scrollToTab]);

  useEffect(() => {
    if (!paused) startAuto();
    return () => { if (autoRef.current) clearInterval(autoRef.current); };
  }, [paused, startAuto]);

  // Sync current with activeTab
  useEffect(() => {
    const idx = TABS.findIndex(t => t.id === activeTab);
    setCurrent(idx);
    scrollToTab(idx);
  }, [activeTab, scrollToTab]);

  const handleClick = (tab: Tab, idx: number) => {
    setCurrent(idx);
    onTabChange(tab.id);
    setPaused(true);
    // Resume autoplay after 12s of inactivity
    setTimeout(() => setPaused(false), 12000);
  };

  return (
    <div className="sticky top-0 z-50 bg-darkerBg/95 backdrop-blur-md border-b border-white/[0.06]">
      <div className="gradient-line" />

      {/* Mobile label — shows current tab description */}
      <div className="md:hidden px-4 pt-2 pb-1 flex items-center justify-between">
        <span className="font-orbitron text-[9px] text-gray-500 uppercase tracking-widest">Navigation</span>
        <span className="font-orbitron text-[9px] text-neonCyan uppercase tracking-widest">
          {TABS[current]?.description}
        </span>
      </div>

      {/* Tab row */}
      <div className="max-w-7xl mx-auto px-2 sm:px-4">

        {/* Outer wrapper — relative for arrows */}
        <div className="relative">

          {/* Scrollable tabs */}
          <div
            ref={scrollRef}
            className="flex overflow-x-auto gap-1 py-1"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {TABS.map((tab, idx) => {
              const isActive    = activeTab === tab.id;
              const isHighlight = current === idx;

              return (
                <button
                  key={tab.id}
                  onClick={() => handleClick(tab, idx)}
                  className={`
                    relative flex-shrink-0 flex flex-col sm:flex-row items-center gap-1 sm:gap-2
                    px-3 sm:px-5 py-3 sm:py-4 rounded-t
                    font-orbitron font-bold text-[9px] sm:text-[10px] tracking-widest whitespace-nowrap
                    transition-all duration-300 min-w-[72px] sm:min-w-0
                    ${isActive
                      ? 'text-neonCyan border-b-2 border-neonCyan bg-neonCyan/5 shadow-[0_0_15px_rgba(0,229,255,0.1)]'
                      : isHighlight && !isActive
                        ? 'text-neonOrange border-b-2 border-neonOrange/60 bg-neonOrange/5'
                        : 'text-gray-500 border-b-2 border-transparent hover:text-gray-300 hover:border-white/20'
                    }
                  `}
                >
                  {/* Icon */}
                  <span className="text-base sm:text-sm leading-none">{tab.emoji}</span>

                  {/* Label */}
                  <span className="leading-tight text-center sm:text-left">{tab.label}</span>

                  {/* Badge */}
                  {tab.badge && (
                    <span className={`
                      text-[7px] sm:text-[8px] px-1 sm:px-1.5 py-0.5 rounded font-black tracking-wider leading-none
                      ${tab.badge === 'LIVE'
                        ? 'bg-red-500/80 text-white animate-pulse'
                        : tab.badge === 'NEW'
                          ? 'bg-neonCyan/20 text-neonCyan border border-neonCyan/40'
                          : 'bg-neonPink/20 text-neonPink border border-neonPink/40'}
                    `}>{tab.badge}</span>
                  )}

                  {/* Autoplay indicator dot */}
                  {isHighlight && !isActive && !paused && (
                    <span className="absolute top-1 right-1 w-1 h-1 rounded-full bg-neonOrange animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Progress bar — autoplay indicator */}
          {!paused && (
            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/5 overflow-hidden">
              <div
                key={current}
                className="h-full bg-gradient-to-r from-neonCyan/40 to-neonOrange/40"
                style={{ animation: 'tabProgress 6s linear forwards' }}
              />
            </div>
          )}
        </div>

        {/* Dot indicators — mobile */}
        <div className="flex justify-center gap-2 py-2 md:hidden">
          {TABS.map((tab, idx) => (
            <button
              key={tab.id}
              onClick={() => handleClick(tab, idx)}
              className={`rounded-full transition-all duration-300 ${
                activeTab === tab.id
                  ? 'w-6 h-1.5 bg-neonCyan'
                  : current === idx
                    ? 'w-3 h-1.5 bg-neonOrange/60'
                    : 'w-1.5 h-1.5 bg-white/20'
              }`}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes tabProgress {
          from { width: 0%; }
          to   { width: 100%; }
        }
      `}</style>
    </div>
  );
}
