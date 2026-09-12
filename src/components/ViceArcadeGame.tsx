import React, { useRef, useEffect, useCallback, useState } from "react";

const W = 320, H = 420;
const HORIZON_Y = 132, PY = H - 76;
const ROAD_HW_BOTTOM = 108, ROAD_HW_TOP = 5;
const CAM_DEPTH = 1.7, Z_SPAWN = 24, Z_SPEED_SCALE = 0.05;
const CENTER_X = W / 2;

const ROAD_EDGE = 1.0;
const WALL_EDGE = 1.14;
const STEER = 0.05;

type OType = "cop" | "money" | "road" | "swat" | "nitro" | "shield";
interface Obs3D { x: number; z: number; type: OType; hit: boolean; }

interface LevelDef { min: number; name: string; speedMul: number; spawnMul: number; pool: OType[]; heli: boolean; dual: boolean; }

const LEVELS: LevelDef[] = [
  { min: 0,     name: "CRUISING",      speedMul: 1.00, spawnMul: 1.00, pool: ["cop", "money"],                        heli: false, dual: false },
  { min: 500,   name: "HEAT RISING",   speedMul: 1.08, spawnMul: 1.06, pool: ["cop", "cop", "money"],                 heli: false, dual: false },
  { min: 2000,  name: "ROADBLOCKS UP", speedMul: 1.18, spawnMul: 1.13, pool: ["cop", "cop", "money", "road"],         heli: false, dual: true  },
  { min: 5000,  name: "AIR SUPPORT",   speedMul: 1.30, spawnMul: 1.20, pool: ["cop", "money", "road"],                heli: true,  dual: true  },
  { min: 10000, name: "FULL PURSUIT",  speedMul: 1.42, spawnMul: 1.28, pool: ["cop", "cop", "money", "road", "swat"], heli: true,  dual: true  },
  { min: 25000, name: "MAX WANTED",    speedMul: 1.55, spawnMul: 1.35, pool: ["cop", "cop", "money", "road", "swat"], heli: true,  dual: true  },
];

function getLevelIdx(score: number): number {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (score >= LEVELS[i].min) idx = i;
  return idx;
}

const HELI_WARN_FRAMES = 78, HELI_STRIKE_FRAMES = 15, HELI_COOLDOWN_BASE = 440;
const MIN_SPAWN_GAP = 46;
const ZONE_X = [-0.68, 0, 0.68];

function persp(z: number): number { return CAM_DEPTH / (CAM_DEPTH + Math.max(0, z)); }
function screenY(z: number): number { return HORIZON_Y + (PY - HORIZON_Y) * persp(z); }
function roadHalfW(z: number): number { return ROAD_HW_TOP + (ROAD_HW_BOTTOM - ROAD_HW_TOP) * persp(z); }
function screenX(objX: number, z: number): number { return CENTER_X + objX * roadHalfW(z); }
function spriteScale(z: number): number { return 0.22 + persp(z) * 1.05; }

function drawPalm(ctx: CanvasRenderingContext2D, sx: number, sy: number, scale: number) {
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

function drawScene(ctx: CanvasRenderingContext2D, heat: number, stripeZ: number[], shakeX: number) {
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

function carPath(ctx: CanvasRenderingContext2D, cx: number, topY: number, w: number, h: number, style: "muscle"|"sedan"|"van") {
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

function drawGroundShadow(ctx: CanvasRenderingContext2D, cx: number, groundY: number, w: number) {
  ctx.save();
  const grad = ctx.createRadialGradient(cx, groundY, 0, cx, groundY, w*0.62);
  grad.addColorStop(0, "rgba(0,0,0,0.45)"); grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.ellipse(cx, groundY, w*0.56, w*0.16, 0, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawWheels(ctx: CanvasRenderingContext2D, cx: number, topY: number, w: number, h: number) {
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

function drawRearGlass(ctx: CanvasRenderingContext2D, cx: number, topY: number, w: number, h: number) {
  ctx.fillStyle = "rgba(25,35,50,0.8)";
  ctx.beginPath();
  ctx.moveTo(cx-w*0.20, topY+h*0.06); ctx.lineTo(cx+w*0.20, topY+h*0.06);
  ctx.lineTo(cx+w*0.28, topY+h*0.25); ctx.lineTo(cx-w*0.28, topY+h*0.25);
  ctx.closePath(); ctx.fill();
}

function drawTailLights(ctx: CanvasRenderingContext2D, cx: number, topY: number, w: number, h: number) {
  ctx.save(); ctx.shadowColor = "#ff2222"; ctx.shadowBlur = 6; ctx.fillStyle = "#ff3333";
  [-1,1].forEach(side => { ctx.beginPath(); ctx.roundRect(cx+side*w*0.38 - w*0.05, topY+h*0.85, w*0.10, h*0.08, 2); ctx.fill(); });
  ctx.restore();
}

function drawMirrors(ctx: CanvasRenderingContext2D, cx: number, topY: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(cx-w*0.36, topY+h*0.11, w*0.06, h*0.05);
  ctx.fillRect(cx+w*0.30, topY+h*0.11, w*0.06, h*0.05);
}

function drawLightBar(ctx: CanvasRenderingContext2D, cx: number, topY: number, w: number, frame: number) {
  const flip = frame % 20 < 10;
  ctx.save(); ctx.shadowBlur = 8;
  ctx.shadowColor = flip ? "#ff2222" : "#2255ff"; ctx.fillStyle = flip ? "#ff2222" : "#2255ff";
  ctx.fillRect(cx - w*0.20, topY - 4, w*0.19, 4);
  ctx.shadowColor = flip ? "#2255ff" : "#ff2222"; ctx.fillStyle = flip ? "#2255ff" : "#ff2222";
  ctx.fillRect(cx + w*0.01, topY - 4, w*0.19, 4);
  ctx.restore();
}

function drawPlayerCar(ctx: CanvasRenderingContext2D, sx: number, flash: number, invincible: boolean, shielded: boolean) {
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

function drawCop(ctx: CanvasRenderingContext2D, sx: number, z: number, frame: number) {
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

function drawSwat(ctx: CanvasRenderingContext2D, sx: number, z: number, frame: number) {
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

function drawRoadblock(ctx: CanvasRenderingContext2D, z: number) {
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

function drawPickup(ctx: CanvasRenderingContext2D, sx: number, z: number, kind: "money"|"nitro"|"shield", frame: number) {
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

export default function ViceArcadeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const held = useRef({ left: false, right: false });
  const st = useRef({
    playerX: 0, wallFlash: 0, obs: [] as Obs3D[],
    score: 0, lives: 3, speed: 2.4, frame: 0,
    flashTimer: 0, gameOver: false, started: false,
    highScore: parseInt(typeof localStorage !== "undefined" ? localStorage.getItem("vch_hi") || "0" : "0"),
    spawnTimer: 0, combo: 0,
    level: 0, levelBannerTimer: 0, graceTimer: 0,
    invincibleTimer: 0, shielded: false,
    heliZone: -1, heliPhase: "idle" as "idle"|"warn"|"strike", heliTimer: 0, heliCooldown: HELI_COOLDOWN_BASE, heliHit: false,
    stripeZ: [3,6,9,12,15,18,21,24],
    offRoad: 0,
  });
  const [disp, setDisp] = useState({ score: 0, lives: 3, gameOver: false, started: false, combo: 0, levelName: "CRUISING", shielded: false, nitro: false, mph: 0 });
  const rafRef = useRef<number>(0);
  const getStars = (s: number) => s>=25000?5:s>=10000?4:s>=5000?3:s>=2000?2:s>=500?1:0;

  const reset = useCallback(() => {
    const s = st.current;
    Object.assign(s, {
      playerX: 0, wallFlash: 0, obs: [], score: 0, lives: 3, speed: 2.4, frame: 0,
      flashTimer: 0, gameOver: false, started: true, spawnTimer: 0, combo: 0,
      level: 0, levelBannerTimer: 0, graceTimer: 0, invincibleTimer: 0, shielded: false,
      heliZone: -1, heliPhase: "idle", heliTimer: 0, heliCooldown: HELI_COOLDOWN_BASE, heliHit: false,
      offRoad: 0,
    });
    setDisp({ score:0, lives:3, gameOver:false, started:true, combo:0, levelName:"CRUISING", shielded:false, nitro:false, mph:0 });
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key==="ArrowLeft"||e.key==="a") { e.preventDefault(); held.current.left = true; }
    if (e.key==="ArrowRight"||e.key==="d") { e.preventDefault(); held.current.right = true; }
    if ((e.key===" "||e.key==="Enter") && (st.current.gameOver||!st.current.started)) reset();
  }, [reset]);
  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key==="ArrowLeft"||e.key==="a") held.current.left = false;
    if (e.key==="ArrowRight"||e.key==="d") held.current.right = false;
  }, []);
  const handleTouchStart = useCallback((e: TouchEvent) => {
    e.preventDefault();
    if (!st.current.started || st.current.gameOver) { reset(); return; }
    const t = e.changedTouches[0]; const rect = canvasRef.current!.getBoundingClientRect();
    if ((t.clientX - rect.left) < W/2) held.current.left = true; else held.current.right = true;
  }, [reset]);
  const handleTouchEnd = useCallback((e: TouchEvent) => { e.preventDefault(); held.current.left = false; held.current.right = false; }, []);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    canvas.addEventListener("touchstart", handleTouchStart, { passive: false });
    canvas.addEventListener("touchend", handleTouchEnd, { passive: false });

    function loop() {
      const s = st.current;
      const lvl = LEVELS[s.level];
      const heat = s.level / (LEVELS.length - 1);
      const shakeX = s.offRoad > 1 ? (Math.random()-0.5) * 5 : s.offRoad > 0 ? (Math.random()-0.5) * 2.5 : 0;
      ctx.clearRect(0, 0, W, H);
      drawScene(ctx, heat, s.stripeZ, shakeX);

      if (!s.started) {
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
        rafRef.current = requestAnimationFrame(loop); return;
      }

      if (s.gameOver) {
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
        rafRef.current = requestAnimationFrame(loop); return;
      }

      s.frame++;
      if (s.frame % 600 === 0) s.speed = Math.min(s.speed + 0.16, 5.4);
      const effSpeed = s.speed * lvl.speedMul;
      const scoreGain = (s.invincibleTimer>0 ? 2 : 1) * Math.floor(effSpeed*0.5+0.5);
      s.score += scoreGain;

      let nx = s.playerX;
      if (held.current.left) nx -= STEER;
      if (held.current.right) nx += STEER;
      let hitWall = false;
      if (nx > WALL_EDGE) { nx = WALL_EDGE; hitWall = true; }
      if (nx < -WALL_EDGE) { nx = -WALL_EDGE; hitWall = true; }
      s.playerX = nx;
      if (hitWall) s.wallFlash = 8;
      if (s.wallFlash > 0) s.wallFlash--;

      const onShoulder = Math.abs(s.playerX) > ROAD_EDGE;
      s.offRoad = hitWall ? 2 : onShoulder ? 1 : 0;
      const effSpeedRoad = effSpeed * (onShoulder ? 0.87 : 1) * (hitWall ? 0.9 : 1);

      if (s.flashTimer>0) s.flashTimer--;
      if (s.graceTimer>0) s.graceTimer--;
      if (s.invincibleTimer>0) s.invincibleTimer--;

      const newLevel = getLevelIdx(s.score);
      if (newLevel > s.level) { s.level = newLevel; s.levelBannerTimer = 90; s.graceTimer = 70; setDisp(d=>({...d, levelName: LEVELS[newLevel].name})); }
      if (s.levelBannerTimer>0) s.levelBannerTimer--;

      s.stripeZ = s.stripeZ.map(z => { const nz = z - effSpeedRoad*Z_SPEED_SCALE*1.4; return nz <= 0 ? nz + Z_SPAWN : nz; });

      s.spawnTimer++;
      const rawRate = Math.max(50, 105 - effSpeed*5.5);
      const rate = Math.max(MIN_SPAWN_GAP, rawRate / lvl.spawnMul);
      if (s.spawnTimer >= rate) {
        s.spawnTimer = 0;
        const dual = lvl.dual && Math.random() < 0.22;
        const zoneIdxs = [0,1,2].sort(() => Math.random()-0.5);
        const useZones = dual ? zoneIdxs.slice(0,2) : zoneIdxs.slice(0,1);
        useZones.forEach((zi, n) => {
          const roll = Math.random();
          let type: OType;
          if (roll < 0.055) type = "nitro";
          else if (roll < 0.095) type = "shield";
          else if (roll < 0.34) type = "money";
          else if (dual && n===1) { type = Math.random()<0.6 ? "cop" : "money"; }
          else { const pool = lvl.pool.filter(t=>t!=="money"); type = pool[Math.floor(Math.random()*pool.length)] || "cop"; }
          s.obs.push({ x: ZONE_X[zi], z: Z_SPAWN, type, hit: false });
        });
      }

      if (lvl.heli) {
        if (s.heliPhase === "idle") {
          s.heliCooldown--;
          if (s.heliCooldown <= 0) { s.heliPhase="warn"; s.heliZone = Math.floor(Math.random()*3); s.heliTimer = HELI_WARN_FRAMES; s.heliHit = false; }
        } else if (s.heliPhase === "warn") {
          s.heliTimer--;
          if (s.heliTimer <= 0) { s.heliPhase="strike"; s.heliTimer = HELI_STRIKE_FRAMES; }
        } else if (s.heliPhase === "strike") {
          if (!s.heliHit) {
            s.heliHit = true;
            const playerZone = s.playerX < -0.34 ? 0 : s.playerX > 0.34 ? 2 : 1;
            const invuln = s.invincibleTimer>0 || s.graceTimer>0;
            if (playerZone === s.heliZone && !invuln) {
              if (s.shielded) { s.shielded=false; s.flashTimer=20; setDisp(d=>({...d,shielded:false})); }
              else {
                s.lives--; s.combo=0; s.flashTimer=45;
                if (s.lives<=0) { s.gameOver=true; if (s.score>s.highScore){s.highScore=s.score;localStorage.setItem("vch_hi",String(s.score));} setDisp(d=>({...d,lives:0,gameOver:true})); }
                else setDisp(d=>({...d,lives:s.lives}));
              }
            } else if (playerZone !== s.heliZone) { s.score += 300; }
          }
          s.heliTimer--;
          if (s.heliTimer <= 0) { s.heliPhase="idle"; s.heliZone=-1; s.heliCooldown = Math.max(260, HELI_COOLDOWN_BASE - s.level*30); }
        }
      }

      const playerSX = screenX(s.playerX, 0);
      s.obs.sort((a,b) => b.z - a.z);
      for (let i = s.obs.length - 1; i >= 0; i--) {
        const o = s.obs[i];
        const zSpeedMul = o.type==="money"||o.type==="nitro"||o.type==="shield" ? 0.82 : o.type==="road" ? 0.95 : 1;
        o.z -= effSpeedRoad * Z_SPEED_SCALE * zSpeedMul;

        if (o.z <= 0.4 && !o.hit) {
          o.hit = true;
          const hitTol = o.type==="road" ? 0.46 : o.type==="swat" ? 0.42 : 0.32;
          const dist = Math.abs(o.x - s.playerX);
          const collided = dist < hitTol;
          if (collided) {
            if (o.type === "money") { s.score += 500 + s.combo*50; s.combo++; setDisp(d=>({...d,score:s.score,combo:s.combo})); }
            else if (o.type === "nitro") { s.invincibleTimer = 200; s.score += 200; setDisp(d=>({...d,nitro:true})); }
            else if (o.type === "shield") { s.shielded = true; s.score += 200; setDisp(d=>({...d,shielded:true})); }
            else {
              const invuln = s.invincibleTimer>0 || s.graceTimer>0;
              if (invuln) { s.score += 150; }
              else if (s.shielded) { s.shielded=false; s.flashTimer=20; setDisp(d=>({...d,shielded:false})); }
              else {
                s.lives--; s.combo=0; s.flashTimer = o.type==="swat"||o.type==="road" ? 55 : 40;
                if (s.lives<=0) { s.gameOver=true; if (s.score>s.highScore){s.highScore=s.score;localStorage.setItem("vch_hi",String(s.score));} setDisp(d=>({...d,lives:0,gameOver:true})); }
                else setDisp(d=>({...d,lives:s.lives}));
              }
            }
          } else if (o.type !== "money" && o.type !== "nitro" && o.type !== "shield") { s.score += 40; }
        }
        if (o.z < -1.5) { s.obs.splice(i,1); continue; }

        const sx = screenX(o.x, o.z);
        if (o.type==="cop") drawCop(ctx, sx, o.z, s.frame);
        else if (o.type==="swat") drawSwat(ctx, sx, o.z, s.frame);
        else if (o.type==="road") drawRoadblock(ctx, o.z);
        else drawPickup(ctx, sx, o.z, o.type, s.frame);
      }
      if (s.invincibleTimer <= 0) setDisp(d => d.nitro ? {...d, nitro:false} : d);

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

      drawPlayerCar(ctx, playerSX, s.flashTimer, s.invincibleTimer>0, s.shielded);

      if (s.wallFlash > 0) {
        const side = s.playerX > 0 ? 1 : -1;
        ctx.save(); ctx.globalAlpha = s.wallFlash/8;
        ctx.fillStyle="#ffee88"; ctx.shadowColor="#ffee88"; ctx.shadowBlur=16;
        ctx.beginPath(); ctx.ellipse(playerSX+side*22, PY-20, 9, 20, 0, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      }
      if (s.offRoad > 0) { ctx.fillStyle=`rgba(255,255,255,${s.offRoad>1?0.09:0.05})`; ctx.fillRect(0,0,W,H); }

      ctx.fillStyle="rgba(0,0,0,0.55)"; ctx.fillRect(0,0,W,28);
      ctx.fillStyle="#FFE135"; ctx.font="bold 12px monospace"; ctx.textAlign="left"; ctx.fillText("$"+s.score.toLocaleString(),8,18);
      const st2 = getStars(s.score);
      if (st2>0) { ctx.fillStyle="#FF2D78"; ctx.textAlign="center"; ctx.fillText("*".repeat(st2), W/2, 18); }
      ctx.textAlign="right";
      for (let i=0;i<3;i++){ ctx.fillStyle = i<s.lives ? "#FF2D78" : "#333"; ctx.fillText("v", W-8-i*18, 18); }

      const mph = Math.round(28 + effSpeed*13);
      ctx.textAlign="left"; ctx.fillStyle="rgba(0,0,0,0.5)"; ctx.fillRect(0,H-22,70,22);
      ctx.fillStyle="#00FFFF"; ctx.font="bold 11px monospace"; ctx.fillText(mph+" MPH", 6, H-7);

      if (s.levelBannerTimer > 0) {
        const a = Math.min(1, s.levelBannerTimer/25);
        ctx.fillStyle = `rgba(0,0,0,${0.5*a})`; ctx.fillRect(0,H/2-30,W,60);
        ctx.textAlign="center"; ctx.shadowColor="#FF2D78"; ctx.shadowBlur=16*a;
        ctx.fillStyle=`rgba(255,45,120,${a})`; ctx.font="bold 16px monospace"; ctx.fillText("WANTED LEVEL UP", W/2, H/2-6);
        ctx.fillStyle=`rgba(255,255,255,${a})`; ctx.font="bold 12px monospace"; ctx.fillText(lvl.name, W/2, H/2+14);
        ctx.shadowBlur=0;
      }

      setDisp(d => (d.score!==s.score||d.mph!==mph) ? {...d, score:s.score, mph} : d);
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener("keydown", handleKeyDown); window.removeEventListener("keyup", handleKeyUp); canvas.removeEventListener("touchstart", handleTouchStart); canvas.removeEventListener("touchend", handleTouchEnd); };
  }, [handleKeyDown, handleKeyUp, handleTouchStart, handleTouchEnd, reset]);

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
        onClick={()=>{const s=st.current;if(!s.started||s.gameOver)reset();}}/>
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
    </div>
  );
}
