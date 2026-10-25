import { useCallback, useEffect, useRef, useState } from 'react';
import { supa, SUPABASE_URL, SUPABASE_KEY } from '../lib/SupabaseClient';
import { buildStorageUploadPath } from '../lib/fileUpload';

// Highlights board: screenshots and short clips from the console (PS5 first), uploaded by signed-in players.
// Console-friendly on purpose: big buttons, visible focus rings, no drag-and-drop, no hover-only controls,
// and a "log in with your phone" code flow so nobody has to type a password with a D-pad.
// Docs: docs/HIGHLIGHTS.md

const BUCKET = 'highlights';
const FN = `${SUPABASE_URL}/functions/v1/device-login`;
const MAX_BYTES = 50 * 1024 * 1024;
const PAGE = 12;
const OK_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'];
const GAMES = ['GTA V', 'GTA Online', 'Red Dead Redemption 2', 'GTA VI', 'Other'];
const PLATFORMS: [string, string][] = [['ps5', 'PS5'], ['ps4', 'PS4'], ['xbox', 'Xbox'], ['pc', 'PC'], ['other', 'Other']];

interface HL {
  id: number; author_id: string; author_name: string; kind: 'image' | 'video'; media_path: string; poster_path: string | null;
  title: string; game: string; platform: string; likes: number; created_at: string;
}
interface Props { session: any; onOpenModal: (id: string, tab?: 'login' | 'register') => void }

const isConsole = () => typeof navigator !== 'undefined' && /PlayStation|Nintendo|Xbox/i.test(navigator.userAgent || '');
const urlOf = (path: string) => supa.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
const mimeOf = (f: File) => {
  if (f.type) return f.type;
  const ext = (f.name.split('.').pop() || '').toLowerCase();
  return ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' } as Record<string, string>)[ext] || '';
};
const ago = (iso: string) => {
  const s = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 1000));
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
};

function xhrUpload(path: string, blob: Blob, token: string, onProgress?: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('cacheControl', '31536000');
    form.append('', blob);
    const x = new XMLHttpRequest();
    x.open('POST', `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`);
    x.setRequestHeader('Authorization', `Bearer ${token}`);
    x.setRequestHeader('apikey', SUPABASE_KEY);
    x.setRequestHeader('x-upsert', 'false');
    if (x.upload && onProgress) x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    x.onload = () => {
      if (x.status >= 200 && x.status < 300) return resolve();
      let msg = `upload failed (${x.status})`;
      try { const j = JSON.parse(x.responseText); if (j && j.message) msg = String(j.message); } catch (_e) { /* keep default */ }
      reject(new Error(msg));
    };
    x.onerror = () => reject(new Error('network error during upload'));
    x.send(form);
  });
}

// Best effort: grab a frame from the clip as its poster. Returns null if the browser cannot decode the file.
function makePoster(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    let done = false;
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    const finish = (b: Blob | null) => { if (done) return; done = true; URL.revokeObjectURL(url); resolve(b); };
    const timer = setTimeout(() => finish(null), 8000);
    v.muted = true; v.preload = 'metadata'; v.playsInline = true; v.src = url;
    v.onerror = () => { clearTimeout(timer); finish(null); };
    v.onloadedmetadata = () => { try { v.currentTime = Math.min(1, (v.duration || 2) / 2); } catch (_e) { clearTimeout(timer); finish(null); } };
    v.onseeked = () => {
      try {
        const w = 640, h = Math.max(1, Math.round((v.videoHeight / (v.videoWidth || 1)) * w));
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const ctx = c.getContext('2d'); if (!ctx) { clearTimeout(timer); return finish(null); }
        ctx.drawImage(v, 0, 0, w, h);
        c.toBlob((b) => { clearTimeout(timer); finish(b); }, 'image/jpeg', 0.8);
      } catch (_e) { clearTimeout(timer); finish(null); }
    };
  });
}

export default function Highlights({ session, onOpenModal }: Props) {
  const user = session?.user || null;
  const consoleMode = isConsole();

  // ---------- gallery ----------
  const [items, setItems] = useState<HL[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [kind, setKind] = useState<'all' | 'image' | 'video'>('all');
  const [sort, setSort] = useState<'new' | 'top'>('new');
  const [liked, setLiked] = useState<Set<number>>(new Set());
  const [reported, setReported] = useState<Set<number>>(new Set());
  const pageRef = useRef(0);

  const load = useCallback(async (reset: boolean) => {
    setLoading(true);
    const page = reset ? 0 : pageRef.current;
    let q = supa.from('highlights').select('id, author_id, author_name, kind, media_path, poster_path, title, game, platform, likes, created_at').eq('status', 'approved');
    if (kind !== 'all') q = q.eq('kind', kind);
    q = sort === 'top' ? q.order('likes', { ascending: false }).order('created_at', { ascending: false }) : q.order('created_at', { ascending: false });
    const { data } = await q.range(page * PAGE, page * PAGE + PAGE - 1);
    const rows = (data || []) as HL[];
    setItems((prev) => (reset ? rows : [...prev, ...rows]));
    setMore(rows.length === PAGE);
    pageRef.current = page + 1;
    setLoading(false);
  }, [kind, sort]);

  useEffect(() => { pageRef.current = 0; load(true); }, [load]);

  useEffect(() => {
    if (!user || !items.length) return;
    supa.from('highlight_likes').select('highlight_id').in('highlight_id', items.map((i) => i.id)).then(({ data }) => {
      setLiked(new Set((data || []).map((r: any) => r.highlight_id)));
    });
  }, [user, items.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleLike = async (h: HL) => {
    if (!user) return onOpenModal('auth', 'login');
    const has = liked.has(h.id);
    setLiked((s) => { const n = new Set(s); if (has) n.delete(h.id); else n.add(h.id); return n; });
    setItems((arr) => arr.map((x) => (x.id === h.id ? { ...x, likes: Math.max(0, x.likes + (has ? -1 : 1)) } : x)));
    if (has) await supa.from('highlight_likes').delete().eq('highlight_id', h.id).eq('user_id', user.id);
    else await supa.from('highlight_likes').insert({ highlight_id: h.id });
  };
  const report = async (h: HL) => {
    if (!user) return onOpenModal('auth', 'login');
    if (!window.confirm('Report this highlight as abusive, illegal or not from a game? Three reports from established accounts hide it automatically.')) return;
    const { error } = await supa.from('highlight_reports').insert({ highlight_id: h.id });
    if (!error || /duplicate/i.test(error.message)) setReported((s) => new Set(s).add(h.id));
  };
  const remove = async (h: HL) => {
    if (!window.confirm('Delete this highlight for good?')) return;
    const { error } = await supa.from('highlights').delete().eq('id', h.id);
    if (error) return;
    const paths = [h.media_path, ...(h.poster_path ? [h.poster_path] : [])];
    await supa.storage.from(BUCKET).remove(paths);
    setItems((arr) => arr.filter((x) => x.id !== h.id));
  };

  // ---------- upload ----------
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [game, setGame] = useState(GAMES[0]);
  const [platform, setPlatform] = useState('ps5');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | null) => {
    setMsg(null);
    if (!f) return setFile(null);
    const t = mimeOf(f);
    if (OK_TYPES.indexOf(t) < 0) { setFile(null); return setMsg({ ok: false, text: `That file type (${t || 'unknown'}) is not supported. Use JPG, PNG, WebP, MP4, WebM or MOV.` }); }
    if (f.size > MAX_BYTES) { setFile(null); return setMsg({ ok: false, text: `That file is ${(f.size / 1048576).toFixed(0)} MB. The limit is 50 MB: trim the clip in the PS5 Media Gallery first.` }); }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 60));
  };

  const upload = async () => {
    if (!user || !file) return;
    const t = title.trim();
    if (t.length < 3) return setMsg({ ok: false, text: 'Give it a title (at least 3 characters). "untitled" is not a personality.' });
    setBusy(true); setProgress(0); setMsg(null);
    try {
      const { data: s } = await supa.auth.getSession();
      const token = s.session?.access_token;
      if (!token) throw new Error('Your session expired. Sign in again.');
      const mime = mimeOf(file);
      const isVideo = mime.indexOf('video/') === 0;
      const blob = mime === file.type ? file : file.slice(0, file.size, mime);
      const mediaPath = buildStorageUploadPath(user.id, file.name);
      await xhrUpload(mediaPath, blob, token, setProgress);
      let posterPath: string | null = null;
      if (isVideo) {
        const poster = await makePoster(file);
        if (poster) {
          posterPath = buildStorageUploadPath(user.id, 'poster.jpg');
          try { await xhrUpload(posterPath, poster, token); } catch (_e) { posterPath = null; }
        }
      }
      const { error } = await supa.from('highlights').insert({ kind: isVideo ? 'video' : 'image', media_path: mediaPath, poster_path: posterPath, title: t, game, platform });
      if (error) {
        await supa.storage.from(BUCKET).remove([mediaPath, ...(posterPath ? [posterPath] : [])]);
        throw new Error(/daily_limit/.test(error.message) ? 'Daily limit reached: 10 uploads per 24 hours. Quality over quantity, champ.' : error.message);
      }
      setFile(null); setTitle(''); if (fileRef.current) fileRef.current.value = '';
      setMsg({ ok: true, text: 'Posted. Your best moment is now public. No pressure.' });
      pageRef.current = 0; setSort('new'); setKind('all'); load(true);
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Upload failed.' });
    } finally { setBusy(false); }
  };

  // ---------- console login with a code (console side) ----------
  const [dl, setDl] = useState<{ code: string; secret: string } | null>(null);
  const [dlState, setDlState] = useState<'idle' | 'waiting' | 'expired' | 'error'>('idle');
  const pollTimer = useRef<number | null>(null);
  const stopPoll = () => { if (pollTimer.current) { window.clearTimeout(pollTimer.current); pollTimer.current = null; } };
  useEffect(() => stopPoll, []);

  const startDeviceLogin = async () => {
    stopPoll(); setDlState('waiting');
    try {
      const r = await fetch(`${FN}/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (!r.ok) throw new Error('start failed');
      const j = await r.json();
      setDl({ code: j.code, secret: j.secret });
      const deadline = Date.now() + (j.expires_in || 600) * 1000;
      const tick = async () => {
        if (Date.now() > deadline) { setDlState('expired'); return; }
        try {
          const pr = await fetch(`${FN}/poll`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: j.secret }) });
          if (pr.status === 200) {
            const pj = await pr.json();
            const { error } = await supa.auth.verifyOtp({ token_hash: pj.token_hash, type: 'magiclink' });
            if (error) { setDlState('error'); return; }
            setDl(null); setDlState('idle'); return;
          }
          if (pr.status === 410) { setDlState('expired'); return; }
        } catch (_e) { /* transient, keep polling */ }
        pollTimer.current = window.setTimeout(tick, 3000);
      };
      pollTimer.current = window.setTimeout(tick, 3000);
    } catch (_e) { setDlState('error'); }
  };

  // ---------- phone side: approve a console ----------
  const [linkCode, setLinkCode] = useState('');
  const [linkInfo, setLinkInfo] = useState<{ device: string; ago: number } | null>(null);
  const [linkMsg, setLinkMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const callFn = async (path: string, body: object) => {
    const { data: s } = await supa.auth.getSession();
    const r = await fetch(`${FN}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s.session?.access_token || ''}` }, body: JSON.stringify(body) });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  };
  const inspectCode = async () => {
    setLinkMsg(null); setLinkInfo(null);
    const r = await callFn('/inspect', { code: linkCode });
    if (r.status !== 200) return setLinkMsg({ ok: false, text: r.body.error || 'Could not check that code.' });
    setLinkInfo({ device: r.body.device, ago: r.body.requested_ago_s });
  };
  const approveCode = async () => {
    const r = await callFn('/approve', { code: linkCode });
    if (r.status !== 200) return setLinkMsg({ ok: false, text: r.body.error || 'Could not approve.' });
    setLinkInfo(null); setLinkCode('');
    setLinkMsg({ ok: true, text: 'Done. The console is signed in as you. Go play, then go upload.' });
  };

  useEffect(() => {
    if (window.location.hash === '#link') setTimeout(() => document.getElementById('link')?.scrollIntoView(), 300);
  }, [user]);

  const btn = 'hl-btn inline-flex items-center justify-center min-h-[56px] px-6 py-3 rounded-lg font-orbitron font-bold uppercase tracking-wider text-sm border-2 transition-all';
  const primary = `${btn} border-neonCyan text-neonCyan hover:bg-neonCyan/10 disabled:opacity-40`;
  const pink = `${btn} border-neonPink text-neonPink hover:bg-neonPink/10 disabled:opacity-40`;
  const ghost = `${btn} border-white/20 text-gray-300 hover:border-white/50 disabled:opacity-40`;
  const field = 'hl-btn w-full min-h-[52px] px-4 rounded-lg bg-black/40 border-2 border-white/15 text-white placeholder-gray-500';

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <style>{`.hl-btn:focus,.hl-btn:focus-visible,.hl-card button:focus-visible{outline:3px solid #FFE135;outline-offset:3px}`}</style>

      <header className="mb-8 text-center">
        <h1 className="font-orbitron text-3xl md:text-5xl font-black text-white neon-text-cyan mb-3">HIGHLIGHTS</h1>
        <p className="font-rajdhani text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
          Your best 15 seconds of GTA, minus the 3 hours of falling off a bike. Upload straight from your console, sign in once, brag forever.
        </p>
        {consoleMode && <p className="mt-3 inline-block px-4 py-2 rounded-lg border border-neonYellow/60 text-neonYellow font-rajdhani">Console browser detected. Big buttons mode is on. If the file picker does not open, use the phone code below.</p>}
      </header>

      {/* ---------- sign-in for consoles ---------- */}
      {!user && (
        <section className="glass-card p-6 md:p-8 mb-8" aria-labelledby="hl-login">
          <h2 id="hl-login" className="font-orbitron text-xl text-neonPink mb-2">1. Sign in</h2>
          <p className="font-rajdhani text-gray-300 mb-5">Typing a password with a D-pad is a crime. Pick your pain level:</p>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-white/10 p-5">
              <h3 className="font-orbitron text-sm text-neonCyan mb-2">Easy: use your phone</h3>
              <p className="font-rajdhani text-gray-400 mb-4">Get a code here, type it on your phone (where you are already signed in), done. No passwords on the console.</p>
              {dlState === 'waiting' && dl ? (
                <div>
                  <div className="font-orbitron text-4xl md:text-5xl tracking-[0.2em] text-neonYellow text-center py-4" aria-live="polite">{dl.code}</div>
                  <p className="font-rajdhani text-gray-300 text-center">On your phone open <strong className="text-white">vicecityhub.github.io/vicecityhub/highlights.html#link</strong>, sign in, and enter this code. Waiting...</p>
                </div>
              ) : (
                <button className={primary} onClick={startDeviceLogin}>Get a phone code</button>
              )}
              {dlState === 'expired' && <p className="mt-3 font-rajdhani text-neonOrange">Code expired. Get a new one.</p>}
              {dlState === 'error' && <p className="mt-3 font-rajdhani text-neonOrange">Something broke on our side. Try again in a minute.</p>}
            </div>
            <div className="rounded-lg border border-white/10 p-5">
              <h3 className="font-orbitron text-sm text-neonCyan mb-2">Hard: email and password</h3>
              <p className="font-rajdhani text-gray-400 mb-4">Works everywhere. On a console it takes about as long as a GTA Online loading screen.</p>
              <div className="flex gap-3 flex-wrap">
                <button className={ghost} onClick={() => onOpenModal('auth', 'login')}>Log in</button>
                <button className={ghost} onClick={() => onOpenModal('auth', 'register')}>Create account</button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ---------- upload ---------- */}
      <section className="glass-card p-6 md:p-8 mb-8" aria-labelledby="hl-upload">
        <h2 id="hl-upload" className="font-orbitron text-xl text-neonPink mb-2">{user ? 'Post a highlight' : '2. Post a highlight'}</h2>
        {!user ? (
          <p className="font-rajdhani text-gray-400">Sign in first. We are not hosting anonymous clips of a stranger driving into the ocean. Well. Signed-in clips of that are fine.</p>
        ) : (
          <div className="grid gap-4">
            <div>
              <input ref={fileRef} id="hl-file" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,image/*,video/*" className="sr-only" onChange={(e) => pick(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
              <label htmlFor="hl-file" tabIndex={0} role="button" className={`${primary} cursor-pointer w-full md:w-auto`} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}>
                {file ? `Selected: ${file.name.slice(0, 40)}` : 'Choose screenshot or clip'}
              </label>
              <p className="font-rajdhani text-sm text-gray-500 mt-2">JPG, PNG, WebP, MP4, WebM or MOV, up to 50 MB. PS5 clips are WebM: trim to 15-30 seconds in Media Gallery and you will fit.</p>
            </div>
            {file && (
              <>
                <input className={field} value={title} maxLength={80} placeholder="Title (what happened?)" aria-label="Title" onChange={(e) => setTitle(e.target.value)} />
                <div className="grid grid-cols-2 gap-4">
                  <select className={field} value={game} onChange={(e) => setGame(e.target.value)} aria-label="Game">{GAMES.map((g) => <option key={g}>{g}</option>)}</select>
                  <select className={field} value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label="Platform">{PLATFORMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                </div>
                <div>
                  <button className={pink} onClick={upload} disabled={busy}>{busy ? `Uploading ${Math.round(progress * 100)}%` : 'Post it'}</button>
                </div>
              </>
            )}
            {msg && <p role="status" className={`font-rajdhani text-lg ${msg.ok ? 'text-green-400' : 'text-neonOrange'}`}>{msg.text}</p>}
            <p className="font-rajdhani text-sm text-gray-500">Only post your own captures from a game. Moderation is automatic: 10 uploads a day, and three reports from established accounts hide a post. Posting means you accept that.</p>
          </div>
        )}
      </section>

      {/* ---------- how to get clips from a PS5 ---------- */}
      <section className="glass-card p-6 md:p-8 mb-8" aria-labelledby="hl-how">
        <h2 id="hl-how" className="font-orbitron text-xl text-neonCyan mb-3">Getting a clip off your PS5</h2>
        <ol className="font-rajdhani text-lg text-gray-300 list-decimal pl-6 space-y-2">
          <li>Capture it: press Create, or hold it to save the last few minutes. Trim it in Media Gallery.</li>
          <li><strong className="text-white">On the console browser:</strong> open this page, sign in with the phone code, press &quot;Choose screenshot or clip&quot;. If your console browser offers a file picker, you are done in three clicks.</li>
          <li><strong className="text-white">If the console will not open a picker</strong> (some console browsers will not): send the capture to your phone through the PlayStation App captures, save it to your camera roll, open this page on the phone and upload there. Same account, same board.</li>
        </ol>
      </section>

      {/* ---------- phone side: approve a console ---------- */}
      <section id="link" className="glass-card p-6 md:p-8 mb-10" aria-labelledby="hl-link">
        <h2 id="hl-link" className="font-orbitron text-xl text-neonYellow mb-2">Link a console to your account</h2>
        {!user ? (
          <div>
            <p className="font-rajdhani text-gray-300 mb-4">Your console is showing a code? Sign in on this device first, then enter it here.</p>
            <button className={primary} onClick={() => onOpenModal('auth', 'login')}>Log in</button>
          </div>
        ) : (
          <div className="grid gap-4 max-w-md">
            <p className="font-rajdhani text-gray-300">Enter the code from your console&apos;s screen.</p>
            <input className={`${field} font-orbitron tracking-widest uppercase`} value={linkCode} maxLength={9} placeholder="ABCD-2345" aria-label="Console code" onChange={(e) => { setLinkCode(e.target.value); setLinkInfo(null); setLinkMsg(null); }} />
            {!linkInfo && <div><button className={primary} onClick={inspectCode} disabled={linkCode.replace(/[^A-Za-z0-9]/g, '').length !== 8}>Check code</button></div>}
            {linkInfo && (
              <div className="rounded-lg border border-neonOrange/60 p-4">
                <p className="font-rajdhani text-lg text-white mb-2">Request from: <strong>{linkInfo.device}</strong>, {linkInfo.ago < 90 ? `${linkInfo.ago}s` : `${Math.round(linkInfo.ago / 60)} min`} ago.</p>
                <p className="font-rajdhani text-neonOrange mb-4">Only approve if that code is on YOUR screen, right now. Anyone who shows you a code and asks you to enter it is asking for the keys to your account.</p>
                <div className="flex gap-3 flex-wrap">
                  <button className={pink} onClick={approveCode}>Yes, sign my console in</button>
                  <button className={ghost} onClick={() => { setLinkInfo(null); setLinkCode(''); }}>Cancel</button>
                </div>
              </div>
            )}
            {linkMsg && <p role="status" className={`font-rajdhani text-lg ${linkMsg.ok ? 'text-green-400' : 'text-neonOrange'}`}>{linkMsg.text}</p>}
          </div>
        )}
      </section>

      {/* ---------- gallery ---------- */}
      <section aria-labelledby="hl-gallery">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h2 id="hl-gallery" className="font-orbitron text-2xl text-white">The wall</h2>
          <div className="flex gap-2 flex-wrap">
            {([['all', 'All'], ['image', 'Screenshots'], ['video', 'Clips']] as const).map(([k, l]) => (
              <button key={k} className={`${btn} min-h-[44px] py-2 ${kind === k ? 'border-neonCyan text-neonCyan' : 'border-white/20 text-gray-400'}`} onClick={() => setKind(k)} aria-pressed={kind === k}>{l}</button>
            ))}
            {([['new', 'Newest'], ['top', 'Top']] as const).map(([k, l]) => (
              <button key={k} className={`${btn} min-h-[44px] py-2 ${sort === k ? 'border-neonPink text-neonPink' : 'border-white/20 text-gray-400'}`} onClick={() => setSort(k)} aria-pressed={sort === k}>{l}</button>
            ))}
          </div>
        </div>

        {!loading && !items.length && (
          <p className="font-rajdhani text-xl text-gray-400 text-center py-12">Nothing here yet. Be the first. Set the bar low, we all started somewhere.</p>
        )}

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((h) => (
            <article key={h.id} className="hl-card glass-card overflow-hidden flex flex-col">
              {h.kind === 'image' ? (
                <a href={urlOf(h.media_path)} target="_blank" rel="noopener noreferrer" className="block bg-black">
                  <img src={urlOf(h.media_path)} alt={h.title} loading="lazy" decoding="async" className="w-full aspect-video object-cover" />
                </a>
              ) : (
                <video className="w-full aspect-video bg-black" controls preload="none" playsInline poster={h.poster_path ? urlOf(h.poster_path) : undefined} src={`${urlOf(h.media_path)}#t=0.1`} />
              )}
              <div className="p-4 flex-1 flex flex-col gap-2">
                <h3 className="font-orbitron text-sm text-white break-words">{h.title}</h3>
                <p className="font-rajdhani text-gray-400 text-sm">{h.game} &middot; {(PLATFORMS.find((p) => p[0] === h.platform) || ['', h.platform])[1]} &middot; by {h.author_name} &middot; {ago(h.created_at)}</p>
                <div className="mt-auto flex items-center gap-2 pt-2 flex-wrap">
                  <button className={`${btn} min-h-[44px] py-2 px-4 ${liked.has(h.id) ? 'border-neonPink text-neonPink' : 'border-white/20 text-gray-300'}`} onClick={() => toggleLike(h)} aria-pressed={liked.has(h.id)}>
                    {liked.has(h.id) ? '♥' : '♡'} {h.likes}
                  </button>
                  {user && user.id === h.author_id ? (
                    <button className={`${btn} min-h-[44px] py-2 px-4 border-white/20 text-gray-400`} onClick={() => remove(h)}>Delete</button>
                  ) : (
                    <button className={`${btn} min-h-[44px] py-2 px-4 border-white/20 text-gray-400`} onClick={() => report(h)} disabled={reported.has(h.id)}>{reported.has(h.id) ? 'Reported' : 'Report'}</button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>

        {more && <div className="text-center mt-8"><button className={primary} onClick={() => load(false)} disabled={loading}>{loading ? 'Loading...' : 'Load more'}</button></div>}
      </section>
    </div>
  );
}
