/**
 * Vice City Hub v13 - shared SEO helpers (ASCII-only on purpose: no encoding surprises on Windows shells).
 * Used by scripts/gen-agent-surface.mjs and scripts/gen-seo-pages.mjs.
 *
 * shell() renders every static page (news archive, vehicles, release date, Wall of Legends) with the SAME look as the
 * React hub: Orbitron/Rajdhani, glass cards, neon buttons, gradient dividers, two-row menu, the Leonida FM radio, and
 * the hub footer with contacts, donations and crypto addresses. Keep it in sync with src/components/Layout.tsx.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const cfg = JSON.parse(readFileSync(join(ROOT, 'site.config.json'), 'utf8'));
export const SITE = cfg.site;
export const NAVDATA = JSON.parse(readFileSync(join(ROOT, 'src', 'lib', 'nav.json'), 'utf8'));
export const GROWTH = String(cfg.api).replace(/\/agent-api$/, '/growth');
export const KOFI = 'https://ko-fi.com/vicecityhub';
export const RELEASE = cfg.release || { date: '2026-11-19', verified: '2026-10-23' };

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const one = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export const trunc = (s, n) => (one(s).length > n ? one(s).slice(0, n - 1).replace(/\s+\S*$/, '') + '...' : one(s));

/** Must stay identical to slug() in the agent-premium edge function. */
export const slugify = (t) =>
  String(t || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
    .replace(/-+$/, '');

export const newsPath = (n) => `n/${n.id}-${slugify(n.title)}/`;
export const newsUrl = (n) => `${SITE}/${newsPath(n)}`;

export const longDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { timeZone: 'UTC', year: 'numeric', month: 'long', day: 'numeric' });
export const day = (iso) => String(iso || new Date().toISOString()).slice(0, 10);
export const stars = (n) => '\u2605'.repeat(Math.max(0, Math.min(5, n | 0))) + '\u2606'.repeat(5 - Math.max(0, Math.min(5, n | 0)));

// ---------------------------------------------------------------------------------------------------------------- CSS
// Mirrors src/index.css (neon palette, glass-card, btn-neon, gradient-line, scanlines, scrollbar) and the Layout nav/footer.
const FONT_FACES = [['Orbitron', '400 900', 'orbitron-latin'], ['Rajdhani', 300, 'rajdhani-300-latin'], ['Rajdhani', 400, 'rajdhani-400-latin'], ['Rajdhani', 500, 'rajdhani-500-latin'], ['Rajdhani', 600, 'rajdhani-600-latin'], ['Rajdhani', 700, 'rajdhani-700-latin']]
  .map(([fam, w, f]) => `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;src:url(${SITE}/fonts/${f}.woff2) format('woff2')}`).join('');
const CSS = FONT_FACES + `:root{--pink:#FF00FF;--cyan:#00FFFF;--yellow:#FFE135;--orange:#FF6B35;--darker:#050508;--mut:#9ca3af;--ink:#e4e4f0}
*{box-sizing:border-box}html{scroll-behavior:smooth}
.yn{font-family:Orbitron,Impact,sans-serif;font-weight:900;font-size:clamp(72px,18vw,168px);line-height:1;text-align:center;margin:.15em 0;letter-spacing:.04em}.yn.no{color:var(--pink);text-shadow:0 0 28px rgba(255,0,255,.65),0 0 60px rgba(255,0,255,.25)}.yn.yes{color:var(--cyan);text-shadow:0 0 28px rgba(0,255,255,.65),0 0 60px rgba(0,255,255,.25)}
body{margin:0;min-height:100vh;display:flex;flex-direction:column;overflow-x:hidden;color:var(--ink);font-family:Rajdhani,system-ui,-apple-system,"Segoe UI",sans-serif;font-weight:500;font-size:17px;line-height:1.6;background:radial-gradient(ellipse at 20% 20%,rgba(255,0,255,.12) 0%,transparent 50%),radial-gradient(ellipse at 80% 80%,rgba(0,255,255,.08) 0%,transparent 50%),radial-gradient(ellipse at 50% 50%,rgba(255,107,53,.04) 0%,transparent 70%),var(--darker);background-attachment:fixed}
body:before{content:"";position:fixed;inset:0;pointer-events:none;z-index:1000;opacity:.25;background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,.15) 2px,rgba(0,0,0,.15) 4px)}
*{scrollbar-width:thin;scrollbar-color:var(--pink) var(--darker)}
::-webkit-scrollbar{width:8px;height:8px}::-webkit-scrollbar-track{background:var(--darker)}::-webkit-scrollbar-thumb{background:linear-gradient(180deg,var(--pink),var(--cyan));border-radius:4px}
a{color:var(--cyan);text-decoration:none;transition:color .2s}a:hover{color:#fff}
.gradient-line{height:2px;background:linear-gradient(90deg,transparent 0%,var(--pink) 20%,var(--cyan) 50%,var(--pink) 80%,transparent 100%);background-size:200% 100%;animation:gl 3s linear infinite}
@keyframes gl{0%{background-position:0 50%}100%{background-position:-200% 50%}}
.top{position:sticky;top:0;z-index:500;background:rgba(7,7,15,.9);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);box-shadow:0 25px 50px -12px rgba(0,0,0,.5)}
.bar{display:flex;align-items:center;justify-content:space-between;padding:17px 24px}
.brand{display:inline-block;font-family:Orbitron,"Arial Black",sans-serif;font-weight:800;font-size:24px;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;background:linear-gradient(90deg,var(--pink),var(--cyan));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;transition:transform .2s}
.brand:hover{transform:scale(1.05);color:transparent}
.ctl{display:flex;align-items:center;gap:16px}
.radio,.burger{display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;background:transparent;transition:all .2s}
.radio{width:40px;height:40px;border-radius:999px;color:var(--cyan);border:1px solid var(--cyan)}
.radio.on{color:var(--pink);border-color:var(--pink);box-shadow:0 0 15px rgba(255,0,255,.4);animation:pl 2s cubic-bezier(.4,0,.6,1) infinite}
@keyframes pl{50%{opacity:.5}}
.burger{width:32px;height:32px;border:0;color:#e5e7eb}.burger:hover{color:var(--pink)}
.radio svg,.burger svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}.burger svg{width:24px;height:24px}
.menu{display:none}
.menu a,.ddb{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:8px 4px;font-family:Rajdhani,sans-serif;font-weight:700;font-size:12px;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap;color:#9ca3af;background:none;border:0;cursor:pointer;transition:color .2s,text-shadow .2s}
.menu a:hover,.ddb:hover{color:var(--cyan)}
.menu a.on,.dd.on>.ddb{color:var(--cyan);text-shadow:0 0 5px var(--cyan),0 0 10px var(--cyan),0 0 20px var(--cyan)}
.menu a.rp:hover{color:var(--pink)}.menu a.rp.on{color:var(--pink);text-shadow:0 0 5px var(--pink),0 0 10px var(--pink),0 0 20px var(--pink)}
.ddb i{font-style:normal;font-size:9px;opacity:.7}
.new{padding:3px 6px;border-radius:4px;border:1px solid rgba(255,0,255,.6);background:rgba(255,0,255,.1);color:var(--pink);font:900 8px/1 Orbitron,sans-serif;letter-spacing:0}
.dd{position:relative}.ddp{display:none}
@media(min-width:1024px){.bar{padding:12px 48px}.burger{display:none}.menu{display:flex;flex:1;align-items:center;justify-content:center;gap:36px}.ddp{position:absolute;left:50%;transform:translateX(-50%);top:100%;padding-top:12px;z-index:700}.dd:hover>.ddp,.dd:focus-within>.ddp,.dd.open>.ddp{display:block}.dd.one>.ddp{display:none!important}.ddi{display:flex;flex-direction:column;min-width:210px;padding:8px 0;background:rgba(18,18,26,.97);border:1px solid rgba(255,0,255,.25);border-radius:12px;box-shadow:0 25px 50px -12px rgba(0,0,0,.6)}.ddi a{justify-content:flex-start;padding:10px 20px;color:#d1d5db}.ddi a:hover{background:rgba(255,255,255,.05);color:var(--cyan)}}
@media(max-width:1023px){.menu.open{display:grid;grid-template-columns:1fr 1fr;gap:26px 24px;padding:28px 32px 32px;position:absolute;left:0;right:0;top:100%;max-height:calc(100vh - 70px);overflow-y:auto;background:var(--darker);border-bottom:1px solid rgba(255,255,255,.1);box-shadow:0 25px 50px -12px rgba(0,0,0,.5);z-index:999}.menu.open .ddb{pointer-events:none;justify-content:flex-start;padding:0 0 8px;font-family:Orbitron,sans-serif;font-size:10px;letter-spacing:.25em;color:var(--pink);text-shadow:none}.menu.open .ddb i{display:none}.menu.open .ddp{display:block}.menu.open .ddi{display:flex;flex-direction:column;gap:10px}.menu.open .ddi a{justify-content:flex-start;padding:0;font-size:14px;color:#d1d5db}.menu.open .ddi a.on{color:var(--cyan)}}
.tabs{display:none}
@media(max-width:1023px){.tabs{display:grid;grid-template-columns:repeat(5,1fr);position:fixed;left:0;right:0;bottom:0;z-index:600;background:rgba(7,7,15,.95);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);border-top:1px solid rgba(255,0,255,.3)}.tabs a{padding:14px 0;text-align:center;font:700 10px/1 Orbitron,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#6b7280}.tabs a.on{color:var(--cyan);text-shadow:0 0 8px var(--cyan)}.foot{padding-bottom:96px}}
.wrap{width:100%;max-width:900px;margin:0 auto;padding:32px 20px 64px;flex:1;position:relative;z-index:10}
h1{margin:.3em 0 .5em;font-family:Orbitron,"Arial Black",sans-serif;font-weight:800;font-size:clamp(22px,4.2vw,34px);line-height:1.25;letter-spacing:.04em;color:#fff;text-shadow:0 0 5px var(--pink),0 0 10px var(--pink),0 0 20px var(--pink)}
h1:after{content:"";display:block;height:2px;margin-top:16px;background:linear-gradient(90deg,transparent 0%,var(--pink) 20%,var(--cyan) 50%,var(--pink) 80%,transparent 100%);background-size:200% 100%;animation:gl 3s linear infinite}
h2{margin:2.2em 0 1em;padding-bottom:10px;border-bottom:1px solid rgba(0,255,255,.2);font-family:Orbitron,sans-serif;font-weight:800;font-size:14px;letter-spacing:.18em;text-transform:uppercase;color:var(--cyan)}
h2:before{content:"\\25C8";margin-right:10px;color:var(--pink);text-shadow:0 0 10px var(--pink)}
h3{margin:.4em 0;font-family:Orbitron,sans-serif;font-weight:700;font-size:14px;letter-spacing:.06em;color:#fff}
p{margin:.7em 0}
.crumbs{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6b7280}.crumbs a{color:#6b7280}.crumbs a:hover{color:var(--cyan)}
.meta{display:flex;flex-wrap:wrap;gap:10px 18px;margin:.6em 0 1.4em;font-size:14px;font-weight:600;letter-spacing:.06em;color:var(--mut)}
.tag{display:inline-block;padding:2px 10px;border-radius:4px;border:1px solid var(--cyan);background:rgba(0,255,255,.06);color:var(--cyan);font:800 10px/1.7 Orbitron,sans-serif;letter-spacing:.12em;text-transform:uppercase}
.heat{color:var(--orange);letter-spacing:2px}
.lead{font-size:20px;font-weight:600;color:#fff}
.card{background:rgba(18,18,26,.85);-webkit-backdrop-filter:blur(20px);backdrop-filter:blur(20px);border:1px solid rgba(255,0,255,.15);border-radius:12px;padding:20px;transition:all .3s ease}
.card:hover{border-color:rgba(0,255,255,.4);box-shadow:0 0 20px rgba(255,0,255,.15),0 0 40px rgba(0,255,255,.1);transform:translateY(-2px)}
.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fill,minmax(250px,1fr))}
.list{list-style:none;margin:0;padding:0;display:grid;gap:14px}
.btn{position:relative;display:inline-flex;align-items:center;justify-content:center;gap:8px;overflow:hidden;padding:10px 24px;border:2px solid var(--pink);border-radius:4px;background:transparent;color:var(--pink);font-family:Orbitron,sans-serif;font-weight:700;font-size:12px;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;transition:all .3s}
.btn:before{content:"";position:absolute;top:0;left:-100%;width:100%;height:100%;background:linear-gradient(90deg,transparent,rgba(255,0,255,.4),transparent);transition:left .5s}
.btn:hover:before{left:100%}
.btn:hover{background:var(--pink);color:#000;box-shadow:0 0 30px var(--pink)}
.btn.alt,.btn.cyan{border-color:var(--cyan);color:var(--cyan)}.btn.alt:hover,.btn.cyan:hover{background:var(--cyan);color:#000;box-shadow:0 0 30px var(--cyan)}
.btn.orange{border-color:var(--orange);color:var(--orange)}.btn.orange:hover{background:var(--orange);color:#000;box-shadow:0 0 30px var(--orange)}
.btn.kofi{border-color:#FF5E5B;color:#FF5E5B}.btn.kofi:hover{background:#FF5E5B;color:#fff;box-shadow:0 0 30px #FF5E5B}
.btn.sm{padding:8px 20px;font-size:10px}
.share{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:1.6em 0}
.share a,.share button{padding:5px 14px;border:1px solid rgba(255,255,255,.15);border-radius:4px;background:rgba(255,255,255,.04);color:#d1d5db;font:700 11px/1.6 Orbitron,sans-serif;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;transition:all .2s}
.share a:hover,.share button:hover{border-color:var(--cyan);color:var(--cyan);box-shadow:0 0 12px rgba(0,255,255,.3)}
.mut{color:var(--mut)}.small{font-size:14px}
table.spec{width:100%;border-collapse:collapse}table.spec td{padding:9px 10px;border-bottom:1px solid rgba(255,255,255,.08);vertical-align:top}table.spec td:first-child{width:38%;color:#6b7280;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:13px}
.count{display:flex;flex-wrap:wrap;gap:14px;margin:18px 0}
.count div{min-width:96px;padding:14px 10px;text-align:center;border-radius:12px;border:1px solid var(--pink);background:rgba(255,0,255,.08);box-shadow:0 0 22px rgba(255,0,255,.25)}
.count b{display:block;font:900 34px/1.1 Orbitron,sans-serif;color:#fff;text-shadow:0 0 10px var(--pink)}.count span{font:700 10px/1 Orbitron,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:var(--mut)}
details{padding:12px 0;border-bottom:1px solid rgba(255,255,255,.08)}summary{cursor:pointer;font-family:Orbitron,sans-serif;font-weight:700;font-size:13px;letter-spacing:.05em;color:#fff}summary:hover{color:var(--cyan)}
.foot{position:relative;z-index:10;display:flex;flex-direction:column;align-items:center;padding:48px 24px;text-align:center;font-weight:700;background:rgba(5,5,8,.95);border-top:1px solid rgba(255,255,255,.05)}
.fbrand{margin-bottom:12px;font-family:Orbitron,sans-serif;font-size:20px;letter-spacing:.1em;text-transform:uppercase;background:linear-gradient(90deg,var(--pink),var(--cyan));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent}
.fdis{max-width:600px;margin:0 0 4px;font-size:12px;letter-spacing:.05em;color:#6b7280}
.fgroups{display:grid;grid-template-columns:repeat(2,1fr);gap:22px 32px;width:100%;max-width:760px;margin-top:22px;text-align:left}
@media(min-width:640px){.fgroups{grid-template-columns:repeat(5,1fr)}}
.fgroups .fh{margin-bottom:8px;font:800 10px/1 Orbitron,sans-serif;letter-spacing:.25em;text-transform:uppercase;color:var(--pink)}
.fgroups a{display:block;padding:3px 0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6b7280}.fgroups a:hover{color:var(--cyan)}
.fmap{margin-top:18px;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:var(--orange)}.fmap:hover{color:var(--cyan)}
.ftm{margin:16px 0 32px;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#4b5563}
.contact{display:flex;flex-direction:column;align-items:center;gap:16px;width:100%;max-width:700px;padding:32px;border-color:rgba(255,0,255,.2);box-shadow:0 25px 50px -12px rgba(0,0,0,.5)}
.contact .ct{font-family:Orbitron,sans-serif;font-size:14px;letter-spacing:.1em;text-transform:uppercase;color:var(--pink)}
.contact p{max-width:500px;margin:0;font-size:12px;color:#9ca3af}
.row{display:flex;flex-wrap:wrap;justify-content:center;gap:12px}
.don{width:100%;margin-top:16px;padding-top:24px;border-top:1px solid rgba(255,255,255,.05);display:flex;flex-direction:column;align-items:center;gap:12px}
.don p{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280}
.addrh{margin:24px 0 16px;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#6b7280}
.addrs{display:grid;grid-template-columns:1fr;gap:16px;width:100%;max-width:900px}
@media(min-width:640px){.addrs{grid-template-columns:1fr 1fr}}
.addr{display:flex;flex-direction:column;justify-content:space-between;min-height:120px;padding:20px;text-align:left;cursor:pointer;box-shadow:0 20px 25px -5px rgba(0,0,0,.4);border-color:rgba(255,255,255,.05)}
.addr:hover{border-color:var(--c)}
.addr .h{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;font-family:Orbitron,sans-serif}
.addr .t{font-weight:900;font-size:12px;color:#e5e7eb;margin-right:8px}.addr .n{font-weight:800;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--c)}
.addr .st{font:800 9px/1 Orbitron,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#6b7280}.addr .st.ok{color:#22c55e;animation:pl 2s infinite}
.addr code{font:600 12px/1.5 ui-monospace,Consolas,monospace;letter-spacing:.05em;color:#d1d5db;word-break:break-all}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important;scroll-behavior:auto!important}}`;

// ----------------------------------------------------------------------------------------------------------------- JS
// Leonida FM mirrors src/lib/AudioManager.ts + the Layout radio: same bucket, same localStorage/sessionStorage keys,
// same autoplay-on-first-gesture rule, same mute-per-session behaviour. No backticks, no dollar-brace, no backslashes in here.
const JS = `(function(){
var SB='https://lpglkglhjdqnktybksth.supabase.co',AK='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxwZ2xrZ2xoamRxbmt0eWJrc3RoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwMTYzMjUsImV4cCI6MjA5MTU5MjMyNX0.fMZo0fjEfPSf20w-rRQh25zPj7xPVOpU6lO2lon3EEk',FB=[SB+'/storage/v1/object/public/muz/1.ogg',SB+'/storage/v1/object/public/muz/2.ogg'];
var $=function(s){return document.querySelector(s)};
function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v)}catch(e){return null}}
function ss(k,v){try{if(v===undefined)return sessionStorage.getItem(k);sessionStorage.setItem(k,v)}catch(e){return null}}
var M='<svg viewBox="0 0 24 24"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>',X='<svg viewBox="0 0 24 24"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
var V2='<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',VX='<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/></svg>';
var bg=$('#burger'),mn=$('#menu');
document.querySelectorAll('.ddb').forEach(function(b){b.addEventListener('click',function(){var d=b.parentNode;if(d.classList.contains('one')||(mn&&mn.classList.contains('open')))return;var o=d.classList.toggle('open');b.setAttribute('aria-expanded',o?'true':'false');document.querySelectorAll('.dd.open').forEach(function(x){if(x!==d)x.classList.remove('open')})})});
document.addEventListener('click',function(e){if(!e.target.closest('.dd'))document.querySelectorAll('.dd.open').forEach(function(x){x.classList.remove('open')})});
if(bg&&mn)bg.addEventListener('click',function(){var o=mn.classList.toggle('open');bg.setAttribute('aria-expanded',o?'true':'false');bg.innerHTML=o?X:M});
var rb=$('#radio'),au=null,tr=FB,ix=-1,want=ss('radioPlaying')!=='false',done=false;
function sync(){var on=!!(au&&!au.paused);if(rb){rb.classList.toggle('on',on);rb.innerHTML=on?V2:VX}}
function pick(){if(tr.length<2)return 0;var i=ix;while(i===ix)i=Math.floor(Math.random()*tr.length);return i}
function load(i,t){ix=i;au.src=tr[i];ls('radioTrackIndex',String(i));if(t>0)au.addEventListener('loadedmetadata',function f(){au.removeEventListener('loadedmetadata',f);if(t<au.duration)try{au.currentTime=t}catch(e){}})}
function play(){var p=au.play();if(p&&p.catch)p.catch(function(){})}
function save(){if(au&&!au.paused){ls('radioTime',String(au.currentTime));ls('radioTrackIndex',String(ix))}}
function boot(){
au=new Audio();au.preload='none';var v=parseFloat(ls('radioVolume')||'0.25');au.volume=isFinite(v)?Math.min(1,Math.max(0,v)):0.25;
au.addEventListener('ended',function(){load(pick(),0);play()});au.addEventListener('play',sync);au.addEventListener('pause',sync);
var s=parseInt(ls('radioTrackIndex')||'-1',10),t=parseFloat(ls('radioTime')||'0');
load(s>=0&&s<tr.length?s:pick(),isFinite(t)&&t>0?t:0);
if(want)play();sync();setInterval(save,1000);addEventListener('pagehide',save);
document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'&&ss('radioPlaying')!=='false'&&au.paused)play()});
}
function first(e){if(done||!au||!want||!au.paused)return;if(e&&e.target&&e.target.closest&&e.target.closest('#radio'))return;var p=au.play();done=true;if(p&&p.catch)p.catch(function(){done=false})}
['click','keydown','touchstart','touchend'].forEach(function(n){document.addEventListener(n,first,{capture:true,passive:true})});
if(rb){rb.innerHTML=VX;rb.addEventListener('click',function(){if(!au)return;if(au.paused){want=true;ss('radioPlaying','true');play()}else{want=false;ss('radioPlaying','false');au.pause()}sync()})}
fetch(SB+'/storage/v1/object/list/muz',{method:'POST',headers:{apikey:AK,Authorization:'Bearer '+AK,'Content-Type':'application/json'},body:JSON.stringify({prefix:'',limit:100,offset:0})}).then(function(r){return r.ok?r.json():[]}).then(function(fs){var u=(fs||[]).filter(function(f){return f&&f.name&&/[.](ogg|mp3|wav|flac)$/i.test(f.name)}).map(function(f){return SB+'/storage/v1/object/public/muz/'+encodeURIComponent(f.name)});if(u.length)tr=u}).catch(function(){}).then(boot);
document.querySelectorAll('[data-copy]').forEach(function(b){b.addEventListener('click',function(){try{navigator.clipboard.writeText(b.dataset.copy);var o=b.textContent;b.textContent='Copied!';setTimeout(function(){b.textContent=o},1800)}catch(e){}})});
document.querySelectorAll('.addr').forEach(function(c){c.addEventListener('click',function(){var s=c.querySelector('.st');try{navigator.clipboard.writeText(c.dataset.addr);s.textContent='Copied';s.classList.add('ok');setTimeout(function(){s.textContent='Copy';s.classList.remove('ok')},2000)}catch(e){}})});
document.querySelectorAll('.addr').forEach(function(c){c.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();c.click()}})});
var c=document.getElementById('count');if(c){var t=new Date(+c.dataset.y,+c.dataset.m-1,+c.dataset.d).getTime();(function tick(){var d=t-Date.now();if(d<=0){c.innerHTML='<p class="lead">It is out. Touch grass later.</p>';return}
var s=Math.floor(d/1000);c.querySelector('[data-k=d]').textContent=Math.floor(s/86400);c.querySelector('[data-k=h]').textContent=String(Math.floor(s%86400/3600)).padStart(2,'0');c.querySelector('[data-k=m]').textContent=String(Math.floor(s%3600/60)).padStart(2,'0');c.querySelector('[data-k=s]').textContent=String(s%60).padStart(2,'0');setTimeout(tick,1000)})()}
try{if(navigator.doNotTrack!=='1'&&ls('vch_ignore')!=='1'){if(/[?&]notrack/.test(location.search)){ls('vch_ignore','1')}else{var q=new URLSearchParams(location.search);fetch(SB+'/functions/v1/hit',{method:'POST',body:JSON.stringify({p:location.pathname,r:document.referrer,s:q.get('utm_source')||q.get('ref')||''}),headers:{'Content-Type':'text/plain'},keepalive:true}).catch(function(){})}}}catch(e){}
})();`;

// Contact, donation and crypto blocks live in the footer (same as the hub). These two stay as no-ops so call sites keep working.
export const nlBlock = () => '';
export const kofiBlock = () => '';

export const shareBar = (url, text) => {
  const u = encodeURIComponent(url), t = encodeURIComponent(text);
  return `<div class="share" aria-label="Share"><span class="mut small">Spread the chaos:</span>
<a href="https://twitter.com/intent/tweet?text=${t}&amp;url=${u}" rel="noopener" target="_blank">Post on X</a>
<a href="https://www.reddit.com/submit?url=${u}&amp;title=${t}" rel="noopener" target="_blank">Reddit</a>
<a href="https://t.me/share/url?url=${u}&amp;text=${t}" rel="noopener" target="_blank">Telegram</a>
<a href="https://wa.me/?text=${t}%20${u}" rel="noopener" target="_blank">WhatsApp</a>
<button type="button" data-copy="${esc(url)}">Copy link</button></div>`;
};

// ----------------------------------------------------------------------------------------------------- nav + footer
// Menu data lives in src/lib/nav.json (shared with src/components/NavGroups.tsx).
const activeKey = (p) =>
  p === 'n' || p.startsWith('n/') ? 'archive' : p.startsWith('vehicles') ? 'vehicles' : p.startsWith('gta-6-release') ? 'date' : p.startsWith('supporters') ? 'wall' : p.startsWith('is-gta-6') ? 'isout' : '';

const FONTS = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;800;900&amp;family=Rajdhani:wght@500;600;700&amp;display=swap';

const ADDRS = [
  ['BTC', 'Bitcoin (BTC)', '#FF6B35', 'bc1qtauw5d569vqmy26w32u6c7076pl5r069xhnsdn'],
  ['ETH', 'Ethereum (ETH)', '#FF00FF', '0x04b9d483E4dcc059CC2fb9375De5244C0A7ddce1'],
  ['SOL', 'Solana (SOL)', '#22c55e', 'Gc75C9QnC59nTVW4f729VbWxcE6fsatGkZBQmQDJqB8b'],
  ['TRX', 'TRON (TRX / USDT)', '#ef4444', 'TRyGNvj1NcVM1V6aDJmycNBiSKWumZ4Zhz'],
];

const groupOf = (act) => (NAVDATA.groups.find((g) => g.items.some((i) => i.key === act)) || {}).key || '';
const header = (path) => {
  const act = activeKey(path);
  const gon = groupOf(act);
  const menu = NAVDATA.groups.map((g) => {
    const on = g.key === gon;
    const items = g.items.map((i) => `<a href="${SITE}/${i.href}"${i.key === act ? ' class="on" aria-current="page"' : ''}>${i.badge ? `<span class="new">${i.badge}</span>` : ''}${i.label}</a>`).join('');
    if (g.items.length === 1) return `<div class="dd one${on ? ' on' : ''}"><a class="ddb" href="${SITE}/${g.items[0].href}">${g.label}</a><div class="ddp"><div class="ddi">${items}</div></div></div>`;
    return `<div class="dd${on ? ' on' : ''}"><button class="ddb" type="button" aria-haspopup="true" aria-expanded="false">${g.label} <i>&#9662;</i></button><div class="ddp"><div class="ddi">${items}</div></div></div>`;
  }).join('');
  const tabs = NAVDATA.bottom.map((b) => `<a href="${SITE}/${b.href}"${b.group === gon ? ' class="on" aria-current="page"' : ''}>${b.label}</a>`).join('');
  return `<header class="top"><div class="bar"><a class="brand" href="${SITE}/index.html">Vice City Hub</a>
<nav id="menu" class="menu" aria-label="Main">${menu}</nav>
<div class="ctl"><button id="radio" class="radio" type="button" aria-label="Toggle Leonida FM" title="Toggle Leonida FM"></button>
<button id="burger" class="burger" type="button" aria-label="Menu" aria-controls="menu" aria-expanded="false"><svg viewBox="0 0 24 24"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg></button></div></div>
<div class="gradient-line"></div></header>
<nav class="tabs" aria-label="Quick navigation">${tabs}</nav>`;
};

const footer = () => `<footer class="foot">
<div class="fbrand">Vice City Hub</div>
<div class="fdis">Leonida's definitive intelligence network. Fan-operated community portal &#8212; not affiliated with Rockstar Games or Take-Two Interactive Software, Inc.</div>
<div class="fgroups">${NAVDATA.groups.map((g) => `<div><div class="fh">${g.label}</div>${g.items.map((i) => `<a href="${SITE}/${i.href}">${i.label}</a>`).join('')}</div>`).join('')}</div>
<a class="fmap" href="${SITE}/map/">All pages &rarr;</a>
<div class="ftm">Grand Theft Auto VI&#8482; is a registered trademark of Take-Two Interactive Software, Inc.</div>
<div class="card contact">
<div class="ct">Contact &amp; Support Operations</div>
<p>Have leak tips, business collaborations, or server bugs? Send an encrypted dispatch or follow the syndicate below:</p>
<div class="row"><a class="btn cyan sm" href="mailto:vicecityhub@proton.me">&#9993; E-Mail Us</a><a class="btn sm" href="https://x.com/vicecity_hub" target="_blank" rel="noopener noreferrer">X Follow on X</a><a class="btn orange sm" href="https://www.instagram.com/vicecity_hub?igsh=MXV6" target="_blank" rel="noopener noreferrer">@ Instagram</a></div>
<div class="don"><p>Vice City Hub runs on community fuel &#8212; no ads, no cookies, no corporate overlords (only anonymous page counts). Donations fuel our AI projects and the open development of AI. Bots may chip in too, with their human's blessing.</p>
<div class="row"><a class="btn orange sm" href="https://ud.me/vicecity.hub" target="_blank" rel="noopener noreferrer">&#10084; Donate</a><a class="btn kofi sm" href="${KOFI}" target="_blank" rel="noopener noreferrer"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.11 0 2-.89 2-2V5c0-1.11-.89-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z"/></svg>Buy Us a Coffee</a></div></div>
</div>
<div class="addrh">Or transfer directly to our secure chain dispatches:</div>
<div class="addrs">${ADDRS.map(([t, n, c, a]) => `<div class="card addr" style="--c:${c}" data-addr="${a}" role="button" tabindex="0" aria-label="Copy ${n} address"><div class="h"><span><span class="t">${t}</span><span class="n">${n}</span></span><span class="st">Copy</span></div><code>${a}</code></div>`).join('')}</div>
</footer>`;

export function shell({ title, description, path, ogImage, type = 'website', ld = [], noindex = false, body, extraHead = '', article }) {
  const url = `${SITE}/${path}`;
  const img = ogImage || cfg.logo;
  const t = esc(title), d = esc(trunc(description, 200));
  const art = article
    ? `<meta property="article:published_time" content="${esc(article.published)}"><meta property="article:section" content="${esc(article.section || 'News')}">`
    : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${esc(url)}">
<meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1'}">
<meta name="theme-color" content="#FF00FF">
<meta property="og:type" content="${type}"><meta property="og:site_name" content="${esc(cfg.name)}"><meta property="og:title" content="${t}"><meta property="og:description" content="${d}"><meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(img)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
${art}
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:site" content="${esc(cfg.twitter)}"><meta name="twitter:title" content="${t}"><meta name="twitter:description" content="${d}"><meta name="twitter:image" content="${esc(img)}">
<link rel="alternate" type="application/rss+xml" title="${esc(cfg.name)} - The Wire" href="${SITE}/feed.xml">
<link rel="icon" type="image/svg+xml" href="${SITE}/favicon.svg">
<link rel="preload" href="${SITE}/fonts/orbitron-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${SITE}/fonts/rajdhani-700-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="${SITE}/fonts/rajdhani-500-latin.woff2" as="font" type="font/woff2" crossorigin>
${extraHead}
${ld.map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`).join('\n')}
<style>${CSS}</style></head>
<body>
${header(path)}
<main class="wrap">
${body}
</main>
${footer()}
<script>${JS}</script>
</body></html>
`;
}

export const org = () => ({
  '@type': 'Organization', '@id': `${SITE}/#org`, name: cfg.name, url: SITE + '/',
  logo: { '@type': 'ImageObject', url: cfg.logo }, sameAs: ['https://x.com/vicecity_hub', 'https://www.instagram.com/vicecity_hub', KOFI],
});
export const crumbs = (items) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url })),
});
