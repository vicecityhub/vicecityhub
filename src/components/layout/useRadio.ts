import React, { useCallback, useEffect, useState } from 'react';

/** The radio of the persistent shell, or undefined where there is none (server rendering, tests, a page without the shell). */
const shellRadio = () => (typeof window !== 'undefined' && window.vchShell ? window.vchShell.radio : undefined);

/**
 * Leonida FM button state. The radio itself (the <audio> element, the playlist, what happens when a track ends) lives in
 * the persistent shell (src/shell/radio.ts) and survives page changes; this hook only mirrors its state into React.
 */
export function useRadio() {
  // The first render already shows the real state: after a soft navigation the music is playing and the button must not flash "muted".
  const [isPlaying, setIsPlaying] = useState(() => { const radio = shellRadio(); return !!radio && radio.isPlaying(); });

  useEffect(() => {
    const radio = shellRadio();
    if (!radio) return undefined;
    setIsPlaying(radio.isPlaying());
    return radio.subscribe(setIsPlaying);
  }, []);

  const toggleRadio = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const radio = shellRadio();
    if (radio) radio.toggle();
  }, []);

  return { isPlaying, toggleRadio };
}
