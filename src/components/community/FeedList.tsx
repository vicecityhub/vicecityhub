import React from 'react';
import PostCard from '../PostCard';
import type { FeedPost } from '../PostCard';

interface Props {
  loading: boolean;
  posts: FeedPost[];
  feedRef: React.RefObject<HTMLDivElement>;
  isLoggedIn: boolean;
  currentUserId: string | null;
  onRequireAuth: () => void;
  onOpenPost: (id: number) => void;
  onEdit: (post: FeedPost) => void;
  onDelete: (id: number) => void;
}

const EMPTY_STATE_CLASS = 'text-center text-gray-500 text-xs uppercase tracking-widest font-bold py-20';

/** The scrolling list of post cards, or its loading / empty message. */
export function FeedList({ loading, posts, feedRef, isLoggedIn, currentUserId, onRequireAuth, onOpenPost, onEdit, onDelete }: Props) {
  if (loading) return <div className={EMPTY_STATE_CLASS}>Loading the feed...</div>;
  if (posts.length === 0) return <div className={EMPTY_STATE_CLASS}>Nothing here yet. Be the first to post.</div>;
  return (
    <div
      ref={feedRef}
      className="snap-y snap-mandatory scroll-smooth custom-scrollbar"
      style={{
        maxHeight: '480px',
        overflowY: 'auto',
        overflowX: 'visible',
        paddingTop: '12px',
        paddingBottom: '8px',
        paddingLeft: '4px',
        paddingRight: '8px',
        scrollPaddingTop: '12px',
      }}
    >
      <div className="flex flex-col gap-3">
        {posts.map((p) => (
          <div key={p.id} className="snap-start [scroll-snap-stop:always]" style={{ paddingTop: '4px' }}>
            <PostCard
              post={p}
              variant="list"
              isLoggedIn={isLoggedIn}
              currentUserId={currentUserId}
              onRequireAuth={onRequireAuth}
              onOpenPost={onOpenPost}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
