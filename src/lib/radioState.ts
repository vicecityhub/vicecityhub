// Pure radio ("Leonida FM") state rules. The audio element itself lives in AudioManager.ts.

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

/** Should a tab that becomes visible again resume? Only an explicit 'false' (user muted) keeps it paused. */
export function shouldResumeOnVisible(savedPlaying: string | null): boolean {
  return savedPlaying !== 'false';
}
