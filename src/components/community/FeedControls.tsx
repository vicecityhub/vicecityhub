import React from 'react';
import { Clock, Flame, TrendingUp } from 'lucide-react';
import type { SortMode, Subhub } from '../../lib/community';

const PILL_BASE = 'px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all';
const PILL_ON = 'bg-neonCyan/10 text-neonCyan border-neonCyan/40';
const PILL_OFF = 'text-gray-400 border-white/10 hover:border-white/30';

/** "All" plus one pill per sub-hub. */
export function SubhubFilter({ subhubs, active, onSelect }: { subhubs: Subhub[]; active: string | null; onSelect: (slug: string | null) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      <button onClick={() => onSelect(null)} className={`${PILL_BASE} ${active === null ? PILL_ON : PILL_OFF}`}>
        All
      </button>
      {subhubs.map((s) => (
        <button key={s.id} onClick={() => onSelect(s.slug)} className={`${PILL_BASE} ${active === s.slug ? PILL_ON : PILL_OFF}`}>
          {s.icon} r/{s.slug}
        </button>
      ))}
    </div>
  );
}

const SORT_TABS: [SortMode, string, React.ReactNode][] = [
  ['hot', 'Hot', <Flame size={13} key="i" />],
  ['new', 'New', <Clock size={13} key="i" />],
  ['top', 'Top', <TrendingUp size={13} key="i" />],
];

/** Hot / New / Top. */
export function SortTabs({ mode, onChange }: { mode: SortMode; onChange: (mode: SortMode) => void }) {
  return (
    <div className="flex gap-2 mb-6 border-b border-white/5 pb-4">
      {SORT_TABS.map(([value, label, icon]) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${
            mode === value ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          {icon}
          {label}
        </button>
      ))}
    </div>
  );
}
