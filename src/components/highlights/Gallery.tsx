import { KIND_OPTIONS, SORT_OPTIONS } from '../../lib/highlights';
import type { HlKind, HlSort, HlUser } from '../../lib/highlights';
import HighlightCard from './HighlightCard';
import { btn, primary } from './styles';
import type { useGallery } from './useGallery';

type Props = { user: HlUser | null; gallery: ReturnType<typeof useGallery> };

type PillsProps<T extends string> = {
  options: readonly (readonly [T, string])[];
  value: T;
  onPick: (v: T) => void;
  activeClass: string;
};

/** A row of toggle buttons: exactly one is pressed. */
function Pills<T extends string>({ options, value, onPick, activeClass }: PillsProps<T>) {
  return (
    <>
      {options.map(([k, l]) => (
        <button key={k} className={`${btn} min-h-[44px] py-2 ${value === k ? activeClass : 'border-white/20 text-gray-400'}`} onClick={() => onPick(k)} aria-pressed={value === k}>{l}</button>
      ))}
    </>
  );
}

/** "The wall": filters, the card grid, the empty state and Load more. */
export default function Gallery({ user, gallery }: Props) {
  const { items, loading, more, kind, sort, liked, reported, setKind, setSort, load, toggleLike, report, remove } = gallery;
  return (
    <section aria-labelledby="hl-gallery">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <h2 id="hl-gallery" className="font-orbitron text-2xl text-white">The wall</h2>
        <div className="flex gap-2 flex-wrap">
          <Pills<HlKind> options={KIND_OPTIONS} value={kind} onPick={setKind} activeClass="border-neonCyan text-neonCyan" />
          <Pills<HlSort> options={SORT_OPTIONS} value={sort} onPick={setSort} activeClass="border-neonPink text-neonPink" />
        </div>
      </div>

      {!loading && !items.length && (
        <p className="font-rajdhani text-xl text-gray-400 text-center py-12">Nothing here yet. Be the first. Set the bar low, we all started somewhere.</p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {items.map((h) => (
          <HighlightCard key={h.id} h={h} user={user} isLiked={liked.has(h.id)} isReported={reported.has(h.id)} onLike={toggleLike} onReport={report} onRemove={remove} />
        ))}
      </div>

      {more && <div className="text-center mt-8"><button className={primary} onClick={() => load(false)} disabled={loading}>{loading ? 'Loading...' : 'Load more'}</button></div>}
    </section>
  );
}
