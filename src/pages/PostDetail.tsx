import React, { useRef } from 'react';
import { PostDetailView } from '../components/post-detail/PostDetailView';
import { useCommentComposer } from '../components/post-detail/useCommentComposer';
import { usePostData } from '../components/post-detail/usePostData';
import { usePostEditor } from '../components/post-detail/usePostEditor';

interface PostDetailProps {
  onOpenModal: (id: string, tab?: 'login' | 'register') => void;
  session: any;
}

const FullPageMessage = ({ children }: { children: React.ReactNode }) => (
  <div className="max-w-3xl mx-auto px-4 py-24 text-center">{children}</div>
);

/** Post page (post.html?id=…): loads the post and its comments, owner can edit or delete it. */
export default function PostDetail({ onOpenModal, session }: PostDetailProps) {
  const params = new URLSearchParams(window.location.search);
  const postId = Number(params.get('id'));

  const isLoggedIn = !!session?.user;
  const currentUserId = session?.user?.id || null;
  const requireAuth = () => onOpenModal('auth', 'login');

  // The loader resets the editor's fields on every (re)load, while the editor needs the loaded post:
  // the ref ties the two together without a circular hook dependency.
  const editorRef = useRef<ReturnType<typeof usePostEditor> | null>(null);
  const data = usePostData(postId, session, (p) => editorRef.current?.syncFromPost(p));
  const editor = usePostEditor({ post: data.post, session, reload: data.loadPost });
  editorRef.current = editor;
  const composer = useCommentComposer({ post: data.post, session, isLoggedIn, requireAuth, reloadComments: data.loadComments });

  if (data.loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center text-gray-500 text-xs uppercase tracking-widest font-bold">
        Pulling up the file...
      </div>
    );
  }

  if (data.notFound || !data.post) {
    return (
      <FullPageMessage>
        <p className="text-gray-400 text-sm font-bold mb-4">This post doesn't exist or was removed.</p>
        <a href="./community.html" className="text-neonCyan text-xs font-bold uppercase hover:underline">
          Back to Community
        </a>
      </FullPageMessage>
    );
  }

  return (
    <PostDetailView
      post={data.post}
      authorName={data.authorName}
      authorAvatar={data.authorAvatar}
      subhubSlug={data.subhubSlug}
      comments={data.comments}
      isLoggedIn={isLoggedIn}
      isOwner={isLoggedIn && currentUserId === data.post.author_id}
      currentUserId={currentUserId}
      currentUserName={session?.user?.user_metadata?.username || ''}
      requireAuth={requireAuth}
      editor={editor}
      composer={composer}
      onReplyPosted={data.loadComments}
    />
  );
}
