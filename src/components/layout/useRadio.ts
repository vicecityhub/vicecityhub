import React, { useEffect, useRef, useState } from 'react';
import { getOrCreateAudio, getTrackIndex } from '../../lib/AudioManager';
import { parseSavedRadioTime, shouldAutoplayOnMount, shouldResumeOnVisible } from '../../lib/radioState';

// NOTE: Each page (Home / News / Market / RealEstate / Document) is a separate HTML entry point, so Layout
// (and this hook) remounts on every navigation. To keep "Leonida FM" playing seamlessly across pages:
//  1) Restore the saved track + playback position on every mount.
//  2) Try to resume playback immediately on mount (works once the browser has marked this origin as
//     "audio-allowed" for the session).
//  3) If blocked (true first visit / no interaction yet), call audio.play() SYNCHRONOUSLY inside the very
//     first click/tap/keypress handler. Browser autoplay policy requires play() to run directly inside the
//     gesture handler, not inside a .then()/async callback, or it gets blocked.

type Detach = () => void;

const saveTime = (audio: HTMLAudioElement) => localStorage.setItem('radioTime', audio.currentTime.toString());

const saveProgress = (audio: HTMLAudioElement) => {
  saveTime(audio);
  localStorage.setItem('radioTrackIndex', String(getTrackIndex()));
};

const saveProgressIfPlaying = (audio: HTMLAudioElement) => {
  if (!audio.paused) saveProgress(audio);
};

function configureAudio(audio: HTMLAudioElement) {
  audio.preload = 'auto';
  audio.loop = false; // Disable loop so track ends and triggers 'ended' event
  audio.volume = 0.25;
}

/** Restore the exact playback position so the track continues where it left off. */
function restorePosition(audio: HTMLAudioElement, restoreTime: number) {
  if (restoreTime <= 0) return;
  const apply = () => {
    if (audio.duration && restoreTime < audio.duration) {
      try { audio.currentTime = restoreTime; } catch (e) { }
    }
  };
  if (audio.readyState >= 1) apply();
  else audio.addEventListener('loadedmetadata', apply, { once: true });
}

const FIRST_INTERACTION_EVENTS: [string, AddEventListenerOptions][] = [
  ['click', { capture: true }],
  ['keydown', { capture: true }],
  ['touchstart', { capture: true, passive: true }],
  ['touchend', { capture: true }],
];

/**
 * Resume on mount when the browser allows it; otherwise on the very first user gesture, calling play()
 * synchronously inside the handler so the browser still counts it as a response to that gesture.
 */
function attachAutoResume(audio: HTMLAudioElement, shouldPlay: boolean, markPlaying: () => void, setIsPlaying: (v: boolean) => void): Detach {
  let resumed = false;

  if (shouldPlay) {
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.then(() => {
        resumed = true;
        markPlaying();
      }).catch(() => {
        // Blocked by autoplay policy: resumed on the first user interaction below.
      });
    }
  } else {
    setIsPlaying(false);
  }

  const handleFirstInteraction = () => {
    if (resumed) return;
    if (shouldPlay && audio.paused) {
      const p = audio.play();
      resumed = true;
      if (p && typeof p.then === 'function') {
        p.then(markPlaying).catch(() => { resumed = false; });
      } else {
        markPlaying();
      }
    }
  };
  FIRST_INTERACTION_EVENTS.forEach(([type, options]) => document.addEventListener(type, handleFirstInteraction, options));
  return () => FIRST_INTERACTION_EVENTS.forEach(([type, options]) => document.removeEventListener(type, handleFirstInteraction, options));
}

/** Keep the radio going when the current track finishes. */
function attachTrackEnded(audio: HTMLAudioElement, markPlaying: () => void): Detach {
  const handleTrackEnded = () => {
    audio.play().then(() => { markPlaying(); }).catch(() => { });
  };
  audio.addEventListener('ended', handleTrackEnded);
  return () => audio.removeEventListener('ended', handleTrackEnded);
}

/** Save progress every second and on unload so the next page load resumes at (roughly) the right spot. */
function attachProgressSaving(audio: HTMLAudioElement): Detach {
  const interval = setInterval(() => saveProgressIfPlaying(audio), 1000);
  const handleUnload = () => saveProgressIfPlaying(audio);
  window.addEventListener('beforeunload', handleUnload);
  return () => {
    clearInterval(interval);
    window.removeEventListener('beforeunload', handleUnload);
  };
}

/**
 * Mobile browsers (especially Android Chrome and iOS Safari) often silently pause background audio when the
 * tab/app is backgrounded. When the page becomes visible again, resume unless the user explicitly muted, so the
 * radio feels "always on" instead of staying silent until the next full reload.
 */
function attachVisibilityResume(audio: HTMLAudioElement, markPlaying: () => void): Detach {
  const handleVisibilityChange = () => {
    if (document.visibilityState !== 'visible') return;
    if (shouldResumeOnVisible(sessionStorage.getItem('radioPlaying')) && audio.paused) {
      audio.play().then(markPlaying).catch(() => {
        // Still blocked: the first-interaction handler resumes it on the next tap/click.
      });
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}

/** Leonida FM: persistent background radio shared across page navigations. */
export function useRadio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = getOrCreateAudio();
    configureAudio(audio);
    audioRef.current = audio;

    // sessionStorage (not localStorage): a mute only lasts for the current browser session, so closing the
    // tab/browser and coming back later defaults back to "playing", while in-site navigation keeps the choice.
    const shouldPlay = shouldAutoplayOnMount(sessionStorage.getItem('radioPlaying'));
    restorePosition(audio, parseSavedRadioTime(localStorage.getItem('radioTime')));
    audio.load();

    const markPlaying = () => {
      setIsPlaying(true);
      sessionStorage.setItem('radioPlaying', 'true');
    };

    const detachers = [
      attachAutoResume(audio, shouldPlay, markPlaying, setIsPlaying),
      attachTrackEnded(audio, markPlaying),
      attachProgressSaving(audio),
      attachVisibilityResume(audio, markPlaying),
    ];

    return () => {
      detachers.forEach(detach => detach());
      // Persist the final position before this page unmounts/navigates away
      if (!audio.paused) saveTime(audio);
      audio.pause();
    };
  }, []);

  const toggleRadio = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      sessionStorage.setItem('radioPlaying', 'false');
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
        sessionStorage.setItem('radioPlaying', 'true');
      }).catch(() => { });
    }
  };

  return { isPlaying, toggleRadio };
}
