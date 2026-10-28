// Leonida FM, the one radio used by every page (Layout and the RP Hub). Plain TypeScript, no React: the hook in
// components/layout/useRadio.ts only hands it the shared <audio> element, a state setter and the track-index getter,
// which keeps every rule testable from Node.
//
// NOTE: Each page (Home / News / Market / RealEstate / Document / RP Hub) is a separate HTML entry point, so the
// radio remounts on every navigation. To keep it playing seamlessly across pages:
//  1) Restore the saved track + playback position on every mount.
//  2) Try to resume playback immediately on mount (works once the browser has marked this origin as
//     "audio-allowed" for the session).
//  3) If blocked (true first visit / no interaction yet), call audio.play() SYNCHRONOUSLY inside the very
//     first click/tap/keypress handler. Browser autoplay policy requires play() to run directly inside the
//     gesture handler, not inside a .then()/async callback, or it gets blocked.
import { parseSavedRadioTime, shouldAutoplayOnMount, shouldResumeOnVisible } from './radioState.ts';

type Detach = () => void;
type SetPlaying = (playing: boolean) => void;
type TrackIndex = () => number;

const SAVE_EVERY_MS = 1000;

/**
 * play() is rejected by the browser autoplay policy until the user interacts with the page. That is expected,
 * not an error: the first-interaction / visibility handlers try again, so the rejection is dropped on purpose.
 */
const playBlocked = () => {};

const saveTime = (audio: HTMLAudioElement) => localStorage.setItem('radioTime', audio.currentTime.toString());

const saveProgress = (audio: HTMLAudioElement, trackIndex: TrackIndex) => {
  saveTime(audio);
  localStorage.setItem('radioTrackIndex', String(trackIndex()));
};

const saveProgressIfPlaying = (audio: HTMLAudioElement, trackIndex: TrackIndex) => {
  if (!audio.paused) saveProgress(audio, trackIndex);
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
      try { audio.currentTime = restoreTime; } catch (_) { /* seeking can throw before the media is seekable: stay at 0 */ }
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
function attachAutoResume(audio: HTMLAudioElement, shouldPlay: boolean, markPlaying: () => void, setIsPlaying: SetPlaying): Detach {
  let resumed = false;

  if (shouldPlay) {
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise.then(() => {
        resumed = true;
        markPlaying();
      }).catch(playBlocked); // blocked by autoplay policy: resumed on the first user interaction below
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

/** Keep the radio going when the current track finishes (the audio manager picks and loads the next track). */
function attachTrackEnded(audio: HTMLAudioElement, markPlaying: () => void): Detach {
  const handleTrackEnded = () => {
    audio.play().then(markPlaying).catch(playBlocked);
  };
  audio.addEventListener('ended', handleTrackEnded);
  return () => audio.removeEventListener('ended', handleTrackEnded);
}

/** Save progress every second and on unload so the next page load resumes at (roughly) the right spot. */
function attachProgressSaving(audio: HTMLAudioElement, trackIndex: TrackIndex): Detach {
  const interval = setInterval(() => saveProgressIfPlaying(audio, trackIndex), SAVE_EVERY_MS);
  const handleUnload = () => saveProgressIfPlaying(audio, trackIndex);
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
      audio.play().then(markPlaying).catch(playBlocked); // still blocked: the first-interaction handler retries
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}

/** Configure the shared audio element, restore the previous position and start listening. Returns the cleanup. */
export function startRadio(audio: HTMLAudioElement, setIsPlaying: SetPlaying, trackIndex: TrackIndex): Detach {
  configureAudio(audio);

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
    attachProgressSaving(audio, trackIndex),
    attachVisibilityResume(audio, markPlaying),
  ];

  return () => {
    detachers.forEach(detach => detach());
    // Persist the final position before this page unmounts/navigates away
    if (!audio.paused) saveTime(audio);
    audio.pause();
  };
}

/** The radio button: pause and remember the mute, or play. */
export function toggleRadio(audio: HTMLAudioElement | null, isPlaying: boolean, setIsPlaying: SetPlaying) {
  if (!audio) return;
  if (isPlaying) {
    audio.pause();
    setIsPlaying(false);
    sessionStorage.setItem('radioPlaying', 'false');
  } else {
    audio.play().then(() => {
      setIsPlaying(true);
      sessionStorage.setItem('radioPlaying', 'true');
    }).catch(playBlocked);
  }
}
