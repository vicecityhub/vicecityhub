import React, { useRef, useEffect, useCallback, useState } from "react";

const W = 320, H = 420, LANES = [72, 160, 248], PY = H - 100;
const CW = 42, CH = 64, OW = 38, OH = 60;

function drawPlayerCar(ctx: CanvasRenderingContext2D, x: number, y: number, flash: number) {
  const px = x - CW / 2;
  ctx.save();
  ctx.shadowColor = "#FF2D78"; ctx.shadowBlur = 16;
  ctx.fillStyle = flash > 0 ? "#fff" : "#CC0055";
  ctx.beginPath(); ctx.roundRect(px+6,y+8,CW-12,CH-16,4); ctx.fill();
  ctx.fillStyle = flash > 0 ? "#fdd" : "#FF2D78";
  ctx.beginPath(); ctx.roundRect(px+10,y+18,CW-20,CH-32,3); ctx.fill();
  ctx.shadowBlur=0; ctx.fillStyle="#111";
  ([[px+2,y+10],[px+CW-8,y+10],[px+2,y+CH-20],[px+CW-8,y+CH-20]] as number[][]).forEach(([wx,wy])=>ctx.fillRect(wx,wy,6,10));
  ctx.fillStyle="#FFF176"; ctx.shadowColor="#FFF176"; ctx.shadowBlur=8;
  ctx.fillRect(px+8,y+CH-12,8,6); ctx.fillRect(px+CW-16,y+CH-12,8,6);
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
function drawMoney(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save(); ctx.shadowColor="#FFE135"; ctx.shadowBlur=10; ctx.fillStyle="#FFE135";
  ctx.beginPath(); ctx.arc(x,y+16,14,0,Math.PI*2); ctx.fill();
  ctx.fillStyle="#1a1a00"; ctx.font="bold 14px monospace"; ctx.textAlign="center"; ctx.fillText("$",x,y+21);
  ctx.restore();
}

export default function ViceArcadeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const st = useRef({ lane:1,targetLane:1,laneX:LANES[1],obs:[] as {x:number;y:number;lane:number;type:"cop"|"money"}[],score:0,lives:3,speed:2.8,frame:0,flashTimer:0,gameOver:false,started:false,highScore:parseInt(typeof localStorage!=="undefined"?localStorage.getItem("vch_hi")||"0":"0"),spawnTimer:0,roadOffset:0,combo:0 });
  const [disp,setDisp]=useState({score:0,lives:3,gameOver:false,started:false,combo:0});
  const rafRef=useRef<number>(0);
  const getStars=(s:number)=>s>=25000?5:s>=10000?4:s>=5000?3:s>=2000?2:s>=500?1:0;
  const reset=useCallback(()=>{const s=st.current;Object.assign(s,{lane:1,targetLane:1,laneX:LANES[1],obs:[],score:0,lives:3,speed:2.8,frame:0,flashTimer:0,gameOver:false,started:true,spawnTimer:0,combo:0});setDisp({score:0,lives:3,gameOver:false,started:true,combo:0});},[]);
  const moveLeft=useCallback(()=>{const s=st.current;if(s.targetLane>0&&!s.gameOver&&s.started)s.targetLane--;},[]);
  const moveRight=useCallback(()=>{const s=st.current;if(s.targetLane<2&&!s.gameOver&&s.started)s.targetLane++;},[]);
  const handleKey=useCallback((e:KeyboardEvent)=>{if(e.key==="ArrowLeft"||e.key==="a"){e.preventDefault();moveLeft();}if(e.key==="ArrowRight"||e.key==="d"){e.preventDefault();moveRight();}if((e.key===" "||e.key==="Enter")&&(st.current.gameOver||!st.current.started))reset();},[moveLeft,moveRight,reset]);
  const handleTouch=useCallback((e:TouchEvent)=>{e.preventDefault();const t=e.changedTouches[0];const rect=canvasRef.current!.getBoundingClientRect();if(!st.current.started||st.current.gameOver){reset();return;}(t.clientX-rect.left)<W/2?moveLeft():moveRight();},[moveLeft,moveRight,reset]);

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext("2d")!;
    window.addEventListener("keydown",handleKey);
    canvas.addEventListener("touchstart",handleTouch,{passive:false});
    function loop(){
      const s=st.current;
      ctx.clearRect(0,0,W,H);
      ctx.fillStyle="#0a0a14";ctx.fillRect(0,0,W,H);
      ctx.fillStyle="#111122";ctx.fillRect(30,0,W-60,H);
      ctx.fillStyle="#1a1a2e";ctx.fillRect(0,0,30,H);ctx.fillRect(W-30,0,30,H);
      if(s.started&&!s.gameOver)s.roadOffset=(s.roadOffset+s.speed*0.8)%60;
      ctx.strokeStyle="rgba(255,255,255,0.12)";ctx.lineWidth=2;ctx.setLineDash([30,30]);ctx.lineDashOffset=-s.roadOffset;
      [116,204].forEach(lx=>{ctx.beginPath();ctx.moveTo(lx,0);ctx.lineTo(lx,H);ctx.stroke();});
      ctx.setLineDash([]);
      if(!s.started){
        ctx.fillStyle="rgba(0,0,0,0.75)";ctx.fillRect(0,0,W,H);
        ctx.textAlign="center";ctx.shadowColor="#FF2D78";ctx.shadowBlur=20;
        ctx.fillStyle="#FF2D78";ctx.font="bold 20px monospace";ctx.fillText("VICE CITY HUSTLE",W/2,H/2-55);
        ctx.shadowBlur=0;ctx.fillStyle="#aaa";ctx.font="11px monospace";
        ctx.fillText("ARROWS / TAP TO DODGE COPS",W/2,H/2-25);ctx.fillText("COLLECT $ TO SCORE",W/2,H/2-5);
        ctx.fillStyle="#FFE135";ctx.font="bold 12px monospace";ctx.fillText("[ TAP OR PRESS SPACE TO START ]",W/2,H/2+38);
        if(s.highScore>0){ctx.fillStyle="#00FFFF";ctx.font="11px monospace";ctx.fillText("BEST: $"+s.highScore.toLocaleString(),W/2,H/2+62);}
        rafRef.current=requestAnimationFrame(loop);return;
      }
      if(s.gameOver){
        ctx.fillStyle="rgba(0,0,0,0.78)";ctx.fillRect(0,0,W,H);
        ctx.textAlign="center";ctx.shadowColor="#FF2D78";ctx.shadowBlur=20;
        ctx.fillStyle="#FF2D78";ctx.font="bold 22px monospace";ctx.fillText("BUSTED!",W/2,H/2-55);
        ctx.shadowBlur=0;ctx.fillStyle="#fff";ctx.font="bold 14px monospace";ctx.fillText("$"+s.score.toLocaleString(),W/2,H/2-20);
        if(s.score>=s.highScore&&s.score>0){ctx.fillStyle="#FFE135";ctx.fillText("NEW HIGH SCORE!",W/2,H/2+8);}
        else if(s.highScore>0){ctx.fillStyle="#00FFFF";ctx.font="12px monospace";ctx.fillText("BEST: $"+s.highScore.toLocaleString(),W/2,H/2+8);}
        const stars=getStars(s.score);
        ctx.fillStyle="#FF2D78";ctx.font="13px monospace";ctx.fillText("*".repeat(stars)+".".repeat(5-stars),W/2,H/2+35);
        ctx.fillStyle="#fff";ctx.font="11px monospace";ctx.fillText("TAP / SPACE TO RETRY",W/2,H/2+60);
        rafRef.current=requestAnimationFrame(loop);return;
      }
      s.frame++;if(s.frame%600===0)s.speed=Math.min(s.speed+0.35,8);
      s.score+=Math.floor(s.speed*0.5+0.5);
      s.laneX+=(LANES[s.targetLane]-s.laneX)*0.18;
      if(s.flashTimer>0)s.flashTimer--;
      s.spawnTimer++;
      const rate=Math.max(38,95-s.speed*8);
      if(s.spawnTimer>=rate){
        s.spawnTimer=0;
        const avail=[0,1,2].filter(l=>!s.obs.some(o=>o.lane===l&&o.y<110));
        if(avail.length>0){const lane=avail[Math.floor(Math.random()*avail.length)];s.obs.push({x:LANES[lane],y:-80,lane,type:Math.random()<0.28?"money":"cop"});}
      }
      for(let i=s.obs.length-1;i>=0;i--){
        const o=s.obs[i];o.y+=o.type==="money"?s.speed*0.7:s.speed;
        if(o.y>H+80){s.obs.splice(i,1);continue;}
        const dx=Math.abs(o.x-s.laneX),dy=Math.abs(o.y+30-PY-32);
        if(dx<28&&dy<36){
          if(o.type==="money"){s.score+=500+s.combo*50;s.combo++;s.obs.splice(i,1);setDisp(d=>({...d,score:s.score,combo:s.combo}));continue;}
          else{s.lives--;s.combo=0;s.flashTimer=40;s.obs.splice(i,1);if(s.lives<=0){s.gameOver=true;if(s.score>s.highScore){s.highScore=s.score;localStorage.setItem("vch_hi",String(s.score));}setDisp(d=>({...d,lives:0,gameOver:true}));}else setDisp(d=>({...d,lives:s.lives}));continue;}
        }
        o.type==="cop"?drawCop(ctx,o.x,o.y,s.frame):drawMoney(ctx,o.x,o.y);
      }
      drawPlayerCar(ctx,s.laneX,PY,s.flashTimer);
      ctx.fillStyle="rgba(0,0,0,0.55)";ctx.fillRect(0,0,W,28);
      ctx.fillStyle="#FFE135";ctx.font="bold 12px monospace";ctx.textAlign="left";ctx.fillText("$"+s.score.toLocaleString(),8,18);
      const st2=getStars(s.score);if(st2>0){ctx.fillStyle="#FF2D78";ctx.textAlign="center";ctx.fillText("*".repeat(st2),W/2,18);}
      ctx.textAlign="right";for(let i=0;i<3;i++){ctx.fillStyle=i<s.lives?"#FF2D78":"#333";ctx.fillText("v",W-8-i*18,18);}
      setDisp(d=>d.score!==s.score?{...d,score:s.score}:d);
      rafRef.current=requestAnimationFrame(loop);
    }
    rafRef.current=requestAnimationFrame(loop);
    return()=>{cancelAnimationFrame(rafRef.current);window.removeEventListener("keydown",handleKey);canvas.removeEventListener("touchstart",handleTouch);};
  },[handleKey,handleTouch,reset]);

  return (
    <div className="relative flex flex-col items-center justify-center w-full h-full select-none"
      style={{background:"rgba(0,0,0,0.4)",borderRadius:"12px",overflow:"hidden",minHeight:"460px"}}>
      <div className="absolute inset-0 rounded-xl pointer-events-none"
        style={{border:"1px solid rgba(255,45,120,0.35)",boxShadow:"0 0 24px rgba(255,45,120,0.12) inset"}}/>
      <div className="absolute top-0 left-0 right-0 px-4 py-2 flex items-center justify-between z-10">
        <span className="font-orbitron font-black text-[10px] tracking-widest text-neonPink">VICE CITY HUSTLE</span>
        <span className="text-[9px] text-white/35 font-bold tracking-widest">ARROWS / TAP</span>
      </div>
      <canvas ref={canvasRef} width={W} height={H} className="rounded-lg cursor-pointer"
        style={{imageRendering:"pixelated",maxWidth:"100%",touchAction:"none"}}
        onClick={()=>{const s=st.current;if(!s.started||s.gameOver)reset();}}/>
      {disp.combo>1&&!disp.gameOver&&disp.started&&(
        <div className="absolute top-12 right-4 font-orbitron font-black text-xs text-neonCyan"
          style={{textShadow:"0 0 10px rgba(0,255,255,0.8)"}}>x{disp.combo} COMBO!</div>
      )}
    </div>
  );
}
