import React from 'react';
import { Pin } from 'lucide-react';
import { timeAgo } from '../../lib/timeAgo';
import type { FullPost } from './usePostData';

interface Props {
  post: FullPost;
  authorName: string;
  authorAvatar: string | null;
  subhubSlug: string | null;
}

/** "pin · r/slug · avatar author · 3h ago" line above the post. */
export function PostMetaLine({ post, authorName, authorAvatar, subhubSlug }: Props) {
  return (
    <div className="flex items-center gap-2 mb-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
      {post.is_pinned && <Pin size={11} className="text-neonOrange" />}
      {subhubSlug && <span className="text-neonCyan">r/{subhubSlug}</span>}
      <span>•</span>
      {authorAvatar ? (
        <img src={authorAvatar} alt={authorName} className="w-7 h-7 rounded-full object-cover border border-white/10 flex-shrink-0" />
      ) : (
        <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
          <span className="text-[9px] font-bold text-gray-400">{authorName.slice(0,1).toUpperCase()}</span>
        </div>
      )}
      <span>{authorName}</span>
      <span>•</span>
      <span>{timeAgo(post.created_at)}</span>
    </div>
  );
}
