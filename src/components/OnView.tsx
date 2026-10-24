import { useEffect, useRef, useState, type ReactNode } from 'react';

interface OnViewProps {
  children: ReactNode;
  /** Reserved height while the content has not mounted yet (prevents layout shift). */
  minHeight?: number | string;
  /** How early to start loading, before the block scrolls into view. */
  rootMargin?: string;
}

/**
 * Mounts its children only when the block is about to scroll into view.
 * Used with React.lazy so heavy below-the-fold widgets (like the arcade game) stay out of the initial JavaScript.
 */
export default function OnView({ children, minHeight = 320, rootMargin = '300px' }: OnViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setShow(true); return; }
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { setShow(true); io.disconnect(); }
    }, { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return <div ref={ref} style={show ? undefined : { minHeight }}>{show ? children : null}</div>;
}
