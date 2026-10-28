import React from 'react';
import { Radio } from 'lucide-react';
import { NewsFeed } from '../components/news/NewsFeed';
import { NewsFilters } from '../components/news/NewsFilters';
import { NewsHero } from '../components/news/NewsHero';
import { useNews } from '../components/news/useNews';

export default function News() {
  const { feed, selectedTag, setSelectedTag, searchQuery, setSearchQuery, expandedIds, toggleExpanded } = useNews();

  return (
    <div className="w-full">
      <NewsHero />

      <div className="gradient-line" />

      <section className="py-8 px-6 max-w-[1280px] mx-auto z-10 relative">
        <NewsFilters selectedTag={selectedTag} onSelectTag={setSelectedTag} searchQuery={searchQuery} onSearch={setSearchQuery} />
      </section>

      <section className="pb-24 px-6 max-w-[1280px] mx-auto z-10 relative">
        <NewsFeed items={feed} expandedIds={expandedIds} onToggle={toggleExpanded} />

        {/* Info notice */}
        <div className="mt-16 text-center max-w-lg mx-auto">
          <div className="inline-flex items-center gap-2 border border-white/5 px-6 py-3.5 rounded-full bg-[#050508]/60 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-gray-500 font-orbitron">
            <Radio size={14} className="text-neonPink animate-pulse" /> Want to publish leaks or analysis? Access your Dashboard.
          </div>
        </div>
      </section>
    </div>
  );
}
