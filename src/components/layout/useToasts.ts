import { useCallback, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';
export interface Toast { id: number; msg: string; type: ToastType }
export type ShowToast = (msg: string, type?: ToastType) => void;

const TOAST_LIFETIME_MS = 3500;

/** Toast queue: each toast removes itself after 3.5 s. */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast: ShowToast = useCallback((msg, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, TOAST_LIFETIME_MS);
  }, []);

  return { toasts, showToast };
}
