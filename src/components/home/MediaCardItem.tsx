import React from 'react';
import { ExternalLink, Pencil, Play, Trash2 } from 'lucide-react';
import YouTubePlayer from '../YouTubePlayer';
import type { MediaCard } from '../../lib/homeLogic';

const CARD_CLASS = 'snap-start [scroll-snap-stop:always] flex-shrink-0 w-[calc(100vw-48px)] sm:w-[360px] glass-card overflow-hidden group flex flex-col justify-between relative';

function CardText({ card }: { card: MediaCard }) {
  return (
    <div>
      <h3 className="font-bold font-orbitron text-base text-white tracking-wide">{card.title}</h3>
      {card.description && (
        <p className="text-xs text-gray-400 mt-1 leading-relaxed line-clamp-3">{card.description}</p>
      )}
    </div>
  );
}

function OwnerControls({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="absolute top-2 right-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button onClick={onEdit} className="bg-black/70 text-gray-300 hover:text-neonCyan p-1.5 rounded transition-colors">
        <Pencil size={13} />
      </button>
      <button onClick={onDelete} className="bg-black/70 text-gray-300 hover:text-neonPink p-1.5 rounded transition-colors">
        <Trash2 size={13} />
      </button>
    </div>
  );
}

/** Streamer card: avatar (or initials), "Content Creator" badge and YouTube / Twitch buttons. */
function StreamerCard({ card }: { card: MediaCard }) {
  return (
    <>
      <div className="relative w-full aspect-video bg-gradient-to-br from-[#0a0a18] via-[#0d0d1f] to-[#1a0a2e] flex flex-col items-center justify-center gap-3 p-6">
        {card.thumbnail_url ? (
          <img
            src={card.thumbnail_url}
            alt={card.title}
            className="w-20 h-20 rounded-full object-cover border-2 border-neonCyan shadow-[0_0_20px_rgba(0,255,255,0.3)]"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-neonCyan/20 to-neonPink/20 border-2 border-neonCyan/40 flex items-center justify-center">
            <span className="font-orbitron font-bold text-xl text-neonCyan">
              {card.title.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-neonCyan animate-pulse" />
          <span className="text-[10px] text-neonCyan font-bold uppercase tracking-widest font-orbitron">Content Creator</span>
        </div>
      </div>
      <div className="p-4 flex-grow flex flex-col justify-between gap-3">
        <CardText card={card} />
        {/* Two full-width buttons: YouTube + Twitch */}
        <div className="flex flex-col gap-2 mt-auto">
          {card.external_url && (
            <a
              href={card.external_url}
              target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="w-full text-center border border-neonCyan/30 text-neonCyan text-[10px] uppercase font-bold tracking-wider px-3 py-2 rounded hover:bg-neonCyan hover:text-black transition-all flex items-center justify-center gap-1.5"
            >
              <ExternalLink size={11} /> YouTube ↗
            </a>
          )}
          {card.twitch_url && (
            <a
              href={card.twitch_url}
              target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="w-full text-center border border-[#9146FF]/30 text-[#9146FF] text-[10px] uppercase font-bold tracking-wider px-3 py-2 rounded hover:bg-[#9146FF] hover:text-white transition-all flex items-center justify-center gap-1.5"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
              Twitch ↗
            </a>
          )}
        </div>
      </div>
    </>
  );
}

/** Standard card for trailers, podcasts and reels: YouTube player, thumbnail or placeholder. */
function StandardCard({ card }: { card: MediaCard }) {
  return (
    <>
      {card.youtube_id ? (
        <YouTubePlayer videoId={card.youtube_id} title={card.title} />
      ) : card.thumbnail_url ? (
        <div className="aspect-video w-full overflow-hidden bg-black/30">
          <img src={card.thumbnail_url} alt={card.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        </div>
      ) : (
        <div className="aspect-video w-full bg-gradient-to-tr from-[#0a0a18] to-[#1a0a2e] flex items-center justify-center">
          <Play size={40} className="text-neonCyan opacity-40" />
        </div>
      )}
      <div className="p-4 flex-grow flex flex-col justify-between gap-3">
        <CardText card={card} />
        {card.external_url && (
          <a
            href={card.external_url}
            target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="w-full text-center border border-neonCyan/30 text-neonCyan text-[10px] uppercase font-bold tracking-wider px-3 py-2 rounded hover:bg-neonCyan hover:text-black transition-all flex items-center justify-center gap-1.5 mt-auto"
          >
            <ExternalLink size={11} /> YouTube ↗
          </a>
        )}
      </div>
    </>
  );
}

interface MediaCardItemProps {
  card: MediaCard;
  /** The streamer layout applies to every card of the active tab. */
  isStreamerTab: boolean;
  isOwner: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function MediaCardItem({ card, isStreamerTab, isOwner, onEdit, onDelete }: MediaCardItemProps) {
  return (
    <div className={CARD_CLASS}>
      {/* Owner controls */}
      {isOwner && <OwnerControls onEdit={onEdit} onDelete={onDelete} />}
      {isStreamerTab ? <StreamerCard card={card} /> : (
        /* Standard card — trailers, podcasts, reels */
        <StandardCard card={card} />
      )}
    </div>
  );
}
