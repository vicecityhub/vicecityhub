import { useRef, useState } from 'react';
import { GAMES, checkPickedFile, titleError, titleFromFileName } from '../../lib/highlights';
import type { HlMessage, HlUser } from '../../lib/highlights';
import { postHighlight } from './uploadFlow';

/** The "Post a highlight" form: picked file, title/game/platform, progress and the result message. */
export function useUpload(user: HlUser | null, onPosted: () => void) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [game, setGame] = useState(GAMES[0]);
  const [platform, setPlatform] = useState('ps5');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState<HlMessage | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = (f: File | null) => {
    setMsg(null);
    if (!f) return setFile(null);
    const problem = checkPickedFile(f);
    if (problem) { setFile(null); return setMsg({ ok: false, text: problem }); }
    setFile(f);
    if (!title) setTitle(titleFromFileName(f.name));
  };

  const resetForm = () => {
    setFile(null); setTitle('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const upload = async () => {
    if (!user || !file) return;
    const t = title.trim();
    const invalid = titleError(t);
    if (invalid) return setMsg({ ok: false, text: invalid });
    setBusy(true); setProgress(0); setMsg(null);
    try {
      await postHighlight({ userId: user.id, file, title: t, game, platform, onProgress: setProgress });
      resetForm();
      setMsg({ ok: true, text: 'Posted. Your best moment is now public. No pressure.' });
      onPosted();
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Upload failed.' });
    } finally { setBusy(false); }
  };

  return { file, title, game, platform, busy, progress, msg, fileRef, setTitle, setGame, setPlatform, pick, upload };
}
