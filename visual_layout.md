<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Petri · Evolution of Trust</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,300;0,400;0,500;1,300&family=IM+Fell+English:ital@0;1&display=swap" rel="stylesheet">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --bg: #f0ede8;
  --dish: #f7f5f0;
  --rim: #d4cfc6;
  --ink: #2a2520;
  --ink-dim: #8a8278;
  --panel: rgba(240,237,232,0.94);
  --panel-w: 190px;
}

html, body {
  height: 100%; width: 100%;
  overflow: hidden;
}

body {
  background: var(--bg);
  color: var(--ink);
  font-family: 'IBM Plex Mono', monospace;
  display: flex;
  flex-direction: column;
}

/* Lab bench texture */
body::before {
  content: '';
  position: fixed; inset: 0;
  background-image:
    repeating-linear-gradient(0deg, transparent, transparent 39px, rgba(0,0,0,0.025) 40px),
    repeating-linear-gradient(90deg, transparent, transparent 39px, rgba(0,0,0,0.018) 40px);
  pointer-events: none; z-index: 0;
}

/* ── TOP HEADER BAR ── */
#header {
  flex-shrink: 0;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 12px;
  padding: 12px 20px 10px;
  border-bottom: 1px solid var(--rim);
  background: var(--panel);
  position: relative;
  z-index: 5;
}

#header h1 {
  font-family: 'IM Fell English', serif;
  font-size: 1.05rem;
  font-weight: 400;
  letter-spacing: 0.06em;
  color: var(--ink);
  white-space: nowrap;
}

#header p {
  font-size: 0.52rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--ink-dim);
}

/* ── MAIN BODY (panels + dish) ── */
#main {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  overflow: hidden;
  position: relative;
  z-index: 1;
  min-height: 0;
}

/* ── SIDE PANELS ── */
.side-panel {
  width: var(--panel-w);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px 12px;
  background: var(--panel);
  overflow-y: auto;
  overflow-x: hidden;
}

#panel-left  { border-right: 1px solid var(--rim); }
#panel-right { border-left:  1px solid var(--rim); }

.panel-block {
  background: rgba(255,253,249,0.7);
  border: 1px solid var(--rim);
  border-radius: 3px;
  padding: 11px 13px;
}

.panel-block h3 {
  font-size: 0.54rem;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--ink-dim);
  margin-bottom: 9px;
  font-weight: 500;
}

/* Generation */
#gen-block .gen-number {
  font-family: 'IM Fell English', serif;
  font-size: 2.6rem;
  line-height: 1;
  color: var(--ink);
  letter-spacing: -0.02em;
}

#gen-block .gen-sub {
  font-size: 0.56rem;
  color: var(--ink-dim);
  margin-top: 3px;
  font-style: italic;
}

/* Legend rows */
.strat-row {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 5px;
  font-size: 0.66rem;
}
.strat-row:last-child { margin-bottom: 0; }

.swatch {
  width: 8px; height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
  opacity: 0.85;
}
.strat-label { flex: 1; color: var(--ink); }
.strat-n { font-size: 0.64rem; color: var(--ink-dim); min-width: 20px; text-align: right; }
.strat-n.dominant { color: var(--ink); font-weight: 500; }

/* Chart */
#chart-wrap canvas { width: 100% !important; height: 80px; display: block; }

/* Log */
#log-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
#log-list li {
  font-size: 0.58rem;
  color: var(--ink-dim);
  font-style: italic;
  line-height: 1.4;
  padding-bottom: 5px;
  border-bottom: 1px solid rgba(0,0,0,0.06);
  transition: color 0.4s;
}
#log-list li.fresh { color: var(--ink); }

/* ── DISH CENTRE ── */
#dish-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 12px;
  min-width: 0;
  gap: 10px;
}

#dish-wrap {
  position: relative;
  flex-shrink: 0;
}

#dish-shadow {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(ellipse at 40% 35%, transparent 55%, rgba(0,0,0,0.10) 100%);
  inset: -2px;
  pointer-events: none; z-index: 3;
}

#dish-rim {
  position: absolute;
  border-radius: 50%;
  border: 3px solid var(--rim);
  inset: 0;
  pointer-events: none; z-index: 4;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.6);
}

#dish-glare {
  position: absolute;
  top: 6%; left: 12%;
  width: 28%; height: 14%;
  background: radial-gradient(ellipse, rgba(255,255,255,0.55) 0%, transparent 100%);
  border-radius: 50%;
  pointer-events: none; z-index: 5;
  transform: rotate(-20deg);
}

#dish-vignette {
  position: absolute; inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle, transparent 60%, rgba(180,170,155,0.32) 100%);
  pointer-events: none; z-index: 4;
}

canvas#petri {
  display: block;
  border-radius: 50%;
  background: var(--dish);
  position: relative; z-index: 2;
  box-shadow: 0 2px 10px rgba(0,0,0,0.09), inset 0 0 40px rgba(200,190,170,0.2);
}

/* ── CONTROLS BAR (inside dish area, below dish) ── */
#controls {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
  flex-shrink: 0;
}

.btn {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.58rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  background: var(--panel);
  border: 1px solid var(--rim);
  color: var(--ink-dim);
  padding: 6px 12px;
  border-radius: 2px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.btn:hover { color: var(--ink); border-color: #aaa; }
.btn.on { color: var(--ink); border-color: var(--ink); background: rgba(0,0,0,0.06); }

.speed-disp {
  font-size: 0.58rem;
  color: var(--ink-dim);
  letter-spacing: 0.1em;
  min-width: 22px;
  text-align: center;
}

/* ── TOOLTIP ── */
#tip {
  position: fixed; z-index: 20;
  background: var(--panel);
  border: 1px solid var(--rim);
  border-radius: 3px;
  padding: 8px 12px;
  font-size: 0.63rem;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s;
  max-width: 160px;
  line-height: 1.5;
}
#tip.show { opacity: 1; }
#tip strong { font-weight: 500; display: block; margin-bottom: 2px; }

/* ═══════════════════════════════════════
   TABLET LANDSCAPE  768 – 1023px
   Narrower side panels, everything scales
═══════════════════════════════════════ */
@media (max-width: 1023px) {
  :root { --panel-w: 155px; }

  #header h1 { font-size: 0.92rem; }
  #header p  { display: none; }

  #gen-block .gen-number { font-size: 2.1rem; }

  .strat-row  { font-size: 0.6rem; }
  #log-list li { font-size: 0.54rem; }
  .panel-block { padding: 9px 11px; }
}

/* ═══════════════════════════════════════
   TABLET PORTRAIT  ≤ 767px
   Stack: top info strip → dish → bottom strip
═══════════════════════════════════════ */
@media (max-width: 767px) {
  body { overflow-y: auto; }

  #main {
    flex-direction: column;
    align-items: center;
    overflow-y: auto;
    padding: 10px 12px 8px;
    gap: 10px;
  }

  /* Side panels become horizontal strips */
  .side-panel {
    width: 100%;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 8px;
    padding: 0;
    background: transparent;
    border: none;
    overflow: visible;
  }

  .panel-block {
    flex: 1;
    min-width: 130px;
  }

  /* Gen block takes full row on portrait */
  #gen-block {
    flex-basis: 100%;
    display: flex;
    align-items: baseline;
    gap: 14px;
    padding: 9px 14px;
  }

  #gen-block .gen-number { font-size: 2rem; }
  #gen-block h3 { margin-bottom: 0; }
  #gen-block .gen-sub { margin-top: 0; }

  #dish-area { padding: 0; width: 100%; }

  #controls { gap: 5px; }
  .btn { font-size: 0.55rem; padding: 6px 10px; }

  /* Log hidden on portrait to save space */
  #log-wrap { display: none; }
}
</style>
</head>
<body>

<!-- TOP HEADER -->
<div id="header">
  <h1>Evolution of Trust</h1>
  <p>Axelrod · Prisoner's Dilemma · Evolutionary Dynamics</p>
</div>

<!-- MAIN: left panel | dish | right panel -->
<div id="main">

  <!-- LEFT PANEL -->
  <div class="side-panel" id="panel-left">
    <div class="panel-block" id="gen-block">
      <h3>Generation</h3>
      <div class="gen-number" id="gen-num">0</div>
      <div class="gen-sub" id="gen-sub">initialising culture…</div>
    </div>
    <div class="panel-block">
      <h3>Population</h3>
      <div id="strat-list"></div>
    </div>
  </div>

  <!-- CENTRE: dish + controls -->
  <div id="dish-area">
    <div id="dish-wrap">
      <canvas id="petri"></canvas>
      <div id="dish-shadow"></div>
      <div id="dish-rim"></div>
      <div id="dish-glare"></div>
      <div id="dish-vignette"></div>
    </div>
    <div id="controls">
      <button class="btn" id="btn-slow">◂ Slower</button>
      <button class="btn on" id="btn-pause">⏸ Pause</button>
      <button class="btn" id="btn-fast">Faster ▸</button>
      <span class="speed-disp" id="spd">1×</span>
      <button class="btn" id="btn-shock">⚡ Shock</button>
      <button class="btn" id="btn-reset">↺ Reset</button>
    </div>
  </div>

  <!-- RIGHT PANEL -->
  <div class="side-panel" id="panel-right">
    <div class="panel-block" id="chart-wrap">
      <h3>Population History</h3>
      <canvas id="chart" width="166" height="80"></canvas>
    </div>
    <div class="panel-block" id="log-wrap">
      <h3>Observations</h3>
      <ul id="log-list"></ul>
    </div>
  </div>

</div>

<div id="tip">
  <strong id="tip-name"></strong>
  <span id="tip-desc"></span><br>
  <span id="tip-score" style="color:var(--ink-dim)"></span>
</div>

<script>
// ── STRATEGIES ──────────────────────────────────────────────────────────────
const C = 0, D = 1;

const STRATS = {
  tft:       { name:'Tit for Tat',       short:'TfT',   color:'#1a9e6e', move: h => h.length===0 ? C : h[h.length-1].o, desc:'Copy last move.' },
  cooperator:{ name:'Always Cooperate',  short:'Coop',  color:'#1a6eb5', move: ()=> C,            desc:'Always cooperate.' },
  defector:  { name:'Always Defect',     short:'Def',   color:'#cc2a2a', move: ()=> D,            desc:'Always defect.' },
  grudger:   { name:'Grudger',           short:'Grud',  color:'#b87a10', move: h => h.some(x=>x.o===D)?D:C, desc:'Never forgive a defection.' },
  detective: { name:'Detective',         short:'Det',   color:'#8a1ab5', move: h => {
    const p=[C,D,C,C]; if(h.length<4) return p[h.length];
    return h.slice(0,4).some(x=>x.o===D) ? h[h.length-1].o : D;
  }, desc:'Probe then exploit or mimic.' },
  random:    { name:'Random',            short:'Rnd',   color:'#666070', move: ()=> Math.random()<.5?C:D, desc:'50/50 each round.' },
};

const KEYS = Object.keys(STRATS);
const PAYOFF = { [C]:{ [C]:[3,3],[D]:[0,5] }, [D]:{ [C]:[5,0],[D]:[1,1] } };

function playMatch(kA, kB, rounds=5) {
  const sA=STRATS[kA], sB=STRATS[kB];
  const hA=[],hB=[];
  let sA_=0, sB_=0;
  for(let r=0;r<rounds;r++){
    const mA=sA.move(hA), mB=sB.move(hB);
    const [pA,pB]=PAYOFF[mA][mB];
    sA_+=pA; sB_+=pB;
    hA.push({m:mA,o:mB}); hB.push({m:mB,o:mA});
  }
  return [sA_,sB_];
}

// ── SIMULATION ──────────────────────────────────────────────────────────────
const N = 120;
let agents=[], gen=0, history=[], paused=false, speed=1;
const SPEEDS=[0.25,0.5,1,2,4,8]; let spdIdx=2;

function rnd(a,b){ return a+Math.random()*(b-a); }

function initAgents(){
  agents=[];
  // Evenly seed strategies
  for(let i=0;i<N;i++){
    const k=KEYS[i % KEYS.length];
    agents.push({ id:i, k, score:0,
      x: rnd(0.05,0.95), y: rnd(0.05,0.95),
      vx: rnd(-0.001,0.001), vy: rnd(-0.001,0.001),
      r: rnd(0.012, 0.022),
      pulse: Math.random()*Math.PI*2,
      flash: 0, // interaction flash timer
    });
  }
}

function runGen(){
  agents.forEach(a=>a.score=0);
  // Each agent plays 6 random opponents
  for(let a of agents){
    const opponents=[...agents].filter(b=>b!==a).sort(()=>Math.random()-.5).slice(0,6);
    for(let b of opponents){
      const [sa,sb]=playMatch(a.k,b.k,5);
      a.score+=sa; b.score+=sb;
      a.flash=0.5; b.flash=0.5;
    }
  }
  // Evolve: bottom 30% copy random top 30%
  const sorted=[...agents].sort((a,b)=>b.score-a.score);
  const top=sorted.slice(0,Math.floor(N*0.30));
  const bot=sorted.slice(Math.floor(N*0.70));
  bot.forEach(loser=>{
    const winner=top[Math.floor(Math.random()*top.length)];
    loser.k=Math.random()<0.08 ? KEYS[Math.floor(Math.random()*KEYS.length)] : winner.k;
    loser.score=0;
  });
  gen++;
  recordHistory();
  updateUI();
  addLog();
}

function shockDefectors(){
  // Inject 15 defectors at random positions
  const targets=[...agents].sort(()=>Math.random()-.5).slice(0,15);
  targets.forEach(a=>{ a.k='defector'; a.flash=1.0; });
  addLog('⚡ Defectors injected into culture…');
}

// ── CANVAS / RENDERING ──────────────────────────────────────────────────────
const petri = document.getElementById('petri');
const ctx = petri.getContext('2d');

function sizeDish(){
  const area = document.getElementById('dish-area');
  const areaW = area.clientWidth;
  const areaH = area.clientHeight;
  // Leave room for controls bar (~50px) and padding
  const availW = areaW - 24;
  const availH = areaH - 60;
  const D = Math.max(220, Math.min(availW, availH, 680));
  petri.width = D; petri.height = D;
  const wrap = document.querySelector('#dish-wrap');
  wrap.style.width = D+'px';
  wrap.style.height = D+'px';
  // Resize chart canvas to match its container
  const chartWrap = document.getElementById('chart-wrap');
  const chartCanvas = document.getElementById('chart');
  chartCanvas.width = Math.max(100, chartWrap.clientWidth - 26);
}

function drawDish(dt){
  const W=petri.width, H=petri.height, R=W/2;
  ctx.clearRect(0,0,W,H);

  // Clip to circle
  ctx.save();
  ctx.beginPath(); ctx.arc(R,R,R-2,0,Math.PI*2); ctx.clip();

  // Agar background — very subtle warm texture
  const bg = ctx.createRadialGradient(R*0.85,R*0.7,0,R,R,R);
  bg.addColorStop(0,'#faf8f3');
  bg.addColorStop(1,'#ede9e0');
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

  // Subtle grid lines (scientific graph paper feel)
  ctx.strokeStyle='rgba(0,0,0,0.04)'; ctx.lineWidth=0.5;
  const gs=W/16;
  for(let x=gs;x<W;x+=gs){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for(let y=gs;y<H;y+=gs){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // Draw agents
  for(const a of agents){
    a.pulse += dt * (1.8 + a.flash*4);
    if(a.flash>0) a.flash=Math.max(0,a.flash-dt);

    const ax=a.x*W, ay=a.y*H;
    const pr = a.r * W;
    const pulseMod = 1 + Math.sin(a.pulse)*0.06;
    const cr = pr * pulseMod;

    const col=STRATS[a.k].color;

    // Glow halo when flashing
    if(a.flash>0){
      const g=ctx.createRadialGradient(ax,ay,cr*0.5,ax,ay,cr*3.5);
      g.addColorStop(0, col+'55');
      g.addColorStop(1, col+'00');
      ctx.beginPath(); ctx.arc(ax,ay,cr*3.5,0,Math.PI*2);
      ctx.fillStyle=g; ctx.fill();
    }

    // Outer soft blob shadow
    const shadow=ctx.createRadialGradient(ax+cr*0.15,ay+cr*0.15,0,ax,ay,cr*1.6);
    shadow.addColorStop(0,'rgba(0,0,0,0.10)');
    shadow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.beginPath(); ctx.arc(ax,ay,cr*1.6,0,Math.PI*2);
    ctx.fillStyle=shadow; ctx.fill();

    // Body fill — translucent cell look
    const grad=ctx.createRadialGradient(ax-cr*0.3,ay-cr*0.3,cr*0.05,ax,ay,cr);
    grad.addColorStop(0, col+'dd');
    grad.addColorStop(0.6, col+'99');
    grad.addColorStop(1, col+'44');
    ctx.beginPath(); ctx.arc(ax,ay,cr,0,Math.PI*2);
    ctx.fillStyle=grad; ctx.fill();

    // Cell membrane ring
    ctx.beginPath(); ctx.arc(ax,ay,cr,0,Math.PI*2);
    ctx.strokeStyle=col+'bb'; ctx.lineWidth=0.8; ctx.stroke();

    // Inner nucleus dot
    ctx.beginPath(); ctx.arc(ax-cr*0.22,ay-cr*0.22,cr*0.22,0,Math.PI*2);
    ctx.fillStyle='rgba(255,255,255,0.45)'; ctx.fill();
  }

  // Interaction arcs (draw a few each frame based on flash)
  const flashing=agents.filter(a=>a.flash>0.3);
  if(flashing.length>=2){
    for(let i=0;i<Math.min(flashing.length-1,4);i+=2){
      const a=flashing[i], b=flashing[i+1];
      const ax=a.x*W,ay=a.y*H,bx=b.x*W,by=b.y*H;
      const alpha=Math.min(a.flash,b.flash)*0.25;
      ctx.beginPath();
      ctx.moveTo(ax,ay);
      const mx=(ax+bx)/2+(ay-by)*0.15, my=(ay+by)/2+(bx-ax)*0.15;
      ctx.quadraticCurveTo(mx,my,bx,by);
      ctx.strokeStyle=`rgba(100,100,100,${alpha})`;
      ctx.lineWidth=0.6; ctx.stroke();
    }
  }

  ctx.restore();
}

function moveAgents(dt){
  for(const a of agents){
    a.x += a.vx * dt * 60;
    a.y += a.vy * dt * 60;
    // Brownian nudge
    a.vx += (Math.random()-0.5)*0.00008;
    a.vy += (Math.random()-0.5)*0.00008;
    // Damping
    a.vx *= 0.995; a.vy *= 0.995;
    // Clamp to circle
    const cx=a.x-0.5, cy=a.y-0.5, d=Math.sqrt(cx*cx+cy*cy);
    if(d>0.46){
      const nx=cx/d, ny=cy/d;
      a.vx -= nx*0.002; a.vy -= ny*0.002;
      a.x = 0.5+nx*0.45; a.y = 0.5+ny*0.45;
    }
    // Soft repulsion from same-position agents
    // (skip for perf — brownian is enough)
  }
}

// ── UI ───────────────────────────────────────────────────────────────────────
function counts(){
  const c={};KEYS.forEach(k=>c[k]=0);
  agents.forEach(a=>c[a.k]++);
  return c;
}

function updateUI(){
  document.getElementById('gen-num').textContent=gen;
  const c=counts();
  const dom=KEYS.reduce((a,b)=>c[a]>c[b]?a:b);
  document.getElementById('gen-sub').textContent=`dominant: ${STRATS[dom].short}`;

  // Strat list
  const list=document.getElementById('strat-list');
  list.innerHTML='';
  KEYS.slice().sort((a,b)=>c[b]-c[a]).forEach(k=>{
    const s=STRATS[k];
    const row=document.createElement('div');
    row.className='strat-row';
    row.innerHTML=`
      <div class="swatch" style="background:${s.color}"></div>
      <span class="strat-label">${s.short}</span>
      <span class="strat-n${c[k]===Math.max(...KEYS.map(x=>c[x]))?' dominant':''}">${c[k]}</span>
    `;
    list.appendChild(row);
  });
}

function recordHistory(){
  const c=counts();
  history.push({...c});
  if(history.length>80) history.shift();
  drawChart();
}

function drawChart(){
  const canvas=document.getElementById('chart');
  const cx=canvas.getContext('2d');
  const W=canvas.width, H=canvas.height;
  cx.clearRect(0,0,W,H);
  if(history.length<2) return;

  const n=history.length, step=W/(n-1);
  KEYS.forEach((key,si)=>{
    const top=[], bot=[];
    for(let i=0;i<n;i++){
      let sb=0;
      for(let j=0;j<si;j++) sb+=(history[i][KEYS[j]]||0)/N;
      const st=sb+(history[i][key]||0)/N;
      top.push({x:i*step, y:H-st*H});
      bot.push({x:i*step, y:H-sb*H});
    }
    cx.beginPath();
    top.forEach((p,i)=>i===0?cx.moveTo(p.x,p.y):cx.lineTo(p.x,p.y));
    [...bot].reverse().forEach(p=>cx.lineTo(p.x,p.y));
    cx.closePath();
    cx.fillStyle=STRATS[key].color+'88';
    cx.fill();
    // top line
    cx.beginPath();
    top.forEach((p,i)=>i===0?cx.moveTo(p.x,p.y):cx.lineTo(p.x,p.y));
    cx.strokeStyle=STRATS[key].color+'cc';
    cx.lineWidth=1; cx.stroke();
  });
}

const MSGS={
  tft:'Reciprocity spreads through the culture…',
  cooperator:'Generosity dominates the dish…',
  defector:'Exploitation runs rampant — cooperation collapses…',
  grudger:'Unforgiving memory stabilises the colony…',
  detective:'Cunning probers test the population…',
  random:'Noise overwhelms — no clear signal…',
};

function addLog(msg){
  if(!msg){
    const c=counts();
    const dom=KEYS.reduce((a,b)=>c[a]>c[b]?a:b);
    msg=MSGS[dom]||'The culture shifts…';
  }
  const ul=document.getElementById('log-list');
  const li=document.createElement('li');
  li.textContent=`Gen ${gen}: ${msg}`;
  li.className='fresh';
  ul.insertBefore(li,ul.firstChild);
  setTimeout(()=>li.classList.remove('fresh'),600);
  while(ul.children.length>5) ul.removeChild(ul.lastChild);
}

// ── TOOLTIP ──────────────────────────────────────────────────────────────────
petri.addEventListener('mousemove', e=>{
  const rect=petri.getBoundingClientRect();
  const mx=(e.clientX-rect.left)/petri.width;
  const my=(e.clientY-rect.top)/petri.height;
  const W=petri.width;
  let closest=null, dist=Infinity;
  for(const a of agents){
    const dx=(a.x-mx), dy=(a.y-my);
    const d=Math.sqrt(dx*dx+dy*dy);
    if(d<dist){ dist=d; closest=a; }
  }
  const tip=document.getElementById('tip');
  if(closest && dist<closest.r*2.5){
    const s=STRATS[closest.k];
    document.getElementById('tip-name').textContent=s.name;
    document.getElementById('tip-desc').textContent=s.desc;
    document.getElementById('tip-score').textContent=`score: ${closest.score}`;
    tip.style.left=(e.clientX+14)+'px';
    tip.style.top=(e.clientY-8)+'px';
    tip.classList.add('show');
  } else {
    tip.classList.remove('show');
  }
});
petri.addEventListener('mouseleave',()=>document.getElementById('tip').classList.remove('show'));

// ── CONTROLS ──────────────────────────────────────────────────────────────────
document.getElementById('btn-pause').addEventListener('click',()=>{
  paused=!paused;
  const b=document.getElementById('btn-pause');
  b.textContent=paused?'▶ Play':'⏸ Pause';
  b.classList.toggle('on',!paused);
});
document.getElementById('btn-fast').addEventListener('click',()=>{
  spdIdx=Math.min(spdIdx+1,SPEEDS.length-1);
  speed=SPEEDS[spdIdx];
  document.getElementById('spd').textContent=speed+'×';
});
document.getElementById('btn-slow').addEventListener('click',()=>{
  spdIdx=Math.max(spdIdx-1,0);
  speed=SPEEDS[spdIdx];
  document.getElementById('spd').textContent=speed+'×';
});
document.getElementById('btn-shock').addEventListener('click',shockDefectors);
document.getElementById('btn-reset').addEventListener('click',()=>{
  gen=0; history=[];
  initAgents(); updateUI(); drawChart();
  document.getElementById('log-list').innerHTML='';
  addLog('Culture reset — reseeding…');
});

window.addEventListener('resize',()=>{ sizeDish(); drawChart(); });

// ── LOOP ──────────────────────────────────────────────────────────────────────
let last=performance.now(), acc=0;
const GEN_INTERVAL=2.2; // seconds at 1×

function loop(){
  requestAnimationFrame(loop);
  const now=performance.now();
  const dt=Math.min((now-last)/1000,0.1);
  last=now;

  moveAgents(dt);
  drawDish(dt);

  if(!paused){
    acc+=dt*speed;
    if(acc>=GEN_INTERVAL){
      acc=0;
      runGen();
    }
  }
}

sizeDish();
initAgents();
updateUI();
recordHistory();
addLog('Culture seeded — observing…');
loop();
</script>
</body>
</html>
