// Pure dashboard logic (no React, no Supabase): turns form state into database rows and back.
// Extracted from Layout.tsx; validation messages, field names and reset rules are unchanged.

export type SubmitType = 'forum' | 'domain' | 'news' | 'stream' | 'podcast';

export interface ForumForm { title: string; body: string }
export interface DomainForm { name: string; price: string; desc: string }
export interface NewsForm { title: string; body: string; tag: string; src: string; url: string; featured: boolean; stars: number }
export interface StreamForm { name: string; plat: string; yt: string; tw: string; desc: string }
export interface PodcastForm { name: string; url: string; desc: string }

export interface SubmitForms {
  forum: ForumForm;
  domain: DomainForm;
  news: NewsForm;
  stream: StreamForm;
  podcast: PodcastForm;
}

export const EMPTY_FORMS: SubmitForms = {
  forum: { title: '', body: '' },
  domain: { name: '', price: '', desc: '' },
  news: { title: '', body: '', tag: 'Official', src: '', url: '', featured: false, stars: 0 },
  stream: { name: '', plat: '', yt: '', tw: '', desc: '' },
  podcast: { name: '', url: '', desc: '' },
};

export interface Author { id: string; name: string }

export type DashRowResult =
  | { ok: false; error: string }
  | { ok: true; table: 'posts' | 'news'; row: Record<string, any>; next: SubmitForms };

type Built = { error: string } | { fields: Record<string, any>; next: SubmitForms };

const buildForum = (forms: SubmitForms): Built => {
  const f = forms.forum;
  if (!f.title.trim() || !f.body.trim()) return { error: 'Title and body required.' };
  return { fields: { title: f.title, body: f.body }, next: { ...forms, forum: EMPTY_FORMS.forum } };
};

/** Tag = the part after the last dot of the domain name (only when it has a dot). */
const domainTag = (name: string): string | undefined => (name.includes('.') ? name.split('.').pop()?.toLowerCase() : undefined);

const buildDomain = (forms: SubmitForms): Built => {
  const f = forms.domain;
  if (!f.name.trim()) return { error: 'Domain name required.' };
  const meta: Record<string, any> = { price: f.price };
  if (f.name.includes('.')) meta.tag = domainTag(f.name);
  return { fields: { title: f.name, body: f.desc, meta: JSON.stringify(meta) }, next: { ...forms, domain: EMPTY_FORMS.domain } };
};

const buildNews = (forms: SubmitForms): Built => {
  const f = forms.news;
  if (!f.title.trim() || !f.src.trim()) return { error: 'Headline and source name required.' };
  const hasBody = !!f.body.trim();
  return {
    fields: {
      title: f.title,
      body: hasBody ? f.body : 'Community submitted news',
      summary: hasBody ? f.body.slice(0, 180) : '',
      category: f.tag,
      source_url: f.url,
      is_published: true,
      is_featured: f.featured,
      meta: JSON.stringify({ source_name: f.src, stars: f.stars }),
    },
    // the category tag is deliberately kept between submissions
    next: { ...forms, news: { ...f, title: '', body: '', src: '', url: '', featured: false, stars: 0 } },
  };
};

const buildStream = (forms: SubmitForms): Built => {
  const f = forms.stream;
  if (!f.name.trim()) return { error: 'Channel name required.' };
  return {
    fields: { title: f.name, body: f.desc, meta: JSON.stringify({ platform: f.plat, yt: f.yt, tw: f.tw }) },
    next: { ...forms, stream: EMPTY_FORMS.stream },
  };
};

const buildPodcast = (forms: SubmitForms): Built => {
  const f = forms.podcast;
  if (!f.name.trim()) return { error: 'Show name required.' };
  return {
    fields: { title: f.name, body: f.desc, meta: JSON.stringify({ url: f.url }) },
    next: { ...forms, podcast: EMPTY_FORMS.podcast },
  };
};

const BUILDERS: Record<SubmitType, (forms: SubmitForms) => Built> = {
  forum: buildForum,
  domain: buildDomain,
  news: buildNews,
  stream: buildStream,
  podcast: buildPodcast,
};

/** Validate one dashboard form and build the row to insert plus the form state to show afterwards. */
export function buildDashRow(type: SubmitType, forms: SubmitForms, author: Author): DashRowResult {
  const built = BUILDERS[type](forms);
  if ('error' in built) return { ok: false, error: built.error };
  return {
    ok: true,
    table: type === 'news' ? 'news' : 'posts',
    row: { author_id: author.id, author_name: author.name, type, ...built.fields },
    next: built.next,
  };
}

/** Asking price stored in a post's meta (JSON string or object); '' when absent or unparsable. */
export function getPostPrice(meta: unknown): string {
  if (!meta) return '';
  try {
    const parsed: any = typeof meta === 'string' ? JSON.parse(meta) : meta;
    return parsed.price || '';
  } catch {
    return '';
  }
}

export function validateEditedPost(title: string, body: string): string | null {
  return !title.trim() || !body.trim() ? 'Title and body required.' : null;
}

/** Meta JSON written when a domain listing is edited; other post types clear their meta. */
export function buildEditMeta(type: string, title: string, price: string): string | null {
  if (type !== 'domain') return null;
  return JSON.stringify({ price, tag: title.includes('.') ? title.split('.').pop()?.toLowerCase() : 'nft' });
}

export interface ProfileForm { displayName: string; bio: string; rsc: string; psn: string; platform: string; gangTag: string }

export const EMPTY_PROFILE_FORM: ProfileForm = { displayName: '', bio: '', rsc: '', psn: '', platform: 'pc', gangTag: '' };

export function profileFormFromRow(row: any): ProfileForm {
  return {
    displayName: row.display_name || '',
    bio: row.bio || '',
    rsc: row.rsc_username || '',
    psn: row.psn_username || '',
    platform: row.platform || 'pc',
    gangTag: row.gang_tag || '',
  };
}

export function buildProfilePayload(userId: string, f: ProfileForm) {
  return {
    user_id: userId,
    display_name: f.displayName.trim(),
    bio: f.bio.trim() || null,
    rsc_username: f.rsc.trim() || null,
    psn_username: f.psn.trim() || null,
    platform: f.platform,
    gang_tag: f.gangTag.trim() || null,
  };
}

/** Storage path of a user's avatar: `<user id>/avatar.<extension of the uploaded file>`. */
export function avatarStoragePath(userId: string, fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
  return `${userId}/avatar.${ext}`;
}
