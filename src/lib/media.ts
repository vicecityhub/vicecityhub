/**
 * Is this post media a video? An explicit media_type wins; rows without one (older posts) are
 * recognised by their file extension.
 */
export function isVideoMedia(url: string | null, mediaType?: string | null): boolean {
  if (mediaType === 'video') return true;
  if (mediaType === 'image') return false;
  return !!url && /\.(mp4|webm|mov)$/i.test(url);
}
