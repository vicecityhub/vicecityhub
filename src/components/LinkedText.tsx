import React, { useState, useEffect } from 'react';
import { Play } from 'lucide-react';
import { supa } from '../lib/SupabaseClient';

/*
  Renders plain text, auto-detecting URLs and turning them into clickable
  links. Two preview paths exist:

  1. YouTube links get an instant thumbnail via Google's public,
     no-key-required endpoint (img.youtube.com) — no network round trip
     to our own backend needed.
  2. Any other link gets a rich preview (title/description/image) by
     calling the "link-preview" Supabase Edge Function, which crawls the
     target page server-side and extracts Open Graph meta tags — the
     same mechanism X/Twitter, Discord, and Slack use. Results are cached
     server-side for 7 days, so this stays cheap even with repeat views.

  If the Edge Function fails or the target site has no Open Graph tags,
  the link still renders as plain clickable text — there's no broken UI,
  just no preview card underneath.
*/

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  site_name: string | null;
}

function GenericLinkPreview({ url }: { url: string }) {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supa.functions
      .invoke('link-preview', { body: { url } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data || data.error) {
          setFailed(true);
        } else {
          setPreview(data as LinkPreviewData);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (failed || !preview || (!preview.title && !preview.image)) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="block mt-2 rounded overflow-hidden border border-white/10 hover:border-neonCyan/40 transition-colors max-w-sm bg-white/[0.02]"
    >
      {preview.image && (
        <div className="w-full max-h-[300px] bg-black/30 flex items-center justify-center">
          <img src={preview.image} alt="" className="w-full max-h-[300px] object-contain" loading="lazy" />
        </div>
      )}
      <div className="p-2.5 min-w-0 flex flex-col gap-0.5">
        {preview.site_name && (
          <span className="text-[9px] text-gray-500 uppercase tracking-widest font-bold truncate">
            {preview.site_name}
          </span>
        )}
        {preview.title && (
          <span className="text-xs text-gray-200 font-bold leading-snug line-clamp-2">{preview.title}</span>
        )}
        {preview.description && (
          <span className="text-[10px] text-gray-500 leading-snug line-clamp-2">{preview.description}</span>
        )}
      </div>
    </a>
  );
}

function YouTubeThumb({ id }: { id: string }) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="mt-2 rounded overflow-hidden border border-white/10 bg-black w-full h-full min-h-[200px]">
        <iframe
          src={`https://www.youtube.com/embed/${id}?autoplay=1`}
          title="YouTube video player"
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setPlaying(true);
      }}
      className="block mt-2 rounded overflow-hidden border border-white/10 hover:border-neonCyan/40 transition-colors max-w-sm relative group w-full text-left"
    >
      <img
        src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`}
        alt="YouTube video thumbnail"
        className="w-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
        <div className="bg-black/70 rounded-full p-3">
          <Play size={18} className="text-white" fill="currentColor" />
        </div>
      </div>
    </button>
  );
}

// Pure helper: pulls every URL out of a block of text and sorts them into
// "is a YouTube video" vs "everything else", without producing any JSX.
// Shared by both LinkedText (inline clickable text) and LinkPreviewBlock
// (standalone preview cards, used when the text itself is visually
// truncated via line-clamp and the preview needs to render outside that
// truncated area).
function extractLinks(text: string): { youtubeIds: string[]; genericUrls: string[] } {
  const matches = text.match(URL_REGEX) || [];
  const youtubeIds: string[] = [];
  const genericUrls: string[] = [];

  for (const raw of matches) {
    const trailingPunctMatch = raw.match(/([.,!?;:]+)$/);
    const cleanUrl = trailingPunctMatch ? raw.slice(0, -trailingPunctMatch[1].length) : raw;
    const ytId = extractYouTubeId(cleanUrl);
    if (ytId) {
      if (!youtubeIds.includes(ytId)) youtubeIds.push(ytId);
    } else if (!genericUrls.includes(cleanUrl)) {
      genericUrls.push(cleanUrl);
    }
  }

  return { youtubeIds, genericUrls };
}

interface LinkedTextProps {
  text: string;
  className?: string;
  showPreview?: boolean;
}

export default function LinkedText({ text, className, showPreview = true }: LinkedTextProps) {
  const parts = text.split(URL_REGEX);
  const { youtubeIds, genericUrls } = extractLinks(text);

  const rendered = parts.map((part, i) => {
    if (part.match(URL_REGEX)) {
      const trailingPunctMatch = part.match(/([.,!?;:]+)$/);
      const cleanUrl = trailingPunctMatch ? part.slice(0, -trailingPunctMatch[1].length) : part;
      const trailing = trailingPunctMatch ? trailingPunctMatch[1] : '';

      return (
        <React.Fragment key={i}>
          <a
            href={cleanUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-neonCyan hover:underline break-all"
          >
            {cleanUrl}
          </a>
          {trailing}
        </React.Fragment>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });

  return (
    <span className={className}>
      {rendered}
      {showPreview && youtubeIds.map((id) => <YouTubeThumb key={id} id={id} />)}
      {showPreview && genericUrls.map((url) => <GenericLinkPreview key={url} url={url} />)}
    </span>
  );
}

/*
  Renders ONLY the preview cards (YouTube thumbnail or generic Open Graph
  card) for every URL found in `text`, with no clickable inline text at
  all. Used when the text itself is shown elsewhere with showPreview=false
  (e.g. inside a line-clamp-3 truncated paragraph in a feed card) — this
  component renders the preview card as a sibling, outside the truncated
  area, so it doesn't get visually clipped or hidden.
*/
export function LinkPreviewOnly({ text }: { text: string }) {
  const { youtubeIds, genericUrls } = extractLinks(text);
  if (youtubeIds.length === 0 && genericUrls.length === 0) return null;

  return (
    <>
      {youtubeIds.map((id) => <YouTubeThumb key={id} id={id} />)}
      {genericUrls.map((url) => <GenericLinkPreview key={url} url={url} />)}
    </>
  );
}
