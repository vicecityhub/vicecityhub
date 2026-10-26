import React, { useState } from 'react';
import { hasOwnerMenu } from '../lib/postCard';
import { GRID_MENU_STYLE, LIST_MENU_STYLE, OwnerMenu } from './post-card/OwnerMenu';
import { PostCardGrid } from './post-card/PostCardGrid';
import { PostCardList } from './post-card/PostCardList';

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
  const showMenu = hasOwnerMenu(isLoggedIn, currentUserId, post.author_id, !!onEdit, !!onDelete);

  const isGrid = variant === 'grid';
  const ownerMenu = showMenu ? (
    <OwnerMenu
      post={post}
      style={isGrid ? GRID_MENU_STYLE : LIST_MENU_STYLE}
      open={menuOpen}
      setOpen={setMenuOpen}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  ) : null;

  if (isGrid) return <PostCardGrid post={post} onOpenPost={onOpenPost} ownerMenu={ownerMenu} />;
  return <PostCardList post={post} isLoggedIn={isLoggedIn} onRequireAuth={onRequireAuth} onOpenPost={onOpenPost} ownerMenu={ownerMenu} />;
}
