import { useEffect, useRef, useState } from 'react';

interface LazyVideoProps {
  src: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Decorative autoplay video that only starts downloading when it is about to scroll into view.
 * Keeps multi-megabyte banner videos out of the initial page load (LCP / data usage on mobile).
 */
export default function LazyVideo({ src, className, style }: LazyVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setActive(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setActive(true);
          io.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <video
      ref={ref}
      src={active ? src : undefined}
      autoPlay
      loop
      muted
      playsInline
      preload="none"
      aria-hidden="true"
      className={className}
      style={style}
    />
  );
}
