import React from 'react';
import LinkedText from '../LinkedText';
import { isVideoMedia } from '../../lib/media';
import type { FullPost } from './usePostData';

function PostMedia({ post }: { post: FullPost & { media_url: string } }) {
  return (
    <div className="rounded overflow-hidden border border-white/5 mt-2">
      {isVideoMedia(post.media_url, post.media_type) ? (
        <video src={post.media_url} className="w-full max-h-[600px]" controls />
      ) : (
        <img src={post.media_url} alt={post.title} className="w-full object-contain max-h-[600px]" />
      )}
    </div>
  );
}

/** Read-only view: title, body, media and the attached link. */
export function PostContent({ post }: { post: FullPost }) {
  return (
    <>
      <h1 className="font-orbitron font-bold text-xl text-white leading-snug mb-3">{post.title}</h1>

      {post.body && (
        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap mb-3">
          <LinkedText text={post.body} />
        </p>
      )}

      {post.media_url && <PostMedia post={post as FullPost & { media_url: string }} />}

      {post.link_url && (
        <a
          href={post.link_url}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-neonCyan hover:underline break-all block mt-2"
        >
          {post.link_url}
        </a>
      )}
    </>
  );
}
