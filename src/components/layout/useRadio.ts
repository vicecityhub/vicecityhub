import React, { useEffect, useRef, useState } from 'react';
import { getOrCreateAudio, getTrackIndex } from '../../lib/AudioManager';
import { startRadio, toggleRadio } from '../../lib/radio';

/** Leonida FM: persistent background radio shared across page navigations (rules in lib/radio.ts). */
export function useRadio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = getOrCreateAudio();
    audioRef.current = audio;
    return startRadio(audio, setIsPlaying, getTrackIndex);
  }, []);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleRadio(audioRef.current, isPlaying, setIsPlaying);
  };

  return { isPlaying, toggleRadio: toggle };
}
