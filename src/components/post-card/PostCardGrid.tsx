import React from 'react';
import { MessageSquare, Pin } from 'lucide-react';
import LinkedText from '../LinkedText';
import { isVideoMedia } from '../../lib/media';
import { scorePrefix, voteTone } from '../../lib/postCard';
import { timeAgo } from '../../lib/timeAgo';
import type { FeedPost } from '../PostCard';

function GridMedia({ post }: { post: FeedPost & { media_url: string } }) {
  return (
    <div className="h-28 flex-shrink-0 overflow-hidden bg-black/30">
      {isVideoMedia(post.media_url, post.media_type) ? (
        <video src={post.media_url} className="w-full h-full object-cover" onClick={(e) => e.stopPropagation()} />
      ) : (
        <img src={post.media_url} alt={post.title} className="w-full h-full object-cover" loading="lazy" />
      )}
    </div>
  );
}

interface Props {
  post: FeedPost;
  onOpenPost: (id: number) => void;
  /** The ⋮ menu, already built (or null when the viewer is not the author). */
  ownerMenu: React.ReactNode;
}

/** Compact fixed-height card for the 3-column grid. */
export function PostCardGrid({ post, onOpenPost, ownerMenu }: Props) {
  return (
    <div
      onClick={() => onOpenPost(post.id)}
      className="glass-card border-white/5 hover:border-neonCyan/40 transition-all shadow-xl overflow-hidden relative cursor-pointer flex flex-col h-[280px]"
    >
      {post.media_url ? <GridMedia post={post as FeedPost & { media_url: string }} /> : null}

      <div className="flex-grow p-3 flex flex-col min-h-0">
        <div className="flex items-center gap-1.5 mb-1 text-[9px] text-gray-500 font-bold uppercase tracking-wider">
          {post.is_pinned && <Pin size={10} className="text-neonOrange flex-shrink-0" />}
          {post.subhub_title && <span className="text-neonCyan truncate">r/{post.subhub_slug}</span>}
          <span className="flex-shrink-0">•</span>
          <span className="truncate">{timeAgo(post.created_at)}</span>
        </div>

        <h3 className="font-orbitron font-bold text-sm text-white leading-snug mb-1 line-clamp-2">
          {post.title}
        </h3>

        {post.body && !post.media_url && (
          <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">
            <LinkedText text={post.body} showPreview={false} />
          </p>
        )}

        <div className="flex items-center justify-between mt-auto pt-2 text-[10px] text-gray-500 font-bold">
          <span className="flex items-center gap-1">
            <MessageSquare size={12} />
            {post.comments_count}
          </span>
          <span className={voteTone(post.user_vote)}>
            {scorePrefix(post.score)}{post.score}
          </span>
        </div>
      </div>

      {ownerMenu}
    </div>
  );
}
