import React from 'react';
import { Search } from 'lucide-react';
import { NEWS_TAGS } from '../../lib/news';

interface Props {
  selectedTag: string;
  onSelectTag: (tag: string) => void;
  searchQuery: string;
  onSearch: (query: string) => void;
}

/** Tag tabs and the search box. */
export function NewsFilters({ selectedTag, onSelectTag, searchQuery, onSearch }: Props) {
  return (
  <div className="glass-card p-6 border-white/5 flex flex-col md:flex-row gap-6 justify-between items-center shadow-2xl">
    {/* Tag Selectors */}
    <div className="flex flex-wrap gap-2.5 font-orbitron text-xs font-bold uppercase tracking-wider w-full md:w-auto">
      {NEWS_TAGS.map(tag => (
        <button
          key={tag}
          onClick={() => onSelectTag(tag)}
          className={`px-5 py-2.5 rounded border transition-all ${
            selectedTag === tag
              ? 'border-neonCyan text-neonCyan bg-neonCyan/10 shadow-[0_0_15px_rgba(0,255,255,0.25)] neon-text-cyan'
              : 'border-white/10 text-gray-400 hover:border-white/20 hover:text-white'
          }`}
        >
          {tag}
        </button>
      ))}
    </div>

    {/* Search bar */}
    <div className="relative w-full md:w-[350px]">
      <input
        type="text"
        value={searchQuery}
        onChange={e => onSearch(e.target.value)}
        className="w-full bg-[#050508]/80 border border-white/10 focus:border-neonCyan outline-none rounded-lg px-4 py-3 pl-11 text-sm text-white transition-all font-rajdhani font-bold placeholder-gray-500"
        placeholder="Search wire records..."
      />
      <Search className="absolute left-4 top-3.5 text-gray-500" size={16} />
    </div>
  </div>
  );
}
