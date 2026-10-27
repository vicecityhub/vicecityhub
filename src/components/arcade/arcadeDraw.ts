// Vice City Hustle: canvas drawing. Extracted from components/ViceArcadeGame.tsx; the drawing code is unchanged.
// The ORDER of calls matters: canvas state (text alignment, shadow) deliberately carries over between draws.
import {
  W, H, HORIZON_Y, PY, ROAD_HW_TOP, ROAD_HW_BOTTOM, CENTER_X, WALL_EDGE, Z_SPAWN, ZONE_X,
  screenX, screenY, roadHalfW, spriteScale, persp, getStars,
} from "../../lib/arcadeEngine";
import type { GameState, LevelDef } from "../../lib/arcadeEngine";

export function drawPalm(ctx: CanvasRenderingContext2D, sx: number, sy: number, scale: number) {
  if (scale < 0.05) return;
  ctx.save(); ctx.translate(sx, sy); ctx.scale(scale, scale);
  ctx.fillStyle = "rgba(15,8,14,0.92)";
  ctx.beginPath();
  ctx.moveTo(-3, 0); ctx.quadraticCurveTo(6, -22, 1, -46); ctx.lineTo(5, -46); ctx.quadraticCurveTo(9, -20, 5, 0);
  ctx.closePath(); ctx.fill();
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    ctx.save(); ctx.translate(3, -46); ctx.rotate(ang);
    ctx.beginPath(); ctx.ellipse(11, 0, 14, 4, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

export function drawScene(ctx: CanvasRenderingContext2D, heat: number, stripeZ: number[], shakeX: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, HORIZON_Y);
  sky.addColorStop(0, `rgb(${30+heat*20},${10},${45+heat*10})`);
  sky.addColorStop(0.6, `rgb(${180+heat*30},${60+heat*20},${110})`);
  sky.addColorStop(1, `rgb(255,${140+heat*20},${90})`);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, HORIZON_Y);

  ctx.save(); ctx.shadowColor = "#FFAA55"; ctx.shadowBlur = 30;
  ctx.fillStyle = "rgba(255,190,120,0.9)";
  ctx.beginPath(); ctx.ellipse(CENTER_X, HORIZON_Y - 6, 34, 34, 0, Math.PI, 0); ctx.fill();
  ctx.restore();

  ctx.fillStyle = "rgba(20,10,30,0.85)";
  const bH = [26, 40, 18, 55, 30, 44, 20, 36];
  let bx = 0;
  bH.forEach((h) => { const bw = W / bH.length + 2; ctx.fillRect(bx + shakeX*0.2, HORIZON_Y - h, bw, h); bx += bw; });

  ctx.fillStyle = "#0a0a14"; ctx.fillRect(0, HORIZON_Y, W, H - HORIZON_Y);

  // palm trees beyond the wall, cycling with depth
  const sorted = [...stripeZ].sort((a,b)=>b-a);
  sorted.forEach(z => {
    if (z <= 0 || z > Z_SPAWN) return;
    const sc = spriteScale(z) * 0.9;
    [-1, 1].forEach(side => {
      const sx = screenX(side * (WALL_EDGE + 0.22), z);
      drawPalm(ctx, sx, screenY(z) + 6*sc, sc);
    });
  });

  // paved road
  ctx.beginPath();
  ctx.moveTo(CENTER_X - ROAD_HW_TOP, HORIZON_Y); ctx.lineTo(CENTER_X + ROAD_HW_TOP, HORIZON_Y);
  ctx.lineTo(CENTER_X + ROAD_HW_BOTTOM, PY + 30); ctx.lineTo(CENTER_X - ROAD_HW_BOTTOM, PY + 30);
  ctx.closePath(); ctx.fillStyle = "#19191f"; ctx.fill();

  // wet-asphalt neon reflection streak
  const shine = ctx.createLinearGradient(CENTER_X, HORIZON_Y, CENTER_X, PY+30);
  shine.addColorStop(0, "rgba(255,120,200,0.02)"); shine.addColorStop(0.5, "rgba(120,220,255,0.05)"); shine.addColorStop(1, "rgba(255,45,120,0.07)");
  ctx.fillStyle = shine;
  ctx.beginPath();
  ctx.moveTo(CENTER_X - ROAD_HW_TOP*0.4, HORIZON_Y); ctx.lineTo(CENTER_X + ROAD_HW_TOP*0.4, HORIZON_Y);
  ctx.lineTo(CENTER_X + ROAD_HW_BOTTOM*0.3, PY+30); ctx.lineTo(CENTER_X - ROAD_HW_BOTTOM*0.3, PY+30);
  ctx.closePath(); ctx.fill();

  // shoulder (dirt/rumble) between road edge and wall
  [-1, 1].forEach(side => {
    ctx.beginPath();
    ctx.moveTo(CENTER_X + side*ROAD_HW_TOP, HORIZON_Y);
    ctx.lineTo(CENTER_X + side*(ROAD_HW_TOP*1.6), HORIZON_Y);
    ctx.lineTo(screenX(side*WALL_EDGE, 0), PY+30);
    ctx.lineTo(CENTER_X + side*ROAD_HW_BOTTOM, PY+30);
    ctx.closePath();
    ctx.fillStyle = "#3a3226"; ctx.fill();
  });

  // guardrail with scrolling posts
  [-1, 1].forEach(side => {
    ctx.beginPath();
    ctx.moveTo(CENTER_X + side*(ROAD_HW_TOP*1.6), HORIZON_Y); ctx.lineTo(CENTER_X + side*(ROAD_HW_TOP*1.8), HORIZON_Y);
    ctx.lineTo(screenX(side*WALL_EDGE, 0)+side*6, PY+30); ctx.lineTo(screenX(side*WALL_EDGE, 0), PY+30);
    ctx.closePath();
    ctx.fillStyle = "#FF2D78"; ctx.fill();
  });
  sorted.forEach(z => {
    if (z <= 0 || z > Z_SPAWN) return;
    const sc = spriteScale(z);
    [-1, 1].forEach(side => {
      const px = screenX(side*WALL_EDGE, z);
      const py2 = screenY(z);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(px - 1.5*sc, py2 - 9*sc, 3*sc, 9*sc);
    });
  });

  stripeZ.forEach(z => {
    if (z <= 0 || z > Z_SPAWN) return;
    const y = screenY(z); const w = 3 * spriteScale(z);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.fillRect(CENTER_X - w/2, y, w, Math.max(2, 10*persp(z)));
  });
}

export function carPath(ctx: CanvasRenderingContext2D, cx: number, topY: number, w: number, h: number, style: "muscle"|"sedan"|"van") {
  ctx.beginPath();
  if (style === "van") {
    ctx.moveTo(cx - w*0.42, topY);
    ctx.lineTo(cx + w*0.42, topY);
    ctx.lineTo(cx + w*0.48, topY + h*0.92);
    ctx.quadraticCurveTo(cx + w*0.48, topY+h, cx + w*0.40, topY+h);
    ctx.lineTo(cx - w*0.40, topY+h);
    ctx.quadraticCurveTo(cx - w*0.48, topY+h, cx - w*0.48, topY+h*0.92);
    ctx.closePath();
  } else {
    const roofW = style === "muscle" ? 0.27 : 0.30;
    ctx.moveTo(cx - w*roofW, topY);
    ctx.lineTo(cx + w*roofW, topY);
    ctx.quadraticCurveTo(cx + w*0.40, topY + h*0.16, cx + w*0.44, topY + h*0.30);
    ctx.lineTo(cx + w*0.49, topY + h*0.60);
    ctx.quadraticCurveTo(cx + w*0.50, topY + h*0.90, cx + w*0.42, topY + h);
    ctx.lineTo(cx - w*0.42, topY + h);
    ctx.quadraticCurveTo(cx - w*0.50, topY + h*0.90, cx - w*0.49, topY + h*0.60);
    ctx.lineTo(cx - w*0.44, topY + h*0.30);
    ctx.quadraticCurveTo(cx - w*0.40, topY + h*0.16, cx - w*roofW, topY);
    ctx.closePath();
  }
}

export function drawGroundShadow(ctx: CanvasRenderingContext2D, cx: number, groundY: number, w: number) {
  ctx.save();
  const grad = ctx.createRadialGradient(cx, groundY, 0, cx, groundY, w*0.62);
  grad.addColorStop(0, "rgba(0,0,0,0.45)"); grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.ellipse(cx, groundY, w*0.56, w*0.16, 0, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

export function drawWheels(ctx: CanvasRenderingContext2D, cx: number, topY: number, w: number, h: number) {
  const wx = w*0.45;
  [topY + h*0.30, topY + h*0.86].forEach(wy => {
    [-1,1].forEach(side => {
      ctx.fillStyle = "#0a0a0a";
      ctx.beginPath(); ctx.ellipse(cx+side*wx, wy, w*0.10, h*0.075, 0, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = "#555";
      ctx.beginPath(); ctx.ellipse(cx+side*wx, wy, w*0.045, h*0.032, 0, 0, Math.PI*2); ctx.fill();
    });
  });
}

export function drawRearGlass(ctx: CanvasRenderingContext2D, cx: number, topY: number, w: number, h: number) {
  ctx.fillStyle = "rgba(25,35,50,0.8)";
  ctx.beginPath();
  ctx.moveTo(cx-w*0.20, topY+h*0.06); ctx.lineTo(cx+w*0.20, topY+h*0.06);
  ctx.lineTo(cx+w*0.28, topY+h*0.25); ctx.lineTo(cx-w*0.28, topY+h*0.25);
  ctx.closePath(); ctx.fill();
}

export function drawTailLights(ctx: CanvasRenderingContext2D, cx: number, topY: number, w: number, h: number) {
  ctx.save(); ctx.shadowColor = "#ff2222"; ctx.shadowBlur = 6; ctx.fillStyle = "#ff3333";
  [-1,1].forEach(side => { ctx.beginPath(); ctx.roundRect(cx+side*w*0.38 - w*0.05, topY+h*0.85, w*0.10, h*0.08, 2); ctx.fill(); });
  ctx.restore();
}

export function drawMirrors(ctx: CanvasRenderingContext2D, cx: number, topY: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(cx-w*0.36, topY+h*0.11, w*0.06, h*0.05);
  ctx.fillRect(cx+w*0.30, topY+h*0.11, w*0.06, h*0.05);
}

export function drawLightBar(ctx: CanvasRenderingContext2D, cx: number, topY: number, w: number, frame: number) {
  const flip = frame % 20 < 10;
  ctx.save(); ctx.shadowBlur = 8;
  ctx.shadowColor = flip ? "#ff2222" : "#2255ff"; ctx.fillStyle = flip ? "#ff2222" : "#2255ff";
  ctx.fillRect(cx - w*0.20, topY - 4, w*0.19, 4);
  ctx.shadowColor = flip ? "#2255ff" : "#ff2222"; ctx.fillStyle = flip ? "#2255ff" : "#ff2222";
  ctx.fillRect(cx + w*0.01, topY - 4, w*0.19, 4);
  ctx.restore();
}

export function drawPlayerCar(ctx: CanvasRenderingContext2D, sx: number, flash: number, invincible: boolean, shielded: boolean) {
  const w = 40, h = 58, topY = PY - h + 8;
  drawGroundShadow(ctx, sx, PY + 8, w);
  drawWheels(ctx, sx, topY, w, h);
  ctx.save();
  const hi = flash>0 ? "#ffe8f4" : invincible ? "#00FFFF" : "#FF2D78";
  const lo = flash>0 ? "#ffffff" : invincible ? "#009999" : "#A80048";
  const grad = ctx.createLinearGradient(0, topY, 0, topY+h);
  grad.addColorStop(0, hi); grad.addColorStop(1, lo);
  ctx.shadowColor = invincible ? "#00FFFF" : "#FF2D78"; ctx.shadowBlur = invincible ? 20 : 13;
  carPath(ctx, sx, topY, w, h, "muscle");
  ctx.fillStyle = grad; ctx.fill();
  ctx.shadowBlur = 0;
  drawRearGlass(ctx, sx, topY, w, h);
  ctx.strokeStyle = "#1a1a1a"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(sx-w*0.33, topY+h*0.60); ctx.lineTo(sx+w*0.33, topY+h*0.60); ctx.stroke();
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(sx-w*0.37, topY+h*0.55, w*0.055, h*0.10); ctx.fillRect(sx+w*0.32, topY+h*0.55, w*0.055, h*0.10);
  drawMirrors(ctx, sx, topY, w, h, lo);
  ctx.fillStyle="#FFF176"; ctx.shadowColor="#FFF176"; ctx.shadowBlur=6;
  ctx.fillRect(sx-w*0.30, topY+h*0.03, w*0.10, h*0.03); ctx.fillRect(sx+w*0.20, topY+h*0.03, w*0.10, h*0.03);
  ctx.shadowBlur=0;
  drawTailLights(ctx, sx, topY, w, h);
  if (shielded) {
    ctx.strokeStyle = "rgba(0,200,255,0.85)"; ctx.lineWidth = 3; ctx.shadowColor="#00c8ff"; ctx.shadowBlur=14;
    ctx.beginPath(); ctx.ellipse(sx, topY+h/2, w/2+11, h/2+12, 0, 0, Math.PI*2); ctx.stroke();
  }
  ctx.restore();
}

export function drawCop(ctx: CanvasRenderingContext2D, sx: number, z: number, frame: number) {
  const sc = spriteScale(z), sy = screenY(z);
  const w = 36*sc, h = 52*sc, topY = sy - h;
  drawGroundShadow(ctx, sx, sy+2*sc, w);
  drawWheels(ctx, sx, topY, w, h);
  ctx.save();
  const grad = ctx.createLinearGradient(0, topY, 0, topY+h);
  grad.addColorStop(0, "#dfe6ff"); grad.addColorStop(1, "#1a1aa8");
  ctx.shadowColor = "#3355ff"; ctx.shadowBlur = 8*sc;
  carPath(ctx, sx, topY, w, h, "sedan");
  ctx.fillStyle = grad; ctx.fill();
  ctx.shadowBlur = 0;
  drawRearGlass(ctx, sx, topY, w, h);
  ctx.strokeStyle="#0a0a55"; ctx.lineWidth=Math.max(1,1.6*sc);
  ctx.beginPath(); ctx.moveTo(sx-w*0.35,topY+h*0.5); ctx.lineTo(sx+w*0.35,topY+h*0.5); ctx.stroke();
  drawTailLights(ctx, sx, topY, w, h);
  if (sc > 0.3) drawLightBar(ctx, sx, topY, w, frame);
  ctx.restore();
}

export function drawSwat(ctx: CanvasRenderingContext2D, sx: number, z: number, frame: number) {
  const sc = spriteScale(z), sy = screenY(z);
  const w = 48*sc, h = 56*sc, topY = sy - h;
  drawGroundShadow(ctx, sx, sy+2*sc, w);
  drawWheels(ctx, sx, topY, w, h);
  ctx.save();
  const grad = ctx.createLinearGradient(0, topY, 0, topY+h);
  grad.addColorStop(0, "#3d4d3d"); grad.addColorStop(1, "#111811");
  ctx.shadowColor = "#224422"; ctx.shadowBlur = 10*sc;
  carPath(ctx, sx, topY, w, h, "van");
  ctx.fillStyle = grad; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "rgba(20,25,20,0.85)";
  ctx.fillRect(sx-w*0.34, topY+h*0.10, w*0.68, h*0.28);
  ctx.strokeStyle="#0a0f0a"; ctx.lineWidth=Math.max(1,1.6*sc);
  ctx.beginPath(); ctx.moveTo(sx,topY+h*0.10); ctx.lineTo(sx,topY+h*0.95); ctx.stroke();
  if (sc > 0.45) { ctx.fillStyle="#fff176"; ctx.font=`bold ${Math.max(7,Math.round(8*sc))}px monospace`; ctx.textAlign="center"; ctx.fillText("SWAT", sx, topY+h*0.62); }
  drawTailLights(ctx, sx, topY, w, h);
  if (sc > 0.3) drawLightBar(ctx, sx, topY, w, frame);
  ctx.restore();
}

export function drawRoadblock(ctx: CanvasRenderingContext2D, z: number) {
  const sc = spriteScale(z), sy = screenY(z), hw = roadHalfW(z) * 0.94;
  const y = sy - 20*sc, h = 18*sc;
  ctx.save(); ctx.shadowColor = "#FFD700"; ctx.shadowBlur = 8*sc;
  ctx.fillStyle = "#1a1a1a"; ctx.fillRect(CENTER_X-hw, y, hw*2, h);
  const seg = Math.max(6, 14*sc);
  for (let i = -hw; i < hw; i += seg) {
    ctx.fillStyle = (((i+hw)/seg)|0) % 2 === 0 ? "#FFD700" : "#111";
    ctx.beginPath();
    ctx.moveTo(CENTER_X+i, y+h); ctx.lineTo(CENTER_X+i+seg*0.55, y); ctx.lineTo(CENTER_X+i+seg*0.9, y); ctx.lineTo(CENTER_X+i+seg*0.35, y+h);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

export function drawPickup(ctx: CanvasRenderingContext2D, sx: number, z: number, kind: "money"|"nitro"|"shield", frame: number) {
  const sc = spriteScale(z), sy = screenY(z), r = 13*sc;
  ctx.save();
  const col = kind==="money" ? "#FFE135" : kind==="nitro" ? "#00CCCC" : "#2255cc";
  ctx.shadowColor = col; ctx.shadowBlur = 10*sc;
  const pulse = kind==="nitro" ? 1+Math.sin(frame*0.3)*0.12 : 1;
  ctx.fillStyle = col;
  ctx.beginPath(); ctx.arc(sx, sy-r, r*pulse, 0, Math.PI*2); ctx.fill();
  if (sc > 0.35) {
    ctx.fillStyle = kind==="money" ? "#1a1a00" : "#001a1a";
    ctx.font = `bold ${Math.round(13*sc)}px monospace`; ctx.textAlign = "center";
    ctx.fillText(kind==="money" ? "$" : kind==="nitro" ? "N" : "S", sx, sy-r+5*sc);
  }
  ctx.restore();
}

/** Title screen, shown before the first run. */
export function drawStartScreen(ctx: CanvasRenderingContext2D, s: GameState) {
  ctx.fillStyle = "rgba(0,0,0,0.72)"; ctx.fillRect(0,0,W,H);
  ctx.textAlign="center"; ctx.shadowColor="#FF2D78"; ctx.shadowBlur=20;
  ctx.fillStyle="#FF2D78"; ctx.font="bold 19px monospace"; ctx.fillText("VICE CITY HUSTLE", W/2, H/2-64);
  ctx.shadowBlur=0; ctx.fillStyle="#aaa"; ctx.font="11px monospace";
  ctx.fillText("HOLD ARROWS / TAP+HOLD TO STEER", W/2, H/2-34);
  ctx.fillText("STAY BETWEEN THE GUARDRAILS", W/2, H/2-16);
  ctx.fillStyle="#00FFFF"; ctx.font="10px monospace";
  ctx.fillText("N=NITRO  BLUE=SHIELD  RED LANE=CHOPPER STRIKE", W/2, H/2+6);
  ctx.fillStyle="#FFE135"; ctx.font="bold 12px monospace"; ctx.fillText("[ TAP OR PRESS SPACE ]", W/2, H/2+36);
  if (s.highScore>0) { ctx.fillStyle="#00FFFF"; ctx.font="11px monospace"; ctx.fillText("BEST: $"+s.highScore.toLocaleString(), W/2, H/2+58); }
}

/** "BUSTED!" screen. `lvl` is the level at the start of the frame. */
export function drawGameOverScreen(ctx: CanvasRenderingContext2D, s: GameState, lvl: LevelDef) {
  ctx.fillStyle="rgba(0,0,0,0.76)"; ctx.fillRect(0,0,W,H);
  ctx.textAlign="center"; ctx.shadowColor="#FF2D78"; ctx.shadowBlur=20;
  ctx.fillStyle="#FF2D78"; ctx.font="bold 22px monospace"; ctx.fillText("BUSTED!", W/2, H/2-58);
  ctx.shadowBlur=0; ctx.fillStyle="#fff"; ctx.font="bold 14px monospace"; ctx.fillText("$"+s.score.toLocaleString(), W/2, H/2-24);
  ctx.fillStyle="#00FFFF"; ctx.font="11px monospace"; ctx.fillText("REACHED: "+lvl.name, W/2, H/2-6);
  if (s.score>=s.highScore && s.score>0) { ctx.fillStyle="#FFE135"; ctx.font="12px monospace"; ctx.fillText("NEW HIGH SCORE!", W/2, H/2+14); }
  else if (s.highScore>0) { ctx.fillStyle="#888"; ctx.font="11px monospace"; ctx.fillText("BEST: $"+s.highScore.toLocaleString(), W/2, H/2+14); }
  const stars = getStars(s.score);
  ctx.fillStyle="#FF2D78"; ctx.font="13px monospace"; ctx.fillText("*".repeat(stars)+".".repeat(5-stars), W/2, H/2+38);
  ctx.fillStyle="#fff"; ctx.font="11px monospace"; ctx.fillText("TAP / SPACE TO RETRY", W/2, H/2+62);
}

/** Traffic, pickups and roadblocks. Drawn from the last array entry to the first, like the original loop. */
function drawObstacles(ctx: CanvasRenderingContext2D, s: GameState) {
  for (let i = s.obs.length - 1; i >= 0; i--) {
    const o = s.obs[i];
    const sx = screenX(o.x, o.z);
    if (o.type==="cop") drawCop(ctx, sx, o.z, s.frame);
    else if (o.type==="swat") drawSwat(ctx, sx, o.z, s.frame);
    else if (o.type==="road") drawRoadblock(ctx, o.z);
    else drawPickup(ctx, sx, o.z, o.type, s.frame);
  }
}

/** Red lane warning plus the chopper silhouette, or the white strike beam. */
function drawHelicopter(ctx: CanvasRenderingContext2D, s: GameState) {
  if (s.heliPhase === "warn" && s.heliZone >= 0) {
    const zx = ZONE_X[s.heliZone]; const bx = screenX(zx, 0.4);
    const pulse = Math.abs(Math.sin(s.frame*0.25));
    ctx.fillStyle = `rgba(255,50,50,${0.15+pulse*0.22})`;
    ctx.beginPath();
    ctx.moveTo(CENTER_X+(zx-0.32)*ROAD_HW_TOP*0.6, HORIZON_Y+4); ctx.lineTo(CENTER_X+(zx+0.32)*ROAD_HW_TOP*0.6, HORIZON_Y+4);
    ctx.lineTo(bx+34, PY+26); ctx.lineTo(bx-34, PY+26); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.shadowColor="#ff3333"; ctx.shadowBlur=10;
    ctx.fillStyle="#222"; ctx.beginPath(); ctx.ellipse(CENTER_X+zx*30, 18, 18, 7, 0, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle="#ff3333"; ctx.lineWidth=2; ctx.beginPath(); ctx.moveTo(CENTER_X+zx*30-24,18); ctx.lineTo(CENTER_X+zx*30+24,18); ctx.stroke();
    ctx.restore();
  } else if (s.heliPhase === "strike" && s.heliZone >= 0) {
    const zx = ZONE_X[s.heliZone]; const bx = screenX(zx, 0.4);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath(); ctx.moveTo(CENTER_X+zx*8, HORIZON_Y); ctx.lineTo(bx+34, PY+26); ctx.lineTo(bx-34, PY+26); ctx.closePath(); ctx.fill();
  }
}

/** Yellow spark when the car scrapes the wall, and a white tint while off the asphalt. */
function drawWallSparks(ctx: CanvasRenderingContext2D, s: GameState, playerSX: number) {
  if (s.wallFlash > 0) {
    const side = s.playerX > 0 ? 1 : -1;
    ctx.save(); ctx.globalAlpha = s.wallFlash/8;
    ctx.fillStyle="#ffee88"; ctx.shadowColor="#ffee88"; ctx.shadowBlur=16;
    ctx.beginPath(); ctx.ellipse(playerSX+side*22, PY-20, 9, 20, 0, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
  if (s.offRoad > 0) { ctx.fillStyle=`rgba(255,255,255,${s.offRoad>1?0.09:0.05})`; ctx.fillRect(0,0,W,H); }
}

/** Score, stars, lives and speed. */
function drawHud(ctx: CanvasRenderingContext2D, s: GameState, mph: number) {
  ctx.fillStyle="rgba(0,0,0,0.55)"; ctx.fillRect(0,0,W,28);
  ctx.fillStyle="#FFE135"; ctx.font="bold 12px monospace"; ctx.textAlign="left"; ctx.fillText("$"+s.score.toLocaleString(),8,18);
  const st2 = getStars(s.score);
  if (st2>0) { ctx.fillStyle="#FF2D78"; ctx.textAlign="center"; ctx.fillText("*".repeat(st2), W/2, 18); }
  ctx.textAlign="right";
  for (let i=0;i<3;i++){ ctx.fillStyle = i<s.lives ? "#FF2D78" : "#333"; ctx.fillText("v", W-8-i*18, 18); }

  ctx.textAlign="left"; ctx.fillStyle="rgba(0,0,0,0.5)"; ctx.fillRect(0,H-22,70,22);
  ctx.fillStyle="#00FFFF"; ctx.font="bold 11px monospace"; ctx.fillText(mph+" MPH", 6, H-7);
}

/** "WANTED LEVEL UP" banner. `lvl` is the level at the start of the frame, so the frame of the level-up still names the old one. */
function drawLevelBanner(ctx: CanvasRenderingContext2D, s: GameState, lvl: LevelDef) {
  if (s.levelBannerTimer > 0) {
    const a = Math.min(1, s.levelBannerTimer/25);
    ctx.fillStyle = `rgba(0,0,0,${0.5*a})`; ctx.fillRect(0,H/2-30,W,60);
    ctx.textAlign="center"; ctx.shadowColor="#FF2D78"; ctx.shadowBlur=16*a;
    ctx.fillStyle=`rgba(255,45,120,${a})`; ctx.font="bold 16px monospace"; ctx.fillText("WANTED LEVEL UP", W/2, H/2-6);
    ctx.fillStyle=`rgba(255,255,255,${a})`; ctx.font="bold 12px monospace"; ctx.fillText(lvl.name, W/2, H/2+14);
    ctx.shadowBlur=0;
  }
}

/** Everything drawn on top of the road scene while a run is in progress. */
export function drawRunningFrame(ctx: CanvasRenderingContext2D, s: GameState, lvl: LevelDef, mph: number) {
  const playerSX = screenX(s.playerX, 0);
  drawObstacles(ctx, s);
  drawHelicopter(ctx, s);
  drawPlayerCar(ctx, playerSX, s.flashTimer, s.invincibleTimer>0, s.shielded);
  drawWallSparks(ctx, s, playerSX);
  drawHud(ctx, s, mph);
  drawLevelBanner(ctx, s, lvl);
}
