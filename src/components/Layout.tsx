import React, { useState, useEffect, useRef } from 'react';
import { supa } from '../lib/SupabaseClient';
import { Volume2, VolumeX, Menu, X, Radio, Map, LogIn, User, Trash2, Edit3, Save, ExternalLink, Heart, Copy, Check, Upload } from 'lucide-react';

// Ð”Ð¸Ð½Ð°Ð¼Ð¸Ñ‡ÐµÑÐºÐ¸ Ð·Ð°Ð³Ñ€ÑƒÐ¶Ð°ÐµÑ‚ÑÑ Ð¸Ð· Supabase Storage bucket 'muz'
// Fallback Ð½Ð° 2 Ñ‚Ñ€ÐµÐºÐ° ÐµÑÐ»Ð¸ fetch Ð½Ðµ ÑƒÐ´Ð°Ð»ÑÑ
const FALLBACK_TRACKS = [
  'https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/muz/1.ogg',
  'https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/muz/2.ogg',
];
const MUZ_BUCKET_URL = 'https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/muz/';

async function loadAllTracks(): Promise<string[]> {
  try {
    const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwZ2xrZ2xoamRxbmt0eWJrc3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMTYzMjUsImV4cCI6MjA5MTU5MjMyNX0.fMZo0fjEfPSf20w-rRQh25zPj7xPVOpU6lO2lon3EEk';
    const res = await fetch(
      'https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/list/muz',
      {
        method: 'POST',
        headers: { 'apikey': ANON, 'Authorization': `Bearer ${ANON}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix: '', limit: 100, offset: 0 }),
      }
    );
    if (!res.ok) return FALLBACK_TRACKS;
    const files: Array<{name:string}> = await res.json();
    const urls = files
      .filter(f => f.name && /\.(ogg|mp3|wav|flac)$/i.test(f.name))
      .map(f => `https://lpglkglhjdqnktybksth.supabase.co/storage/v1/object/public/muz/${encodeURIComponent(f.name)}`);
    console.log(`[Audio] Loaded ${urls.length} tracks from muz bucket`);
    return urls.length > 0 ? urls : FALLBACK_TRACKS;
  } catch (e) {
    console.warn('[Audio] Bucket fetch failed, using fallback:', e);
    return FALLBACK_TRACKS;
  }
}

let AUDIO_TRACKS: string[] = FALLBACK_TRACKS;

interface LayoutProps {
  children: React.ReactNode;
  activePage: 'home' | 'news' | 'market' | 'realestate' | 'document' | 'community' | 'profile' | 'rp';
}

export default function Layout({ children, activePage }: LayoutProps) {
  // Navigation
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Crypto Address Copy Indicators (footer donation cards)
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const handleCopyAddress = (address: string, label: string) => {
    navigator.clipboard.writeText(address).then(() => {
      setCopiedAddress(label);
      setTimeout(() => setCopiedAddress(null), 2000);
    });
  };

  // Auth States
  const [session, setSession] = useState<any>(null);
  const [username, setUsername] = useState<string>('');
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register' | 'reset'>('login');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [resetSaving, setResetSaving] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [registerUser, setRegisterUser] = useState('');
  const [registerEmail, setRegisterEmail] = useState('');
  const [registerPass, setRegisterPass] = useState('');
  const [registerPassConfirm, setRegisterPassConfirm] = useState('');
  const [authError, setAuthError] = useState('');

  // Modals
  const [sitemapOpen, setSitemapOpen] = useState(false);
  const [kofiOpen, setKofiOpen] = useState(false);
  const [dashboardOpen, setDashboardOpen] = useState(false);
  const [dashTab, setDashTab] = useState<'overview' | 'myposts' | 'myprofile' | 'news' | 'forum' | 'stream' | 'podcast' | 'domain'>('overview');

  // User Stats & Posts
  const [userPosts, setUserPosts] = useState<any[]>([]);
  const [editingPostId, setEditingPostId] = useState<number | null>(null);
  const [editingPostTitle, setEditingPostTitle] = useState('');
  const [editingPostBody, setEditingPostBody] = useState('');
  const [editingPostPrice, setEditingPostPrice] = useState('');

  // Form Submissions
  const [newsTitle, setNewsTitle] = useState('');
  const [newsBody, setNewsBody] = useState('');
  const [newsTag, setNewsTag] = useState('Official');
  const [newsSrc, setNewsSrc] = useState('');
  const [newsUrl, setNewsUrl] = useState('');
  const [newsFeatured, setNewsFeatured] = useState(false);
  const [newsStars, setNewsStars] = useState(0);
  const [forumTitle, setForumTitle] = useState('');
  const [forumBody, setForumBody] = useState('');
  const [streamName, setStreamName] = useState('');
  const [streamPlat, setStreamPlat] = useState('');
  const [streamYt, setStreamYt] = useState('');
  const [streamTw, setStreamTw] = useState('');
  const [streamDesc, setStreamDesc] = useState('');
  const [podcastName, setPodcastName] = useState('');
  const [podcastUrl, setPodcastUrl] = useState('');
  const [podcastDesc, setPodcastDesc] = useState('');
  const [domainName, setDomainName] = useState('');
  const [domainPrice, setDomainPrice] = useState('');
  const [domainDesc, setDomainDesc] = useState('');

  // Player Profile (My Profile tab)
  const [playerProfile, setPlayerProfile] = useState<any>(null);
  const [profileDisplayName, setProfileDisplayName] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [profileRsc, setProfileRsc] = useState('');
  const [profilePsn, setProfilePsn] = useState('');
  const [profilePlatform, setProfilePlatform] = useState('pc');
  const [profileGangTag, setProfileGangTag] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);

  // Audio/Radio Leonida Persistent State
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Auth Session
  useEffect(() => {
    supa.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        setUsername(session.user.user_metadata?.username || session.user.email?.split('@')[0] || '');
      }
    });

    const { data: { subscription } } = supa.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (session?.user) {
        setUsername(session.user.user_metadata?.username || session.user.email?.split('@')[0] || '');
      } else {
        setUsername('');
        setUserPosts([]);
      }
      // When user clicks the password reset link in email, Supabase fires
      // this event and gives us a session â€” open the reset form immediately.
      if (event === 'PASSWORD_RECOVERY') {
        setAuthTab('reset');
        setAuthModalOpen(true);
        setNewPassword('');
        setNewPasswordConfirm('');
        setResetDone(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Listen for custom modal trigger events from child pages
  useEffect(() => {
    const handleOpenModalEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const { id, tab } = customEvent.detail || {};
      if (id === 'auth') {
        setAuthModalOpen(true);
        if (tab) setAuthTab(tab);
      } else if (id === 'sitemap') {
        setSitemapOpen(true);
      } else if (id === 'dashboard') {
        setDashboardOpen(true);
      }
    };
    window.addEventListener('vch-open-modal', handleOpenModalEvent);
    return () => window.removeEventListener('vch-open-modal', handleOpenModalEvent);
  }, []);

  // Fetch Dashboard items for logged in user
  const fetchDashboardData = async () => {
    if (!session?.user) return;
    try {
      const { data, error } = await supa
        .from('posts')
        .select('*')
        .eq('author_id', session.user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUserPosts(data || []);
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  // Fetch the logged-in user's player_profiles row (My Profile tab)
  const fetchPlayerProfile = async () => {
    if (!session?.user) return;
    try {
      const { data, error } = await supa
        .from('player_profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setPlayerProfile(data);
        setProfileDisplayName(data.display_name || '');
        setProfileBio(data.bio || '');
        setProfileRsc(data.rsc_username || '');
        setProfilePsn(data.psn_username || '');
        setProfilePlatform(data.platform || 'pc');
        setProfileGangTag(data.gang_tag || '');
      } else {
        setPlayerProfile(null);
        setProfileDisplayName(username || '');
      }
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const savePlayerProfile = async () => {
    if (!session?.user || !profileDisplayName.trim()) return;
    setProfileSaving(true);
    try {
      const payload = {
        user_id: session.user.id,
        display_name: profileDisplayName.trim(),
        bio: profileBio.trim() || null,
        rsc_username: profileRsc.trim() || null,
        psn_username: profilePsn.trim() || null,
        platform: profilePlatform,
        gang_tag: profileGangTag.trim() || null,
      };
      const { error } = await supa.from('player_profiles').upsert(payload, { onConflict: 'user_id' });
      if (error) throw error;
      showToast('Profile saved', 'success');
      fetchPlayerProfile();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setProfileSaving(false);
    }
  };

  useEffect(() => {
    if (dashboardOpen) {
      fetchDashboardData();
      fetchPlayerProfile();
    }
  }, [dashboardOpen, session]);

  // Audio setup and persistence
  // NOTE: Each page (Home / News / Market / RealEstate / Document) is a separate
  // HTML entry point, so the Layout (and this effect) remounts on every navigation.
  // To keep "Leonida FM" playing seamlessly across pages:
  //  1) Restore the saved track + playback position on every mount.
  //  2) Try to resume playback immediately on mount (works once the browser has
  //     marked this origin as "audio-allowed" for the session).
  //  3) If blocked (true first visit / no interaction yet), call audio.play()
  //     SYNCHRONOUSLY inside the very first click/tap/keypress handler â€” this is
  //     required by browser autoplay policy: play() must be called directly inside
  //     the gesture handler, not inside a .then()/async callback, or it gets blocked.
  useEffect(() => {
    // Choose a track randomly or load from localStorage
    const savedTrackIndex = localStorage.getItem('radioTrackIndex');
    let trackIndex = savedTrackIndex ? parseInt(savedTrackIndex) : Math.floor(Math.random() * AUDIO_TRACKS.length);
    if (isNaN(trackIndex) || trackIndex < 0 || trackIndex >= AUDIO_TRACKS.length) {
      trackIndex = Math.floor(Math.random() * AUDIO_TRACKS.length);
    }
    const audio = new Audio();
    // Ð—Ð°Ð³Ñ€ÑƒÐ¶Ð°ÐµÐ¼ Ð¿Ð¾Ð»Ð½Ñ‹Ð¹ ÑÐ¿Ð¸ÑÐ¾Ðº Ñ‚Ñ€ÐµÐºÐ¾Ð² Ð¸Ð· bucket, Ð—ÐÐ¢Ð•Ðœ Ð²Ñ‹Ð±Ð¸Ñ€Ð°ÐµÐ¼ Ñ€Ð°Ð½Ð´Ð¾Ð¼Ð½Ñ‹Ð¹
    loadAllTracks().then(tracks => {
      AUDIO_TRACKS = tracks;
      const newIdx = Math.floor(Math.random() * tracks.length);
      audio.src = tracks[newIdx];
      localStorage.setItem('radioTrackIndex', newIdx.toString());
      console.log(`[Audio] Full list: ${tracks.length} tracks, playing #${newIdx}`);
      // Trigger play immediately after src is set (was playing silence before)
      const sp = sessionStorage.getItem('radioPlaying');
      if (sp === null || sp === 'true') { audio.play().catch(() => {}); }
    });
    audio.preload = 'auto';
    audio.loop = false; // Disable loop so track ends and triggers 'ended' event
    audio.volume = 0.25;
    // audio.src set after loadAllTracks() resolves above
    audioRef.current = audio;

    // Load play state from sessionStorage (not localStorage): if the user
    // muted the radio, that choice should only last for the current browser
    // session â€” closing the tab/browser and coming back later should default
    // back to "playing", per product requirement. sessionStorage clears
    // automatically when the tab/browser closes, while still persisting
    // across in-site page navigations within the same session.
    const savedPlaying = sessionStorage.getItem('radioPlaying');
    const shouldPlay = savedPlaying === null || savedPlaying === 'true';

    // Restore exact playback position so the track continues where it left off.
    const savedTime = parseFloat(localStorage.getItem('radioTime') || '0');
    const restoreTime = !isNaN(savedTime) && isFinite(savedTime) && savedTime >= 0 ? savedTime : 0;
    if (restoreTime > 0) {
      const applyRestoreTime = () => {
        if (audio.duration && restoreTime < audio.duration) {
          try { audio.currentTime = restoreTime; } catch (e) { }
        }
      };
      if (audio.readyState >= 1) {
        applyRestoreTime();
      } else {
        audio.addEventListener('loadedmetadata', applyRestoreTime, { once: true });
      }
    }

    audio.load();

    const markPlaying = () => {
      setIsPlaying(true);
      sessionStorage.setItem('radioPlaying', 'true');
    };

    let resumed = false;

    // Attempt to resume immediately on mount (covers in-site navigation, where
    // the browser already treats this origin as audio-allowed for the session).
    if (shouldPlay) {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.then(() => {
          resumed = true;
          markPlaying();
        }).catch(() => {
          // Blocked by autoplay policy â€” resumed on first user interaction below.
        });
      }
    } else {
      setIsPlaying(false);
    }

    // Fallback: on the very first user interaction anywhere on the page, call
    // play() SYNCHRONOUSLY (directly inside the handler) so the browser still
    // counts it as a response to a user gesture.
    const handleFirstInteraction = () => {
      if (resumed) return;
      if (audioRef.current && shouldPlay && audioRef.current.paused) {
        const p = audioRef.current.play();
        resumed = true;
        if (p && typeof p.then === 'function') {
          p.then(markPlaying).catch(() => { resumed = false; });
        } else {
          markPlaying();
        }
      }
    };
    document.addEventListener('click', handleFirstInteraction, { capture: true });
    document.addEventListener('keydown', handleFirstInteraction, { capture: true });
    document.addEventListener('touchstart', handleFirstInteraction, { capture: true, passive: true });
    document.addEventListener('touchend', handleFirstInteraction, { capture: true });

    // Play random song when current one finishes
    const handleTrackEnded = () => {
      const randomTrackIndex = Math.floor(Math.random() * AUDIO_TRACKS.length);
      localStorage.setItem('radioTrackIndex', randomTrackIndex.toString());
      localStorage.setItem('radioTime', '0');
      if (audioRef.current) {
        audioRef.current.src = AUDIO_TRACKS[randomTrackIndex];
        audioRef.current.load();
        audioRef.current.play().then(() => {
          markPlaying();
        }).catch(() => { });
      }
    };
    audio.addEventListener('ended', handleTrackEnded);

    // Save exact playback progress periodically so the next page load resumes
    // at (roughly) the right spot.
    const interval = setInterval(() => {
      if (audioRef.current && !audioRef.current.paused) {
        localStorage.setItem('radioTime', audioRef.current.currentTime.toString());
        localStorage.setItem('radioTrackIndex', trackIndex.toString());
      }
    }, 1000);

    // Save playback progress on page unload to ensure seamless transitions
    const handleUnload = () => {
      if (audioRef.current && !audioRef.current.paused) {
        localStorage.setItem('radioTime', audioRef.current.currentTime.toString());
        localStorage.setItem('radioTrackIndex', trackIndex.toString());
      }
    };
    window.addEventListener('beforeunload', handleUnload);

    // Mobile browsers (especially Android Chrome and iOS Safari) often
    // silently pause background audio when the tab/app is backgrounded
    // (e.g. switching apps, pulling down notifications, locking the
    // screen). When the page becomes visible again, try to resume if the
    // user hadn't explicitly muted â€” this keeps the radio feeling
    // "always on" instead of staying silent until the next full reload.
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const stillShouldPlay = sessionStorage.getItem('radioPlaying') !== 'false';
      if (stillShouldPlay && audioRef.current && audioRef.current.paused) {
        audioRef.current.play().then(markPlaying).catch(() => {
          // Still blocked â€” handleFirstInteraction below will catch the
          // next tap/click and resume it then.
        });
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('click', handleFirstInteraction, { capture: true });
      document.removeEventListener('keydown', handleFirstInteraction, { capture: true });
      document.removeEventListener('touchstart', handleFirstInteraction, { capture: true });
      document.removeEventListener('touchend', handleFirstInteraction, { capture: true });
      audio.removeEventListener('ended', handleTrackEnded);
      if (audioRef.current) {
        // Persist final position before this page unmounts/navigates away
        if (!audioRef.current.paused) {
          localStorage.setItem('radioTime', audioRef.current.currentTime.toString());
        }
        audioRef.current.pause();
      }
    };
  }, []);

  const toggleRadio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      sessionStorage.setItem('radioPlaying', 'false');
    } else {
      // Pick a random track from Supabase public storage bucket
      const randomTrackIndex = Math.floor(Math.random() * AUDIO_TRACKS.length);
      audioRef.current.src = AUDIO_TRACKS[randomTrackIndex];
      audioRef.current.load();
      audioRef.current.play().then(() => {
        setIsPlaying(true);
        sessionStorage.setItem('radioPlaying', 'true');
        localStorage.setItem('radioTrackIndex', randomTrackIndex.toString());
      }).catch(() => { });
    }
  };

  // Toast System
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'success' | 'error' | 'info' }[]>([]);
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  // Auth Functions
  const handleLogin = async () => {
    setAuthError('');
    if (!loginEmail || !loginPass) {
      setAuthError('Enter email and password.');
      return;
    }
    const { data, error } = await supa.auth.signInWithPassword({
      email: loginEmail,
      password: loginPass
    });
    if (error) {
      setAuthError(error.message);
      return;
    }
    showToast(`Welcome back, ${data.user?.user_metadata?.username || loginEmail.split('@')[0]}!`);
    setAuthModalOpen(false);
    setLoginEmail('');
    setLoginPass('');
    // Ensure player_profiles exists (for users registered before this was added)
    if (data.user) {
      const username = data.user.user_metadata?.username || loginEmail.split('@')[0];
      await supa.from('player_profiles').upsert({
        user_id: data.user.id,
        display_name: username,
      }, { onConflict: 'user_id', ignoreDuplicates: true });
    }
  };

  const handleRegister = async () => {
    setAuthError('');
    if (!registerUser || !registerEmail || !registerPass) {
      setAuthError('All fields required.');
      return;
    }
    if (registerPass.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }
    if (registerPass !== registerPassConfirm) {
      setAuthError('Passwords do not match.');
      return;
    }
    const { data, error } = await supa.auth.signUp({
      email: registerEmail,
      password: registerPass,
      options: { data: { username: registerUser } }
    });
    if (error) {
      setAuthError(error.message);
      return;
    }
    // Create player profile immediately so the display name appears in posts
    if (data.user) {
      await supa.from('player_profiles').upsert({
        user_id: data.user.id,
        display_name: registerUser,
        avatar_url: null,
      }, { onConflict: 'user_id' });
    }
    showToast('Account created! Welcome!');
    setAuthModalOpen(false);
    setRegisterUser('');
    setRegisterEmail('');
    setRegisterPass('');
    setRegisterPassConfirm('');
  };

  const handleForgotPassword = async () => {
    setAuthError('');
    if (!loginEmail) {
      setAuthError('Enter your email above first, then click "Forgot password?".');
      return;
    }
    const { error } = await supa.auth.resetPasswordForEmail(loginEmail, {
      redirectTo: 'https://vicecityhub.github.io/vicecityhub/',
    });
    if (error) {
      setAuthError(error.message);
      return;
    }
    showToast('Password reset link sent. Check your inbox.', 'success');
  };

  const handleResetPassword = async () => {
    setAuthError('');
    if (!newPassword || newPassword.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setAuthError('Passwords do not match.');
      return;
    }
    setResetSaving(true);
    const { error } = await supa.auth.updateUser({ password: newPassword });
    setResetSaving(false);
    if (error) {
      setAuthError(error.message);
      return;
    }
    setResetDone(true);
    showToast('Password updated successfully. You are now signed in.', 'success');
    setTimeout(() => {
      setAuthModalOpen(false);
      setAuthTab('login');
      setResetDone(false);
      setNewPassword('');
      setNewPasswordConfirm('');
    }, 2000);
  };

  const handleLogout = async () => {
    await supa.auth.signOut();
    showToast('Signed out.', 'info');
    setDashboardOpen(false);
  };

  // Edit / Delete Dashboard Content
  const startEditing = (post: any) => {
    setEditingPostId(post.id);
    setEditingPostTitle(post.title || '');
    setEditingPostBody(post.body || '');
    if (post.meta) {
      try {
        const metaObj = typeof post.meta === 'string' ? JSON.parse(post.meta) : post.meta;
        setEditingPostPrice(metaObj.price || '');
      } catch (e) {
        setEditingPostPrice('');
      }
    } else {
      setEditingPostPrice('');
    }
  };

  const saveEdit = async (id: number, type: string) => {
    if (!editingPostTitle.trim() || !editingPostBody.trim()) {
      showToast('Title and body required.', 'error');
      return;
    }

    let meta: any = null;
    if (type === 'domain') {
      meta = JSON.stringify({
        price: editingPostPrice,
        tag: editingPostTitle.includes('.') ? editingPostTitle.split('.').pop()?.toLowerCase() : 'nft'
      });
    }

    const { error } = await supa
      .from('posts')
      .update({
        title: editingPostTitle,
        body: editingPostBody,
        meta: meta
      })
      .eq('id', id)
      .eq('author_id', session.user.id);

    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('Post updated successfully!');
      setEditingPostId(null);
      fetchDashboardData();
    }
  };

  const deletePost = async (id: number) => {
    if (!confirm('Are you sure you want to delete this listing?')) return;
    const { error } = await supa
      .from('posts')
      .delete()
      .eq('id', id)
      .eq('author_id', session.user.id);

    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('Successfully deleted!', 'info');
      fetchDashboardData();
    }
  };

  // Dash Submissions
  const handleDashSubmit = async (type: string) => {
    if (!session?.user) {
      setAuthTab('login');
      setAuthModalOpen(true);
      return;
    }

    let row: any = {
      author_id: session.user.id,
      author_name: username,
      type: type
    };

    if (type === 'forum') {
      if (!forumTitle.trim() || !forumBody.trim()) {
        showToast('Title and body required.', 'error');
        return;
      }
      row.title = forumTitle;
      row.body = forumBody;
      setForumTitle('');
      setForumBody('');
    } else if (type === 'domain') {
      if (!domainName.trim()) {
        showToast('Domain name required.', 'error');
        return;
      }
      row.title = domainName;
      row.body = domainDesc;
      let meta: any = { price: domainPrice };
      if (domainName.includes('.')) {
        meta.tag = domainName.split('.').pop()?.toLowerCase();
      }
      row.meta = JSON.stringify(meta);
      setDomainName('');
      setDomainPrice('');
      setDomainDesc('');
    } else if (type === 'news') {
      if (!newsTitle.trim() || !newsSrc.trim()) {
        showToast('Headline and source name required.', 'error');
        return;
      }
      row.title = newsTitle;
      row.body = newsBody.trim() ? newsBody : 'Community submitted news';
      row.summary = newsBody.trim() ? newsBody.slice(0, 180) : '';
      row.category = newsTag;
      row.source_url = newsUrl;
      row.is_published = true;
      row.is_featured = newsFeatured;
      row.meta = JSON.stringify({ source_name: newsSrc, stars: newsStars });
      setNewsTitle('');
      setNewsBody('');
      setNewsSrc('');
      setNewsUrl('');
      setNewsFeatured(false);
      setNewsStars(0);
    } else if (type === 'stream') {
      if (!streamName.trim()) {
        showToast('Channel name required.', 'error');
        return;
      }
      row.title = streamName;
      row.body = streamDesc;
      row.meta = JSON.stringify({ platform: streamPlat, yt: streamYt, tw: streamTw });
      setStreamName('');
      setStreamPlat('');
      setStreamYt('');
      setStreamTw('');
      setStreamDesc('');
    } else if (type === 'podcast') {
      if (!podcastName.trim()) {
        showToast('Show name required.', 'error');
        return;
      }
      row.title = podcastName;
      row.body = podcastDesc;
      row.meta = JSON.stringify({ url: podcastUrl });
      setPodcastName('');
      setPodcastUrl('');
      setPodcastDesc('');
    }

    const targetTable = type === 'news' ? 'news' : 'posts';
    const { error } = await supa.from(targetTable).insert(row);
    if (error) {
      showToast(error.message, 'error');
    } else {
      showToast('Successfully published!');
      fetchDashboardData();
      setDashTab('overview');
    }
  };

  return (
    <div className="min-h-screen vibe-bg scanlines relative flex flex-col font-rajdhani text-gray-200">
      {/* Toast Alert Drawer */}
      <div className="fixed bottom-8 right-6 z-[9999] flex flex-col gap-3">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`px-6 py-4 rounded glass-card flex items-center gap-3 shadow-2xl border transition-all animate-bounce min-w-[240px] ${t.type === 'success' ? 'border-green-500 text-neonCyan neon-text-cyan' :
                t.type === 'error' ? 'border-neonPink text-neonPink neon-text-pink' :
                  'border-neonOrange text-neonOrange'
              }`}
          >
            <span className="font-bold text-sm tracking-wider uppercase">{t.msg}</span>
          </div>
        ))}
      </div>

      {/* Navigation Header */}
      <nav className="sticky top-0 z-[500] h-[75px] bg-[#07070f]/90 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6 lg:px-12 shadow-2xl">
        <a className="font-orbitron font-extrabold text-2xl tracking-widest bg-gradient-to-r from-neonPink to-neonCyan bg-clip-text text-transparent hover:scale-105 transition-transform" href="./index.html">
          VICE CITY HUB
        </a>

        {/* Desktop Nav Links */}
        <div className="hidden lg:flex gap-10 items-center font-bold tracking-widest text-xs uppercase">
          <a href="./index.html" className={`hover:text-neonCyan transition-all ${activePage === 'home' ? 'text-neonCyan neon-text-cyan' : 'text-gray-500'}`}>Home</a>
          <a href="./news.html" className={`hover:text-neonCyan transition-all ${activePage === 'news' ? 'text-neonCyan neon-text-cyan' : 'text-gray-500'}`}>The Wire</a>
          <a href="./market.html" className={`hover:text-neonCyan transition-all ${activePage === 'market' ? 'text-neonCyan neon-text-cyan' : 'text-gray-500'}`}>Market</a>
          <a href="./community.html" className={`hover:text-neonCyan transition-all ${activePage === 'community' ? 'text-neonCyan neon-text-cyan' : 'text-gray-500'}`}>Community</a>
          <a href="./realestate.html" className={`hover:text-neonCyan transition-all ${activePage === 'realestate' ? 'text-neonCyan neon-text-cyan' : 'text-gray-500'}`}>Dynasty 8</a>
          <a href="./document.html" className={`hover:text-neonCyan transition-all ${activePage === 'document' ? 'text-neonCyan neon-text-cyan' : 'text-gray-500'}`}>Leonida Database</a>
          <a href="./rp.html" className={`hover:text-neonPink transition-all flex items-center gap-1.5 font-bold ${activePage === 'rp' ? 'text-neonPink neon-text-pink' : 'text-gray-500'}`}><span className="text-[8px] px-1.5 py-0.5 rounded border border-neonPink/60 bg-neonPink/10 text-neonPink font-orbitron font-black">NEW</span>RP Hub</a>
        </div>

        {/* Music Player & Auth Controls */}
        <div className="flex items-center gap-4">
          {session ? (
            <div className="hidden md:flex items-center gap-3 z-10">
              <span className="text-neonCyan font-bold tracking-wider text-xs uppercase">
                <User size={12} className="inline mr-1" /> {username}
              </span>
              <button onClick={() => { setDashboardOpen(true); setDashTab('overview'); }} className="btn-neon btn-neon-cyan !py-1.5 !px-4 !text-xs font-bold font-orbitron">
                Dashboard
              </button>
              <button onClick={handleLogout} className="border border-white/10 hover:border-neonPink text-xs uppercase px-4 py-1.5 rounded transition-all">
                Logout
              </button>
            </div>
          ) : (
            <div className="hidden md:flex gap-3 z-10">
              <button onClick={() => { setAuthTab('login'); setAuthModalOpen(true); }} className="border border-white/10 hover:border-neonCyan text-xs uppercase px-4 py-1.5 rounded transition-all">
                Sign In
              </button>
              <button onClick={() => { setAuthTab('register'); setAuthModalOpen(true); }} className="btn-neon !py-1.5 !px-4 !text-xs font-bold font-orbitron">
                Join
              </button>
            </div>
          )}

          {/* Music Button */}
          <button
            onClick={toggleRadio}
            className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${isPlaying ? 'text-neonPink border-neonPink shadow-[0_0_15px_rgba(255,0,255,0.4)] animate-pulse' : 'text-neonCyan border-neonCyan'
              }`}
            title="Toggle Leonida FM"
          >
            {isPlaying ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {/* Hamburger Mobile Menu */}
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="lg:hidden text-gray-200 hover:text-neonPink transition-colors">
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Dropdown Nav Menu */}
        {mobileMenuOpen && (
          <div className="absolute top-[75px] left-0 w-full bg-[#050508] border-b border-white/10 flex flex-col items-center gap-6 py-8 font-bold tracking-widest text-sm uppercase lg:hidden animate-fade-in shadow-2xl z-[999]">
            <a href="./index.html" onClick={() => setMobileMenuOpen(false)} className={`hover:text-neonCyan transition-all ${activePage === 'home' ? 'text-neonCyan neon-text-cyan' : 'text-gray-300'}`}>Home</a>
            <a href="./news.html" onClick={() => setMobileMenuOpen(false)} className={`hover:text-neonCyan transition-all ${activePage === 'news' ? 'text-neonCyan neon-text-cyan' : 'text-gray-300'}`}>The Wire</a>
            <a href="./market.html" onClick={() => setMobileMenuOpen(false)} className={`hover:text-neonCyan transition-all ${activePage === 'market' ? 'text-neonCyan neon-text-cyan' : 'text-gray-300'}`}>Market</a>
            <a href="./community.html" onClick={() => setMobileMenuOpen(false)} className={`hover:text-neonCyan transition-all ${activePage === 'community' ? 'text-neonCyan neon-text-cyan' : 'text-gray-300'}`}>Community</a>
            <a href="./realestate.html" onClick={() => setMobileMenuOpen(false)} className={`hover:text-neonCyan transition-all ${activePage === 'realestate' ? 'text-neonCyan neon-text-cyan' : 'text-gray-300'}`}>Dynasty 8</a>
            <a href="./document.html" onClick={() => setMobileMenuOpen(false)} className={`hover:text-neonCyan transition-all ${activePage === 'document' ? 'text-neonCyan neon-text-cyan' : 'text-gray-300'}`}>Leonida Database</a>
            <a href="./rp.html" onClick={() => setMobileMenuOpen(false)} className={`hover:text-neonPink transition-all flex items-center gap-2 font-bold ${activePage === 'rp' ? 'text-neonPink neon-text-pink' : 'text-gray-300'}`}><span className="text-[8px] px-1.5 py-0.5 rounded border border-neonPink/60 bg-neonPink/10 text-neonPink font-orbitron font-black">NEW</span>RP Hub</a>
            <div className="flex md:hidden flex-col items-center gap-4 mt-2">
              {session ? (
                <>
                  <span className="text-neonCyan text-xs">{username}</span>
                  <button onClick={() => { setMobileMenuOpen(false); setDashboardOpen(true); setDashTab('overview'); }} className="btn-neon btn-neon-cyan !py-1.5 !px-5 !text-xs font-orbitron">Dashboard</button>
                  <button onClick={() => { setMobileMenuOpen(false); handleLogout(); }} className="text-xs uppercase border border-white/10 px-5 py-1.5 rounded">Logout</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setMobileMenuOpen(false); setAuthTab('login'); setAuthModalOpen(true); }} className="text-xs uppercase border border-white/10 px-5 py-1.5 rounded">Sign In</button>
                  <button onClick={() => { setMobileMenuOpen(false); setAuthTab('register'); setAuthModalOpen(true); }} className="btn-neon !py-1.5 !px-5 !text-xs font-orbitron">Join</button>
                </>
              )}
            </div>
            <button onClick={() => { setMobileMenuOpen(false); setSitemapOpen(true); }} className="text-xs text-neonOrange tracking-widest uppercase flex items-center gap-1.5 mt-2">
              <Map size={14} /> Full Sitemap
            </button>
          </div>
        )}
      </nav>

      {/* Main Content Area */}
      <main className="flex-grow min-h-0">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-[#050508]/95 border-t border-white/5 py-12 px-6 lg:px-12 flex flex-col items-center text-center font-bold relative z-10">
        <div className="font-orbitron tracking-widest text-xl bg-gradient-to-r from-neonPink to-neonCyan bg-clip-text text-transparent mb-3">
          VICE CITY HUB
        </div>
        <div className="text-xs text-gray-500 tracking-wider mb-1 max-w-[600px]">
          Leonida's definitive intelligence network. Fan-operated community portal â€” not affiliated with Rockstar Games or Take-Two Interactive Software, Inc.
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            <a href="./index.html" className="text-[10px] text-gray-600 hover:text-neonCyan transition-colors uppercase tracking-wider font-bold">ðŸŽ¬ Home</a>
            <a href="./news.html" className="text-[10px] text-gray-600 hover:text-neonCyan transition-colors uppercase tracking-wider font-bold">ðŸ“¡ The Wire</a>
            <a href="./community.html" className="text-[10px] text-gray-600 hover:text-neonCyan transition-colors uppercase tracking-wider font-bold">ðŸ—£ï¸ Community</a>
            <a href="./market.html" className="text-[10px] text-gray-600 hover:text-neonCyan transition-colors uppercase tracking-wider font-bold">ðŸ’° Market</a>
            <a href="./realestate.html" className="text-[10px] text-gray-600 hover:text-neonCyan transition-colors uppercase tracking-wider font-bold">ðŸ¢ Dynasty 8</a>
            <a href="./document.html" className="text-[10px] text-gray-600 hover:text-neonCyan transition-colors uppercase tracking-wider font-bold">ðŸ“ Leonida DB</a>
            <a href="./rp.html" className="text-[10px] text-neonPink/60 hover:text-neonPink transition-colors uppercase tracking-wider font-bold">ðŸŽ® RP Hub âœ¦</a>
          </div>
        </div>
        <div className="text-[10px] text-gray-600 tracking-widest uppercase mb-8">
          Grand Theft Auto VIâ„¢ is a registered trademark of Take-Two Interactive Software, Inc.
        </div>

        {/* Contact Links Box */}
        <div className="glass-card max-w-[700px] w-full p-8 flex flex-col items-center gap-4 border border-neonPink/20 shadow-2xl">
          <div className="text-neonPink uppercase tracking-widest font-orbitron text-sm">Contact & Support Operations</div>
          <p className="text-xs text-gray-400 font-bold max-w-[500px]">
            Have leak tips, business collaborations, or server bugs? Send an encrypted dispatch or follow the syndicate below:
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            <a href="mailto:vicecityhub@proton.me"
              className="btn-neon btn-neon-cyan !py-2 !px-5 !text-[10px] flex items-center gap-2">
              âœ‰ E-Mail Us
            </a>
            <a href="https://x.com/vicecity_hub" target="_blank" rel="noopener noreferrer"
              className="btn-neon !py-2 !px-5 !text-[10px] flex items-center gap-2">
              ð• Follow on X
            </a>
            <a href="https://www.instagram.com/vicecity_hub?igsh=MXV6" target="_blank" rel="noopener noreferrer"
              className="btn-neon btn-neon-orange !py-2 !px-5 !text-[10px] flex items-center gap-2">
              â—ˆ Instagram
            </a>
          </div>

          {/* Donation CTA */}
          <div className="w-full border-t border-white/5 mt-4 pt-6 flex flex-col items-center gap-3">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
              Vice City Hub runs on community fuel â€” no ads, no trackers, no corporate overlords.
            </p>
            <div className="flex items-center gap-3 flex-wrap justify-center">
              <a
                href="https://ud.me/vicecity.hub"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-neon btn-neon-orange !py-2 !px-5 !text-[10px] flex items-center gap-2 font-extrabold"
              >
                <Heart size={13} /> Donate â†—
              </a>
              <button
                onClick={() => setKofiOpen(true)}
                className="btn-neon btn-neon-kofi !py-2 !px-5 !text-[10px] flex items-center gap-2 font-extrabold"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z"/>
                </svg>
                Buy Us a Coffee
              </button>
            </div>
          </div>
        </div>

        {/* Direct Crypto Donation Addresses */}
        <div className="max-w-[900px] w-full mt-6">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-4 text-center">Or transfer directly to our secure chain dispatches:</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* BTC Card */}
            <div
              onClick={() => handleCopyAddress('bc1qtauw5d569vqmy26w32u6c7076pl5r069xhnsdn', 'btc')}
              className="glass-card p-5 border-white/5 hover:border-neonOrange text-left shadow-xl transition-all cursor-pointer flex flex-col justify-between min-h-[120px] relative overflow-hidden"
            >
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">ðŸª™</span>
                  <span className="font-orbitron font-extrabold text-neonOrange text-xs tracking-wider uppercase">Bitcoin (BTC)</span>
                </div>
                {copiedAddress === 'btc' ? (
                  <span className="text-[9px] text-green-500 font-extrabold font-orbitron bg-green-500/10 border border-green-500/25 px-2 py-0.5 rounded tracking-widest flex items-center gap-1 animate-pulse"><Check size={10} /> Copied</span>
                ) : (
                  <Copy size={12} className="text-gray-500" />
                )}
              </div>
              <div className="font-mono text-xs text-gray-300 font-semibold break-all tracking-wider select-all select-none">
                bc1qtauw5d569vqmy26w32u6c7076pl5r069xhnsdn
              </div>
            </div>

            {/* ETH Card */}
            <div
              onClick={() => handleCopyAddress('0x04b9d483E4dcc059CC2fb9375De5244C0A7ddce1', 'eth')}
              className="glass-card p-5 border-white/5 hover:border-neonPink text-left shadow-xl transition-all cursor-pointer flex flex-col justify-between min-h-[120px] relative overflow-hidden"
            >
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">ðŸ”·</span>
                  <span className="font-orbitron font-extrabold text-neonPink text-xs tracking-wider uppercase">Ethereum (ETH)</span>
                </div>
                {copiedAddress === 'eth' ? (
                  <span className="text-[9px] text-green-500 font-extrabold font-orbitron bg-green-500/10 border border-green-500/25 px-2 py-0.5 rounded tracking-widest flex items-center gap-1 animate-pulse"><Check size={10} /> Copied</span>
                ) : (
                  <Copy size={12} className="text-gray-500" />
                )}
              </div>
              <div className="font-mono text-xs text-gray-300 font-semibold break-all tracking-wider select-all select-none">
                0x04b9d483E4dcc059CC2fb9375De5244C0A7ddce1
              </div>
            </div>

            {/* SOL Card */}
            <div
              onClick={() => handleCopyAddress('Gc75C9QnC59nTVW4f729VbWxcE6fsatGkZBQmQDJqB8b', 'sol')}
              className="glass-card p-5 border-white/5 hover:border-green-500 text-left shadow-xl transition-all cursor-pointer flex flex-col justify-between min-h-[120px] relative overflow-hidden"
            >
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">â˜€ï¸</span>
                  <span className="font-orbitron font-extrabold text-green-500 text-xs tracking-wider uppercase">Solana (SOL)</span>
                </div>
                {copiedAddress === 'sol' ? (
                  <span className="text-[9px] text-green-500 font-extrabold font-orbitron bg-green-500/10 border border-green-500/25 px-2 py-0.5 rounded tracking-widest flex items-center gap-1 animate-pulse"><Check size={10} /> Copied</span>
                ) : (
                  <Copy size={12} className="text-gray-500" />
                )}
              </div>
              <div className="font-mono text-xs text-gray-300 font-semibold break-all tracking-wider select-all select-none">
                Gc75C9QnC59nTVW4f729VbWxcE6fsatGkZBQmQDJqB8b
              </div>
            </div>

            {/* TRX Card */}
            <div
              onClick={() => handleCopyAddress('TRyGNvj1NcVM1V6aDJmycNBiSKWumZ4Zhz', 'trx')}
              className="glass-card p-5 border-white/5 hover:border-red-500 text-left shadow-xl transition-all cursor-pointer flex flex-col justify-between min-h-[120px] relative overflow-hidden"
            >
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">ðŸ”º</span>
                  <span className="font-orbitron font-extrabold text-red-500 text-xs tracking-wider uppercase">TRON (TRX / USDT)</span>
                </div>
                {copiedAddress === 'trx' ? (
                  <span className="text-[9px] text-green-500 font-extrabold font-orbitron bg-green-500/10 border border-green-500/25 px-2 py-0.5 rounded tracking-widest flex items-center gap-1 animate-pulse"><Check size={10} /> Copied</span>
                ) : (
                  <Copy size={12} className="text-gray-500" />
                )}
              </div>
              <div className="font-mono text-xs text-gray-300 font-semibold break-all tracking-wider select-all select-none">
                TRyGNvj1NcVM1V6aDJmycNBiSKWumZ4Zhz
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Ko-fi Coffee Widget Modal */}
      {kofiOpen && (
        <div
          className="fixed inset-0 z-[1000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setKofiOpen(false)}
        >
          <div
            className="glass-card max-w-md w-full relative border border-[#FF5E5B]/40 shadow-[0_0_40px_rgba(255,94,91,0.2)] overflow-hidden flex flex-col"
            style={{ maxHeight: 'calc(100vh - 32px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header â€” always visible, crÐµÑÑ‚Ð¸Ðº Ð²ÑÐµÐ³Ð´Ð° Ð´Ð¾ÑÑ‚ÑƒÐ¿ÐµÐ½ */}
            <div className="flex-shrink-0 flex items-center gap-3 px-5 pt-5 pb-3 border-b border-white/5">
              <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#FF5E5B]/10 border border-[#FF5E5B]/30 flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#FF5E5B">
                  <path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z"/>
                </svg>
              </div>
              <div className="flex-grow">
                <div className="font-orbitron font-extrabold text-sm text-[#FF5E5B] uppercase tracking-wider">
                  Buy Us a Coffee
                </div>
                <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">
                  Keep the Hub alive Â· No ads Â· No tracking
                </div>
              </div>
              <button
                onClick={() => setKofiOpen(false)}
                className="flex-shrink-0 text-gray-500 hover:text-white transition-colors p-1"
              >
                <X size={18} />
              </button>
            </div>
            {/* Scrollable iframe area */}
            <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
              <iframe
                id="kofiframe"
                src="https://ko-fi.com/vicecityhub/?hidefeed=true&widget=true&embed=true&preview=true"
                style={{ border: 'none', width: '100%', padding: '4px', background: '#f9f9f9', display: 'block' }}
                height="712"
                title="vicecityhub"
              />
            </div>
          </div>
        </div>
      )}

      {/* Authentication Modal */}
      {authModalOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className={`glass-card w-full relative border border-neonPink shadow-[0_0_40px_rgba(255,0,255,0.2)] ${authTab === 'reset' ? 'max-w-sm p-6' : 'max-w-md p-8'}`}>
            <button onClick={() => setAuthModalOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-neonPink transition-colors">
              <X size={20} />
            </button>
            <div className={`font-orbitron font-extrabold text-3xl text-neonPink neon-text-pink mb-1 tracking-widest uppercase ${authTab === 'reset' ? 'hidden' : ''}`}>MEMBER</div>
            <div className={`text-[10px] text-gray-500 tracking-widest uppercase font-bold ${authTab === 'reset' ? 'hidden' : 'mb-6'}`}>Access â€¢ Post â€¢ Share Intel</div>

            {/* Modal Tabs â€” hide tabs during password reset flow */}
            {authTab !== 'reset' && (
              <div className="flex border-b border-white/5 mb-6 text-xs uppercase tracking-widest font-bold">
                <button onClick={() => setAuthTab('login')} className={`pb-3 pr-6 ${authTab === 'login' ? 'text-neonCyan border-b-2 border-neonCyan' : 'text-gray-500'}`}>Sign In</button>
                <button onClick={() => setAuthTab('register')} className={`pb-3 pr-6 ${authTab === 'register' ? 'text-neonCyan border-b-2 border-neonCyan' : 'text-gray-500'}`}>Register</button>
              </div>
            )}

            {authError && (
              <div className="mb-4 text-xs font-bold text-neonPink border border-neonPink/20 bg-neonPink/5 p-3 rounded tracking-wide uppercase">
                {authError}
              </div>
            )}

            {/* Reset Password Form â€” shown when user arrives via email link */}
            {authTab === 'reset' && (
              <div className="flex flex-col gap-4">
                <div className="text-[10px] text-neonCyan uppercase tracking-widest font-bold mb-2">
                  ðŸ” Set Your New Password
                </div>
                {resetDone ? (
                  <div className="text-center py-6">
                    <div className="text-2xl mb-2">âœ“</div>
                    <p className="text-neonCyan font-bold font-orbitron text-sm">Password updated!</p>
                    <p className="text-xs text-gray-500 mt-1">Redirecting...</p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Min. 6 characters"
                        className="bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Confirm Password</label>
                      <input
                        type="password"
                        value={newPasswordConfirm}
                        onChange={(e) => setNewPasswordConfirm(e.target.value)}
                        placeholder="Repeat password"
                        className="bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white"
                        onKeyDown={(e) => e.key === 'Enter' && handleResetPassword()}
                      />
                    </div>
                    <button
                      onClick={handleResetPassword}
                      disabled={resetSaving}
                      className="btn-neon font-orbitron text-xs mt-2 disabled:opacity-50"
                    >
                      {resetSaving ? 'Saving...' : 'Set New Password'}
                    </button>
                  </>
                )}
              </div>
            )}

            <div className={authTab === 'reset' ? 'hidden' : ''}>
            {authTab === 'login' ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Email Address</label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm transition-all"
                    placeholder="you@email.com"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Secret Password</label>
                  <input
                    type="password"
                    value={loginPass}
                    onChange={e => setLoginPass(e.target.value)}
                    className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm transition-all"
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                  />
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="self-end text-[10px] text-gray-500 hover:text-neonCyan underline transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <button onClick={handleLogin} className="btn-neon font-orbitron text-xs mt-4">Sign In</button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Alias Username</label>
                  <input
                    type="text"
                    value={registerUser}
                    onChange={e => setRegisterUser(e.target.value)}
                    className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm transition-all"
                    placeholder="Lucia69"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Email Address</label>
                  <input
                    type="email"
                    value={registerEmail}
                    onChange={e => setRegisterEmail(e.target.value)}
                    className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm transition-all"
                    placeholder="lucia@gta6.com"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Secure Password</label>
                  <input
                    type="password"
                    value={registerPass}
                    onChange={e => setRegisterPass(e.target.value)}
                    className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm transition-all"
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Confirm Password</label>
                  <input
                    type="password"
                    value={registerPassConfirm}
                    onChange={e => setRegisterPassConfirm(e.target.value)}
                    className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm transition-all"
                    placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                  />
                </div>
                <button onClick={handleRegister} className="btn-neon font-orbitron text-xs mt-4">Create Account</button>
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Sitemap Modal */}
      {sitemapOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card max-w-2xl w-full p-8 relative border border-neonCyan shadow-[0_0_40px_rgba(0,255,255,0.2)]">
            <button onClick={() => setSitemapOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-neonCyan transition-colors">
              <X size={20} />
            </button>
            <div className="font-orbitron font-extrabold text-3xl text-neonCyan neon-text-cyan mb-1 tracking-widest uppercase">SITE MAP</div>
            <div className="text-[10px] text-gray-500 tracking-widest uppercase mb-8 font-bold">Direct Navigation Panel</div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <a href="./index.html" className="glass-card p-6 text-center hover:border-neonCyan flex flex-col items-center gap-3">
                <span className="text-3xl">ðŸŽ¬</span>
                <span className="text-xs uppercase font-orbitron tracking-widest text-gray-300">Home & Media</span>
              </a>
              <a href="./news.html" className="glass-card p-6 text-center hover:border-neonCyan flex flex-col items-center gap-3">
                <span className="text-3xl">ðŸ“¡</span>
                <span className="text-xs uppercase font-orbitron tracking-widest text-gray-300">The Wire News</span>
              </a>
              <a href="./market.html" className="glass-card p-6 text-center hover:border-neonCyan flex flex-col items-center gap-3">
                <span className="text-3xl">ðŸ’°</span>
                <span className="text-xs uppercase font-orbitron tracking-widest text-gray-300">Web3 Market</span>
              </a>
              <a href="./realestate.html" className="glass-card p-6 text-center hover:border-neonCyan flex flex-col items-center gap-3">
                <span className="text-3xl">ðŸ¢</span>
                <span className="text-xs uppercase font-orbitron tracking-widest text-gray-300">Dynasty 8 ROI</span>
              </a>
              <a href="./document.html" className="glass-card p-6 text-center hover:border-neonCyan flex flex-col items-center gap-3">
                <span className="text-3xl">ðŸ“</span>
                <span className="text-xs uppercase font-orbitron tracking-widest text-gray-300">Leonida Database</span>
              </a>
              <a href="./community.html" className="glass-card p-6 text-center hover:border-neonCyan flex flex-col items-center gap-3">
                <span className="text-3xl">ðŸ—£ï¸</span>
                <span className="text-xs uppercase font-orbitron tracking-widest text-gray-300">Community</span>
              </a>
              <a href="./rp.html" className="glass-card p-6 text-center hover:border-neonPink flex flex-col items-center gap-3 relative border border-neonPink/20">
                <span className="absolute -top-2 -right-2 text-[8px] px-1.5 py-0.5 rounded border border-neonPink/70 bg-neonPink/15 text-neonPink font-orbitron font-black">NEW</span>
                <span className="text-3xl">ðŸŽ®</span>
                <span className="text-xs uppercase font-orbitron tracking-widest text-neonPink">RP Hub</span>
              </a>
              <div onClick={() => { setSitemapOpen(false); if (session) setDashboardOpen(true); else setAuthModalOpen(true); }} className="glass-card p-6 text-center hover:border-neonCyan flex flex-col items-center gap-3 cursor-pointer">
                <span className="text-3xl">âš™ï¸</span>
                <span className="text-xs uppercase font-orbitron tracking-widest text-gray-300">User Settings</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Wide User Dashboard Modal */}
      {dashboardOpen && (
        <div className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-card max-w-5xl w-full h-[85vh] flex flex-col md:flex-row relative border border-neonCyan shadow-[0_0_55px_rgba(0,255,255,0.15)] overflow-hidden">
            <button onClick={() => setDashboardOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-neonPink transition-colors z-[1001]">
              <X size={20} />
            </button>

            {/* Sidebar Navigation */}
            <div className="w-full md:w-[250px] border-r border-white/5 bg-[#050508]/85 p-6 flex flex-col gap-1.5 flex-shrink-0">
              <div className="font-orbitron font-extrabold text-2xl text-neonCyan neon-text-cyan mb-2 uppercase tracking-widest flex items-center gap-2">
                <Radio size={20} className="text-neonCyan animate-pulse" /> HUB
              </div>
              <div className="text-[10px] text-gray-500 tracking-widest uppercase mb-6 font-bold">Agent: {username}</div>

              <button onClick={() => setDashTab('overview')} className={`w-full py-2.5 px-4 text-left text-xs font-bold uppercase tracking-wider rounded transition-all ${dashTab === 'overview' ? 'bg-neonCyan/10 text-neonCyan border border-neonCyan/30' : 'text-gray-400 hover:bg-white/5'}`}>Overview</button>
              <button onClick={() => setDashTab('myposts')} className={`w-full py-2.5 px-4 text-left text-xs font-bold uppercase tracking-wider rounded transition-all ${dashTab === 'myposts' ? 'bg-neonCyan/10 text-neonCyan border border-neonCyan/30' : 'text-gray-400 hover:bg-white/5'}`}>My Posts & Assets</button>
              <button onClick={() => setDashTab('myprofile')} className={`w-full py-2.5 px-4 text-left text-xs font-bold uppercase tracking-wider rounded transition-all ${dashTab === 'myprofile' ? 'bg-neonCyan/10 text-neonCyan border border-neonCyan/30' : 'text-gray-400 hover:bg-white/5'}`}>My Profile</button>
              <div className="h-px bg-white/5 my-4" />
              <div className="text-[9px] text-gray-600 uppercase tracking-widest font-extrabold mb-2 ml-4">Submit Operations</div>
              <button onClick={() => setDashTab('news')} className={`w-full py-2.5 px-4 text-left text-xs font-bold uppercase tracking-wider rounded transition-all ${dashTab === 'news' ? 'bg-neonCyan/10 text-neonCyan border border-neonCyan/30' : 'text-gray-400 hover:bg-white/5'}`}>Submit News</button>
              <button onClick={() => setDashTab('forum')} className={`w-full py-2.5 px-4 text-left text-xs font-bold uppercase tracking-wider rounded transition-all ${dashTab === 'forum' ? 'bg-neonCyan/10 text-neonCyan border border-neonCyan/30' : 'text-gray-400 hover:bg-white/5'}`}>Submit Forum Post</button>
              <button onClick={() => setDashTab('stream')} className={`w-full py-2.5 px-4 text-left text-xs font-bold uppercase tracking-wider rounded transition-all ${dashTab === 'stream' ? 'bg-neonCyan/10 text-neonCyan border border-neonCyan/30' : 'text-gray-400 hover:bg-white/5'}`}>Submit Streamer</button>
              <button onClick={() => setDashTab('podcast')} className={`w-full py-2.5 px-4 text-left text-xs font-bold uppercase tracking-wider rounded transition-all ${dashTab === 'podcast' ? 'bg-neonCyan/10 text-neonCyan border border-neonCyan/30' : 'text-gray-400 hover:bg-white/5'}`}>Submit Podcast</button>
              <button onClick={() => setDashTab('domain')} className={`w-full py-2.5 px-4 text-left text-xs font-bold uppercase tracking-wider rounded transition-all ${dashTab === 'domain' ? 'bg-neonCyan/10 text-neonCyan border border-neonCyan/30' : 'text-gray-400 hover:bg-white/5'}`}>List Web3 Domain</button>
            </div>

            {/* Main Tab Content Panel */}
            <div className="flex-grow p-8 overflow-y-auto bg-[#0a0a0f]/50">
              {dashTab === 'overview' && (
                <div className="flex flex-col gap-6">
                  <div className="font-orbitron font-extrabold text-2xl uppercase tracking-wider text-white">Agent Dashboard Overview</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="glass-card p-6 border-neonCyan/30 flex flex-col justify-center">
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Forum Items</span>
                      <span className="text-3xl font-orbitron font-extrabold text-neonCyan neon-text-cyan mt-2">{userPosts.filter(p => p.type === 'forum').length}</span>
                    </div>
                    <div className="glass-card p-6 border-neonOrange/30 flex flex-col justify-center">
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Listed Domains</span>
                      <span className="text-3xl font-orbitron font-extrabold text-neonOrange mt-2">{userPosts.filter(p => p.type === 'domain').length}</span>
                    </div>
                    <div className="glass-card p-6 border-neonPink/30 flex flex-col justify-center">
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Streams Submitted</span>
                      <span className="text-3xl font-orbitron font-extrabold text-neonPink neon-text-pink mt-2">{userPosts.filter(p => p.type === 'stream').length}</span>
                    </div>
                    <div className="glass-card p-6 border-white/10 flex flex-col justify-center">
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Total Activity</span>
                      <span className="text-3xl font-orbitron font-extrabold text-white mt-2">{userPosts.length}</span>
                    </div>
                  </div>
                  <div className="glass-card p-6 border-white/5 text-sm text-gray-400 font-bold max-w-[650px] leading-relaxed">
                    Use the dashboard tabs on the left navigation panel to write, edit, and delete forum guides, list Web3 domains for crypto sale, or upload streamers/podcasts. All content is saved directly to Supabase and synced in real-time across Vice City Hub!
                  </div>
                </div>
              )}

              {dashTab === 'myposts' && (
                <div className="flex flex-col gap-6">
                  <div className="font-orbitron font-extrabold text-2xl uppercase tracking-wider text-white">Manage My Assets &amp; Posts</div>
                  {userPosts.length === 0 ? (
                    <div className="text-gray-500 text-xs font-bold uppercase tracking-wider">No uploads found. Publish something to populate your workspace dashboard.</div>
                  ) : (
                    <div className="flex flex-col gap-4">
                      {userPosts.map(p => {
                        const isEditing = editingPostId === p.id;
                        let price = '';
                        if (p.meta) {
                          try {
                            price = (typeof p.meta === 'string' ? JSON.parse(p.meta) : p.meta).price || '';
                          } catch (e) { }
                        }
                        return (
                          <div key={p.id} className="glass-card p-6 border-white/5 hover:border-neonCyan transition-all flex flex-col gap-4 shadow-xl">
                            {isEditing ? (
                              <div className="flex flex-col gap-3">
                                <div className="flex flex-col gap-1.5">
                                  <label className="text-[10px] text-gray-500 uppercase tracking-widest">Edit Title / Asset Name</label>
                                  <input
                                    type="text"
                                    value={editingPostTitle}
                                    onChange={e => setEditingPostTitle(e.target.value)}
                                    className="w-full bg-[#050508] border border-white/10 rounded p-2 text-sm text-white"
                                  />
                                </div>
                                {p.type === 'domain' && (
                                  <div className="flex flex-col gap-1.5">
                                    <label className="text-[10px] text-gray-500 uppercase tracking-widest">Asking Price (USD)</label>
                                    <input
                                      type="number"
                                      value={editingPostPrice}
                                      onChange={e => setEditingPostPrice(e.target.value)}
                                      className="w-full bg-[#050508] border border-white/10 rounded p-2 text-sm text-white"
                                    />
                                  </div>
                                )}
                                <div className="flex flex-col gap-1.5">
                                  <label className="text-[10px] text-gray-500 uppercase tracking-widest">Edit Body / Description</label>
                                  <textarea
                                    value={editingPostBody}
                                    onChange={e => setEditingPostBody(e.target.value)}
                                    rows={4}
                                    className="w-full bg-[#050508] border border-white/10 rounded p-2 text-sm text-white outline-none"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => saveEdit(p.id, p.type)} className="border border-neonCyan/30 text-neonCyan px-4 py-1.5 rounded hover:bg-neonCyan hover:text-black font-orbitron text-xs flex items-center gap-1.5">
                                    <Save size={12} /> Save
                                  </button>
                                  <button onClick={() => setEditingPostId(null)} className="border border-white/15 text-gray-400 px-4 py-1.5 rounded hover:bg-white/5 font-orbitron text-xs">
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-lg text-white font-orbitron tracking-wide">{p.title}</span>
                                    <span className={`text-[9px] px-2 py-0.5 rounded font-extrabold uppercase ${p.type === 'domain' ? 'bg-neonOrange/10 text-neonOrange border border-neonOrange/20' : 'bg-neonCyan/10 text-neonCyan border border-neonCyan/20'
                                      }`}>{p.type}</span>
                                  </div>
                                  <p className="text-gray-400 text-xs line-clamp-2 max-w-[600px] mt-1">{p.body}</p>
                                  {p.type === 'domain' && price && (
                                    <span className="text-neonOrange text-xs font-orbitron font-extrabold mt-1">PRICE: ${price} USD</span>
                                  )}
                                  <span className="text-[10px] text-gray-600 font-bold uppercase tracking-wider mt-1">{new Date(p.created_at).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button onClick={() => startEditing(p)} className="border border-neonCyan/25 text-neonCyan p-2 rounded hover:bg-neonCyan hover:text-black transition-all" title="Edit Post">
                                    <Edit3 size={14} />
                                  </button>
                                  <button onClick={() => deletePost(p.id)} className="border border-neonPink/25 text-neonPink p-2 rounded hover:bg-neonPink hover:text-black transition-all" title="Delete Post">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {dashTab === 'myprofile' && (
                <div className="flex flex-col gap-5 max-w-[650px]">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="font-orbitron font-extrabold text-2xl uppercase tracking-wider text-white">My Agent Profile</div>
                    {playerProfile && (
                      <a href={`./profile.html?u=${encodeURIComponent(playerProfile.display_name)}`} target="_blank" rel="noreferrer" className="text-xs text-neonCyan hover:underline flex items-center gap-1">
                        <ExternalLink size={13} /> View public page
                      </a>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 leading-relaxed -mt-2">
                    Rockstar Social Club and PSN don't offer a public login API, so those fields are
                    self-reported â€” they show with an "Unverified" badge until a moderator checks a
                    screenshot. Steam can be linked for real, automatic verification.
                  </p>

                  <div className="flex flex-col gap-4">
                    {/* Avatar upload â€” prominent, at top of form */}
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest">Profile Avatar</label>
                      <div className="flex items-center gap-4">
                        <div className="w-24 h-24 rounded-full bg-white/5 border-2 border-neonCyan/30 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {playerProfile?.avatar_url ? (
                            <img src={playerProfile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                          ) : (
                            <User size={36} className="text-gray-600" />
                          )}
                        </div>
                        <div className="flex flex-col gap-2 flex-grow">
                          <label className="flex items-center justify-center gap-2 border border-neonCyan/30 text-neonCyan px-4 py-2.5 rounded cursor-pointer hover:bg-neonCyan hover:text-black font-orbitron text-[10px] font-bold uppercase tracking-wider transition-all">
                            <Upload size={13} />
                            {playerProfile?.avatar_url ? 'Change Avatar' : 'Upload Avatar'}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file || !session?.user) return;
                                const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
                                const path = `${session.user.id}/avatar.${ext}`;
                                const { error: upErr } = await supa.storage.from('player-media').upload(path, file, { upsert: true });
                                if (upErr) return;
                                const { data: urlData } = supa.storage.from('player-media').getPublicUrl(path);
                                await supa.from('player_profiles').update({ avatar_url: urlData.publicUrl }).eq('user_id', session.user.id);
                                setPlayerProfile((prev: any) => prev ? { ...prev, avatar_url: urlData.publicUrl } : prev);
                              }}
                            />
                          </label>
                          <p className="text-[9px] text-gray-600 text-center">Displayed next to your posts in Community</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest">Display Name</label>
                      <input type="text" value={profileDisplayName} onChange={e => setProfileDisplayName(e.target.value)} className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white" placeholder="Lucia69" />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest">Bio</label>
                      <textarea value={profileBio} onChange={e => setProfileBio(e.target.value)} rows={3} maxLength={500} className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white" placeholder="What's your story in Leonida?" />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest">Platform</label>
                      <select value={profilePlatform} onChange={e => setProfilePlatform(e.target.value)} className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white">
                        <option value="pc">PC</option>
                        <option value="playstation">PlayStation</option>
                        <option value="xbox">Xbox</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-gray-500 uppercase tracking-widest">Rockstar Social Club Username</label>
                        <input type="text" value={profileRsc} onChange={e => setProfileRsc(e.target.value)} className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white" placeholder="RSC_Handle" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-gray-500 uppercase tracking-widest">PSN Username</label>
                        <input type="text" value={profilePsn} onChange={e => setProfilePsn(e.target.value)} className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white" placeholder="PSN_Handle" />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest">Gang / Crew Tag</label>
                      <input type="text" value={profileGangTag} onChange={e => setProfileGangTag(e.target.value)} className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white" placeholder="VCH" />
                    </div>

                    {playerProfile && (
                      <div className="flex items-center gap-2 text-xs text-gray-400 bg-white/5 rounded p-3">
                        Verification status: <span className="text-neonCyan font-bold uppercase">{playerProfile.verification_level.replace('_', ' ')}</span>
                      </div>
                    )}

                    <button onClick={savePlayerProfile} disabled={profileSaving || !profileDisplayName.trim()} className="btn-neon font-orbitron text-xs uppercase disabled:opacity-40 self-start flex items-center gap-2">
                      <Save size={14} /> {profileSaving ? 'Saving...' : 'Save Profile'}
                    </button>
                  </div>
                </div>
              )}

              {dashTab === 'news' && (
                <div className="flex flex-col gap-5 max-w-[650px]">
                  <div className="font-orbitron font-extrabold text-2xl uppercase tracking-wider text-white">Submit News Broadcast</div>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest">Headline</label>
                      <input type="text" value={newsTitle} onChange={e => setNewsTitle(e.target.value)} className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white" placeholder="Trailer 3 Release Date Leaked!" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest">Story Body</label>
                      <textarea value={newsBody} onChange={e => setNewsBody(e.target.value)} rows={5} className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white" placeholder="Full breakdown of the leak, dispatch, or rumor..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-gray-500 uppercase tracking-widest">Category Tag</label>
                        <select value={newsTag} onChange={e => setNewsTag(e.target.value)} className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white">
                          <option>Official</option>
                          <option>Leaks</option>
                          <option>Rumors</option>
                          <option>Community</option>
                        </select>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-gray-500 uppercase tracking-widest">Source Platform / Name</label>
                        <input type="text" value={newsSrc} onChange={e => setNewsSrc(e.target.value)} className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white" placeholder="Reddit @_arthur1781" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest">Source URL Link</label>
                      <input type="text" value={newsUrl} onChange={e => setNewsUrl(e.target.value)} className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white" placeholder="https://x.com/username/status/..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4 items-center">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-gray-500 uppercase tracking-widest">Importance Rating</label>
                        <div className="flex items-center gap-1.5 bg-[#050508] border border-white/10 rounded p-3">
                          {[1, 2, 3, 4, 5].map(n => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setNewsStars(n === newsStars ? 0 : n)}
                              className="transition-colors"
                            >
                              <span className={n <= newsStars ? 'text-neonOrange' : 'text-gray-700'}>â˜…</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5 pt-5">
                        <input type="checkbox" id="newsFeatured" checked={newsFeatured} onChange={e => setNewsFeatured(e.target.checked)} className="w-4 h-4 accent-neonOrange" />
                        <label htmlFor="newsFeatured" className="text-[10px] text-gray-500 uppercase tracking-widest">Pin as Featured / Top Story</label>
                      </div>
                    </div>
                    <button onClick={() => handleDashSubmit('news')} className="btn-neon font-orbitron text-xs mt-3 uppercase">Publish News</button>
                  </div>
                </div>
              )}

              {dashTab === 'forum' && (
                <div className="flex flex-col gap-5">
                  <div className="font-orbitron font-extrabold text-2xl uppercase tracking-wider text-white">Create New Forum Discussion</div>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest">Topic Title</label>
                      <input type="text" value={forumTitle} onChange={e => setForumTitle(e.target.value)} className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white" placeholder="GTA VI Map compared to Red Dead Redemption 2" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest">Discussion Body Content</label>
                      <textarea value={forumBody} onChange={e => setForumBody(e.target.value)} rows={10} className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white font-mono" placeholder="Stitch your evidence, coordinate maps, or share rumors..." />
                    </div>
                    <button onClick={() => handleDashSubmit('forum')} className="btn-neon font-orbitron text-xs mt-2 uppercase">Publish Topic</button>
                  </div>
                </div>
              )}

              {dashTab === 'stream' && (
                <div className="flex flex-col gap-5 max-w-[650px]">
                  <div className="font-orbitron font-extrabold text-2xl uppercase tracking-wider text-white">Submit Community Streamer</div>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest">Channel Name Alias</label>
                      <input type="text" value={streamName} onChange={e => setStreamName(e.target.value)} className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white" placeholder="GTASeriesVideos" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest">Platform (e.g. YouTube, Twitch)</label>
                      <input type="text" value={streamPlat} onChange={e => setStreamPlat(e.target.value)} className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white" placeholder="YouTube / Twitch" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-gray-500 uppercase tracking-widest">YouTube URL Link</label>
                        <input type="text" value={streamYt} onChange={e => setStreamYt(e.target.value)} className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white" placeholder="https://youtube.com/@channel" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-gray-500 uppercase tracking-widest">Twitch URL Link</label>
                        <input type="text" value={streamTw} onChange={e => setStreamTw(e.target.value)} className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white" placeholder="https://twitch.tv/channel" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest">Channel Brief Description</label>
                      <textarea value={streamDesc} onChange={e => setStreamDesc(e.target.value)} rows={3} className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white" placeholder="Analyzes GTA 6 files, coordinate triangulation, and community gameplay leaks..." />
                    </div>
                    <button onClick={() => handleDashSubmit('stream')} className="btn-neon font-orbitron text-xs mt-2 uppercase">Submit Streamer</button>
                  </div>
                </div>
              )}

              {dashTab === 'podcast' && (
                <div className="flex flex-col gap-5 max-w-[650px]">
                  <div className="font-orbitron font-extrabold text-2xl uppercase tracking-wider text-white">Submit Community Podcast</div>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest">Show Name Title</label>
                      <input type="text" value={podcastName} onChange={e => setPodcastName(e.target.value)} className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white" placeholder="Radio Leonida" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest">Audio Stream URL Link</label>
                      <input type="text" value={podcastUrl} onChange={e => setPodcastUrl(e.target.value)} className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white" placeholder="https://soundcloud.com/show-link" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest">Show Description Details</label>
                      <textarea value={podcastDesc} onChange={e => setPodcastDesc(e.target.value)} rows={4} className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white" placeholder="Weekly deep dives on Leonida mapping, Florida Joker parodies, and GTA VI developer insights..." />
                    </div>
                    <button onClick={() => handleDashSubmit('podcast')} className="btn-neon font-orbitron text-xs mt-2 uppercase">Submit Podcast</button>
                  </div>
                </div>
              )}

              {dashTab === 'domain' && (
                <div className="flex flex-col gap-5 max-w-[650px]">
                  <div className="font-orbitron font-extrabold text-2xl uppercase tracking-wider text-white">List Web3 Domain for Sale</div>
                  <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-gray-500 uppercase tracking-widest">Domain Name</label>
                        <input type="text" value={domainName} onChange={e => setDomainName(e.target.value)} className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white" placeholder="vicecity.nft" />
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] text-gray-500 uppercase tracking-widest">Asking Price (USD Equivalency)</label>
                        <input type="number" value={domainPrice} onChange={e => setDomainPrice(e.target.value)} className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white" placeholder="1500" />
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest">Domain Value Description</label>
                      <textarea value={domainDesc} onChange={e => setDomainDesc(e.target.value)} rows={4} className="w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white" placeholder="Premium Web3 domain on Unstoppable Domains, highly memorable brand for GTA VI guilds." />
                    </div>
                    <button onClick={() => handleDashSubmit('domain')} className="btn-neon font-orbitron text-xs mt-2 uppercase">List Domain</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

