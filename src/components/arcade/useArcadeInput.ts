import { useEffect } from "react";
import type { MutableRefObject, RefObject } from "react";
import { W } from "../../lib/arcadeEngine";
import type { GameState, HeldKeys } from "../../lib/arcadeEngine";

/**
 * Keyboard (arrows / A / D, Space or Enter to start) and touch (hold the left or right half to steer, tap to start)
 * controls. They only write the `held` keys and start a new run through `reset`.
 */
export function useArcadeInput(
  canvasRef: RefObject<HTMLCanvasElement>,
  held: MutableRefObject<HeldKeys>,
  st: MutableRefObject<GameState>,
  reset: () => void,
) {
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key==="ArrowLeft"||e.key==="a") { e.preventDefault(); held.current.left = true; }
      if (e.key==="ArrowRight"||e.key==="d") { e.preventDefault(); held.current.right = true; }
      if ((e.key===" "||e.key==="Enter") && (st.current.gameOver||!st.current.started)) reset();
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key==="ArrowLeft"||e.key==="a") held.current.left = false;
      if (e.key==="ArrowRight"||e.key==="d") held.current.right = false;
    };
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (!st.current.started || st.current.gameOver) { reset(); return; }
      const t = e.changedTouches[0]; const rect = canvas.getBoundingClientRect();
      if ((t.clientX - rect.left) < W/2) held.current.left = true; else held.current.right = true;
    };
    const handleTouchEnd = (e: TouchEvent) => { e.preventDefault(); held.current.left = false; held.current.right = false; };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: false });
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      canvas.removeEventListener("touchstart", handleTouchStart);
      canvas.removeEventListener("touchend", handleTouchEnd);
    };
  }, [canvasRef, held, st, reset]);
}
