import React, { useState } from 'react';
import { Play } from 'lucide-react';

interface YouTubePlayerProps {
  videoId: string;
  title?: string;
  className?: string;
}

/**
 * Shows a YouTube thumbnail; clicking the play button replaces it with an
 * embedded <iframe> that auto-plays the video inline — no redirect to
 * youtube.com. Same mechanism used in LinkedText for URL previews and in
 * the Community feed for video link posts.
 */
export default function YouTubePlayer({ videoId, title, className = '' }: YouTubePlayerProps) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className={`relative w-full aspect-video bg-black ${className}`}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          title={title || 'YouTube video player'}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setPlaying(true);
      }}
      className={`relative w-full aspect-video bg-black overflow-hidden group ${className}`}
    >
      <img
        src={`https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`}
        alt={title || 'YouTube video thumbnail'}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        loading="lazy"
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
        <div className="bg-black/70 rounded-full p-4 border border-white/20 group-hover:scale-110 group-hover:border-neonCyan transition-all">
          <Play size={24} className="text-white" fill="currentColor" />
        </div>
      </div>
    </button>
  );
}
