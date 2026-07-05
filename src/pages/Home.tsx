import React, { useState, useEffect, useRef } from 'react';
import { supa } from '../lib/SupabaseClient';
import { Play, Flame, ExternalLink, Calendar, MapPin, MessageSquare, ChevronLeft, ChevronRight, Pencil, Trash2, Plus, X } from 'lucide-react';
import YouTubePlayer from '../components/YouTubePlayer';

interface HomeProps {
  onOpenModal: (id: string, tab?: 'login' | 'register') => void;
  session: any;
}

export default function Home({ onOpenModal, session }: HomeProps) {
  // Countdown State
  const [timeLeft, setTimeLeft] = useState({ days: '000', hours: '00', minutes: '00', seconds: '00' });

  // Media Tab State
  const [activeMediaTab, setActiveMediaTab] = useState<'trailer' | 'streamer' | 'podcast' | 'reel'>('trailer');

  // Media Cards (dynamic from DB)
  interface MediaCard {
    id: number;
    author_id: string | null;
    type: 'trailer' | 'podcast' | 'streamer' | 'reel';
    title: string;
    description: string | null;
    youtube_id: string | null;
    thumbnail_url: string | null;
    external_url: string | null;
    twitch_url: string | null;
    is_pinned: boolean;
    created_at: string;
  }
  const [mediaCards, setMediaCards] = useState<MediaCard[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);

  // Media CRUD state
  const [mediaComposerOpen, setMediaComposerOpen] = useState(false);
  const [editingMediaId, setEditingMediaId] = useState<number | null>(null);
  const [mediaForm, setMediaForm] = useState({ title: '', description: '', youtube_id: '', external_url: '' });
  const [mediaError, setMediaError] = useState('');
  const [mediaSaving, setMediaSaving] = useState(false);

  const isLoggedIn = !!session?.user;
  const currentUserId = session?.user?.id || null;

  const fetchMediaCards = async () => {
    setMediaLoading(true);
    const { data } = await supa
      .from('media_cards')
      .select('*')
      .order('sort_order', { ascending: true, nullsFirst: false })
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: true });
    if (data) setMediaCards(data as MediaCard[]);
    setMediaLoading(false);
  };

  useEffect(() => {
    fetchMediaCards();
  }, []);

  const openMediaComposer = (card?: MediaCard) => {
    if (card) {
      setEditingMediaId(card.id);
      setMediaForm({
        title: card.title,
        description: card.description || '',
        youtube_id: card.youtube_id || '',
        external_url: card.external_url || '',
      });
    } else {
      setEditingMediaId(null);
      setMediaForm({ title: '', description: '', youtube_id: '', external_url: '' });
    }
    setMediaError('');
    setMediaComposerOpen(true);
  };

  const saveMediaCard = async () => {
    if (!mediaForm.title.trim()) {
      setMediaError('Title is required.');
      return;
    }
    setMediaSaving(true);
    setMediaError('');

    const payload = {
      title: mediaForm.title.trim(),
      description: mediaForm.description.trim() || null,
      youtube_id: mediaForm.youtube_id.trim() || null,
      external_url: mediaForm.external_url.trim() || null,
      type: activeMediaTab,
    };

    const { error } = editingMediaId
      ? await supa.from('media_cards').update(payload).eq('id', editingMediaId)
      : await supa.from('media_cards').insert({ ...payload, author_id: session.user.id });

    setMediaSaving(false);
    if (error) {
      setMediaError(error.message);
    } else {
      setMediaComposerOpen(false);
      fetchMediaCards();
    }
  };

  const deleteMediaCard = async (id: number) => {
    if (!window.confirm('Delete this card? This cannot be undone.')) return;
    await supa.from('media_cards').delete().eq('id', id);
    setMediaCards(prev => prev.filter(c => c.id !== id));
  };

  // Map Comments State
  const [mapComments, setMapComments] = useState<{ [key: string]: any[] }>({ map1: [], map2: [] });
  const [newCommentText, setNewCommentText] = useState<{ [key: string]: string }>({ map1: '', map2: '' });

  // Countdown timer logic
  useEffect(() => {
    const targetDate = new Date('2026-11-19T00:00:00Z').getTime();

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = targetDate - now;

      if (distance < 0) {
        clearInterval(interval);
        return;
      }

      const d = Math.floor(distance / (1000 * 60 * 60 * 24));
      const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((distance % (1000 * 60)) / 1000);

      setTimeLeft({
        days: String(d).padStart(3, '0'),
        hours: String(h).padStart(2, '0'),
        minutes: String(m).padStart(2, '0'),
        seconds: String(s).padStart(2, '0')
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Fetch Map Comments
  const fetchData = async () => {
    try {
      // Map Comments
      const { data: commentsData } = await supa
        .from('map_comments')
        .select('*')
        .order('created_at', { ascending: false });

      const commentsMap: { [key: string]: any[] } = { map1: [], map2: [] };
      if (commentsData) {
        commentsData.forEach((c: any) => {
          if (!commentsMap[c.map_id]) commentsMap[c.map_id] = [];
          commentsMap[c.map_id].push(c);
        });
      }
      setMapComments(commentsMap);
    } catch (e) { }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Submit Map Comment
  const handleMapCommentSubmit = async (mapId: string) => {
    if (!session?.user) {
      onOpenModal('auth', 'login');
      return;
    }

    const text = newCommentText[mapId]?.trim();
    if (!text) return;

    try {
      const { error } = await supa.from('map_comments').insert({
        map_id: mapId,
        body: text,
        author_id: session.user.id,
        author_name: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'Anon'
      });

      if (!error) {
        setNewCommentText(prev => ({ ...prev, [mapId]: '' }));
        fetchData();
      }
    } catch (e) { }
  };

  const mediaScrollRef = useRef<HTMLDivElement>(null);
  const [mediaScrollPaused, setMediaScrollPaused] = useState(false);

  useEffect(() => {
    const container = mediaScrollRef.current;
    if (!container || mediaScrollPaused) return;
    const interval = setInterval(() => {
      if (!container) return;
      const cardWidth = 360 + 24; // w-[360px] + gap-6
      const atEnd = container.scrollLeft + container.clientWidth >= container.scrollWidth - 10;
      container.scrollTo({
        left: atEnd ? 0 : container.scrollLeft + cardWidth,
        behavior: 'smooth',
      });
    }, 10000);
    return () => clearInterval(interval);
  }, [activeMediaTab, mediaCards, mediaScrollPaused]);

  return (
    <div className="w-full">
      {/* HERO SECTION */}
      <header className="flex flex-col items-center justify-center text-center px-6 pt-1 pb-10 lg:pt-2 lg:pb-12 relative overflow-hidden bg-radial-hero">
        <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_80%_50%_at_50%_85%,rgba(255,0,255,0.12)_0%,transparent_60%)]" />

        <div className="relative z-10 flex flex-col items-center max-w-4xl">
          <div className="font-orbitron text-[10px] sm:text-xs font-bold tracking-[0.3em] text-neonCyan uppercase border border-neonCyan/40 px-6 py-1 rounded-full bg-neonCyan/5 shadow-[0_0_15px_rgba(0,255,255,0.15)] mb-2 lg:mb-3">
            Vice City Hub &mdash; GTA VI Official Fan Community
          </div>

          <h1 className="font-orbitron font-black text-5xl sm:text-7xl md:text-8xl lg:text-9xl xl:text-[11rem] leading-[0.85] uppercase tracking-tighter bg-gradient-to-br from-white via-neonPink to-neonOrange bg-clip-text text-transparent filter drop-shadow-2xl">
            GTA VI
          </h1>

          <div className="font-orbitron text-lg sm:text-2xl font-bold tracking-[0.15em] text-neonCyan mt-2 lg:mt-3 uppercase">
            Lucia Caminos &amp; Jason Duval
          </div>

          <p className="text-sm sm:text-base text-gray-400 font-bold max-w-xl mx-auto mt-3 lg:mt-4 leading-relaxed">
            The definitive hub for everything Grand Theft Auto VI. Real news, interactive cartography, syndicate forum posts, Web3 domain listings, and live investor analytics. Zero fluff.
          </p>

          {/* COUNTDOWN TIMER */}
          <div className="countdown mt-6 lg:mt-7" id="countdown">
            <div className="cd-unit">
              <div className="cd-num">{timeLeft.days}</div>
              <div className="cd-lbl">Days</div>
            </div>
            <div className="cd-unit">
              <div className="cd-num">{timeLeft.hours}</div>
              <div className="cd-lbl">Hours</div>
            </div>
            <div className="cd-unit">
              <div className="cd-num">{timeLeft.minutes}</div>
              <div className="cd-lbl">Mins</div>
            </div>
            <div className="cd-unit">
              <div className="cd-num">{timeLeft.seconds}</div>
              <div className="cd-lbl">Secs</div>
            </div>
          </div>

          {/* CALL TO ACTIONS */}
          <div className="flex flex-wrap gap-4 justify-center mt-5 lg:mt-6">
            <button onClick={() => onOpenModal('sitemap')} className="btn-neon font-orbitron text-xs">
              Explore Hub
            </button>
            <button onClick={() => onOpenModal('auth', 'register')} className="btn-neon btn-neon-cyan font-orbitron text-xs">
              Become a Member
            </button>
          </div>
        </div>
      </header>

      <div className="gradient-line" />

      {/* PRE-ORDER BANNER */}
      <section className="py-4 px-6 max-w-[1280px] mx-auto">
        {/* Desktop: flex-row | Mobile: flex-col */}
        <div className="flex flex-col sm:flex-row rounded-xl overflow-hidden border border-neonOrange/50 shadow-[0_0_40px_rgba(255,107,53,0.2)] bg-black">
          {/* Text side */}
          <div className="flex-shrink-0 sm:w-72 flex flex-col justify-center px-6 py-6 bg-black"
            style={{borderBottom: '1px solid rgba(255,107,53,0.2)'}}>
            <p className="text-[9px] font-orbitron font-bold text-neonOrange uppercase tracking-[0.25em] mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-neonOrange inline-block animate-pulse" />
              PRE-ORDERS LIVE NOW
            </p>
            <h2 className="font-orbitron font-extrabold text-xl sm:text-2xl text-white uppercase leading-tight mb-3">
              Grand Theft<br />
              Auto <span className="text-neonOrange">VI</span>
            </h2>
            <p className="text-[10px] text-white/50 leading-relaxed mb-4">
              Pre-orders for Grand Theft Auto VI are now live. Learn more about the Ultimate Edition and pre-order bonuses at Rockstar Games.
            </p>
            <a
              href="https://www.rockstargames.com/VI"
              target="_blank"
              rel="noreferrer"
              className="font-orbitron text-xs w-fit px-4 py-2 rounded transition-all duration-200"
              style={{
                border: '1px solid var(--neon-orange)',
                color: 'var(--neon-orange)',
                background: 'transparent',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'var(--neon-orange)';
                (e.currentTarget as HTMLAnchorElement).style.color = '#000';
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 0 20px var(--neon-orange)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLAnchorElement).style.background = 'transparent';
                (e.currentTarget as HTMLAnchorElement).style.color = 'var(--neon-orange)';
                (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'none';
              }}
            >
              PRE-ORDER NOW →
            </a>
          </div>
          {/* GIF side — оригинальные пропорции, без растяжения */}
          <div className="flex-1 bg-black flex items-center justify-center p-0" style={{minHeight: '180px'}}>
            <img
              src="https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/promos/promo2.gif"
              alt="GTA VI Pre-orders are live"
              className="block"
              style={{width: '100%', height: '100%', objectFit: 'contain', maxHeight: '320px'}}
            />
          </div>
        </div>
      </section>

      <div className="gradient-line" />

      {/* COMMUNITY MEDIA SECTION — dynamic from media_cards table */}
      <section className="py-6 lg:py-8 px-6 max-w-[1280px] mx-auto">
        <div className="flex items-center gap-3 border-b border-white/5 pb-3 mb-5 lg:mb-6">
          <span className="font-orbitron text-xs text-neonPink font-extrabold tracking-widest">02</span>
          <h2 className="font-orbitron font-extrabold text-3xl tracking-widest uppercase">
            Community <span className="text-neonCyan">Media</span>
          </h2>
          <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase ml-auto hidden sm:inline">
            Trailers &amp; Creators
          </span>
          {isLoggedIn && (
            <button
              onClick={() => openMediaComposer()}
              className="flex items-center gap-1.5 border border-neonCyan/30 text-neonCyan px-3 py-1.5 rounded hover:bg-neonCyan hover:text-black font-orbitron text-[10px] font-bold uppercase transition-all"
            >
              <Plus size={12} /> Submit
            </button>
          )}
        </div>

        {/* Media Tabs */}
        <div className="flex gap-4 border-b border-white/5 mb-5 overflow-x-auto pb-1 text-xs uppercase tracking-widest font-bold font-orbitron">
          {(['trailer', 'podcast', 'streamer', 'reel'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveMediaTab(tab)}
              className={`pb-3 pr-4 transition-all capitalize ${activeMediaTab === tab ? 'text-neonCyan border-b-2 border-neonCyan neon-text-cyan' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {tab === 'trailer' ? 'Trailers' : tab === 'podcast' ? 'Podcasts' : tab === 'streamer' ? 'Streamers' : 'Fan Videos'}
            </button>
          ))}
        </div>

        {/* Cards — horizontal carousel with auto-scroll */}
        {mediaLoading ? (
          <div className="text-center text-gray-500 text-xs uppercase tracking-widest font-bold py-12">
            Loading...
          </div>
        ) : (
          <div className="relative w-full">
            {/* Left arrow */}
            <button
              onClick={() => {
                const el = mediaScrollRef.current;
                if (el) el.scrollBy({ left: -(360 + 24), behavior: 'smooth' });
              }}
              className="absolute left-[-22px] top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full border border-neonCyan bg-[#0c0c1c]/90 text-neonCyan flex items-center justify-center hover:bg-neonCyan hover:text-black hover:scale-105 hover:shadow-[0_0_20px_rgba(0,255,255,0.4)] transition-all"
            >
              <ChevronLeft size={20} />
            </button>

            <div
              ref={mediaScrollRef}
              onMouseEnter={() => setMediaScrollPaused(true)}
              onMouseLeave={() => setMediaScrollPaused(false)}
              className="flex gap-6 overflow-x-auto w-full py-2 scroll-smooth no-scrollbar snap-x snap-mandatory"
            >
              {mediaCards.filter(c => c.type === activeMediaTab).map(card => (
                <div
                  key={card.id}
                  className="snap-start [scroll-snap-stop:always] flex-shrink-0 w-[calc(100vw-48px)] sm:w-[360px] glass-card overflow-hidden group flex flex-col justify-between relative"
                >
                  {/* Owner controls */}
                  {currentUserId && currentUserId === card.author_id && (
                    <div className="absolute top-2 right-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openMediaComposer(card)} className="bg-black/70 text-gray-300 hover:text-neonCyan p-1.5 rounded transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => deleteMediaCard(card.id)} className="bg-black/70 text-gray-300 hover:text-neonPink p-1.5 rounded transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}

                  {/* Streamer card */}
                  {activeMediaTab === 'streamer' ? (
                    <>
                      <div className="relative w-full aspect-video bg-gradient-to-br from-[#0a0a18] via-[#0d0d1f] to-[#1a0a2e] flex flex-col items-center justify-center gap-3 p-6">
                        {card.thumbnail_url ? (
                          <img
                            src={card.thumbnail_url}
                            alt={card.title}
                            className="w-20 h-20 rounded-full object-cover border-2 border-neonCyan shadow-[0_0_20px_rgba(0,255,255,0.3)]"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-neonCyan/20 to-neonPink/20 border-2 border-neonCyan/40 flex items-center justify-center">
                            <span className="font-orbitron font-bold text-xl text-neonCyan">
                              {card.title.slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-neonCyan animate-pulse" />
                          <span className="text-[10px] text-neonCyan font-bold uppercase tracking-widest font-orbitron">Content Creator</span>
                        </div>
                      </div>
                      <div className="p-4 flex-grow flex flex-col justify-between gap-3">
                        <div>
                          <h3 className="font-bold font-orbitron text-base text-white tracking-wide">{card.title}</h3>
                          {card.description && (
                            <p className="text-xs text-gray-400 mt-1 leading-relaxed line-clamp-3">{card.description}</p>
                          )}
                        </div>
                        {/* Two full-width buttons: YouTube + Twitch */}
                        <div className="flex flex-col gap-2 mt-auto">
                          {card.external_url && (
                            <a
                              href={card.external_url}
                              target="_blank" rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="w-full text-center border border-neonCyan/30 text-neonCyan text-[10px] uppercase font-bold tracking-wider px-3 py-2 rounded hover:bg-neonCyan hover:text-black transition-all flex items-center justify-center gap-1.5"
                            >
                              <ExternalLink size={11} /> YouTube ↗
                            </a>
                          )}
                          {card.twitch_url && (
                            <a
                              href={card.twitch_url}
                              target="_blank" rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="w-full text-center border border-[#9146FF]/30 text-[#9146FF] text-[10px] uppercase font-bold tracking-wider px-3 py-2 rounded hover:bg-[#9146FF] hover:text-white transition-all flex items-center justify-center gap-1.5"
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/></svg>
                              Twitch ↗
                            </a>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Standard card — trailers, podcasts, reels */
                    <>
                      {card.youtube_id ? (
                        <YouTubePlayer videoId={card.youtube_id} title={card.title} />
                      ) : card.thumbnail_url ? (
                        <div className="aspect-video w-full overflow-hidden bg-black/30">
                          <img src={card.thumbnail_url} alt={card.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        </div>
                      ) : (
                        <div className="aspect-video w-full bg-gradient-to-tr from-[#0a0a18] to-[#1a0a2e] flex items-center justify-center">
                          <Play size={40} className="text-neonCyan opacity-40" />
                        </div>
                      )}
                      <div className="p-4 flex-grow flex flex-col justify-between gap-3">
                        <div>
                          <h3 className="font-bold font-orbitron text-base text-white tracking-wide">{card.title}</h3>
                          {card.description && (
                            <p className="text-xs text-gray-400 mt-1 leading-relaxed line-clamp-3">{card.description}</p>
                          )}
                        </div>
                        {card.external_url && (
                          <a
                            href={card.external_url}
                            target="_blank" rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="w-full text-center border border-neonCyan/30 text-neonCyan text-[10px] uppercase font-bold tracking-wider px-3 py-2 rounded hover:bg-neonCyan hover:text-black transition-all flex items-center justify-center gap-1.5 mt-auto"
                          >
                            <ExternalLink size={11} /> YouTube ↗
                          </a>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}

              {mediaCards.filter(c => c.type === activeMediaTab).length === 0 && (
                <div className="text-gray-500 text-xs uppercase tracking-widest font-bold py-12 text-center w-full">
                  {isLoggedIn ? 'No cards yet — submit the first one.' : 'Nothing here yet.'}
                </div>
              )}
            </div>

            {/* Right arrow */}
            <button
              onClick={() => {
                const el = mediaScrollRef.current;
                if (el) el.scrollBy({ left: 360 + 24, behavior: 'smooth' });
              }}
              className="absolute right-[-22px] top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full border border-neonCyan bg-[#0c0c1c]/90 text-neonCyan flex items-center justify-center hover:bg-neonCyan hover:text-black hover:scale-105 hover:shadow-[0_0_20px_rgba(0,255,255,0.4)] transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}

        {/* Add/Edit card modal */}
        {mediaComposerOpen && (
          <div className="fixed inset-0 z-[1000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="glass-card max-w-lg w-full p-7 relative border border-neonCyan shadow-[0_0_40px_rgba(0,255,255,0.2)] max-h-[90vh] overflow-y-auto">
              <button onClick={() => setMediaComposerOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white">
                <X size={20} />
              </button>
              <h2 className="font-orbitron font-extrabold text-xl text-neonCyan uppercase tracking-wider mb-2">
                {editingMediaId ? 'Edit Submission' : `Submit ${activeMediaTab}`}
              </h2>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-6">
                {editingMediaId
                  ? 'Your pending submission will be updated.'
                  : 'Submissions are reviewed before appearing on the site.'}
              </p>

              <div className="flex flex-col gap-4">
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold block mb-1.5">Title *</label>
                  <input
                    type="text"
                    value={mediaForm.title}
                    onChange={e => setMediaForm(p => ({ ...p, title: e.target.value }))}
                    maxLength={120}
                    className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white"
                    placeholder="GTA VI — Official Trailer 4"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold block mb-1.5">Description</label>
                  <textarea
                    value={mediaForm.description}
                    onChange={e => setMediaForm(p => ({ ...p, description: e.target.value }))}
                    rows={2}
                    maxLength={500}
                    className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white"
                    placeholder="Short description..."
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold block mb-1.5">YouTube Video ID</label>
                  <input
                    type="text"
                    value={mediaForm.youtube_id}
                    onChange={e => setMediaForm(p => ({ ...p, youtube_id: e.target.value }))}
                    className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white"
                    placeholder="e.g. EiQEBYDox_k  (from youtu.be/EiQEBYDox_k)"
                  />
                  <p className="text-[10px] text-gray-600 mt-1">Paste the part after youtu.be/ or watch?v=</p>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold block mb-1.5">External Link (optional)</label>
                  <input
                    type="text"
                    value={mediaForm.external_url}
                    onChange={e => setMediaForm(p => ({ ...p, external_url: e.target.value }))}
                    className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white"
                    placeholder="https://..."
                  />
                </div>
                {mediaError && <p className="text-xs text-neonPink">{mediaError}</p>}
                <div className="flex gap-3 mt-2">
                  <button
                    onClick={saveMediaCard}
                    disabled={mediaSaving || !mediaForm.title.trim()}
                    className="border border-neonCyan/30 text-neonCyan px-5 py-2 rounded hover:bg-neonCyan hover:text-black font-orbitron text-xs disabled:opacity-40 transition-all"
                  >
                    {mediaSaving ? 'Submitting...' : editingMediaId ? 'Save Changes' : 'Submit for Review'}
                  </button>
                  <button
                    onClick={() => setMediaComposerOpen(false)}
                    className="border border-white/15 text-gray-400 px-5 py-2 rounded hover:bg-white/5 font-orbitron text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
      <div className="gradient-line" />

      {/* IN DEPTH ARTICLES SECTION */}
      <section className="py-20 px-6 max-w-[1280px] mx-auto">
        <div className="flex items-baseline gap-3 border-b border-white/5 pb-5 mb-12">
          <span className="font-orbitron text-xs text-neonPink font-extrabold tracking-widest">03</span>
          <h2 className="font-orbitron font-extrabold text-3xl tracking-widest uppercase">
            In <span className="text-neonCyan">Depth</span>
          </h2>
          <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase ml-auto">
            Analysis &amp; Features
          </span>
        </div>

        <div className="flex flex-col gap-12">
          {/* Article 1: Leonida State Map */}
          <article className="glass-card border border-white/5 hover:border-neonCyan transition-all duration-300 min-h-[500px] overflow-hidden flex flex-col md:flex-row relative">
            <div className="w-full md:w-1/2 min-h-[300px] md:min-h-full relative overflow-hidden order-1 md:order-2">
              <img src="https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/photos/Lucia_Caminos.jpg" alt="Lucia Caminos in Vice City" className="w-full h-full object-cover object-center absolute inset-0 hover:scale-105 transition-transform duration-700 scroll-dynamic-img" />
              <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#0a0a0f] via-[#0a0a0f]/80 to-transparent" />
            </div>
            <div className="w-full md:w-1/2 p-8 lg:p-12 z-10 relative flex flex-col justify-between order-2 md:order-1">
              <div>
                <div className="flex gap-3 items-center mb-6">
                  <span className="border border-neonPink text-neonPink text-[9px] font-bold tracking-widest px-2.5 py-1 uppercase rounded">World Building</span>
                  <span className="text-[10px] text-gray-500 font-bold tracking-wider uppercase">5 Min Read</span>
                </div>
                <h3 className="font-orbitron font-bold text-3xl text-white tracking-wide leading-snug mb-6">
                  Leonida State: How Big Is the GTA VI Map?
                </h3>
                <div className="text-sm text-gray-300 leading-relaxed space-y-4 font-semibold">
                  <p>When Rockstar Games unveiled the state of <strong>Leonida</strong> in GTA VI's first trailer, the gaming world immediately began measuring every frame. Speculative mapping projects based on leaked development materials and South Florida satellite telemetry indicate an open world size that dwarfs any previous Rockstar creation.</p>
                  <p>The map is anchored by the neon-drenched metropolis of Vice City, featuring bustling high-density downtown blocks, beach strips, and marina clubs. However, the playable environment extends deep into wild marshlands, offshore island keys, industrial docks, and dense coastal highways.</p>
                  <p>Triangulations suggest an active, traversable canvas spanning over 150 square kilometers, utilizing modern loading pipelines to make almost every residential and commercial interior fully accessible.</p>
                </div>
              </div>
              <div className="flex justify-between items-center border-t border-white/5 pt-6 mt-8">
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Source: Rockstar Games / Speculative Mapping Syndicate</span>
                <a href="https://www.rockstargames.com/VI" target="_blank" rel="noopener noreferrer" className="text-neonCyan hover:underline text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 font-orbitron">Read Source <ExternalLink size={12} /></a>
              </div>
            </div>
          </article>

          {/* Article 2: Dual Protagonists Story */}
          <article className="glass-card border border-white/5 hover:border-neonCyan transition-all duration-300 min-h-[500px] overflow-hidden flex flex-col md:flex-row relative">
            <div className="w-full md:w-1/2 min-h-[300px] md:min-h-full relative overflow-hidden">
              <img src="https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/photos/Jason.jpg" alt="Jason Duval in GTA VI" className="w-full h-full object-cover object-center absolute inset-0 hover:scale-105 transition-transform duration-700 scroll-dynamic-img" />
              <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-l from-[#0a0a0f] via-[#0a0a0f]/80 to-transparent" />
            </div>
            <div className="w-full md:w-1/2 p-8 lg:p-12 z-10 relative flex flex-col justify-between">
              <div>
                <div className="flex gap-3 items-center mb-6">
                  <span className="border border-neonCyan text-neonCyan text-[9px] font-bold tracking-widest px-2.5 py-1 uppercase rounded">Characters</span>
                  <span className="text-[10px] text-gray-500 font-bold tracking-wider uppercase">4 Min Read</span>
                </div>
                <h3 className="font-orbitron font-bold text-3xl text-white tracking-wide leading-snug mb-6">
                  Lucia &amp; Jason: The Narrative Behind GTA VI's Dual Protagonists
                </h3>
                <div className="text-sm text-gray-300 leading-relaxed space-y-4 font-semibold">
                  <p><strong>Lucia Caminos</strong> — the Grand Theft Auto series' first true female protagonist in the HD universe — and her accomplice <strong>Jason Duval</strong> represent Rockstar's most intimate storytelling effort to date.</p>
                  <p>Anchored in a high-stakes, Bonnie-and-Clyde style relationship, the dual protagonist system allows players to experience the criminal syndicate from two distinct perspectives. Rather than the separate, sprawling stories of GTA V, Lucia and Jason's narrative is deeply interconnected, testing their loyalty, trust, and resolve against the corporate and street-level syndicates of Leonida.</p>
                  <p>Development analysis confirms players will be able to swap between both characters dynamically during open-world roaming, with co-op tactical commands available during heist setups.</p>
                </div>
              </div>
              <div className="flex justify-between items-center border-t border-white/5 pt-6 mt-8">
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Source: Rockstar Games Syndicate</span>
                <a href="https://www.rockstargames.com/VI" target="_blank" rel="noopener noreferrer" className="text-neonCyan hover:underline text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 font-orbitron">Read Source <ExternalLink size={12} /></a>
              </div>
            </div>
          </article>

          {/* Article 3: TTWO Investor Forecast */}
          <article className="glass-card border border-white/5 hover:border-neonCyan transition-all duration-300 min-h-[500px] overflow-hidden flex flex-col md:flex-row relative">
            <div className="w-full md:w-1/2 min-h-[300px] md:min-h-full relative overflow-hidden order-1 md:order-2">
              <img src="https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/photos/Vice_City_Club.jpg" alt="Vice City Club Take-Two Interactive" className="w-full h-full object-cover object-center absolute inset-0 hover:scale-105 transition-transform duration-700 scroll-dynamic-img" />
              <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#0a0a0f] via-[#0a0a0f]/80 to-transparent" />
            </div>
            <div className="w-full md:w-1/2 p-8 lg:p-12 z-10 relative flex flex-col justify-between order-2 md:order-1">
              <div>
                <div className="flex gap-3 items-center mb-6">
                  <span className="border border-neonOrange text-neonOrange text-[9px] font-bold tracking-widest px-2.5 py-1 uppercase rounded">Investor Analysis</span>
                  <span className="text-[10px] text-gray-500 font-bold tracking-wider uppercase">6 Min Read</span>
                </div>
                <h3 className="font-orbitron font-bold text-3xl text-white tracking-wide leading-snug mb-6">
                  Take-Two's $8B+ Revenue Forecast and What GTA VI Means for TTWO
                </h3>
                <div className="text-sm text-gray-300 leading-relaxed space-y-4 font-semibold">
                  <p>Take-Two Interactive's fiscal future is intrinsically tied to the launch pipeline of Grand Theft Auto VI. With an estimated development and marketing budget exceeding $1.5 billion, the stakes have never been higher for the gaming industry giant.</p>
                  <p>Analyst forecasts project that the initial 12 months of GTA VI's launch could push Take-Two's net bookings past the historic $8 billion mark, driving significant share price valuation shifts for NASDAQ:TTWO. Reinvestments into standard GTA Online engine expansions will establish a multi-decade recurring income stream.</p>
                  <p className="text-xs text-gray-500 italic uppercase">
                    Disclaimer: This article is for fan research purposes only and does not constitute official investment advice.
                  </p>
                </div>
              </div>
              <div className="flex justify-between items-center border-t border-white/5 pt-6 mt-8">
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Source: Take-Two Interactive IR Operations</span>
                <a href="https://ir.take2games.com" target="_blank" rel="noopener noreferrer" className="text-neonCyan hover:underline text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 font-orbitron">Read Source <ExternalLink size={12} /></a>
              </div>
            </div>
          </article>
        </div>
      </section>

      <div className="gradient-line" />

      {/* MAPPING SPECULATIVE CARTOGRAPHY SECTION */}
      <section className="py-20 px-6 max-w-[1280px] mx-auto" id="mapping">
        <div className="flex items-baseline gap-3 border-b border-white/5 pb-5 mb-10">
          <span className="font-orbitron text-xs text-neonPink font-extrabold tracking-widest">04</span>
          <h2 className="font-orbitron font-extrabold text-3xl tracking-widest uppercase">
            Mapping <span className="text-neonCyan">Project</span>
          </h2>
          <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase ml-auto">
            Leonida speculate cartography
          </span>
        </div>

        <p className="text-xs sm:text-sm text-gray-400 font-bold leading-relaxed max-w-2xl mb-8">
          Stitched speculated mapping overlays created by the GTA cartography mapping Discord, derived directly from 2022 raw development leak coordinates, trailer frames, and South Florida geographical topology.
        </p>

        <div className="flex flex-col gap-10">
          {/* Map Item 1 */}
          <div className="glass-card overflow-hidden border border-white/5 hover:border-neonCyan shadow-2xl flex flex-col">
            <div className="w-full h-[550px] relative overflow-hidden bg-black/80">
              <iframe
                src="https://map.stateofleonida.net/?lang=en"
                title="Interactive Speculative Leonida Map"
                className="w-full h-full border-none"
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
              />
            </div>
            <div className="p-8 flex flex-col justify-between flex-grow">
              <div>
                <h3 className="font-bold text-2xl text-white font-orbitron tracking-wide mb-3">State of Leonida — Speculative Interactive Map</h3>
                <p className="text-xs text-gray-400 leading-relaxed font-bold max-w-4xl">
                  Built dynamically by the GTA Speculative Mapping Syndicate, this frame holds over 120 pins representing locations found in both official trailers, Port Gellhorn coordinates, smuggling airstrips, and residential keys.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-between border-t border-white/5 pt-6 mt-6 gap-4">
                <a href="https://map.stateofleonida.net/?lang=en" target="_blank" rel="noopener noreferrer" className="border border-neonCyan/30 text-neonCyan text-xs font-bold font-orbitron uppercase tracking-widest px-6 py-2.5 rounded hover:bg-neonCyan hover:text-black transition-all">Open Direct View ↗</a>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-orbitron">Updated Realtime</span>
              </div>

              {/* Map Comments Block */}
              <div className="mt-8 pt-6 border-t border-white/5">
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-extrabold font-orbitron mb-4 block">Speculate Map Intelligence Comments</span>
                <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto pr-2 no-scrollbar">
                  {mapComments.map1?.length === 0 ? (
                    <div className="text-[10px] text-gray-600 uppercase tracking-widest font-bold font-orbitron py-2">No dispatches logged on Speculate Map A.</div>
                  ) : (
                    mapComments.map1?.map((c: any) => (
                      <div key={c.id} className="bg-[#050508]/60 p-3 rounded border border-white/5 text-xs">
                        <div className="flex justify-between items-center mb-1 text-[9px] font-extrabold font-orbitron uppercase tracking-widest">
                          <span className="text-neonCyan">{c.author_name}</span>
                          <span className="text-gray-600">{new Date(c.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-gray-400 font-bold font-rajdhani">{c.body}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <input
                    type="text"
                    value={newCommentText.map1}
                    onChange={e => setNewCommentText(prev => ({ ...prev, map1: e.target.value }))}
                    placeholder={session ? "Transmit speculate intel..." : "Log in to transmit speculate intel dispatches"}
                    disabled={!session}
                    className="flex-grow bg-[#050508] border border-white/10 rounded px-4 py-2 text-xs font-bold text-white focus:border-neonCyan outline-none disabled:opacity-50"
                  />
                  <button
                    onClick={() => handleMapCommentSubmit('map1')}
                    disabled={!session || !newCommentText.map1.trim()}
                    className="btn-neon btn-neon-cyan !py-2 !px-5 !text-[10px] font-orbitron tracking-widest font-bold uppercase disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-neonCyan disabled:hover:shadow-none"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Map Item 2 */}
          <div className="glass-card overflow-hidden border border-white/5 hover:border-neonCyan shadow-2xl flex flex-col md:flex-row">
            <div className="w-full md:w-[400px] h-[350px] md:h-auto relative overflow-hidden bg-black/80 border-r border-white/5 flex-shrink-0 cursor-pointer" onClick={() => window.open('https://www.reddit.com/r/GTA6/', '_blank')}>
              <img src="https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/photos/gta_map.JPG" alt="Leonida Speculate Composite Map" className="w-full h-full object-cover object-center absolute inset-0 hover:scale-105 transition-transform duration-500 scroll-dynamic-img" />
            </div>
            <div className="p-8 flex flex-col justify-between flex-grow">
              <div>
                <span className="text-neonPink font-orbitron font-extrabold text-[10px] tracking-widest uppercase">Speculate Build · Reddit u/EliteFireBox</span>
                <h3 className="font-bold text-2xl text-white font-orbitron tracking-wide mb-3 mt-1">Leonida Composite Map — v3.2</h3>
                <p className="text-xs text-gray-400 leading-relaxed font-bold mb-6">
                  Speculative topographical map stitched from over 400 frames of Trailer 1 and Trailer 2, with detailed locations: Mount Kalaga, Ambrosia farming blocks, Hamlet district, Watson Bay, Key Lento, and Port Gellhorn county zones.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-between border-t border-white/5 pt-6 mt-6 gap-4">
                <a href="https://www.reddit.com/r/GTA6/" target="_blank" rel="noopener noreferrer" className="border border-neonPink/30 text-neonPink text-xs font-bold font-orbitron uppercase tracking-widest px-6 py-2.5 rounded hover:bg-neonPink hover:text-black transition-all">View High-Res Reddit Threads ↗</a>
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider font-orbitron">Stitched May 2025</span>
              </div>

              {/* Map Comments Block */}
              <div className="mt-8 pt-6 border-t border-white/5">
                <span className="text-[10px] text-gray-500 uppercase tracking-widest font-extrabold font-orbitron mb-4 block">Speculate Map Intelligence Comments</span>
                <div className="flex flex-col gap-3 max-h-[220px] overflow-y-auto pr-2 no-scrollbar">
                  {mapComments.map2?.length === 0 ? (
                    <div className="text-[10px] text-gray-600 uppercase tracking-widest font-bold font-orbitron py-2">No dispatches logged on Speculate Map B.</div>
                  ) : (
                    mapComments.map2?.map((c: any) => (
                      <div key={c.id} className="bg-[#050508]/60 p-3 rounded border border-white/5 text-xs">
                        <div className="flex justify-between items-center mb-1 text-[9px] font-extrabold font-orbitron uppercase tracking-widest">
                          <span className="text-neonCyan">{c.author_name}</span>
                          <span className="text-gray-600">{new Date(c.created_at).toLocaleDateString()}</span>
                        </div>
                        <p className="text-gray-400 font-bold font-rajdhani">{c.body}</p>
                      </div>
                    ))
                  )}
                </div>
                <div className="flex gap-2 mt-4">
                  <input
                    type="text"
                    value={newCommentText.map2}
                    onChange={e => setNewCommentText(prev => ({ ...prev, map2: e.target.value }))}
                    placeholder={session ? "Transmit speculate intel..." : "Log in to transmit speculate intel dispatches"}
                    disabled={!session}
                    className="flex-grow bg-[#050508] border border-white/10 rounded px-4 py-2 text-xs font-bold text-white focus:border-neonCyan outline-none disabled:opacity-50"
                  />
                  <button
                    onClick={() => handleMapCommentSubmit('map2')}
                    disabled={!session || !newCommentText.map2.trim()}
                    className="btn-neon btn-neon-cyan !py-2 !px-5 !text-[10px] font-orbitron tracking-widest font-bold uppercase disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-neonCyan disabled:hover:shadow-none"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
