// Pure logic of the Community page (no React, no Supabase client). Extracted from pages/Community.tsx.
import { isVideoMedia } from './media.ts';
import type { FeedPost } from '../components/PostCard';

export interface Subhub {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  icon: string | null;
}

export interface LegacyForumPost {
  id: number;
  title: string;
  body: string;
  author_id: string;
  author_name: string;
  created_at: string;
}

export type SortMode = 'hot' | 'new' | 'top';
export type MediaType = 'image' | 'video';

/** The part of a Supabase query builder the feed sort needs. */
interface Orderable<Q> {
  order: (column: string, options: { ascending: boolean }) => Q;
}

/** hot = pinned first then newest, new = newest, top = highest score. */
export function applyFeedSort<Q extends Orderable<Q>>(query: Q, mode: SortMode): Q {
  if (mode === 'new') return query.order('created_at', { ascending: false });
  if (mode === 'top') return query.order('score', { ascending: false });
  return query.order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
}

/** Adds author, sub-hub and the viewer's vote to raw feed rows. */
export function enrichFeedPosts(
  rows: any[],
  subhubs: Subhub[],
  names: Record<string, string>,
  avatars: Record<string, string | null>,
  userVotes: Record<number, 1 | -1>,
): FeedPost[] {
  const subhubMap = new Map(subhubs.map((s) => [s.id, s]));
  return rows.map((p) => ({
    ...p,
    author_name: names[p.author_id] || 'agent',
    author_avatar: avatars[p.author_id] || null,
    subhub_slug: subhubMap.get(p.subhub_id)?.slug,
    subhub_title: subhubMap.get(p.subhub_id)?.title,
    user_vote: userVotes[p.id] || 0,
  }));
}

/** Name stored with a new forum topic: metadata username, else the e-mail local part, else "agent". */
export function legacyAuthorName(user: { email?: string | null; user_metadata?: { username?: string } | null }): string {
  return user.user_metadata?.username || user.email?.split('@')[0] || 'agent';
}

export function validateLegacyPost(title: string, body: string): string | null {
  return !title.trim() || !body.trim() ? 'Title and body are both required.' : null;
}

/**
 * What the post's media should be after the composer is submitted, before any upload:
 * a chosen file wins (its MIME type decides image/video); otherwise the kept URL is typed by its extension;
 * "remove" clears it. `url` is only final when `upload` is false.
 */
export function planComposerMedia(
  existingUrl: string | null,
  removeMedia: boolean,
  file: { type: string } | null,
): { url: string | null; type: MediaType | null; upload: boolean } {
  const url = removeMedia ? null : existingUrl;
  if (file) return { url, type: file.type.startsWith('video') ? 'video' : 'image', upload: true };
  if (url) return { url, type: isVideoMedia(url) ? 'video' : 'image', upload: false };
  return { url, type: null, upload: false };
}

/** Columns shared by the insert and the update of a feed post. A post without media never keeps a media type. */
export function buildFeedPostFields(title: string, body: string, subhubId: number, mediaUrl: string | null, mediaType: MediaType | null) {
  return {
    subhub_id: subhubId,
    title: title.trim(),
    body: body.trim() || null,
    media_url: mediaUrl,
    media_type: mediaUrl ? mediaType : null,
  };
}

/** The composer can submit once there is a title and a sub-hub to post into. */
export const canSubmitPost = (title: string, subhubId: number | null): boolean => !!title.trim() && !!subhubId;
