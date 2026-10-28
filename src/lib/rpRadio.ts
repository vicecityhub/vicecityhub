// Leonida FM on the RP Hub page (rp.html). Plain TypeScript, no React: the hook in rp-hub/useRpRadio.ts only
// hands it the shared <audio> element and a state setter, which keeps every rule testable from Node.
//
// It deliberately differs from the Layout radio (components/layout/useRadio.ts): progress is saved every 5 s,
// no track index is stored, and a track that ends reloads the source before playing again.
import { parseSavedRadioTime, shouldAutoplayOnMount, shouldResumeOnVisible } from './radioState.ts';

type Detach = () => void;
type SetPlaying = (playing: boolean) => void;

const SAVE_EVERY_MS = 5000;

/**
 * play() is rejected by the browser autoplay policy until the user interacts with the page. That is expected,
 * not an error: the first-gesture / visibility handlers below try again, so the rejection is dropped on purpose.
 */
const playBlocked = () => {};

const saveTime = (audio: HTMLAudioElement) => localStorage.setItem('radioTime', audio.currentTime.toString());

/** Persist the position, but only while something is actually playing. */
const saveProgress = (audio: HTMLAudioElement) => {
  if (!audio.paused) saveTime(audio);
};

/** Mark the radio as playing for this tab and for the rest of the browser session. */
function makeMarkPlaying(setIsPlaying: SetPlaying) {
  return () => {
    setIsPlaying(true);
    sessionStorage.setItem('radioPlaying', 'true');
  };
}

/** Jump to the saved position once the track's metadata is known. A failing seek just starts from 0. */
function restorePosition(audio: HTMLAudioElement, restoreTime: number) {
  if (restoreTime <= 0) return;
  const applyTime = () => {
    if (audio.duration && restoreTime < audio.duration) {
      try { audio.currentTime = restoreTime; } catch (_) { /* seeking can throw before the media is seekable: stay at 0 */ }
    }
  };
  if (audio.readyState >= 1) applyTime();
  else audio.addEventListener('loadedmetadata', applyTime, { once: true });
}

/** Resume unless the user muted this session and the audio really is paused. */
function resumeIfAllowed(audio: HTMLAudioElement, markPlaying: () => void) {
  if (shouldResumeOnVisible(sessionStorage.getItem('radioPlaying')) && audio.paused) {
    audio.play().then(markPlaying).catch(playBlocked);
  }
}

/** Try to start on mount; a browser that refuses is handled by attachFirstGesture. */
function startOnMount(audio: HTMLAudioElement, shouldPlay: boolean, markPlaying: () => void, setIsPlaying: SetPlaying) {
  if (!shouldPlay) {
    setIsPlaying(false);
    return;
  }
  const attempt = audio.play();
  if (attempt && typeof attempt.then === 'function') attempt.then(markPlaying).catch(playBlocked);
}

/**
 * First click / key / touch resumes playback. The listeners remove themselves once they fire (`once`); like the
 * original page code they are not removed on unmount.
 */
function attachFirstGesture(audio: HTMLAudioElement, markPlaying: () => void) {
  const onFirstGesture = () => resumeIfAllowed(audio, markPlaying);
  for (const type of ['click', 'keydown', 'touchend']) {
    document.addEventListener(type, onFirstGesture, { capture: true, once: true });
  }
}

/** When a track ends, reload the source and keep the radio going. */
function attachTrackEnded(audio: HTMLAudioElement, markPlaying: () => void): Detach {
  const onEnded = () => {
    localStorage.setItem('radioTime', '0');
    audio.load();
    audio.play().then(markPlaying).catch(playBlocked);
  };
  audio.addEventListener('ended', onEnded);
  return () => audio.removeEventListener('ended', onEnded);
}

/** Save progress every few seconds and right before the page unloads. */
function attachProgressSaving(audio: HTMLAudioElement): Detach {
  const onUnload = () => saveProgress(audio);
  window.addEventListener('beforeunload', onUnload);
  const interval = setInterval(onUnload, SAVE_EVERY_MS);
  return () => {
    clearInterval(interval);
    window.removeEventListener('beforeunload', onUnload);
  };
}

/** Hidden tab: save the position. Visible again: resume, because mobile browsers pause background audio. */
function attachVisibility(audio: HTMLAudioElement, markPlaying: () => void): Detach {
  const onVisibilityChange = () => {
    if (document.hidden) saveProgress(audio);
    else resumeIfAllowed(audio, markPlaying);
  };
  document.addEventListener('visibilitychange', onVisibilityChange);
  return () => document.removeEventListener('visibilitychange', onVisibilityChange);
}

/** Configure the shared audio element, restore the previous position and start listening. Returns the cleanup. */
export function startRpRadio(audio: HTMLAudioElement, setIsPlaying: SetPlaying): Detach {
  audio.loop = false;
  audio.volume = 0.25;

  const shouldPlay = shouldAutoplayOnMount(sessionStorage.getItem('radioPlaying'));
  restorePosition(audio, parseSavedRadioTime(localStorage.getItem('radioTime')));
  audio.load();

  const markPlaying = makeMarkPlaying(setIsPlaying);
  startOnMount(audio, shouldPlay, markPlaying, setIsPlaying);
  attachFirstGesture(audio, markPlaying);

  const detachers = [attachTrackEnded(audio, markPlaying), attachProgressSaving(audio), attachVisibility(audio, markPlaying)];
  return () => {
    detachers.forEach(detach => detach());
    saveProgress(audio);
    audio.pause();
  };
}

/** The header button: play when paused, otherwise pause and remember the mute and the position. */
export function toggleRpRadio(audio: HTMLAudioElement | null, setIsPlaying: SetPlaying) {
  if (!audio) return;
  if (audio.paused) {
    audio.play().then(makeMarkPlaying(setIsPlaying)).catch(playBlocked);
    return;
  }
  audio.pause();
  setIsPlaying(false);
  sessionStorage.setItem('radioPlaying', 'false');
  saveTime(audio);
}
