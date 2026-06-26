import React, { useState, useEffect } from 'react';
import { supa } from '../lib/SupabaseClient';
import { Search, Radio, Calendar, ExternalLink, AlertCircle, Star, Pin, ShieldCheck, Flame, HelpCircle, Users } from 'lucide-react';

interface NewsArticle {
  id: number;
  created_at: string;
  type: string;
  title: string;
  body: string;
  meta?: any;
  author_id?: string;
  author_name: string;
  summary?: string;
  category?: string;
  source_url?: string;
  is_published?: boolean;
  is_featured?: boolean;
  sort_order?: number;
}

const DEFAULT_NEWS: NewsArticle[] = [
  {
    id: 9901,
    created_at: '2026-05-18T10:00:00Z',
    type: 'news',
    title: 'Rockstar Games Confirms November 2026 Release Pipeline',
    body: 'Take-Two Interactive officially reiterated during their latest earnings conference call that Grand Theft Auto VI is strictly on schedule for a Fall 2026 release, specifically targeted for November 2026. The publisher expressed absolute confidence in Rockstar Games delivering an industry-defining experience.',
    author_name: 'VCH Syndicate',
    category: 'Official',
    source_url: 'https://ir.take2games.com',
    is_featured: true,
    meta: { stars: 5 }
  },
  {
    id: 9902,
    created_at: '2026-05-15T14:30:00Z',
    type: 'news',
    title: 'Speculative Map Analysis Highlights Massive Port Gellhorn Area',
    body: 'Stitched satellite topology and 2022 raw development leak coordinates indicate that Port Gellhorn is not merely a small side-town but a sprawling industrial hub. Located on the western edge of Leonida, the area boasts deep sea shipping container yards, illegal racing strips, and a fully modeled petrochemical refinery.',
    author_name: 'Mapping_Dev',
    category: 'Leaks',
    source_url: 'https://map.stateofleonida.net',
    is_featured: false,
    meta: { stars: 4 }
  },
  {
    id: 9903,
    created_at: '2026-05-10T08:15:00Z',
    type: 'news',
    title: 'RUMOR: Dynamic Weather Engine to Feature Categorized Hurricanes',
    body: 'Rumors originating from corporate recruiting pipelines and RAGE engine patent filings hint at a highly advanced climate simulator. Players will allegedly experience tropical storms, rapid coastal erosion, and high-intensity hurricanes requiring tactical evacuation or offering high-yield smuggling runs in high seas.',
    author_name: 'LeonidaTruth',
    category: 'Rumors',
    source_url: 'https://x.com/vicecity_hub',
    is_featured: true,
    meta: { stars: 3 }
  },
  {
    id: 9904,
    created_at: '2026-05-04T19:00:00Z',
    type: 'news',
    title: 'Rockstar Employs Patent for Revolutionary NPC Memory Systems',
    body: 'An officially registered Take-Two patent details a system where NPCs remember player actions, facial descriptions, and vehicle models over prolonged gameplay periods. If Lucia robs a convenience store in Homestead, local shopkeepers and police patrols will remain alert, adapting their dialogue and security postures.',
    author_name: 'Lore_Master',
    category: 'Official',
    source_url: 'https://www.uspto.gov',
    is_featured: false,
    meta: { stars: 4 }
  },
  {
    id: 9905,
    created_at: '2026-04-28T12:00:00Z',
    type: 'news',
    title: 'Florida Keys (Vice Keys) Highway Stretches Over 15 Traversed Miles',
    body: 'Lore enthusiasts analyzing coordinate telemetry confirm that the simulated Overseas Highway connecting mainland Leonida to the southernmost Vice Keys will be a high-speed playground. The bridge features dynamic drawbridges, derelict resort hotels, and offshore coral reefs ripe for deep-sea salvage operations.',
    author_name: 'KeyWestLover',
    category: 'Leaks',
    source_url: 'https://map.stateofleonida.net',
    is_featured: false,
    meta: { stars: 2 }
  }
];

export default function News() {
  const [dbNews, setDbNews] = useState<NewsArticle[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const toggleExpanded = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Fetch news from Supabase
  const fetchNews = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supa
        .from('news')
        .select('*')
        .or('is_published.is.null,is_published.eq.true')
        .order('is_featured', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDbNews(data || []);
    } catch (err) {
      console.error('Error fetching news:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNews();
  }, []);

  // Sourced news purely from the database query
  const allNewsRaw = dbNews;

  // Filter out duplicates if a news item has the same ID
  const seenIds = new Set();
  const allNews = allNewsRaw.filter(item => {
    if (seenIds.has(item.id)) {
      return false;
    }
    seenIds.add(item.id);
    return true;
  });

  // Extract display details from a news item using the real Supabase schema:
  // category (top-level column) -> filter tag / status badge
  // source_url (top-level column) -> link to original source
  // is_featured (top-level column) -> pin to top of the feed
  // meta.stars (optional JSON field) -> 1-5 importance rating
  const getMeta = (item: NewsArticle) => {
    const tag = item.category && item.category.trim() ? item.category : 'Community';
    const srcUrl = item.source_url || '';
    const important = !!item.is_featured;
    let stars = 0;

    if (item.meta) {
      try {
        const parsed = typeof item.meta === 'string' ? JSON.parse(item.meta) : item.meta;
        if (parsed.stars) stars = Number(parsed.stars) || 0;
        if (parsed.importance) stars = Number(parsed.importance) || stars;
      } catch (e) {}
    }

    return { tag, srcUrl, stars, important };
  };

  // Apply filters
  const filteredNews = allNews.filter(item => {
    const { tag } = getMeta(item);

    const matchesTag = selectedTag === 'All' || tag.toLowerCase() === selectedTag.toLowerCase();
    
    const titleLower = (item.title || '').toLowerCase();
    const bodyLower = (item.body || '').toLowerCase();
    const summaryLower = (item.summary || '').toLowerCase();
    const authorLower = (item.author_name || '').toLowerCase();
    const queryLower = searchQuery.toLowerCase();

    const matchesSearch =
      titleLower.includes(queryLower) ||
      bodyLower.includes(queryLower) ||
      summaryLower.includes(queryLower) ||
      authorLower.includes(queryLower);

    return matchesTag && matchesSearch;
  });

  // Pin featured news to the top, preserving recency order within each group
  const sortedNews = [...filteredNews].sort((a, b) => {
    const aImportant = getMeta(a).important;
    const bImportant = getMeta(b).important;
    if (aImportant && !bImportant) return -1;
    if (!aImportant && bImportant) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const getTagStyle = (tag: string) => {
    switch (tag.toLowerCase()) {
      case 'official':
        return 'border-green-500/30 text-green-400 bg-green-500/5 neon-text-green';
      case 'leaks':
        return 'border-neonPink/30 text-neonPink bg-neonPink/5 neon-text-pink';
      case 'rumors':
        return 'border-neonOrange/30 text-neonOrange bg-neonOrange/5';
      default:
        return 'border-neonCyan/30 text-neonCyan bg-neonCyan/5 neon-text-cyan';
    }
  };

  // Status icon shown alongside the tag badge
  const getTagIcon = (tag: string) => {
    switch (tag.toLowerCase()) {
      case 'official':
        return <ShieldCheck size={11} />;
      case 'leaks':
        return <Flame size={11} />;
      case 'rumors':
        return <HelpCircle size={11} />;
      default:
        return <Users size={11} />;
    }
  };

  // Derive a short, readable source label from the source_url column
  const getSourceLabel = (url: string) => {
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      return host.toUpperCase();
    } catch (e) {
      return 'SOURCE';
    }
  };

  return (
    <div className="w-full">
      {/* HEADER BANNER */}
      <header className="min-h-[40vh] flex flex-col items-center justify-center text-center px-6 relative overflow-hidden bg-radial-hero py-16">
        <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_80%_50%_at_50%_85%,rgba(255,0,255,0.08)_0%,transparent_60%)]" />
        
        <div className="relative z-10 flex flex-col items-center max-w-4xl">
          <div className="font-orbitron text-[10px] sm:text-xs font-bold tracking-[0.3em] text-neonPink uppercase border border-neonPink/40 px-6 py-2.5 rounded-full bg-neonPink/5 shadow-[0_0_15px_rgba(255,0,255,0.15)] mb-6 animate-pulse">
            DISPATCH STATION &mdash; REAL-TIME INTEL
          </div>

          <h1 className="font-orbitron font-black text-5xl sm:text-7xl uppercase tracking-tighter bg-gradient-to-br from-white via-neonPink to-neonCyan bg-clip-text text-transparent filter drop-shadow-2xl">
            THE WIRE
          </h1>

          <p className="text-xs sm:text-sm text-gray-400 font-bold max-w-lg mx-auto mt-4 leading-relaxed font-rajdhani uppercase tracking-widest">
            Unfiltered database feed of official releases, telemetry leaks, community analysis, and syndication notes.
          </p>
        </div>
      </header>

      <div className="gradient-line" />

      {/* SEARCH AND FILTER BAR */}
      <section className="py-8 px-6 max-w-[1280px] mx-auto z-10 relative">
        <div className="glass-card p-6 border-white/5 flex flex-col md:flex-row gap-6 justify-between items-center shadow-2xl">
          {/* Tag Selectors */}
          <div className="flex flex-wrap gap-2.5 font-orbitron text-xs font-bold uppercase tracking-wider w-full md:w-auto">
            {['All', 'Official', 'Leaks', 'Rumors', 'Community'].map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
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
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#050508]/80 border border-white/10 focus:border-neonCyan outline-none rounded-lg px-4 py-3 pl-11 text-sm text-white transition-all font-rajdhani font-bold placeholder-gray-500"
              placeholder="Search wire records..."
            />
            <Search className="absolute left-4 top-3.5 text-gray-500" size={16} />
          </div>
        </div>
      </section>

      {/* LIVE NEWS FEED */}
      <section className="pb-24 px-6 max-w-[1280px] mx-auto z-10 relative">
        {sortedNews.length === 0 ? (
          <div className="glass-card p-16 text-center border border-white/5 max-w-2xl mx-auto mt-8">
            <AlertCircle size={40} className="text-neonPink mx-auto mb-4 animate-bounce" />
            <div className="text-white font-orbitron font-extrabold text-lg uppercase tracking-wider">No Records Matches</div>
            <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-2 max-w-sm mx-auto leading-relaxed">
              No matching intelligence dispatches found inside the decrypted database logs. Try modifying your filter tabs.
            </p>
          </div>
        ) : (
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
              {sortedNews.map(item => {
                const { tag, srcUrl, stars, important } = getMeta(item);
                const isExpanded = expandedIds.has(item.id);
                const previewText = item.summary && item.summary.trim() ? item.summary : item.body;

                return (
                  <div
                    key={item.id}
                    onClick={() => toggleExpanded(item.id)}
                    className={`snap-start [scroll-snap-stop:always] glass-card border transition-all duration-300 flex flex-col justify-between shadow-2xl group min-h-[375px] md:min-h-[380px] p-6 relative overflow-hidden cursor-pointer ${
                      important
                        ? 'border-neonOrange/50 hover:border-neonOrange shadow-[0_0_25px_rgba(255,136,0,0.12)]'
                        : 'border-white/5 hover:border-neonCyan'
                    }`}
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-neonCyan/5 rounded-bl-full pointer-events-none group-hover:bg-neonCyan/10 transition-colors" />

                    {/* Featured / Pinned Ribbon */}
                    {important && (
                      <div className="absolute top-0 left-0 bg-neonOrange text-black text-[9px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-br-lg flex items-center gap-1.5 font-orbitron shadow-lg z-10">
                        <Pin size={10} /> Featured
                      </div>
                    )}

                    <div className={important ? 'mt-5' : ''}>
                      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
                        <span className={`border text-[9px] font-extrabold tracking-widest px-2.5 py-1 uppercase rounded font-orbitron flex items-center gap-1.5 ${getTagStyle(tag)}`}>
                          {getTagIcon(tag)}
                          {tag}
                        </span>

                        <div className="flex items-center gap-3">
                          {/* Importance Stars */}
                          {stars > 0 && (
                            <span className="flex items-center gap-0.5" title={`Importance: ${stars}/5`}>
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  size={11}
                                  className={i < stars ? 'text-neonOrange fill-neonOrange' : 'text-gray-700'}
                                />
                              ))}
                            </span>
                          )}
                          <span className="text-[10px] text-gray-500 font-extrabold tracking-wider uppercase font-orbitron flex items-center gap-1.5">
                            <Calendar size={11} />
                            {new Date(item.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <h3 className="font-orbitron font-bold text-lg text-white tracking-wide leading-snug group-hover:text-neonCyan transition-colors mb-3">
                        {item.title}
                      </h3>

                      <p className={`text-sm text-gray-300 leading-loose font-bold font-rajdhani mb-4 ${isExpanded ? 'line-clamp-none' : 'line-clamp-4 md:line-clamp-6'}`}>
                        {isExpanded ? item.body : previewText}
                      </p>

                      {/* Read More / Collapse toggle */}
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleExpanded(item.id); }}
                        className="text-[10px] font-extrabold uppercase tracking-widest font-orbitron text-neonCyan hover:text-white transition-colors mb-4"
                      >
                        {isExpanded ? 'Collapse ▲' : 'Read More ▼'}
                      </button>
                    </div>

                    <div className="border-t border-white/5 pt-4 mt-auto flex items-center justify-between text-[10px] font-bold uppercase tracking-widest font-orbitron flex-wrap gap-2">
                      <div className="text-gray-500">
                        Operator: <span className="text-neonCyan">{item.author_name}</span>
                      </div>
                      {srcUrl && (
                        <a
                          href={srcUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-neonPink hover:underline flex items-center gap-1 hover:neon-text-pink"
                        >
                          {getSourceLabel(srcUrl)} <ExternalLink size={10} />
                        </a>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        )}

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
