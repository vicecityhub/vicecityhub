/*
  Supabase Storage (like most S3-compatible object storage) rejects keys
  containing spaces and several special characters with an "Invalid key"
  error. Browsers happily let users pick files with names like
  "Grand Theft Auto Online - Heists Trailer.mp4", so this needs to be
  sanitized before it ever reaches storage.upload().
*/
export function sanitizeFileName(name: string): string {
  const lastDot = name.lastIndexOf('.');
  const base = lastDot > 0 ? name.slice(0, lastDot) : name;
  const ext = lastDot > 0 ? name.slice(lastDot) : '';

  const safeBase = base
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip accents
    .replace(/[^a-zA-Z0-9_-]+/g, '-') // anything not alphanumeric/_/- becomes a dash
    .replace(/-+/g, '-') // collapse repeated dashes
    .replace(/^-|-$/g, '') // trim leading/trailing dashes
    .toLowerCase()
    .slice(0, 80); // keep keys reasonably short

  const safeExt = ext.toLowerCase().replace(/[^a-z0-9.]/g, '');

  return (safeBase || 'file') + safeExt;
}

export function buildStorageUploadPath(userId: string, originalFileName: string): string {
  return `${userId}/${Date.now()}-${sanitizeFileName(originalFileName)}`;
}
