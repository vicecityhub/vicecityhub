import React from 'react';

/** Standard dark input/select/textarea look used by the dashboard submit forms. */
export const INPUT_CLASS = 'w-full bg-[#050508] border border-white/10 focus:border-neonCyan outline-none rounded p-3 text-sm text-white';

export const TAB_TITLE_CLASS = 'font-orbitron font-extrabold text-2xl uppercase tracking-wider text-white';

/** Label above a form control. */
export function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] text-gray-500 uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );
}
