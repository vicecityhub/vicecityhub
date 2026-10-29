// Best effort: grab a frame from the clip as its poster. Returns null if the browser cannot decode the file.

const POSTER_WIDTH = 640;
const POSTER_TIMEOUT_MS = 8000;

/** Draws the current video frame onto a canvas and hands back a JPEG, or null when 2D canvas is unavailable. */
function frameToJpeg(v: HTMLVideoElement, done: (b: Blob | null) => void) {
  const w = POSTER_WIDTH, h = Math.max(1, Math.round((v.videoHeight / (v.videoWidth || 1)) * w));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return done(null);
  ctx.drawImage(v, 0, 0, w, h);
  c.toBlob(done, 'image/jpeg', 0.8);
}

export function makePoster(file: File): Promise<Blob | null> {
  return new Promise((resolve) => {
    let settled = false;
    const url = URL.createObjectURL(file);
    const v = document.createElement('video');
    const timer = setTimeout(() => finish(null), POSTER_TIMEOUT_MS);
    // Every exit goes through here: once, timer cleared, object URL released.
    const finish = (b: Blob | null) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(b);
    };
    v.muted = true; v.preload = 'metadata'; v.playsInline = true; v.src = url;
    v.onerror = () => finish(null);
    v.onloadedmetadata = () => { try { v.currentTime = Math.min(1, (v.duration || 2) / 2); } catch (_e) { finish(null); } };
    v.onseeked = () => { try { frameToJpeg(v, finish); } catch (_e) { finish(null); } };
  });
}
