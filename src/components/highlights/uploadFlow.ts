import { supa } from '../../lib/SupabaseClient';
import { buildStorageUploadPath } from '../../lib/fileUpload';
import { insertFailureMessage, mimeOf, storagePaths } from '../../lib/highlights';
import { makePoster } from './poster';
import { removeFiles, xhrUpload } from './storage';

export interface NewHighlight {
  userId: string; file: File; title: string; game: string; platform: string; onProgress: (p: number) => void;
}

async function requireAccessToken(): Promise<string> {
  const { data: s } = await supa.auth.getSession();
  const token = s.session?.access_token;
  if (!token) throw new Error('Your session expired. Sign in again.');
  return token;
}

/** Poster frame of a clip, uploaded next to it. Null when the browser cannot decode the clip or the poster upload fails: the post goes ahead without it. */
async function uploadPoster(file: File, userId: string, token: string): Promise<string | null> {
  const poster = await makePoster(file);
  if (!poster) return null;
  const path = buildStorageUploadPath(userId, 'poster.jpg');
  try {
    await xhrUpload(path, poster, token);
    return path;
  } catch (_e) {
    return null;
  }
}

/** Uploads the media (and a poster for clips), then records the row. A failed insert removes the files again. */
export async function postHighlight({ userId, file, title, game, platform, onProgress }: NewHighlight): Promise<void> {
  const token = await requireAccessToken();
  const mime = mimeOf(file);
  const isVideo = mime.indexOf('video/') === 0;
  const blob = mime === file.type ? file : file.slice(0, file.size, mime);
  const mediaPath = buildStorageUploadPath(userId, file.name);
  await xhrUpload(mediaPath, blob, token, onProgress);
  const posterPath = isVideo ? await uploadPoster(file, userId, token) : null;
  const { error } = await supa.from('highlights').insert({ kind: isVideo ? 'video' : 'image', media_path: mediaPath, poster_path: posterPath, title, game, platform });
  if (error) {
    await removeFiles(storagePaths(mediaPath, posterPath));
    throw new Error(insertFailureMessage(error.message));
  }
}
