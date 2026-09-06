import React, { useRef, useEffect, useCallback, useState } from "react";

const W = 320, H = 420, LANES = [72, 160, 248], PY = H - 100;
const CW = 42, CH = 64, OW = 38, OH = 60, ROADW = 56, SWATW = 50;

type OType = "cop" | "money" | "road" | "swat" | "nitro" | "shield";
interface Obs { x: number; y: number; lane: number; type: OType; }

interface LevelDef {
  min: number; name: string; speedMul: number; spawnMul: number;
  pool: OType[]; heli: boolean; dual: boolean;
}

const LEVELS: LevelDef[] = [
  { min: 0,     name: "CRUISING",      speedMul: 1.00, spawnMul: 1.00, pool: ["cop", "money"],                         heli: false, dual: false },
  { min: 500,   name: "HEAT RISING",   speedMul: 1.18, spawnMul: 1.15, pool: ["cop", "cop", "money"],                  heli: false, dual: false },
  { min: 2000,  name: "ROADBLOCKS UP", speedMul: 1.35, spawnMul: 1.30, pool: ["cop", "cop", "money", "road"],          heli: false, dual: false },
  { min: 5000,  name: "AIR SUPPORT",   speedMul: 1.55, spawnMul: 1.45, pool: ["cop", "money", "road"],                 heli: true,  dual: true  },
  { min: 10000, name: "FULL PURSUIT",  speedMul: 1.75, spawnMul: 1.60, pool: ["cop", "cop", "money", "road", "swat"],  heli: true,  dual: true  },
  { min: 25000, name: "MAX WANTED",    speedMul: 2.10, spawnMul: 1.80, pool: ["cop", "cop", "money", "road", "swat"],  heli: true,  dual: true  },
];

function getLevelIdx(score: number): number {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (score >= LEVELS[i].min) idx = i;
  return idx;
}

const HELI_WARN_FRAMES = 75;
const HELI_STRIKE_FRAMES = 14;
const HELI_COOLDOWN_BASE = 420;

function drawPlayerCar(ctx: CanvasRenderingContext2D, x: number, y: number, flash: number, invincible: boolean, shielded: boolean) {
  const px = x - CW / 2;
  ctx.save();
  const glowColor = invincible ? "#00FFFF" : "#FF2D78";
  ctx.shadowColor = glowColor; ctx.shadowBlur = invincible ? 24 : 16;
  ctx.fillStyle = flash > 0 ? "#fff" : invincible ? "#00CCCC" : "#CC0055";
  ctx.beginPath(); ctx.roundRect(px+6,y+8,CW-12,CH-16,4); ctx.fill();
  ctx.fillStyle = flash > 0 ? "#fdd" : invincible ? "#00FFFF" : "#FF2D78";
  ctx.beginPath(); ctx.roundRect(px+10,y+18,CW-20,CH-32,3); ctx.fill();
  ctx.shadowBlur=0; ctx.fillStyle="#111";
  ([[px+2,y+10],[px+CW-8,y+10],[px+2,y+CH-20],[px+CW-8,y+CH-20]] as number[][]).forEach(([wx,wy])=>ctx.fillRect(wx,wy,6,10));
  ctx.fillStyle="#FFF176"; ctx.shadowColor="#FFF176"; ctx.shadowBlur=8;
  ctx.fillRect(px+8,y+CH-12,8,6); ctx.fillRect(px+CW-16,y+CH-12,8,6);
  if (shielded) {
    ctx.strokeStyle = "rgba(0,200,255,0.85)"; ctx.lineWidth = 3; ctx.shadowColor="#00c8ff"; ctx.shadowBlur=14;
    ctx.beginPath(); ctx.ellipse(x, y+CH/2, CW/2+9, CH/2+10, 0, 0, Math.PI*2); ctx.stroke();
  }
  ctx.restore();
}

function drawCop(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) {
  const px = x - OW/2;
  ctx.save();
  ctx.shadowColor=frame%20<10?"#00f":"#f00"; ctx.shadowBlur=14;
  ctx.fillStyle="#1a1aff"; ctx.beginPath(); ctx.roundRect(px+5,y+6,OW-10,OH-12,4); ctx.fill();
  ctx.fillStyle="#fff"; ctx.beginPath(); ctx.roundRect(px+8,y+14,OW-16,OH-26,3); ctx.fill();
  ctx.fillStyle=frame%20<10?"#FF0000":"#0000FF"; ctx.fillRect(px+8,y+6,OW-16,6);
  ctx.shadowBlur=0; ctx.fillStyle="#111";
  ([[px,y+8],[px+OW-6,y+8],[px,y+OH-18],[px+OW-6,y+OH-18]] as number[][]).forEach(([wx,wy])=>ctx.fillRect(wx,wy,6,10));
  ctx.restore();
}

function drawSwat(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) {
  const px = x - SWATW/2;
  ctx.save();
  ctx.shadowColor = frame%16<8?"#ff3300":"#0033ff"; ctx.shadowBlur = 16;
  ctx.fillStyle = "#1a2e1a";
  ctx.beginPath(); ctx.roundRect(px+3,y+4,SWATW-6,OH-6,5); ctx.fill();
  ctx.fillStyle = "#2a3e2a";
  ctx.beginPath(); ctx.roundRect(px+6,y+12,SWATW-12,OH-24,3); ctx.fill();
  ctx.fillStyle = frame%16<8 ? "#ff3300" : "#0033ff";
  ctx.fillRect(px+6,y+4,SWATW-12,5);
  ctx.shadowBlur=0; ctx.fillStyle="#fff176"; ctx.font="bold 9px monospace"; ctx.textAlign="center";
  ctx.fillText("SWAT", x, y+OH/2+8);
  ctx.fillStyle="#000";
  ([[px,y+6],[px+SWATW-7,y+6],[px,y+OH-16],[px+SWATW-7,y+OH-16]] as number[][]).forEach(([wx,wy])=>ctx.fillRect(wx,wy,7,11));
  ctx.restore();
}

function drawRoadblock(ctx: CanvasRenderingContext2D, x: number, y: number) {
  const px = x - ROADW/2;
  ctx.save();
  ctx.shadowColor = "#FFD700"; ctx.shadowBlur = 10;
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(px, y+14, ROADW, 16);
  for (let i = 0; i < ROADW; i += 12) {
    ctx.fillStyle = ((i/12)|0) % 2 === 0 ? "#FFD700" : "#111";
    ctx.beginPath();
    ctx.moveTo(px+i, y+30); ctx.lineTo(px+i+8, y+14); ctx.lineTo(px+i+14, y+14); ctx.lineTo(px+i+6, y+30);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

function drawMoney(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save(); ctx.shadowColor="#FFE135"; ctx.shadowBlur=10; ctx.fillStyle="#FFE135";
  ctx.beginPath(); ctx.arc(x,y+16,14,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#1a1a00"; ctx.font="bold 14px monospace"; ctx.textAlign="center"; ctx.fillText("$",x,y+21);
  ctx.restore();
}

function drawNitro(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) {
  ctx.save();
  const pulse = 1 + Math.sin(frame*0.3)*0.12;
  ctx.shadowColor="#00FFFF"; ctx.shadowBlur=16;
  ctx.fillStyle="#00CCCC";
  ctx.beginPath(); ctx.arc(x,y+16,14*pulse,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#00332e"; ctx.font="bold 16px monospace"; ctx.textAlign="center"; ctx.fillText("N",x,y+21);
  ctx.restore();
}

function drawShieldPickup(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.shadowColor="#4488ff"; ctx.shadowBlur=14;
  ctx.fillStyle="#2255cc";
  ctx.beginPath(); ctx.arc(x,y+16,14,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle="#aaddff"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.ellipse(x,y+16,7,9,0,0,Math.PI*2); ctx.stroke();
  ctx.restore();
}

export default function ViceArcadeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const st = useRef({
    lane: 1, targetLane: 1, laneX: LANES[1],
    obs: [] as Obs[],
    score: 0, lives: 3, speed: 2.8, frame: 0,
    flashTimer: 0, gameOver: false, started: false,
    highScore: parseInt(typeof localStorage !== "undefined" ? localStorage.getItem("vch_hi") || "0" : "0"),
    spawnTimer: 0, roadOffset: 0, combo: 0,
    level: 0, levelBannerTimer: 0, graceTimer: 0,
    invincibleTimer: 0, shielded: false,
    heliLane: -1, heliPhase: "idle" as "idle"|"warn"|"strike", heliTimer: 0, heliCooldown: HELI_COOLDOWN_BASE, heliHit: false,
  });
  const [disp, setDisp] = useState({ score: 0, lives: 3, gameOver: false, started: false, combo: 0, levelName: "CRUISING", shielded: false, nitro: false });
  const rafRef = useRef<number>(0);
  const getStars = (s: number) => s>=25000?5:s>=10000?4:s>=5000?3:s>=2000?2:s>=500?1:0;

  const reset = useCallback(() => {
    const s = st.current;
    Object.assign(s, {
      lane:1, targetLane:1, laneX:LANES[1], obs:[], score:0, lives:3, speed:2.8, frame:0,
      flashTimer:0, gameOver:false, started:true, spawnTimer:0, combo:0,
      level:0, levelBannerTimer:0, graceTimer:0, invincibleTimer:0, shielded:false,
      heliLane:-1, heliPhase:"idle", heliTimer:0, heliCooldown:HELI_COOLDOWN_BASE, heliHit:false,
    });
    setDisp({ score:0, lives:3, gameOver:false, started:true, combo:0, levelName:"CRUISING", shielded:false, nitro:false });
  }, []);

  const moveLeft  = useCallback(() => { const s=st.current; if (s.targetLane>0 && !s.gameOver && s.started) s.targetLane--; }, []);
  const moveRight = useCallback(() => { const s=st.current; if (s.targetLane<2 && !s.gameOver && s.started) s.targetLane++; }, []);

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key==="ArrowLeft"||e.key==="a") { e.preventDefault(); moveLeft(); }
    if (e.key==="ArrowRight"||e.key==="d") { e.preventDefault(); moveRight(); }
    if ((e.key===" "||e.key==="Enter") && (st.current.gameOver||!st.current.started)) reset();
  }, [moveLeft, moveRight, reset]);

  const handleTouch = useCallback((e: TouchEvent) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    const rect = canvasRef.current!.getBoundingClientRect();
    if (!st.current.started || st.current.gameOver) { reset(); return; }
    (t.clientX - rect.left) < W/2 ? moveLeft() : moveRight();
  }, [moveLeft, moveRight, reset]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    window.addEventListener("keydown", handleKey);
    canvas.addEventListener("touchstart", handleTouch, { passive: false });

    function loop() {
      const s = st.current;
      const lvl = LEVELS[s.level];
      ctx.clearRect(0, 0, W, H);

      const heat = s.level / (LEVELS.length - 1);
      ctx.fillStyle = `rgb(${10+heat*18},${10},${20+heat*6})`;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#111122"; ctx.fillRect(30, 0, W-60, H);
      ctx.fillStyle = "#1a1a2e"; ctx.fillRect(0, 0, 30, H); ctx.fillRect(W-30, 0, 30, H);

      if (s.started && !s.gameOver) s.roadOffset = (s.roadOffset + s.speed*0.8) % 60;
      ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 2; ctx.setLineDash([30,30]);
      ctx.lineDashOffset = -s.roadOffset;
      [116,204].forEach(lx => { ctx.beginPath(); ctx.moveTo(lx,0); ctx.lineTo(lx,H); ctx.stroke(); });
      ctx.setLineDash([]);

      if (!s.started) {
        ctx.fillStyle = "rgba(0,0,0,0.75)"; ctx.fillRect(0,0,W,H);
        ctx.textAlign="center"; ctx.shadowColor="#FF2D78"; ctx.shadowBlur=20;
        ctx.fillStyle="#FF2D78"; ctx.font="bold 20px monospace"; ctx.fillText("VICE CITY HUSTLE", W/2, H/2-60);
        ctx.shadowBlur=0; ctx.fillStyle="#aaa"; ctx.font="11px monospace";
        ctx.fillText("ARROWS / TAP TO DODGE", W/2, H/2-30);
        ctx.fillText("6 WANTED LEVELS. SURVIVE.", W/2, H/2-12);
        ctx.fillStyle="#00FFFF"; ctx.font="10px monospace";
        ctx.fillText("N=NITRO  SHIELD=1 FREE HIT  CHOPPER=DODGE LANE", W/2, H/2+10);
        ctx.fillStyle="#FFE135"; ctx.font="bold 12px monospace"; ctx.fillText("[ TAP OR PRESS SPACE TO START ]", W/2, H/2+42);
        if (s.highScore>0) { ctx.fillStyle="#00FFFF"; ctx.font="11px monospace"; ctx.fillText("BEST: $"+s.highScore.toLocaleString(), W/2, H/2+65); }
        rafRef.current = requestAnimationFrame(loop); return;
      }

      if (s.gameOver) {
        ctx.fillStyle="rgba(0,0,0,0.78)"; ctx.fillRect(0,0,W,H);
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
      if (s.frame % 480 === 0) s.speed = Math.min(s.speed + 0.45, 11);
      const scoreGain = (s.invincibleTimer > 0 ? 2 : 1) * Math.floor(s.speed * 0.5 + 0.5);
      s.score += scoreGain;
      s.laneX += (LANES[s.targetLane] - s.laneX) * 0.18;
      if (s.flashTimer > 0) s.flashTimer--;
      if (s.graceTimer > 0) s.graceTimer--;
      if (s.invincibleTimer > 0) s.invincibleTimer--;

      const newLevel = getLevelIdx(s.score);
      if (newLevel > s.level) {
        s.level = newLevel; s.levelBannerTimer = 90; s.graceTimer = 60;
        setDisp(d => ({ ...d, levelName: LEVELS[newLevel].name }));
      }
      if (s.levelBannerTimer > 0) s.levelBannerTimer--;

      const effSpeed = s.speed * lvl.speedMul;
      s.spawnTimer++;
      const rate = Math.max(22, 90 - effSpeed * 7) / lvl.spawnMul;
      if (s.spawnTimer >= rate) {
        s.spawnTimer = 0;
        const wantDual = lvl.dual && Math.random() < 0.3;
        const spawnCount = wantDual ? 2 : 1;
        for (let n = 0; n < spawnCount; n++) {
          const avail = [0,1,2].filter(l => !s.obs.some(o => o.lane===l && o.y<130));
          if (avail.length === 0) continue;
          const lane = avail[Math.floor(Math.random()*avail.length)];
          const roll = Math.random();
          let type: OType;
          if (roll < 0.05) type = "nitro";
          else if (roll < 0.09) type = "shield";
          else if (roll < 0.30) type = "money";
          else { const pool = lvl.pool.filter(t => t!=="money"); type = pool[Math.floor(Math.random()*pool.length)] || "cop"; }
          s.obs.push({ x: LANES[lane], y: -80, lane, type });
        }
      }

      if (lvl.heli) {
        if (s.heliPhase === "idle") {
          s.heliCooldown--;
          if (s.heliCooldown <= 0) { s.heliPhase="warn"; s.heliLane = Math.floor(Math.random()*3); s.heliTimer = HELI_WARN_FRAMES; s.heliHit=false; }
        } else if (s.heliPhase === "warn") {
          s.heliTimer--;
          if (s.heliTimer <= 0) { s.heliPhase="strike"; s.heliTimer = HELI_STRIKE_FRAMES; }
        } else if (s.heliPhase === "strike") {
          if (!s.heliHit) {
            s.heliHit = true;
            const invuln = s.invincibleTimer>0 || s.graceTimer>0;
            if (s.targetLane === s.heliLane && !invuln) {
              if (s.shielded) { s.shielded=false; s.flashTimer=20; setDisp(d=>({...d,shielded:false})); }
              else {
                s.lives--; s.combo=0; s.flashTimer=45;
                if (s.lives<=0) { s.gameOver=true; if (s.score>s.highScore){s.highScore=s.score;localStorage.setItem("vch_hi",String(s.score));} setDisp(d=>({...d,lives:0,gameOver:true})); }
                else setDisp(d=>({...d,lives:s.lives}));
              }
            } else if (s.targetLane !== s.heliLane) { s.score += 300; }
          }
          s.heliTimer--;
          if (s.heliTimer <= 0) { s.heliPhase="idle"; s.heliLane=-1; s.heliCooldown = Math.max(220, HELI_COOLDOWN_BASE - s.level*40); }
        }
      }

      for (let i = s.obs.length - 1; i >= 0; i--) {
        const o = s.obs[i];
        const mul = o.type==="money" ? 0.7 : o.type==="road" ? 0.85 : o.type==="swat" ? 0.9 : o.type==="nitro"||o.type==="shield" ? 0.75 : 1;
        o.y += effSpeed * mul;
        if (o.y > H + 80) { s.obs.splice(i,1); continue; }

        const hitboxW = o.type==="road" ? ROADW : o.type==="swat" ? SWATW : OW;
        const dx = Math.abs(o.x - s.laneX), dy = Math.abs(o.y+30 - PY-32);
        const hit = dx < (hitboxW/2 + 12) && dy < 36;
        if (!hit) {
          if (o.type==="cop") drawCop(ctx, o.x, o.y, s.frame);
          else if (o.type==="swat") drawSwat(ctx, o.x, o.y, s.frame);
          else if (o.type==="road") drawRoadblock(ctx, o.x, o.y);
          else if (o.type==="money") drawMoney(ctx, o.x, o.y);
          else if (o.type==="nitro") drawNitro(ctx, o.x, o.y, s.frame);
          else if (o.type==="shield") drawShieldPickup(ctx, o.x, o.y);
          continue;
        }

        if (o.type === "money") {
          s.score += 500 + s.combo*50; s.combo++; s.obs.splice(i,1);
          setDisp(d => ({ ...d, score: s.score, combo: s.combo })); continue;
        }
        if (o.type === "nitro") {
          s.invincibleTimer = 210; s.obs.splice(i,1); s.score += 200;
          setDisp(d => ({ ...d, nitro: true })); continue;
        }
        if (o.type === "shield") {
          s.shielded = true; s.obs.splice(i,1); s.score += 200;
          setDisp(d => ({ ...d, shielded: true })); continue;
        }

        const invuln = s.invincibleTimer>0 || s.graceTimer>0;
        s.obs.splice(i,1);
        if (invuln) { s.score += 150; continue; }
        if (s.shielded) { s.shielded=false; s.flashTimer=20; setDisp(d=>({...d,shielded:false})); continue; }
        s.lives--; s.combo=0; s.flashTimer = o.type==="swat"||o.type==="road" ? 55 : 40;
        if (s.lives<=0) {
          s.gameOver=true;
          if (s.score>s.highScore){s.highScore=s.score;localStorage.setItem("vch_hi",String(s.score));}
          setDisp(d=>({...d,lives:0,gameOver:true}));
        } else setDisp(d=>({...d,lives:s.lives}));
      }
      if (s.invincibleTimer <= 0) setDisp(d => d.nitro ? {...d, nitro:false} : d);

      if (s.heliPhase === "warn" && s.heliLane >= 0) {
        const lx = LANES[s.heliLane];
        const pulse = Math.abs(Math.sin(s.frame*0.25));
        ctx.fillStyle = `rgba(255,50,50,${0.15+pulse*0.2})`;
        ctx.fillRect(lx-32, 30, 64, PY+40);
        ctx.strokeStyle = `rgba(255,60,60,${0.5+pulse*0.4})`; ctx.lineWidth=2; ctx.setLineDash([6,4]);
        ctx.strokeRect(lx-32, 30, 64, PY+40); ctx.setLineDash([]);
        ctx.save(); ctx.shadowColor="#ff3333"; ctx.shadowBlur=12;
        ctx.fillStyle="#222"; ctx.beginPath(); ctx.ellipse(lx, 20, 20, 8, 0, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle="#ff3333"; ctx.lineWidth=2;
        ctx.beginPath(); ctx.moveTo(lx-26,20); ctx.lineTo(lx+26,20); ctx.stroke();
        ctx.restore();
      } else if (s.heliPhase === "strike" && s.heliLane >= 0) {
        const lx = LANES[s.heliLane];
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.fillRect(lx-32, 0, 64, H);
      }

      drawPlayerCar(ctx, s.laneX, PY, s.flashTimer, s.invincibleTimer>0, s.shielded);

      ctx.fillStyle="rgba(0,0,0,0.55)"; ctx.fillRect(0,0,W,28);
      ctx.fillStyle="#FFE135"; ctx.font="bold 12px monospace"; ctx.textAlign="left"; ctx.fillText("$"+s.score.toLocaleString(),8,18);
      const st2 = getStars(s.score);
      if (st2>0) { ctx.fillStyle="#FF2D78"; ctx.textAlign="center"; ctx.fillText("*".repeat(st2), W/2, 18); }
      ctx.textAlign="right";
      for (let i=0;i<3;i++){ ctx.fillStyle = i<s.lives ? "#FF2D78" : "#333"; ctx.fillText("v", W-8-i*18, 18); }

      if (s.levelBannerTimer > 0) {
        const a = Math.min(1, s.levelBannerTimer/25);
        ctx.fillStyle = `rgba(0,0,0,${0.5*a})`; ctx.fillRect(0,H/2-30,W,60);
        ctx.textAlign="center"; ctx.shadowColor="#FF2D78"; ctx.shadowBlur=16*a;
        ctx.fillStyle=`rgba(255,45,120,${a})`; ctx.font="bold 16px monospace";
        ctx.fillText("WANTED LEVEL UP", W/2, H/2-6);
        ctx.fillStyle=`rgba(255,255,255,${a})`; ctx.font="bold 12px monospace";
        ctx.fillText(lvl.name, W/2, H/2+14);
        ctx.shadowBlur=0;
      }

      setDisp(d => d.score !== s.score ? { ...d, score: s.score } : d);
      rafRef.current = requestAnimationFrame(loop);
    }

    rafRef.current = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener("keydown", handleKey); canvas.removeEventListener("touchstart", handleTouch); };
  }, [handleKey, handleTouch, reset]);

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
