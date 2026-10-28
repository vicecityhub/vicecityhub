import React from 'react';
import { Calendar, ExternalLink, Flame, HelpCircle, Pin, ShieldCheck, Star, Users } from 'lucide-react';
import { getNewsMeta, getSourceLabel, getTagStyle, previewOf, tagKind } from '../../lib/news';
import type { NewsArticle } from '../../lib/news';

/** Status icon shown alongside the tag badge. */
function TagIcon({ tag }: { tag: string }) {
  switch (tagKind(tag)) {
    case 'official': return <ShieldCheck size={11} />;
    case 'leaks': return <Flame size={11} />;
    case 'rumors': return <HelpCircle size={11} />;
    default: return <Users size={11} />;
  }
}

interface Props {
  item: NewsArticle;
  isExpanded: boolean;
  onToggle: (id: number) => void;
}

/** One dispatch: tag, stars, date, title, gallery, text (collapsed preview or full body) and source link. */
export function NewsCard({ item, isExpanded, onToggle }: Props) {
  const { tag, srcUrl, stars, important, images } = getNewsMeta(item);
  const previewText = previewOf(item);

  return (
      <div
        key={item.id}
        onClick={() => onToggle(item.id)}
        className={`snap-start [scroll-snap-stop:always] glass-card border transition-all duration-300 flex flex-col shadow-2xl group p-5 relative cursor-pointer ${isExpanded ? "min-h-0 overflow-visible" : "min-h-[250px] md:min-h-[260px] overflow-hidden justify-between"} ${
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
              <TagIcon tag={tag} />
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

          {images.length > 0 && (
            <div
              className={`grid gap-1.5 mb-4 rounded-lg overflow-hidden ${images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}
              onClick={(e) => e.stopPropagation()}
            >
              {(isExpanded ? images : images.slice(0, 3)).map((src, i) => (
                <a
                  key={i}
                  href={src}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block overflow-hidden bg-black/40 border border-white/5 hover:border-neonCyan/50 transition-colors"
                  style={{ aspectRatio: '1 / 1' }}
                >
                  <img src={src} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" loading="lazy" />
                </a>
              ))}
            </div>
          )}

          <p
            className={`text-sm text-gray-300 leading-loose font-bold font-rajdhani mb-4 ${isExpanded ? '' : 'line-clamp-4 md:line-clamp-6'}`}
            style={isExpanded ? { maxHeight: '38vh', overflowY: 'auto', touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' as any, paddingRight: '4px' } : {}}
            onTouchStart={isExpanded ? (e) => e.stopPropagation() : undefined}
            onTouchMove={isExpanded ? (e) => e.stopPropagation() : undefined}
            onClick={(e) => e.stopPropagation()}
          >
            {isExpanded ? item.body : previewText}
          </p>

          {/* Read More / Collapse toggle */}
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(item.id); }}
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
}
