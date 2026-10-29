import { GAMES, PLATFORMS } from '../../lib/highlights';
import type { HlUser } from '../../lib/highlights';
import { field, pink, primary } from './styles';
import type { useUpload } from './useUpload';

type Props = { user: HlUser | null; form: ReturnType<typeof useUpload> };

const ACCEPT = 'image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,image/*,video/*';

/** The details that only make sense once a file is picked: title, game, platform and the Post button. */
function UploadDetails({ form }: { form: Props['form'] }) {
  const { title, game, platform, busy, progress, setTitle, setGame, setPlatform, upload } = form;
  return (
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
  );
}

function UploadForm({ form }: { form: Props['form'] }) {
  const { file, msg, fileRef, pick } = form;
  return (
    <div className="grid gap-4">
      <div>
        <input ref={fileRef} id="hl-file" type="file" accept={ACCEPT} className="sr-only" onChange={(e) => pick(e.target.files && e.target.files[0] ? e.target.files[0] : null)} />
        <label htmlFor="hl-file" tabIndex={0} role="button" className={`${primary} cursor-pointer w-full md:w-auto`} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}>
          {file ? `Selected: ${file.name.slice(0, 40)}` : 'Choose screenshot or clip'}
        </label>
        <p className="font-rajdhani text-sm text-gray-500 mt-2">JPG, PNG, WebP, MP4, WebM or MOV, up to 50 MB. PS5 clips are WebM: trim to 15-30 seconds in Media Gallery and you will fit.</p>
      </div>
      {file && <UploadDetails form={form} />}
      {msg && <p role="status" className={`font-rajdhani text-lg ${msg.ok ? 'text-green-400' : 'text-neonOrange'}`}>{msg.text}</p>}
      <p className="font-rajdhani text-sm text-gray-500">Only post your own captures from a game. Moderation is automatic: 10 uploads a day, and three reports from established accounts hide a post. Posting means you accept that.</p>
    </div>
  );
}

export default function UploadPanel({ user, form }: Props) {
  return (
    <section className="glass-card p-6 md:p-8 mb-8" aria-labelledby="hl-upload">
      <h2 id="hl-upload" className="font-orbitron text-xl text-neonPink mb-2">{user ? 'Post a highlight' : '2. Post a highlight'}</h2>
      {user ? (
        <UploadForm form={form} />
      ) : (
        <p className="font-rajdhani text-gray-400">Sign in first. We are not hosting anonymous clips of a stranger driving into the ocean. Well. Signed-in clips of that are fine.</p>
      )}
    </section>
  );
}
