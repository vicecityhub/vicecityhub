import React from 'react';
import { ArrowLeft } from 'lucide-react';
import VoteButtons from '../VoteButtons';
import CommentThread from '../CommentThread';
import type { CommentNode } from '../CommentThread';
import { commentCountLabel } from '../../lib/postDetail';
import { CommentComposer } from './CommentComposer';
import { OwnerActions } from './OwnerActions';
import { PostContent } from './PostContent';
import { PostEditForm } from './PostEditForm';
import { PostMetaLine } from './PostMetaLine';
import type { CommentComposerState } from './useCommentComposer';
import type { FullPost } from './usePostData';
import type { PostEditor } from './usePostEditor';

export interface PostDetailViewProps {
  post: FullPost;
  authorName: string;
  authorAvatar: string | null;
  subhubSlug: string | null;
  comments: CommentNode[];
  isLoggedIn: boolean;
  isOwner: boolean;
  currentUserId: string | null;
  currentUserName: string;
  requireAuth: () => void;
  editor: PostEditor;
  composer: CommentComposerState;
  onReplyPosted: () => void;
}

const BackLink = () => (
  <a
    href="./community.html"
    className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-neonCyan font-bold uppercase tracking-wider mb-5 transition-colors"
  >
    <ArrowLeft size={14} /> Back to Community
  </a>
);

/** A loaded post: the card (votes, content or edit form), the comment composer and the comment threads. */
export function PostDetailView(props: PostDetailViewProps) {
  const { post, comments, isLoggedIn, isOwner, currentUserId, currentUserName, requireAuth, editor, composer, onReplyPosted } = props;
  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-6 py-10">
      <BackLink />

      <div className="glass-card border-white/5 flex shadow-xl overflow-hidden mb-8 relative">
        <div className="bg-black/20 px-2 py-4 flex-shrink-0">
          <VoteButtons
            targetTable="post_votes"
            targetIdColumn="post_id"
            targetId={post.id}
            initialScore={post.score}
            initialUserVote={0}
            isLoggedIn={isLoggedIn}
            onRequireAuth={requireAuth}
          />
        </div>

        <div className="flex-grow p-5">
          <PostMetaLine post={post} authorName={props.authorName} authorAvatar={props.authorAvatar} subhubSlug={props.subhubSlug} />
          {editor.editing ? <PostEditForm post={post} editor={editor} /> : <PostContent post={post} />}
        </div>

        {isOwner && !editor.editing && <OwnerActions editor={editor} />}
      </div>

      <CommentComposer composer={composer} isLoggedIn={isLoggedIn} requireAuth={requireAuth} />

      <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-4">
        {commentCountLabel(comments.length)}
      </div>

      {comments.map((c) => (
        <CommentThread
          key={c.id}
          comment={c}
          depth={0}
          isLoggedIn={isLoggedIn}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onRequireAuth={requireAuth}
          onReplyPosted={onReplyPosted}
        />
      ))}
    </div>
  );
}
