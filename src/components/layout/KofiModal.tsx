import React from 'react';
import { X } from 'lucide-react';

/** Ko-fi "Buy Us a Coffee" widget modal. */
export function KofiModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[1000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="glass-card max-w-md w-full relative border border-[#FF5E5B]/40 shadow-[0_0_40px_rgba(255,94,91,0.2)] overflow-hidden flex flex-col"
        style={{ maxHeight: 'calc(100vh - 32px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — always visible, close button always reachable */}
        <div className="flex-shrink-0 flex items-center gap-3 px-5 pt-5 pb-3 border-b border-white/5">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#FF5E5B]/10 border border-[#FF5E5B]/30 flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#FF5E5B">
              <path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z"/>
            </svg>
          </div>
          <div className="flex-grow">
            <div className="font-orbitron font-extrabold text-sm text-[#FF5E5B] uppercase tracking-wider">
              Buy Us a Coffee
            </div>
            <div className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">
              Keep the Hub alive · No ads · No tracking
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-gray-500 hover:text-white transition-colors p-1"
          >
            <X size={18} />
          </button>
        </div>
        {/* Scrollable iframe area */}
        <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
          <iframe
            id="kofiframe"
            src="https://ko-fi.com/vicecityhub/?hidefeed=true&widget=true&embed=true&preview=true"
            style={{ border: 'none', width: '100%', padding: '4px', background: '#f9f9f9', display: 'block' }}
            height="712"
            title="vicecityhub"
          />
        </div>
      </div>
    </div>
  );
}
