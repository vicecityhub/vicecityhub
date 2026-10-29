// Vice City Hustle: what a key press or a touch means, as plain functions (no React, no DOM), so it can be tested in Node.
// The hook in components/arcade/useArcadeInput.ts only attaches these handlers to window / canvas.
import { W } from './arcadeEngine.ts';
import type { GameState, HeldKeys } from './arcadeEngine.ts';

export type Side = keyof HeldKeys;

const STEER_KEYS: Record<string, Side> = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right' };
const START_KEYS = [' ', 'Enter'];

/** Which side a key steers to, or null for any other key. */
export const steerSide = (key: string): Side | null => (Object.prototype.hasOwnProperty.call(STEER_KEYS, key) ? STEER_KEYS[key] : null);

/** A new run starts from the title screen and from the game-over screen, never in the middle of a run. */
export const canStartRun = (s: Pick<GameState, 'started' | 'gameOver'>): boolean => s.gameOver || !s.started;

/** Touching the left half of the canvas steers left, the right half steers right. */
export const touchSide = (clientX: number, canvasLeft: number): Side => (clientX - canvasLeft < W / 2 ? 'left' : 'right');

export interface InputDeps {
  held: { current: HeldKeys };
  st: { current: Pick<GameState, 'started' | 'gameOver'> };
  reset: () => void;
  /** Left edge of the canvas on screen. */
  canvasLeft: () => number;
}

interface KeyLike { key: string; preventDefault: () => void }
interface TouchLike { preventDefault: () => void; changedTouches: ArrayLike<{ clientX: number }> }

export function createInputHandlers({ held, st, reset, canvasLeft }: InputDeps) {
  return {
    keyDown(e: KeyLike) {
      const side = steerSide(e.key);
      if (side) { e.preventDefault(); held.current[side] = true; }
      if (START_KEYS.indexOf(e.key) >= 0 && canStartRun(st.current)) reset();
    },
    keyUp(e: Pick<KeyLike, 'key'>) {
      const side = steerSide(e.key);
      if (side) held.current[side] = false;
    },
    touchStart(e: TouchLike) {
      e.preventDefault();
      if (canStartRun(st.current)) { reset(); return; }
      held.current[touchSide(e.changedTouches[0].clientX, canvasLeft())] = true;
    },
    touchEnd(e: Pick<TouchLike, 'preventDefault'>) {
      e.preventDefault();
      held.current.left = false; held.current.right = false;
    },
  };
}
