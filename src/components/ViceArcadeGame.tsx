import React from "react";
import HustleLeaderboard from "./HustleLeaderboard";
import { H, W } from "../lib/arcadeEngine";
import type { Disp } from "../lib/arcadeEngine";
import { useArcadeGame } from "./arcade/useArcadeGame";

/** Combo counter and the nitro / shield badges over the canvas. */
function StatusBadges({ disp }: { disp: Disp }) {
  return (
    <>
      {disp.combo>1 && !disp.gameOver && disp.started && (
        <div className="absolute top-12 right-4 font-orbitron font-black text-xs text-neonCyan"
          style={{textShadow:"0 0 10px rgba(0,255,255,0.8)"}}>x{disp.combo} COMBO!</div>
      )}
      {disp.nitro && !disp.gameOver && (
        <div className="absolute top-12 left-4 font-orbitron font-black text-xs text-cyan-300 animate-pulse"
          style={{textShadow:"0 0 10px rgba(0,255,255,0.9)"}}>NITRO!</div>
      )}
      {disp.shielded && !disp.nitro && !disp.gameOver && disp.started && (
        <div className="absolute top-12 left-4 font-orbitron font-black text-xs text-blue-300"
          style={{textShadow:"0 0 8px rgba(68,136,255,0.9)"}}>SHIELD READY</div>
      )}
    </>
  );
}

export default function ViceArcadeGame() {
  const { canvasRef, disp, onCanvasClick } = useArcadeGame();

  return (
    <div className="relative flex flex-col items-center justify-center w-full h-full select-none"
      style={{background:"rgba(0,0,0,0.4)",borderRadius:"12px",overflow:"hidden",minHeight:"460px"}}>
      <div className="absolute inset-0 rounded-xl pointer-events-none"
        style={{border:"1px solid rgba(255,45,120,0.35)",boxShadow:"0 0 24px rgba(255,45,120,0.12) inset"}}/>
      <div className="absolute top-0 left-0 right-0 px-4 py-2 flex items-center justify-between z-10">
        <span className="font-orbitron font-black text-[10px] tracking-widest text-neonPink">VICE CITY HUSTLE</span>
        <span className="text-[9px] text-white/35 font-bold tracking-widest">{disp.levelName}</span>
      </div>
      <canvas ref={canvasRef} width={W} height={H} className="rounded-lg cursor-pointer"
        style={{imageRendering:"pixelated",maxWidth:"100%",touchAction:"none"}}
        onClick={onCanvasClick}/>
      <StatusBadges disp={disp} />
      <HustleLeaderboard score={disp.score} levelName={disp.levelName} gameOver={disp.gameOver} />
    </div>
  );
}
