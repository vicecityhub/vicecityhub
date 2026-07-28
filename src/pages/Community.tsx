import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supa } from '../lib/SupabaseClient';
import { buildStorageUploadPath } from '../lib/fileUpload';
import PostCard, { FeedPost } from '../components/PostCard';
import LinkedText from '../components/LinkedText';
import { Flame, Clock, TrendingUp, X, Upload, MessageSquare, Pencil, Trash2 } from 'lucide-react';

interface Subhub {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  icon: string | null;
}

interface LegacyForumPost {
  id: number;
  title: string;
  body: string;
  author_id: string;
  author_name: string;
  created_at: string;
}

interface CommunityProps {
  onOpenModal: (id: string, tab?: 'login' | 'register') => void;
  session: any;
}

type SortMode = 'hot' | 'new' | 'top';

export default function Community({ onOpenModal, session }: CommunityProps) {
  const [subhubs, setSubhubs] = useState<Subhub[]>([]);
  const [activeSubhub, setActiveSubhub] = useState<string | null>(null);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('hot');
  const [loading, setLoading] = useState(true);
  const feedRef = useRef<HTMLDivElement>(null);

  // Reset scroll to top when posts first load so the first card is never clipped
  useEffect(() => {
    if (!loading && feedRef.current) {
      feedRef.current.scrollTop = 0;
    }
  }, [loading]);

  // Composer (create + edit share the same modal)
  const [composerOpen, setComposerOpen] = useState(false);
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newSubhubId, setNewSubhubId] = useState<number | null>(null);
  const [existingMediaUrl, setExistingMediaUrl] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [removeMedia, setRemoveMedia] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [composerError, setComposerError] = useState('');

  // Legacy forum (migrated from the old Home page "Underground" section)
  const [legacyForumPosts, setLegacyForumPosts] = useState<LegacyForumPost[]>([]);
  const [legacyComposerOpen, setLegacyComposerOpen] = useState(false);
  const [editingLegacyId, setEditingLegacyId] = useState<number | null>(null);
  const [legacyTitle, setLegacyTitle] = useState('');
  const [legacyBody, setLegacyBody] = useState('');
  const [legacySubmitting, setLegacySubmitting] = useState(false);
  const [legacyError, setLegacyError] = useState('');

  const isLoggedIn = !!session?.user;
  const currentUserId = session?.user?.id || null;

  const requireAuth = () => onOpenModal('auth', 'login');

  // Load subhub list once
  useEffect(() => {
    supa
      .from('subhubs')
      .select('*')
      .order('id')
      .then(({ data }) => {
        if (data) {
          setSubhubs(data);
          if (data.length > 0) setNewSubhubId(data[0].id);
        }
      });
  }, []);

  // Load legacy forum posts (old "posts" table, type = 'forum')
  const fetchLegacyForumPosts = useCallback(() => {
    supa
      .from('posts')
      .select('id,title,body,author_id,author_name,created_at')
      .eq('type', 'forum')
      .order('created_at', { ascending: false })
      .limit(12)
      .then(({ data }) => {
        if (data) setLegacyForumPosts(data);
      });
  }, []);

  useEffect(() => {
    fetchLegacyForumPosts();
  }, [fetchLegacyForumPosts]);

  const openLegacyEditComposer = (post: LegacyForumPost) => {
    setEditingLegacyId(post.id);
    setLegacyTitle(post.title);
    setLegacyBody(post.body);
    setLegacyError('');
    setLegacyComposerOpen(true);
  };

  const handleDeleteLegacyPost = async (id: number) => {
    if (!window.confirm('Delete this forum topic permanently? This cannot be undone.')) return;
    const { error } = await supa.from('posts').delete().eq('id', id);
    if (!error) {
      setLegacyForumPosts((prev) => prev.filter((p) => p.id !== id));
    } else {
      alert(error.message);
    }
  };

  const submitLegacyPost = async () => {
    if (!isLoggedIn) {
      requireAuth();
      return;
    }
    if (!legacyTitle.trim() || !legacyBody.trim()) {
      setLegacyError('Title and body are both required.');
      return;
    }
    setLegacySubmitting(true);
    setLegacyError('');

    const { error } = editingLegacyId
      ? await supa
          .from('posts')
          .update({ title: legacyTitle.trim(), body: legacyBody.trim() })
          .eq('id', editingLegacyId)
      : await supa.from('posts').insert({
          author_id: session.user.id,
          author_name: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'agent',
          type: 'forum',
          title: legacyTitle.trim(),
          body: legacyBody.trim(),
        });

    setLegacySubmitting(false);
    if (error) {
      setLegacyError(error.message);
    } else {
      setLegacyTitle('');
      setLegacyBody('');
      setEditingLegacyId(null);
      setLegacyComposerOpen(false);
      fetchLegacyForumPosts();
    }
  };

  const fetchPosts = useCallback(async () => {
    setLoading(true);

    let query = supa
      .from('feed_posts')
      .select('id,title,body,media_url,media_type,link_url,score,comments_count,is_pinned,created_at,author_id,subhub_id');

    if (activeSubhub) {
      const sh = subhubs.find((s) => s.slug === activeSubhub);
      if (sh) query = query.eq('subhub_id', sh.id);
    }

    if (sortMode === 'new') {
      query = query.order('created_at', { ascending: false });
    } else if (sortMode === 'top') {
      query = query.order('score', { ascending: false });
    } else {
      query = query.order('is_pinned', { ascending: false }).order('created_at', { ascending: false });
    }

    const { data, error } = await query.limit(50);

    if (!error && data) {
      const subhubMap = new Map(subhubs.map((s) => [s.id, s]));

      let userVotes: Record<number, 1 | -1> = {};
      if (session?.user) {
        const postIds = data.map((p: any) => p.id);
        const { data: voteRows } = await supa
          .from('post_votes')
          .select('post_id,value')
          .eq('user_id', session.user.id)
          .in('post_id', postIds);
        if (voteRows) {
          userVotes = Object.fromEntries(voteRows.map((v: any) => [v.post_id, v.value]));
        }
      }

      const authorIds = [...new Set(data.map((p: any) => p.author_id))];
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

      setPosts(
        data.map((p: any) => ({
          ...p,
          author_name: nameMap[p.author_id] || 'agent',
          author_avatar: avatarMap[p.author_id] || null,
          subhub_slug: subhubMap.get(p.subhub_id)?.slug,
          subhub_title: subhubMap.get(p.subhub_id)?.title,
          user_vote: userVotes[p.id] || 0,
        }))
      );
    }
    setLoading(false);
  }, [activeSubhub, sortMode, subhubs, session]);

  useEffect(() => {
    if (subhubs.length > 0) fetchPosts();
  }, [subhubs, fetchPosts]);

  const handleOpenPost = (id: number) => {
    window.location.href = `./post.html?id=${id}`;
  };

  const openCreateComposer = () => {
    setEditingPostId(null);
    setNewTitle('');
    setNewBody('');
    setExistingMediaUrl(null);
    setMediaFile(null);
    setRemoveMedia(false);
    setComposerError('');
    if (subhubs.length > 0) setNewSubhubId(subhubs[0].id);
    setComposerOpen(true);
  };

  const openEditComposer = (post: FeedPost) => {
    setEditingPostId(post.id);
    setNewTitle(post.title);
    setNewBody(post.body || '');
    setExistingMediaUrl(post.media_url);
    setMediaFile(null);
    setRemoveMedia(false);
    setComposerError('');
    const sh = subhubs.find((s) => s.slug === post.subhub_slug);
    if (sh) setNewSubhubId(sh.id);
    setComposerOpen(true);
  };

  const handleDeletePost = async (id: number) => {
    if (!window.confirm('Delete this post permanently? This cannot be undone.')) return;
    const { error } = await supa.from('feed_posts').delete().eq('id', id);
    if (!error) {
      setPosts((prev) => prev.filter((p) => p.id !== id));
    }
  };

  const submitPost = async () => {
    if (!isLoggedIn) {
      requireAuth();
      return;
    }
    if (!newTitle.trim() || !newSubhubId) return;
    setSubmitting(true);
    setComposerError('');

    try {
      let finalMediaUrl: string | null = removeMedia ? null : existingMediaUrl;
      let finalMediaType: 'image' | 'video' | null = null;

      if (mediaFile) {
        const isVideo = mediaFile.type.startsWith('video');
        finalMediaType = isVideo ? 'video' : 'image';
        const path = buildStorageUploadPath(session.user.id, mediaFile.name);
        const { error: uploadError } = await supa.storage.from('post-media').upload(path, mediaFile);
        if (uploadError) throw uploadError;
        const { data: urlData } = supa.storage.from('post-media').getPublicUrl(path);
        finalMediaUrl = urlData.publicUrl;
      } else if (finalMediaUrl) {
        finalMediaType = /\.(mp4|webm|mov)$/i.test(finalMediaUrl) ? 'video' : 'image';
      }

      if (editingPostId) {
        const { error } = await supa
          .from('feed_posts')
          .update({
            title: newTitle.trim(),
            body: newBody.trim() || null,
            subhub_id: newSubhubId,
            media_url: finalMediaUrl,
            media_type: finalMediaUrl ? finalMediaType : null,
          })
          .eq('id', editingPostId);
        if (error) throw error;
      } else {
        const { error } = await supa.from('feed_posts').insert({
          subhub_id: newSubhubId,
          author_id: session.user.id,
          title: newTitle.trim(),
          body: newBody.trim() || null,
          media_url: finalMediaUrl,
          media_type: finalMediaUrl ? finalMediaType : null,
        });
        if (error) throw error;
      }

      setComposerOpen(false);
      fetchPosts();
    } catch (e: any) {
      setComposerError(e.message || 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  };

  const isExistingMediaVideo = !!existingMediaUrl && /\.(mp4|webm|mov)$/i.test(existingMediaUrl);

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-6 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="font-orbitron font-extrabold text-3xl text-white uppercase tracking-wider">
            Vice City Community
          </h1>
          <p className="text-xs text-gray-500 uppercase tracking-widest font-bold mt-1">
            Where Leonida's agents talk shop, trade leaks, and start fights
          </p>
        </div>
        <button
          onClick={() => (isLoggedIn ? openCreateComposer() : requireAuth())}
          className="btn-neon font-orbitron text-xs uppercase tracking-wider self-start sm:self-auto"
        >
          + New Post
        </button>
      </div>

      {/* YouTube Community Banner */}
      <a
        href="https://youtube.com/@vicecity_hub/community?si=G6x0kiCdvueaTgR-"
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-4 rounded-xl p-4 mb-3 transition-all duration-200 hover:-translate-y-0.5 group"
        style={{ background: 'linear-gradient(135deg, rgba(255,0,0,0.1), rgba(255,0,0,0.04))', border: '1px solid rgba(255,0,0,0.25)' }}
      >
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,0,0,0.15)', border: '1px solid rgba(255,0,0,0.4)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.38.55A3.02 3.02 0 0 0 .5 6.19C0 8.09 0 12 0 12s0 3.91.5 5.81a3.02 3.02 0 0 0 2.12 2.14C4.5 20.5 12 20.5 12 20.5s7.5 0 9.38-.55a3.02 3.02 0 0 0 2.12-2.14C24 15.91 24 12 24 12s0-3.91-.5-5.81zM9.75 15.5V8.5l6.5 3.5-6.5 3.5z"/></svg>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-orbitron font-black text-xs text-white tracking-widest group-hover:text-red-400 transition-colors">VICE CITY HUB — YOUTUBE COMMUNITY</div>
          <p className="text-[10px] text-white/40 mt-0.5">Posts, polls, drops and drama. Join the community tab.</p>
        </div>
        <div className="font-orbitron font-black text-[9px] text-red-400/70 flex-shrink-0">JOIN ›</div>
      </a>

      {/* Twitch Community Banner */}
      <a
        href="https://www.twitch.tv/vicecityhub"
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-4 rounded-xl p-4 mb-5 transition-all duration-200 hover:-translate-y-0.5 group"
        style={{ background: 'linear-gradient(135deg, rgba(145,70,255,0.12), rgba(145,70,255,0.04))', border: '1px solid rgba(145,70,255,0.3)' }}
      >
        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden"
          style={{ background: 'rgba(145,70,255,0.2)', border: '1px solid rgba(145,70,255,0.5)' }}>
          <img src="https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/photos/Vice_City_Hub.jpg" alt="VCH" className="w-full h-full object-cover" onError={e=>{(e.target as HTMLImageElement).style.display='none';}}/>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-orbitron font-black text-xs tracking-widest group-hover:text-purple-400 transition-colors" style={{color:'#9146FF'}}>VICE CITY HUB — TWITCH</div>
          <p className="text-[10px] text-white/40 mt-0.5">Live streams, watch parties and GTA VI launch coverage. Follow to get notified.</p>
        </div>
        <div className="font-orbitron font-black text-[9px] flex-shrink-0" style={{color:'#9146FF'}}>FOLLOW ›</div>
      </a>

      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setActiveSubhub(null)}
          className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all ${
            activeSubhub === null
              ? 'bg-neonCyan/10 text-neonCyan border-neonCyan/40'
              : 'text-gray-400 border-white/10 hover:border-white/30'
          }`}
        >
          All
        </button>
        {subhubs.map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSubhub(s.slug)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border transition-all ${
              activeSubhub === s.slug
                ? 'bg-neonCyan/10 text-neonCyan border-neonCyan/40'
                : 'text-gray-400 border-white/10 hover:border-white/30'
            }`}
          >
            {s.icon} r/{s.slug}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mb-6 border-b border-white/5 pb-4">
        {([
          ['hot', 'Hot', <Flame size={13} key="i" />],
          ['new', 'New', <Clock size={13} key="i" />],
          ['top', 'Top', <TrendingUp size={13} key="i" />],
        ] as [SortMode, string, React.ReactNode][]).map(([mode, label, icon]) => (
          <button
            key={mode}
            onClick={() => setSortMode(mode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all ${
              sortMode === mode ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      <div className="gradient-line mb-2" />

      {loading ? (
        <div className="text-center text-gray-500 text-xs uppercase tracking-widest font-bold py-20">
          Loading the feed...
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center text-gray-500 text-xs uppercase tracking-widest font-bold py-20">
          Nothing here yet. Be the first to post.
        </div>
      ) : (
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
                  onRequireAuth={requireAuth}
                  onOpenPost={handleOpenPost}
                  onEdit={openEditComposer}
                  onDelete={handleDeletePost}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legacy Forum — migrated from the old Home page "Underground" section, still fully active */}
      <div className="gradient-line mt-4 mb-6" />

      <div className="pt-2">
        <div className="flex flex-col sm:flex-row sm:items-baseline gap-3 mb-6">
          <h2 className="font-orbitron font-extrabold text-xl tracking-widest uppercase text-white">
            The <span className="text-neonPink">Underground</span> Forum
          </h2>
          <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase sm:ml-auto">
            Long-form syndicate discussions
          </span>
          <button
            onClick={() => {
              if (!isLoggedIn) {
                requireAuth();
                return;
              }
              setEditingLegacyId(null);
              setLegacyTitle('');
              setLegacyBody('');
              setLegacyError('');
              setLegacyComposerOpen(true);
            }}
            className="btn-neon !py-1.5 !px-5 !text-[10px] font-orbitron text-neonPink border-neonPink hover:bg-neonPink hover:text-black font-extrabold tracking-widest self-start sm:self-auto"
          >
            + New Topic
          </button>
        </div>

        {legacyForumPosts.length === 0 ? (
          <div className="glass-card p-8 text-center border-white/5">
            <MessageSquare size={28} className="text-gray-600 mx-auto mb-2" />
            <div className="text-gray-400 font-bold uppercase tracking-widest text-xs">No topics yet — start one</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {legacyForumPosts.map((p) => (
              <div
                key={p.id}
                className="glass-card p-5 border-l-4 border-l-neonPink border-y-white/5 border-r-white/5 flex flex-col justify-between shadow-xl min-h-[425px] relative"
              >
                {currentUserId === p.author_id && (
                  <div className="absolute top-3 right-3 flex gap-2">
                    <button
                      onClick={() => openLegacyEditComposer(p)}
                      className="text-gray-500 hover:text-neonCyan p-1.5 rounded transition-colors"
                      title="Edit topic"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteLegacyPost(p.id)}
                      className="text-gray-500 hover:text-neonPink p-1.5 rounded transition-colors"
                      title="Delete topic"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
                <div>
                  <h4 className="font-bold text-base text-white font-orbitron leading-snug mb-2 tracking-wide">
                    {p.title}
                  </h4>
                  <div className="max-h-[265px] overflow-y-auto pr-1 custom-scrollbar">
                    <p className="text-xs text-gray-400 leading-relaxed font-bold whitespace-pre-wrap">
                      <LinkedText text={p.body} showPreview={false} />
                    </p>
                  </div>
                </div>
                <div className="flex justify-between items-center border-t border-white/5 pt-3 mt-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest font-orbitron">
                  <div>
                    Agent: <span className="text-neonCyan">{p.author_name}</span>
                  </div>
                  <span>{new Date(p.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legacy Forum composer modal */}
      {legacyComposerOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card max-w-lg w-full p-7 relative border border-neonPink shadow-[0_0_40px_rgba(255,0,128,0.2)] max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setLegacyComposerOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-neonPink transition-colors"
            >
              <X size={20} />
            </button>
            <div className="font-orbitron font-extrabold text-2xl text-neonPink mb-5 tracking-widest uppercase">
              {editingLegacyId ? 'Edit Topic' : 'New Forum Topic'}
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Topic Title</label>
                <input
                  type="text"
                  value={legacyTitle}
                  onChange={(e) => setLegacyTitle(e.target.value)}
                  maxLength={300}
                  className="w-full bg-[#050508] border border-white/10 focus:border-neonPink outline-none rounded p-3 text-sm text-white"
                  placeholder="GTA VI Map compared to Red Dead Redemption 2"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                  Discussion Body
                </label>
                <textarea
                  value={legacyBody}
                  onChange={(e) => setLegacyBody(e.target.value)}
                  rows={8}
                  maxLength={10000}
                  className="w-full bg-[#050508] border border-white/10 focus:border-neonPink outline-none rounded p-3 text-sm text-white font-mono"
                  placeholder="Stitch your evidence, coordinate maps, or share rumors..."
                />
                <span className="text-[10px] text-gray-600 self-end">{legacyBody.length}/10000</span>
              </div>
              {legacyError && <p className="text-xs text-neonPink">{legacyError}</p>}
              <button
                onClick={submitLegacyPost}
                disabled={legacySubmitting || !legacyTitle.trim() || !legacyBody.trim()}
                className="border border-neonPink text-neonPink px-4 py-2.5 rounded hover:bg-neonPink hover:text-black font-orbitron text-xs uppercase tracking-widest font-bold disabled:opacity-40 transition-all"
              >
                {legacySubmitting ? 'Saving...' : editingLegacyId ? 'Save Changes' : 'Publish Topic'}
              </button>
            </div>
          </div>
        </div>
      )}

      {composerOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card max-w-lg w-full p-7 relative border border-neonCyan shadow-[0_0_40px_rgba(0,255,255,0.2)] max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setComposerOpen(false)}
              className="absolute top-4 right-4 text-gray-500 hover:text-neonPink transition-colors"
            >
              <X size={20} />
            </button>
            <div className="font-orbitron font-extrabold text-2xl text-neonCyan neon-text-cyan mb-5 tracking-widest uppercase">
              {editingPostId ? 'Edit Post' : 'New Post'}
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Subhub</label>
                <select
                  value={newSubhubId ?? ''}
                  onChange={(e) => setNewSubhubId(Number(e.target.value))}
                  className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white"
                >
                  {subhubs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.icon ? `${s.icon} ` : ''}#{s.slug}{s.title !== s.slug ? ` — ${s.title}` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  maxLength={300}
                  className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white"
                  placeholder="Found something weird in the latest leak..."
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                  Body (optional)
                </label>
                <textarea
                  value={newBody}
                  onChange={(e) => setNewBody(e.target.value)}
                  rows={5}
                  maxLength={10000}
                  className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white"
                  placeholder="Lay out the details..."
                />
                <span className="text-[10px] text-gray-600 self-end">{newBody.length}/10000</span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                  Screenshot or clip (optional)
                </label>

                {existingMediaUrl && !removeMedia && !mediaFile && (
                  <div className="relative rounded overflow-hidden border border-white/10 mb-1">
                    {isExistingMediaVideo ? (
                      <video src={existingMediaUrl} className="w-full max-h-48" controls />
                    ) : (
                      <img src={existingMediaUrl} alt="" className="w-full max-h-48 object-cover" />
                    )}
                    <button
                      onClick={() => setRemoveMedia(true)}
                      className="absolute top-2 right-2 bg-black/70 text-neonPink rounded p-1.5 hover:bg-black"
                      type="button"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}

                {mediaFile && (
                  <p className="text-[10px] text-gray-400">Selected: {mediaFile.name}</p>
                )}

                <label className="flex items-center gap-2 border border-dashed border-white/15 rounded p-3 text-xs text-gray-400 hover:border-neonCyan cursor-pointer transition-colors">
                  <Upload size={14} />
                  {mediaFile || existingMediaUrl ? 'Replace file' : 'Upload image or video'}
                  <input
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => {
                      setMediaFile(e.target.files?.[0] || null);
                      setRemoveMedia(false);
                    }}
                  />
                </label>
              </div>

              {composerError && <p className="text-xs text-neonPink">{composerError}</p>}

              <button
                onClick={submitPost}
                disabled={submitting || !newTitle.trim()}
                className="btn-neon font-orbitron text-xs mt-2 uppercase disabled:opacity-40"
              >
                {submitting ? 'Saving...' : editingPostId ? 'Save Changes' : 'Publish Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
