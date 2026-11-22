// Pure radio ("Leonida FM") state rules. The radio itself (the audio element, the playlist) lives in the persistent
// shell: src/shell/radio.ts.

/** Saved playback position from localStorage; anything unparsable, negative or infinite becomes 0. */
export function parseSavedRadioTime(raw: string | null): number {
  const saved = parseFloat(raw || '0');
  return !isNaN(saved) && isFinite(saved) && saved >= 0 ? saved : 0;
}

/**
 * Should the radio start on page load? `radioPlaying` lives in sessionStorage so a mute only lasts for the
 * browser session: a first visit (no value) or an explicit 'true' plays, anything else stays silent.
 */
export function shouldAutoplayOnMount(savedPlaying: string | null): boolean {
  return savedPlaying === null || savedPlaying === 'true';
}
