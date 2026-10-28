import React from 'react';
import { AlertCircle } from 'lucide-react';
import type { NewsArticle } from '../../lib/news';
import { NewsCard } from './NewsCard';

interface Props {
  items: NewsArticle[];
  expandedIds: Set<number>;
  onToggle: (id: number) => void;
}

/** The scrolling card grid, or the "nothing matches" panel. */
export function NewsFeed({ items, expandedIds, onToggle }: Props) {
  if (items.length === 0) {
    return (
      <div className="glass-card p-16 text-center border border-white/5 max-w-2xl mx-auto mt-8">
        <AlertCircle size={40} className="text-neonPink mx-auto mb-4 animate-bounce" />
        <div className="text-white font-orbitron font-extrabold text-lg uppercase tracking-wider">No Records Matches</div>
        <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-2 max-w-sm mx-auto leading-relaxed">
          No matching intelligence dispatches found inside the decrypted database logs. Try modifying your filter tabs.
        </p>
      </div>
    );
  }

  return (
    <div
      className="snap-y snap-mandatory scroll-smooth custom-scrollbar"
      style={{
        maxHeight: '800px',
        overflowY: 'auto',
        overflowX: 'visible',
        paddingTop: '12px',
        paddingBottom: '8px',
        paddingRight: '8px',
        scrollPaddingTop: '12px',
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start" style={{ paddingTop: '4px' }}>
        {items.map(item => (
          <NewsCard key={item.id} item={item} isExpanded={expandedIds.has(item.id)} onToggle={onToggle} />
        ))}
      </div>
    </div>
  );
}
