import React from 'react';

export type TabId = 'servers' | 'glossary' | 'characters' | 'mods' | 'store' | 'community';

interface Tab { id: TabId; label: string; icon: string; badge?: string; badgeColor?: string; }

const TABS: Tab[] = [
  { id: 'servers',    label: 'SERVER INTEL',    icon: '📡', badge: 'LIVE', badgeColor: 'bg-red-500' },
  { id: 'glossary',   label: 'LEONIDA FILES',   icon: '📋' },
  { id: 'characters', label: 'IDENTITY FORGE',  icon: '🪪', badge: 'HOT', badgeColor: 'bg-neonPink/30' },
  { id: 'mods',       label: 'MOD VAULT',       icon: '🔩' },
  { id: 'store',      label: 'STORE DISTRICT',  icon: '🏪', badge: 'NEW', badgeColor: 'bg-neonCyan/20' },
  { id: 'community',   label: 'COMMUNITY BOARD', icon: '🎯', badge: 'HOT', badgeColor: 'bg-red-500/70' },
];

interface Props { activeTab: TabId; onTabChange: (t: TabId) => void; }

export default function TabNavigation({ activeTab, onTabChange }: Props) {
  return (
    <div className="sticky top-0 z-50 bg-darkerBg/95 backdrop-blur-md border-b border-white/[0.06]">
      <div className="gradient-line" />
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center gap-2 px-5 py-4
                font-orbitron font-bold text-[10px] tracking-widest whitespace-nowrap
                transition-all duration-200
                ${activeTab === tab.id ? 'tab-active' : 'tab-inactive'}
              `}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`
                  text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider
                  ${tab.badge === 'LIVE'
                    ? 'bg-red-500/80 text-white animate-pulse'
                    : tab.badge === 'NEW'
                    ? 'bg-neonCyan/20 text-neonCyan border border-neonCyan/40'
                    : 'bg-neonPink/20 text-neonPink border border-neonPink/40'}
                `}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
