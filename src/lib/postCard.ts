// Pure helpers of the feed post card (no React). Extracted from components/PostCard.tsx.

export const containsUrl = (text: string | null | undefined): boolean => !!text && /https?:\/\//.test(text);

/** A list card is tall (fixed height) when it has an image/video or a link to preview. */
export function cardHasMedia(post: { media_url: string | null; body: string | null }): boolean {
  return !!(post.media_url || containsUrl(post.body));
}

/** A link preview is shown only for posts without media whose body contains a link. */
export function showsLinkPreview(post: { media_url: string | null; body: string | null }): boolean {
  return !post.media_url && containsUrl(post.body);
}

/** The ⋮ menu belongs to the post's author and only exists when there is something to do (edit and/or delete). */
export function hasOwnerMenu(isLoggedIn: boolean, currentUserId: string | null | undefined, authorId: string, canEdit: boolean, canDelete: boolean): boolean {
  const isOwner = !!(isLoggedIn && currentUserId && currentUserId === authorId);
  return isOwner && (canEdit || canDelete);
}

/** Colour class of the score in the grid card: upvoted orange, downvoted cyan, otherwise grey. */
export function voteTone(userVote: 1 | -1 | 0 | undefined): string {
  if (userVote === 1) return 'text-neonOrange';
  if (userVote === -1) return 'text-neonCyan';
  return 'text-gray-400';
}

/** "+" for scores of zero and above; negative numbers already carry their own "-". */
export const scorePrefix = (score: number): string => (score >= 0 ? '+' : '');

/** First letter shown in the avatar placeholder. */
export const authorInitial = (authorName: string | undefined): string => (authorName || 'A').slice(0, 1).toUpperCase();
