import { useEffect } from "react";
import type { Dispatch, MutableRefObject, RefObject, SetStateAction } from "react";
import { H, HIGH_SCORE_KEY, LEVELS, W, cameraShake, stepGame } from "../../lib/arcadeEngine";
import type { Disp, GameState, HeldKeys } from "../../lib/arcadeEngine";
import { drawGameOverScreen, drawRunningFrame, drawScene, drawStartScreen } from "./arcadeDraw";

/** The requestAnimationFrame loop: draw the road, then the title screen, the game-over screen or one step of the game. */
export function useArcadeLoop(
  canvasRef: RefObject<HTMLCanvasElement>,
  st: MutableRefObject<GameState>,
  held: MutableRefObject<HeldKeys>,
  setDisp: Dispatch<SetStateAction<Disp>>,
) {
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    const deps = {
      rng: () => Math.random(),
      saveHighScore: (score: number) => localStorage.setItem(HIGH_SCORE_KEY, String(score)),
    };

    function loop() {
      const s = st.current;
      const lvl = LEVELS[s.level];
      const heat = s.level / (LEVELS.length - 1);
      const shakeX = cameraShake(s.offRoad, deps.rng);
      ctx.clearRect(0, 0, W, H);
      drawScene(ctx, heat, s.stripeZ, shakeX);

      if (!s.started) {
        drawStartScreen(ctx, s);
      } else if (s.gameOver) {
        drawGameOverScreen(ctx, s, lvl);
      } else {
        const step = stepGame(s, lvl, held.current, deps);
        step.updates.forEach(update => setDisp(update));
        drawRunningFrame(ctx, s, lvl, step.mph);
      }
      raf = requestAnimationFrame(loop);
    }

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [canvasRef, st, held, setDisp]);
}
