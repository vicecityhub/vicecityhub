import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { CARD_SCROLL_STEP, MEDIA_TABS, cardsForTab, isCardOwner, mediaTabLabel, nextScrollLeft } from '../../lib/homeLogic';
import type { MediaCard, MediaType } from '../../lib/homeLogic';
import { MediaCardItem } from './MediaCardItem';
import { MediaComposerModal } from './MediaComposerModal';
import { useMediaCards } from './useMediaCards';

const arrowClass = (side: 'left' | 'right') =>
  `absolute ${side === 'left' ? 'left-[-22px]' : 'right-[-22px]'} top-1/2 -translate-y-1/2 z-10 w-11 h-11 rounded-full border border-neonCyan bg-[#0c0c1c]/90 text-neonCyan flex items-center justify-center hover:bg-neonCyan hover:text-black hover:scale-105 hover:shadow-[0_0_20px_rgba(0,255,255,0.4)] transition-all`;

const AUTO_SCROLL_MS = 10000;

/** Scroll the carousel one card every 10 s (wrapping at the end) unless the pointer is over it. */
function useAutoScroll(ref: React.RefObject<HTMLDivElement>, activeTab: MediaType, cards: MediaCard[], paused: boolean) {
  useEffect(() => {
    const container = ref.current;
    if (!container || paused) return;
    const interval = setInterval(() => {
      if (!container) return;
      container.scrollTo({
        left: nextScrollLeft(container.scrollLeft, container.clientWidth, container.scrollWidth),
        behavior: 'smooth',
      });
    }, AUTO_SCROLL_MS);
    return () => clearInterval(interval);
  }, [activeTab, cards, paused]);
}

/** "02 · Community Media": tabs, auto-scrolling card carousel and the add/edit modal. */
export function CommunityMedia({ session }: { session: any }) {
  const media = useMediaCards(session);
  const { activeTab, setActiveTab, cards, loading, composer } = media;

  const isLoggedIn = !!session?.user;
  const currentUserId = session?.user?.id || null;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollPaused, setScrollPaused] = useState(false);
  useAutoScroll(scrollRef, activeTab, cards, scrollPaused);

  const scrollBy = (left: number) => {
    const el = scrollRef.current;
    if (el) el.scrollBy({ left, behavior: 'smooth' });
  };

  const tabCards = cardsForTab(cards, activeTab);

  return (
    <section className="py-6 lg:py-8 px-6 max-w-[1280px] mx-auto">
      <div className="flex items-center gap-3 border-b border-white/5 pb-3 mb-5 lg:mb-6">
        <span className="font-orbitron text-xs text-neonPink font-extrabold tracking-widest">02</span>
        <h2 className="font-orbitron font-extrabold text-3xl tracking-widest uppercase">
          Community <span className="text-neonCyan">Media</span>
        </h2>
        <span className="text-[10px] font-bold text-gray-500 tracking-widest uppercase ml-auto hidden sm:inline">
          Trailers &amp; Creators
        </span>
        {isLoggedIn && (
          <button
            onClick={() => media.openComposer()}
            className="flex items-center gap-1.5 border border-neonCyan/30 text-neonCyan px-3 py-1.5 rounded hover:bg-neonCyan hover:text-black font-orbitron text-[10px] font-bold uppercase transition-all"
          >
            <Plus size={12} /> Submit
          </button>
        )}
      </div>

      {/* Media Tabs */}
      <div className="flex gap-4 border-b border-white/5 mb-5 overflow-x-auto pb-1 text-xs uppercase tracking-widest font-bold font-orbitron">
        {MEDIA_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 pr-4 transition-all capitalize ${activeTab === tab ? 'text-neonCyan border-b-2 border-neonCyan neon-text-cyan' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {mediaTabLabel(tab)}
          </button>
        ))}
      </div>

      {/* Cards — horizontal carousel with auto-scroll */}
      {loading ? (
        <div className="text-center text-gray-500 text-xs uppercase tracking-widest font-bold py-12">
          Loading...
        </div>
      ) : (
        <div className="relative w-full">
          {/* Left arrow */}
          <button
            onClick={() => scrollBy(-CARD_SCROLL_STEP)}
            aria-label="Previous" className={arrowClass('left')}
          >
            <ChevronLeft size={20} />
          </button>

          <div
            ref={scrollRef}
            onMouseEnter={() => setScrollPaused(true)}
            onMouseLeave={() => setScrollPaused(false)}
            className="flex gap-6 overflow-x-auto w-full py-2 scroll-smooth no-scrollbar snap-x snap-mandatory"
          >
            {tabCards.map(card => (
              <MediaCardItem
                key={card.id}
                card={card}
                isStreamerTab={activeTab === 'streamer'}
                isOwner={isCardOwner(currentUserId, card)}
                onEdit={() => media.openComposer(card)}
                onDelete={() => media.deleteCard(card.id)}
              />
            ))}

            {tabCards.length === 0 && (
              <div className="text-gray-500 text-xs uppercase tracking-widest font-bold py-12 text-center w-full">
                {isLoggedIn ? 'No cards yet — submit the first one.' : 'Nothing here yet.'}
              </div>
            )}
          </div>

          {/* Right arrow */}
          <button
            onClick={() => scrollBy(CARD_SCROLL_STEP)}
            aria-label="Next" className={arrowClass('right')}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      {/* Add/Edit card modal */}
      {composer.open && <MediaComposerModal composer={composer} activeTab={activeTab} />}
    </section>
  );
}
