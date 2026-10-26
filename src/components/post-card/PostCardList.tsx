import React from 'react';
import { MessageSquare, Pin } from 'lucide-react';
import VoteButtons from '../VoteButtons';
import LinkedText, { LinkPreviewOnly } from '../LinkedText';
import { isVideoMedia } from '../../lib/media';
import { authorInitial, cardHasMedia, showsLinkPreview } from '../../lib/postCard';
import { timeAgo } from '../../lib/timeAgo';
import type { FeedPost } from '../PostCard';

function AuthorAvatar({ post }: { post: FeedPost }) {
  return post.author_avatar ? (
    <img
      src={post.author_avatar}
      alt={post.author_name || 'agent'}
      className="w-9 h-9 rounded-full object-cover flex-shrink-0 border border-white/10"
    />
  ) : (
    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
      <span className="text-[10px] font-bold text-gray-400">{authorInitial(post.author_name)}</span>
    </div>
  );
}

function ListMedia({ post }: { post: FeedPost & { media_url: string } }) {
  return (
    <div className="mt-3 rounded overflow-hidden border border-white/5 bg-black/30 flex-1 min-h-0 flex items-center justify-center">
      {isVideoMedia(post.media_url, post.media_type) ? (
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
  );
}

interface Props {
  post: FeedPost;
  isLoggedIn: boolean;
  onRequireAuth: () => void;
  onOpenPost: (id: number) => void;
  /** The ⋮ menu, already built (or null when the viewer is not the author). */
  ownerMenu: React.ReactNode;
}

/** Full-width row with vote buttons; fixed height when the post has media or a link to preview. */
export function PostCardList({ post, isLoggedIn, onRequireAuth, onOpenPost, ownerMenu }: Props) {
  return (
    <div
      className="glass-card border-white/5 hover:border-neonCyan/40 transition-all flex shadow-xl overflow-hidden relative"
      style={cardHasMedia(post) ? { height: '460px' } : undefined}
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
            <AuthorAvatar post={post} />
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

        {post.media_url && <ListMedia post={post as FeedPost & { media_url: string }} />}

        {showsLinkPreview(post) && (
          <div className="flex-1 min-h-0 flex items-center justify-center mt-2">
            <LinkPreviewOnly text={post.body!} />
          </div>
        )}

        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 font-bold flex-shrink-0">
          <span className="flex items-center gap-1.5 hover:text-neonCyan transition-colors">
            <MessageSquare size={14} />
            {post.comments_count} comments
          </span>
        </div>
      </div>

      {ownerMenu}
    </div>
  );
}
