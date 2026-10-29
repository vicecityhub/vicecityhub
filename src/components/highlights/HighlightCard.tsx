import { ago, platformLabel } from '../../lib/highlights';
import type { HL, HlUser } from '../../lib/highlights';
import { btn } from './styles';
import { urlOf } from './storage';

type Props = {
  h: HL;
  user: HlUser | null;
  isLiked: boolean;
  isReported: boolean;
  onLike: (h: HL) => void;
  onReport: (h: HL) => void;
  onRemove: (h: HL) => void;
};

const small = `${btn} min-h-[44px] py-2 px-4`;

function Media({ h }: { h: HL }) {
  if (h.kind === 'image') {
    return (
      <a href={urlOf(h.media_path)} target="_blank" rel="noopener noreferrer" className="block bg-black">
        <img src={urlOf(h.media_path)} alt={h.title} loading="lazy" decoding="async" className="w-full aspect-video object-cover" />
      </a>
    );
  }
  return <video className="w-full aspect-video bg-black" controls preload="none" playsInline poster={h.poster_path ? urlOf(h.poster_path) : undefined} src={`${urlOf(h.media_path)}#t=0.1`} />;
}

/** Delete for your own posts, Report for everyone else's. */
function OwnerOrReport({ h, user, isReported, onReport, onRemove }: Pick<Props, 'h' | 'user' | 'isReported' | 'onReport' | 'onRemove'>) {
  if (user && user.id === h.author_id) {
    return <button className={`${small} border-white/20 text-gray-400`} onClick={() => onRemove(h)}>Delete</button>;
  }
  return <button className={`${small} border-white/20 text-gray-400`} onClick={() => onReport(h)} disabled={isReported}>{isReported ? 'Reported' : 'Report'}</button>;
}

export default function HighlightCard({ h, user, isLiked, isReported, onLike, onReport, onRemove }: Props) {
  return (
    <article className="hl-card glass-card overflow-hidden flex flex-col">
      <Media h={h} />
      <div className="p-4 flex-1 flex flex-col gap-2">
        <h3 className="font-orbitron text-sm text-white break-words">{h.title}</h3>
        <p className="font-rajdhani text-gray-400 text-sm">{h.game} &middot; {platformLabel(h.platform)} &middot; by {h.author_name} &middot; {ago(h.created_at)}</p>
        <div className="mt-auto flex items-center gap-2 pt-2 flex-wrap">
          <button className={`${small} ${isLiked ? 'border-neonPink text-neonPink' : 'border-white/20 text-gray-300'}`} onClick={() => onLike(h)} aria-pressed={isLiked}>
            {isLiked ? '♥' : '♡'} {h.likes}
          </button>
          <OwnerOrReport h={h} user={user} isReported={isReported} onReport={onReport} onRemove={onRemove} />
        </div>
      </div>
    </article>
  );
}
