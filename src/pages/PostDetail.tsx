import React, { useState, useEffect, useCallback } from 'react';
import { supa } from '../lib/SupabaseClient';
import { buildStorageUploadPath } from '../lib/fileUpload';
import VoteButtons from '../components/VoteButtons';
import CommentThread, { CommentNode } from '../components/CommentThread';
import LinkedText from '../components/LinkedText';
import { Pin, ArrowLeft, Pencil, Trash2, Upload, X } from 'lucide-react';

interface PostDetailProps {
  onOpenModal: (id: string, tab?: 'login' | 'register') => void;
  session: any;
}

interface FullPost {
  id: number;
  title: string;
  body: string | null;
  media_url: string | null;
  media_type?: 'image' | 'video' | null;
  link_url: string | null;
  score: number;
  is_pinned: boolean;
  created_at: string;
  author_id: string;
  subhub_id: number | null;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Turns the flat rows from Supabase into a nested tree by parent_comment_id
function buildCommentTree(rows: CommentNode[]): CommentNode[] {
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

export default function PostDetail({ onOpenModal, session }: PostDetailProps) {
  const params = new URLSearchParams(window.location.search);
  const postId = Number(params.get('id'));

  const [post, setPost] = useState<FullPost | null>(null);
  const [authorName, setAuthorName] = useState('agent');
  const [authorAvatar, setAuthorAvatar] = useState<string | null>(null);
  const [subhubSlug, setSubhubSlug] = useState<string | null>(null);
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [topLevelBody, setTopLevelBody] = useState('');
  const [submittingTop, setSubmittingTop] = useState(false);

  // Post editing (owner only)
  const [editingPost, setEditingPost] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editMediaFile, setEditMediaFile] = useState<File | null>(null);
  const [editRemoveMedia, setEditRemoveMedia] = useState(false);
  const [savingPost, setSavingPost] = useState(false);
  const [postEditError, setPostEditError] = useState('');
  const [deletingPost, setDeletingPost] = useState(false);

  const isLoggedIn = !!session?.user;
  const currentUserId = session?.user?.id || null;
  const isOwner = isLoggedIn && !!post && currentUserId === post.author_id;
  const requireAuth = () => onOpenModal('auth', 'login');

  const loadComments = useCallback(async () => {
    if (!postId) return;

    const { data: commentRows } = await supa
      .from('post_comments')
      .select('id,post_id,parent_comment_id,author_id,body,score,created_at,is_deleted')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (!commentRows) {
      setComments([]);
      return;
    }

    const authorIds = [...new Set(commentRows.map((c: any) => c.author_id))];
    let nameMap: Record<string, string> = {};
    let avatarMap: Record<string, string | null> = {};
    if (authorIds.length > 0) {
      const { data: profiles } = await supa
        .from('player_profiles')
        .select('user_id,display_name,avatar_url')
        .in('user_id', authorIds);
      if (profiles) {
        nameMap = Object.fromEntries(profiles.map((p: any) => [p.user_id, p.display_name]));
        avatarMap = Object.fromEntries(profiles.map((p: any) => [p.user_id, p.avatar_url]));
      }
    }

    let userVotes: Record<number, 1 | -1> = {};
    if (session?.user) {
      const ids = commentRows.map((c: any) => c.id);
      const { data: voteRows } = await supa
        .from('comment_votes')
        .select('comment_id,value')
        .eq('user_id', session.user.id)
        .in('comment_id', ids);
      if (voteRows) userVotes = Object.fromEntries(voteRows.map((v: any) => [v.comment_id, v.value]));
    }

    const enriched: CommentNode[] = commentRows.map((c: any) => ({
      ...c,
      author_name: nameMap[c.author_id] || 'agent',
      author_avatar: avatarMap[c.author_id] || null,
      user_vote: userVotes[c.id] || 0,
    }));

    setComments(buildCommentTree(enriched));
  }, [postId, session]);

  const loadPost = useCallback(async () => {
    if (!postId) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);

    const { data: postRow, error } = await supa
      .from('feed_posts')
      .select('id,title,body,media_url,media_type,link_url,score,is_pinned,created_at,author_id,subhub_id')
      .eq('id', postId)
      .maybeSingle();

    if (error || !postRow) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    setPost(postRow);
    setEditTitle(postRow.title);
    setEditBody(postRow.body || '');

    const { data: authorRow } = await supa
      .from('player_profiles')
      .select('display_name,avatar_url')
      .eq('user_id', postRow.author_id)
      .maybeSingle();
    if (authorRow) {
      setAuthorName(authorRow.display_name);
      setAuthorAvatar(authorRow.avatar_url);
    }

    if (postRow.subhub_id) {
      const { data: subhubRow } = await supa
        .from('subhubs')
        .select('slug')
        .eq('id', postRow.subhub_id)
        .maybeSingle();
      if (subhubRow) setSubhubSlug(subhubRow.slug);
    }

    await loadComments();
    setLoading(false);
  }, [postId, loadComments]);

  useEffect(() => {
    loadPost();
  }, [postId]);

  const submitTopLevelComment = async () => {
    if (!isLoggedIn) {
      requireAuth();
      return;
    }
    if (!topLevelBody.trim() || !post) return;
    setSubmittingTop(true);

    const { error } = await supa.from('post_comments').insert({
      post_id: post.id,
      parent_comment_id: null,
      author_id: session.user.id,
      body: topLevelBody.trim(),
    });

    setSubmittingTop(false);
    if (!error) {
      setTopLevelBody('');
      loadComments();
    }
  };

  const startEditingPost = () => {
    if (!post) return;
    setEditTitle(post.title);
    setEditBody(post.body || '');
    setEditMediaFile(null);
    setEditRemoveMedia(false);
    setPostEditError('');
    setEditingPost(true);
  };

  const savePostEdit = async () => {
    if (!post || !editTitle.trim()) return;
    setSavingPost(true);
    setPostEditError('');

    try {
      let finalMediaUrl: string | null = editRemoveMedia ? null : post.media_url;
      let finalMediaType: 'image' | 'video' | null = post.media_type || null;

      if (editMediaFile) {
        const isVideo = editMediaFile.type.startsWith('video');
        finalMediaType = isVideo ? 'video' : 'image';
        const path = buildStorageUploadPath(session.user.id, editMediaFile.name);
        const { error: uploadError } = await supa.storage.from('post-media').upload(path, editMediaFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supa.storage.from('post-media').getPublicUrl(path);
        finalMediaUrl = urlData.publicUrl;
      } else if (editRemoveMedia) {
        finalMediaType = null;
      }

      const { error } = await supa
        .from('feed_posts')
        .update({
          title: editTitle.trim(),
          body: editBody.trim() || null,
          media_url: finalMediaUrl,
          media_type: finalMediaUrl ? finalMediaType : null,
        })
        .eq('id', post.id);

      if (error) throw error;

      setEditingPost(false);
      await loadPost();
    } catch (e: any) {
      setPostEditError(e.message || 'Something went wrong.');
    } finally {
      setSavingPost(false);
    }
  };

  const deletePost = async () => {
    if (!post) return;
    if (!window.confirm('Delete this post permanently? This cannot be undone.')) return;
    setDeletingPost(true);
    const { error } = await supa.from('feed_posts').delete().eq('id', post.id);
    setDeletingPost(false);
    if (!error) {
      window.location.href = './community.html';
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center text-gray-500 text-xs uppercase tracking-widest font-bold">
        Pulling up the file...
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <p className="text-gray-400 text-sm font-bold mb-4">This post doesn't exist or was removed.</p>
        <a href="./community.html" className="text-neonCyan text-xs font-bold uppercase hover:underline">
          Back to Community
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 lg:px-6 py-10">
      <a
        href="./community.html"
        className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-neonCyan font-bold uppercase tracking-wider mb-5 transition-colors"
      >
        <ArrowLeft size={14} /> Back to Community
      </a>

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
          <div className="flex items-center gap-2 mb-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
            {post.is_pinned && <Pin size={11} className="text-neonOrange" />}
            {subhubSlug && <span className="text-neonCyan">r/{subhubSlug}</span>}
            <span>•</span>
            {authorAvatar ? (
              <img src={authorAvatar} alt={authorName} className="w-7 h-7 rounded-full object-cover border border-white/10 flex-shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] font-bold text-gray-400">{authorName.slice(0,1).toUpperCase()}</span>
              </div>
            )}
            <span>{authorName}</span>
            <span>•</span>
            <span>{timeAgo(post.created_at)}</span>
          </div>

          {editingPost ? (
            <div className="flex flex-col gap-3 max-w-lg">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                maxLength={300}
                className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white"
              />
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                rows={5}
                maxLength={10000}
                className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white"
              />
              <span className="text-[10px] text-gray-600 self-end -mt-2">{editBody.length}/10000</span>

              {post.media_url && !editRemoveMedia && !editMediaFile && (
                <div className="relative rounded overflow-hidden border border-white/10">
                  {post.media_type === 'video' ? (
                    <video src={post.media_url} className="w-full max-h-48" controls />
                  ) : (
                    <img src={post.media_url} alt="" className="w-full max-h-48 object-cover" />
                  )}
                  <button
                    onClick={() => setEditRemoveMedia(true)}
                    className="absolute top-2 right-2 bg-black/70 text-neonPink rounded p-1.5 hover:bg-black"
                    type="button"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              {editMediaFile && <p className="text-[10px] text-gray-400">Selected: {editMediaFile.name}</p>}

              <label className="flex items-center gap-2 border border-dashed border-white/15 rounded p-3 text-xs text-gray-400 hover:border-neonCyan cursor-pointer transition-colors">
                <Upload size={14} />
                {editMediaFile || post.media_url ? 'Replace file' : 'Upload image or video'}
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    setEditMediaFile(e.target.files?.[0] || null);
                    setEditRemoveMedia(false);
                  }}
                />
              </label>

              {postEditError && <p className="text-xs text-neonPink">{postEditError}</p>}

              <div className="flex gap-2">
                <button
                  onClick={savePostEdit}
                  disabled={savingPost || !editTitle.trim()}
                  className="border border-neonCyan/30 text-neonCyan px-4 py-1.5 rounded hover:bg-neonCyan hover:text-black font-orbitron text-xs disabled:opacity-40 transition-all"
                >
                  {savingPost ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  onClick={() => setEditingPost(false)}
                  className="border border-white/15 text-gray-400 px-4 py-1.5 rounded hover:bg-white/5 font-orbitron text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <h1 className="font-orbitron font-bold text-xl text-white leading-snug mb-3">{post.title}</h1>

              {post.body && (
                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap mb-3">
                  <LinkedText text={post.body} />
                </p>
              )}

              {post.media_url && (
                <div className="rounded overflow-hidden border border-white/5 mt-2">
                  {post.media_type === 'video' || (!post.media_type && post.media_url.match(/\.(mp4|webm|mov)$/i)) ? (
                    <video src={post.media_url} className="w-full max-h-[600px]" controls />
                  ) : (
                    <img src={post.media_url} alt={post.title} className="w-full object-contain max-h-[600px]" />
                  )}
                </div>
              )}

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
          )}
        </div>

        {isOwner && !editingPost && (
          <div className="absolute top-3 right-3 flex gap-2">
            <button
              onClick={startEditingPost}
              className="text-gray-500 hover:text-neonCyan p-1.5 rounded transition-colors"
              title="Edit post"
            >
              <Pencil size={15} />
            </button>
            <button
              onClick={deletePost}
              disabled={deletingPost}
              className="text-gray-500 hover:text-neonPink p-1.5 rounded transition-colors disabled:opacity-40"
              title="Delete post"
            >
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </div>

      {/* Top-level comment composer */}
      <div className="mb-6">
        <textarea
          value={topLevelBody}
          onChange={(e) => setTopLevelBody(e.target.value)}
          rows={3}
          maxLength={5000}
          placeholder={isLoggedIn ? 'Add to the conversation...' : 'Sign in to comment'}
          onFocus={() => !isLoggedIn && requireAuth()}
          className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white"
        />
        <span className="text-[10px] text-gray-600 block text-right mt-1">{topLevelBody.length}/5000</span>
        <button
          onClick={submitTopLevelComment}
          disabled={submittingTop || !topLevelBody.trim()}
          className="btn-neon font-orbitron text-xs uppercase mt-2 disabled:opacity-40"
        >
          {submittingTop ? 'Posting...' : 'Comment'}
        </button>
      </div>

      <div className="text-xs text-gray-500 uppercase tracking-widest font-bold mb-4">
        {comments.length === 0 ? 'No comments yet' : `${comments.length} top-level comments`}
      </div>

      {comments.map((c) => (
        <CommentThread
          key={c.id}
          comment={c}
          depth={0}
          isLoggedIn={isLoggedIn}
          currentUserId={currentUserId}
          currentUserName={session?.user?.user_metadata?.username || ''}
          onRequireAuth={requireAuth}
          onReplyPosted={loadComments}
        />
      ))}
    </div>
  );
}
