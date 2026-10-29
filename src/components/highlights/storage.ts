import { supa, SUPABASE_URL, SUPABASE_KEY } from '../../lib/SupabaseClient';
import { BUCKET, isHttpOk, uploadFailureMessage } from '../../lib/highlights';

export const urlOf = (path: string) => supa.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

export const removeFiles = (paths: string[]) => supa.storage.from(BUCKET).remove(paths);

function uploadForm(blob: Blob): FormData {
  const form = new FormData();
  form.append('cacheControl', '31536000');
  form.append('', blob);
  return form;
}

function openUpload(x: XMLHttpRequest, path: string, token: string) {
  x.open('POST', `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`);
  x.setRequestHeader('Authorization', `Bearer ${token}`);
  x.setRequestHeader('apikey', SUPABASE_KEY);
  x.setRequestHeader('x-upsert', 'false');
}

function reportProgress(x: XMLHttpRequest, onProgress?: (p: number) => void) {
  if (!x.upload || !onProgress) return;
  x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
}

/** Upload with progress (fetch cannot report it). Rejects with the server's message when there is one. */
export function xhrUpload(path: string, blob: Blob, token: string, onProgress?: (p: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    openUpload(x, path, token);
    reportProgress(x, onProgress);
    x.onload = () => (isHttpOk(x.status) ? resolve() : reject(new Error(uploadFailureMessage(x.status, x.responseText))));
    x.onerror = () => reject(new Error('network error during upload'));
    x.send(uploadForm(blob));
  });
}
