import React, { useState } from 'react';
import { MessageSquare, Pin, MoreVertical, Trash2, Pencil } from 'lucide-react';
import VoteButtons from './VoteButtons';
import LinkedText, { LinkPreviewOnly } from './LinkedText';

export interface FeedPost {
  id: number;
  title: string;
  body: string | null;
  media_url: string | null;
  media_type?: 'image' | 'video' | null;
  link_url: string | null;
  score: number;
  comments_count: number;
  is_pinned: boolean;
  created_at: string;
  author_id: string;
  author_name?: string;
  author_avatar?: string | null;
  subhub_slug?: string;
  subhub_title?: string;
  user_vote?: 1 | -1 | 0;
}

interface PostCardProps {
  post: FeedPost;
  isLoggedIn: boolean;
  currentUserId?: string | null;
  onRequireAuth: () => void;
  onOpenPost: (id: number) => void;
  onEdit?: (post: FeedPost) => void;
  onDelete?: (id: number) => void;
  /** "list" = full-width row (used on post detail / single-column contexts).
   *  "grid" = compact card for the 3-column grid layout, fixed height. */
  variant?: 'list' | 'grid';
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function isVideoUrl(url: string | null, mediaType?: string | null): boolean {
  if (mediaType === 'video') return true;
  if (mediaType === 'image') return false;
  return !!url && /\.(mp4|webm|mov)$/i.test(url);
}

export default function PostCard({
  post,
  isLoggedIn,
  currentUserId,
  onRequireAuth,
  onOpenPost,
  onEdit,
  onDelete,
  variant = 'list',
}: PostCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const isOwner = isLoggedIn && currentUserId && currentUserId === post.author_id;
  const ownerMenu = isOwner && (onEdit || onDelete);

  if (variant === 'grid') {
    return (
      <div
        onClick={() => onOpenPost(post.id)}
        className="glass-card border-white/5 hover:border-neonCyan/40 transition-all shadow-xl overflow-hidden relative cursor-pointer flex flex-col h-[280px]"
      >
        {post.media_url ? (
          <div className="h-28 flex-shrink-0 overflow-hidden bg-black/30">
            {isVideoUrl(post.media_url, post.media_type) ? (
              <video src={post.media_url} className="w-full h-full object-cover" onClick={(e) => e.stopPropagation()} />
            ) : (
              <img src={post.media_url} alt={post.title} className="w-full h-full object-cover" loading="lazy" />
            )}
          </div>
        ) : null}

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
            <span
              className={
                post.user_vote === 1
                  ? 'text-neonOrange'
                  : post.user_vote === -1
                  ? 'text-neonCyan'
                  : 'text-gray-400'
              }
            >
              {post.score >= 0 ? '+' : ''}{post.score}
            </span>
          </div>
        </div>

        {ownerMenu && (
          <div className="absolute top-2 right-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setMenuOpen((m) => !m)}
              className="text-gray-400 hover:text-white p-1 rounded bg-black/40 transition-colors"
            >
              <MoreVertical size={14} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-32 bg-[#0a0a0f] border border-white/10 rounded shadow-xl z-10 overflow-hidden">
                {onEdit && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit(post);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5 flex items-center gap-2"
                  >
                    <Pencil size={11} /> Edit
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(post.id);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-neonPink hover:bg-white/5 flex items-center gap-2"
                  >
                    <Trash2 size={11} /> Delete
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  const hasMedia = !!(post.media_url || (post.body && /https?:\/\//.test(post.body)));

  return (
    <div
      className="glass-card border-white/5 hover:border-neonCyan/40 transition-all flex shadow-xl overflow-hidden relative"
      style={hasMedia ? { height: '460px' } : undefined}
    >
      <div className="bg-black/20 px-2 py-4 flex-shrink-0">
        <VoteButtons
          targetTable="post_votes"
          targetIdColumn="post_id"
          targetId={post.id}
          initialScore={post.score}
          initialUserVote={post.user_vote || 0}
          isLoggedIn={isLoggedIn}
          onRequireAuth={onRequireAuth}
        />
      </div>

      <div
        className="flex-grow p-4 cursor-pointer flex flex-col min-h-0 overflow-hidden"
        onClick={() => onOpenPost(post.id)}
      >
        <div className="flex items-center gap-2 mb-1.5 text-[10px] text-gray-500 font-bold uppercase tracking-wider flex-shrink-0 flex-wrap">
          {post.is_pinned && <Pin size={11} className="text-neonOrange" />}
          {post.subhub_title && (
            <span className="text-neonCyan">r/{post.subhub_slug}</span>
          )}
          <span>•</span>
          <div className="flex items-center gap-1.5">
            {post.author_avatar ? (
              <img
                src={post.author_avatar}
                alt={post.author_name || 'agent'}
                className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-white/10"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-gray-400">
                  {(post.author_name || 'A').slice(0, 1).toUpperCase()}
                </span>
              </div>
            )}
            <span className="text-gray-300">{post.author_name || 'agent'}</span>
          </div>
          <span>•</span>
          <span>{timeAgo(post.created_at)}</span>
        </div>

        <h3 className="font-orbitron font-bold text-base text-white leading-snug mb-1.5 flex-shrink-0">
          {post.title}
        </h3>

        {post.body && (
          <div className="flex-shrink-0">
            <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap line-clamp-2">
              <LinkedText text={post.body} showPreview={false} />
            </p>
          </div>
        )}

        {post.media_url && (
          <div className="mt-3 rounded overflow-hidden border border-white/5 bg-black/30 flex-1 min-h-0 flex items-center justify-center">
            {isVideoUrl(post.media_url, post.media_type) ? (
              <video src={post.media_url} className="w-full h-full object-contain max-h-full" controls onClick={(e) => e.stopPropagation()} />
            ) : (
              <img
                src={post.media_url}
                alt={post.title}
                className="w-full h-full object-contain max-h-full"
                loading="lazy"
              />
            )}
          </div>
        )}

        {!post.media_url && post.body && /https?:\/\//.test(post.body) && (
          <div className="flex-1 min-h-0 flex items-center justify-center mt-2">
            <LinkPreviewOnly text={post.body} />
          </div>
        )}

        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 font-bold flex-shrink-0">
          <span className="flex items-center gap-1.5 hover:text-neonCyan transition-colors">
            <MessageSquare size={14} />
            {post.comments_count} comments
          </span>
        </div>
      </div>

      {ownerMenu && (
        <div className="absolute top-3 right-3" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen((m) => !m)}
            className="text-gray-500 hover:text-white p-1 rounded transition-colors"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-36 bg-[#0a0a0f] border border-white/10 rounded shadow-xl z-10 overflow-hidden">
              {onEdit && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onEdit(post);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-white/5 flex items-center gap-2"
                >
                  <Pencil size={12} /> Edit
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onDelete(post.id);
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-neonPink hover:bg-white/5 flex items-center gap-2"
                >
                  <Trash2 size={12} /> Delete
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
