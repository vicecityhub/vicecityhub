import { useEffect, useRef } from 'react';
import type { AuthTab } from './useAuthModal';

interface ModalHandlers {
  auth: (tab?: AuthTab) => void;
  sitemap: () => void;
  dashboard: () => void;
}

/**
 * Child pages ask Layout to open a modal with a window event:
 * `window.dispatchEvent(new CustomEvent('vch-open-modal', { detail: { id, tab } }))`.
 */
export function useModalEvents(handlers: ModalHandlers) {
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    const handleOpenModalEvent = (e: Event) => {
      const { id, tab } = (e as CustomEvent).detail || {};
      if (id === 'auth') latest.current.auth(tab);
      else if (id === 'sitemap') latest.current.sitemap();
      else if (id === 'dashboard') latest.current.dashboard();
    };
    window.addEventListener('vch-open-modal', handleOpenModalEvent);
    return () => window.removeEventListener('vch-open-modal', handleOpenModalEvent);
  }, []);
}
