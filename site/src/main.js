/**
 * Main entry — chapter visualizations + inline Petri dish sandbox.
 * No scrollytelling — just sections on a page.
 */

import { initNav } from './nav.js';

import { createPopulation, moveAgents, getStratKeys, getStratMeta, getStratShort } from './petri/agents.js';
import { sizeDish, drawDish } from './petri/dish.js';
import { runGeneration, shockDefectors, getCounts, drawChart, getLogMessage } from './petri/evolution.js';
import { initControls } from './petri/controls.js';

import { initChapter1 } from './chapters/ch1-dilemma.js';
import { initChapter2 } from './chapters/ch2-tournament.js';
import { initChapter3 } from './chapters/ch3-evolution.js';
import { initChapter4 } from './chapters/ch4-noise.js';
import { initChapter5 } from './chapters/ch5-shadow.js';
import { initChapter6 } from './chapters/ch6-sim.js';
import { initAppendix } from './chapters/ch-appendix.js';
import { renderEcosystemNote } from './ecosystem-note.js';

// ── State ──
let agents = [];
let gen = 0;
let history = [];
const controlState = {};

// ── Init Petri Dish ──

function initDish() {
  agents = createPopulation(120);
  gen = 0;
  history = [];
  skyPhase = 0;
  sizeDish();
  updateUI();
  recordHistory();
  addLog('Culture seeded — observing...');
}

function updateUI() {
  document.getElementById('gen-num').textContent = gen;
  const c = getCounts(agents);
  const KEYS = getStratKeys();
  const dom = KEYS.reduce((a, b) => (c[a] || 0) > (c[b] || 0) ? a : b);
  document.getElementById('gen-sub').textContent = `dominant: ${getStratShort(dom)}`;

  const list = document.getElementById('strat-list');
  list.innerHTML = '';
  const maxCount = Math.max(...KEYS.map(k => c[k] || 0));

  KEYS.slice().sort((a, b) => (c[b] || 0) - (c[a] || 0)).forEach(k => {
    const meta = getStratMeta()[k];
    if (!meta) return;
    const row = document.createElement('div');
    row.className = 'strat-row';
    row.innerHTML = `
      <div class="swatch" style="background:${meta.color}"></div>
      <span class="strat-label">${meta.short}</span>
      <span class="strat-n${(c[k] || 0) === maxCount ? ' dominant' : ''}">${c[k] || 0}</span>
    `;
    list.appendChild(row);
  });
}

function recordHistory() {
  const c = getCounts(agents);
  history.push({ ...c });
  if (history.length > 80) history.shift();
  drawChart(history);
}

function addLog(msg) {
  if (!msg) {
    msg = 'Gen ' + gen + ': ' + getLogMessage(getCounts(agents));
  }
  const ul = document.getElementById('log-list');
  const li = document.createElement('li');
  li.textContent = msg;
  li.className = 'fresh';
  ul.insertBefore(li, ul.firstChild);
  setTimeout(() => li.classList.remove('fresh'), 600);
  while (ul.children.length > 5) ul.removeChild(ul.lastChild);
}

// ── Tooltip ──

function initTooltip() {
  const petri = document.getElementById('petri');

  petri.addEventListener('mousemove', e => {
    const rect = petri.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / petri.width;
    const my = (e.clientY - rect.top) / petri.height;

    let closest = null, dist = Infinity;
    for (const a of agents) {
      const dx = a.x - mx, dy = a.y - my;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < dist) { dist = d; closest = a; }
    }

    const tip = document.getElementById('tip');
    if (closest && dist < closest.r * 2.5) {
      const meta = getStratMeta()[closest.strategy];
      document.getElementById('tip-name').textContent = closest.strategy;
      document.getElementById('tip-desc').textContent = meta?.short || '';
      document.getElementById('tip-score').textContent = `score: ${closest.score}`;
      tip.style.left = (e.clientX + 14) + 'px';
      tip.style.top = (e.clientY - 8) + 'px';
      tip.classList.add('show');
    } else {
      tip.classList.remove('show');
    }
  });

  petri.addEventListener('mouseleave', () => {
    document.getElementById('tip').classList.remove('show');
  });
}

// ── Day/Night Sky Cycle ──

let skyPhase = 0;  // 0..1 continuous, 0=noon(top), 0.5=midnight(bottom)

function updateSky(dt, speed) {
  const orb = document.getElementById('sky-orb');
  const area = document.getElementById('dish-area');
  const wrap = document.getElementById('dish-wrap');
  if (!orb || !wrap) return;

  // Advance phase: one full cycle per generation interval
  skyPhase += (dt * (speed || 1)) / GEN_INTERVAL;
  if (skyPhase >= 1) skyPhase -= 1;

  // Orbit path: ellipse around the dish centre
  const wrapRect = wrap.getBoundingClientRect();
  const areaRect = area.getBoundingClientRect();
  const cx = wrapRect.left - areaRect.left + wrapRect.width / 2;
  const cy = wrapRect.top - areaRect.top + wrapRect.height / 2;
  const rx = wrapRect.width * 0.58;
  const ry = wrapRect.height * 0.58;

  // Angle: 0 = top (noon), PI = bottom (midnight), clockwise
  const angle = skyPhase * Math.PI * 2 - Math.PI / 2;
  const ox = cx + Math.cos(angle) * rx;
  const oy = cy + Math.sin(angle) * ry;

  orb.style.left = ox + 'px';
  orb.style.top = oy + 'px';
  orb.style.transform = 'translate(-50%, -50%)';

  // Day/night factor: 0=full day (top), 1=full night (bottom)
  // Using sin so it's smooth: top=-1 (day), bottom=+1 (night)
  const nightFactor = (Math.sin(angle) + 1) / 2;  // 0..1

  // Switch orb appearance
  const isMoon = nightFactor > 0.55;
  orb.classList.toggle('moon', isMoon);

  // Tint the dish-area background
  // Day: warm cream, Night: cool dark blue-grey
  const dayR = 240, dayG = 237, dayB = 232;
  const nightR = 30,  nightG = 34,  nightB = 50;
  const t = nightFactor * nightFactor; // ease into night
  const r = Math.round(dayR + (nightR - dayR) * t);
  const g = Math.round(dayG + (nightG - dayG) * t);
  const b = Math.round(dayB + (nightB - dayB) * t);
  area.style.backgroundColor = `rgb(${r},${g},${b})`;

  // Adjust orb opacity near horizon crossings for smooth transition
  const horizonDist = Math.abs(nightFactor - 0.55);
  const orbOpacity = horizonDist < 0.08 ? horizonDist / 0.08 : 1;
  orb.style.opacity = orbOpacity;
}

// ── Animation Loop ──

let lastTime = performance.now();
let acc = 0;
const GEN_INTERVAL = 2.2;

function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;

  moveAgents(agents, dt);
  drawDish(agents, dt);

  const speed = controlState.speed || 1;

  if (!controlState.paused) {
    updateSky(dt, speed);
    acc += dt * speed;
    if (acc >= GEN_INTERVAL) {
      acc = 0;
      runGeneration(agents);
      gen++;
      recordHistory();
      updateUI();
      addLog();
    }
  }
}

// ── Boot ──

async function boot() {
  initNav();

  // Init Petri dish
  initDish();
  initTooltip();

  // Controls
  controlState.onShock = () => {
    shockDefectors(agents);
    addLog('Defectors injected into culture...');
  };
  controlState.onReset = () => {
    initDish();
  };
  initControls(controlState);

  // Start animation
  loop();

  // Resize handler
  window.addEventListener('resize', () => {
    sizeDish();
    drawChart(history);
  });

  // Load chapter data (async, renders into containers)
  await Promise.all([
    initChapter1(),
    initChapter2(),
    initChapter3(),
    initChapter4(),
    initChapter5(),
    initChapter6(),
    initAppendix(),
  ]);

  renderEcosystemNote(document.querySelector('.page-container.story-page'), {
    view: 'Story',
    source: 'OGS Pattern + strategy definitions',
    question: 'How do cooperation and defection play out across strategies, noise, and time?',
    note: 'The petri dish, tournament heatmap, evolutionary charts, and parameter sweeps are all different projections of the same OGS composition \u2014 <code>(Alice | Bob) >> Payoff .feedback(...)</code>. The formal game structure is specified once; each chapter visualizes a different facet without re-specifying the model.',
  });
}

boot();
