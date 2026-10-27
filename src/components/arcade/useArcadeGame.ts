import { useCallback, useRef, useState } from "react";
import { INITIAL_DISP, createGameState, readStoredHighScore, resetGameState } from "../../lib/arcadeEngine";
import type { Disp, HeldKeys } from "../../lib/arcadeEngine";
import { useArcadeInput } from "./useArcadeInput";
import { useArcadeLoop } from "./useArcadeLoop";

/** Vice City Hustle: game state, controls and the render loop. */
export function useArcadeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const held = useRef<HeldKeys>({ left: false, right: false });
  const st = useRef(createGameState(readStoredHighScore()));
  const [disp, setDisp] = useState<Disp>(INITIAL_DISP);

  const reset = useCallback(() => {
    resetGameState(st.current);
    setDisp({ ...INITIAL_DISP, started: true });
  }, []);

  useArcadeInput(canvasRef, held, st, reset);
  useArcadeLoop(canvasRef, st, held, setDisp);

  /** Clicking the canvas starts a run from the title or game-over screen. */
  const onCanvasClick = () => {
    const s = st.current;
    if (!s.started || s.gameOver) reset();
  };

  return { canvasRef, disp, onCanvasClick };
}
