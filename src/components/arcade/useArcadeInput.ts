import { useEffect } from "react";
import type { MutableRefObject, RefObject } from "react";
import { createInputHandlers } from "../../lib/arcadeInput";
import type { GameState, HeldKeys } from "../../lib/arcadeEngine";

/**
 * Keyboard (arrows / A / D, Space or Enter to start) and touch (hold the left or right half to steer, tap to start)
 * controls. They only write the `held` keys and start a new run through `reset`. What each input means: lib/arcadeInput.ts.
 */
export function useArcadeInput(
  canvasRef: RefObject<HTMLCanvasElement>,
  held: MutableRefObject<HeldKeys>,
  st: MutableRefObject<GameState>,
  reset: () => void,
) {
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const h = createInputHandlers({ held, st, reset, canvasLeft: () => canvas.getBoundingClientRect().left });

    window.addEventListener("keydown", h.keyDown);
    window.addEventListener("keyup", h.keyUp);
    canvas.addEventListener("touchstart", h.touchStart, { passive: false });
    canvas.addEventListener("touchend", h.touchEnd, { passive: false });
    return () => {
      window.removeEventListener("keydown", h.keyDown);
      window.removeEventListener("keyup", h.keyUp);
      canvas.removeEventListener("touchstart", h.touchStart);
      canvas.removeEventListener("touchend", h.touchEnd);
    };
  }, [canvasRef, held, st, reset]);
}
