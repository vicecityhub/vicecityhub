// Pure logic of the post detail page (no React, no Supabase). Extracted from pages/PostDetail.tsx.
import type { CommentNode } from '../components/CommentThread';

export type MediaType = 'image' | 'video';

/** Turns the flat rows from Supabase into a nested tree by parent_comment_id. */
export function buildCommentTree(rows: CommentNode[]): CommentNode[] {
  const byId = new Map<number, CommentNode>();
  rows.forEach((r) => byId.set(r.id, { ...r, children: [] }));
  const roots: CommentNode[] = [];
  rows.forEach((r) => {
    const node = byId.get(r.id)!;
    if (r.parent_comment_id && byId.has(r.parent_comment_id)) {
      byId.get(r.parent_comment_id)!.children!.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

/** Adds author name/avatar and the signed-in user's vote to raw comment rows. */
export function enrichComments(
  rows: any[],
  names: Record<string, string>,
  avatars: Record<string, string | null>,
  userVotes: Record<number, 1 | -1>,
): CommentNode[] {
  return rows.map((c) => ({
    ...c,
    author_name: names[c.author_id] || 'agent',
    author_avatar: avatars[c.author_id] || null,
    user_vote: userVotes[c.id] || 0,
  }));
}

export const uniqueAuthorIds = (rows: any[]): string[] => [...new Set(rows.map((c) => c.author_id))];

export function commentCountLabel(topLevelCount: number): string {
  return topLevelCount === 0 ? 'No comments yet' : `${topLevelCount} top-level comments`;
}

/**
 * What the post's media should be after an edit, before any upload happens:
 * a chosen file wins (its MIME type decides image/video), "remove" clears both, otherwise nothing changes.
 * `url` is only final when `upload` is false; after an upload it is replaced by the public URL.
 */
export function planMediaEdit(
  current: { media_url: string | null; media_type?: MediaType | null },
  removeMedia: boolean,
  file: { type: string } | null,
): { url: string | null; type: MediaType | null; upload: boolean } {
  const url = removeMedia ? null : current.media_url;
  if (file) return { url, type: file.type.startsWith('video') ? 'video' : 'image', upload: true };
  return { url, type: removeMedia ? null : current.media_type || null, upload: false };
}

/** The row sent to feed_posts on save. A post without media never keeps a media type. */
export function buildPostUpdate(title: string, body: string, mediaUrl: string | null, mediaType: MediaType | null) {
  return {
    title: title.trim(),
    body: body.trim() || null,
    media_url: mediaUrl,
    media_type: mediaUrl ? mediaType : null,
  };
}
