import React from 'react';
import type { Toast, ToastType } from './useToasts';

const TONE: Record<ToastType, string> = {
  success: 'border-green-500 text-neonCyan neon-text-cyan',
  error: 'border-neonPink text-neonPink neon-text-pink',
  info: 'border-neonOrange text-neonOrange',
};

/** Toast alert drawer (bottom right). */
export function Toasts({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="fixed bottom-8 right-6 z-[9999] flex flex-col gap-3">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`px-6 py-4 rounded glass-card flex items-center gap-3 shadow-2xl border transition-all animate-bounce min-w-[240px] ${TONE[t.type]}`}
        >
          <span className="font-bold text-sm tracking-wider uppercase">{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
