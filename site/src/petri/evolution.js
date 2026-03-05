/**
 * Generation loop: PD matches + evolutionary selection within the Petri dish.
 */

import { getStratKeys, getStratColor, getStratShort } from './agents.js';

const C = 'Cooperate', D = 'Defect';
const PAYOFF = {
  [C]: { [C]: [3, 3], [D]: [0, 5] },
  [D]: { [C]: [5, 0], [D]: [1, 1] },
};

// Simplified in-browser strategies (for real-time sim)
const BROWSER_STRATS = {
  'Tit for Tat':      { move: h => h.length === 0 ? C : h[h.length - 1].o },
  'Always Cooperate':  { move: () => C },
  'Always Defect':     { move: () => D },
  'Grim Trigger':      { move: h => h.some(x => x.o === D) ? D : C },
  'Detective':         { move: h => {
    const p = [C, D, C, C];
    if (h.length < 4) return p[h.length];
    return h.slice(0, 4).some(x => x.o === D) ? h[h.length - 1].o : D;
  }},
  'Random':            { move: () => Math.random() < 0.5 ? C : D },
  'Generous TFT':      { move: h => {
    if (h.length === 0) return C;
    if (h[h.length - 1].o === D) return Math.random() < 1/3 ? C : D;
    return C;
  }},
  'Tit for Two Tats':  { move: h => {
    if (h.length < 2) return C;
    return (h[h.length - 1].o === D && h[h.length - 2].o === D) ? D : C;
  }},
  'Pavlov':            { move: h => {
    if (h.length === 0) return C;
    const last = h[h.length - 1];
    return last.m === last.o ? last.m : (last.m === C ? D : C);
  }},
};

function playMatch(kA, kB, rounds = 5) {
  const sA = BROWSER_STRATS[kA], sB = BROWSER_STRATS[kB];
  if (!sA || !sB) return [0, 0];
  const hA = [], hB = [];
  let scoreA = 0, scoreB = 0;
  for (let r = 0; r < rounds; r++) {
    const mA = sA.move(hA), mB = sB.move(hB);
    const [pA, pB] = PAYOFF[mA][mB];
    scoreA += pA; scoreB += pB;
    hA.push({ m: mA, o: mB });
    hB.push({ m: mB, o: mA });
  }
  return [scoreA, scoreB];
}

export function runGeneration(agents) {
  const KEYS = getStratKeys();

  // Reset scores
  agents.forEach(a => a.score = 0);

  // Each agent plays 6 random opponents
  for (const a of agents) {
    const opponents = agents.filter(b => b !== a).sort(() => Math.random() - 0.5).slice(0, 6);
    for (const b of opponents) {
      const [sa, sb] = playMatch(a.strategy, b.strategy, 5);
      a.score += sa;
      b.score += sb;
      a.flash = 0.5;
      b.flash = 0.5;
    }
  }

  // Evolve: bottom 30% copy top 30%, 8% mutation
  const N = agents.length;
  const sorted = [...agents].sort((a, b) => b.score - a.score);
  const top = sorted.slice(0, Math.floor(N * 0.30));
  const bot = sorted.slice(Math.floor(N * 0.70));

  bot.forEach(loser => {
    const winner = top[Math.floor(Math.random() * top.length)];
    loser.strategy = winner.strategy;
    loser.score = 0;
  });
}

export function shockDefectors(agents, count = 15) {
  const targets = [...agents].sort(() => Math.random() - 0.5).slice(0, count);
  targets.forEach(a => { a.strategy = 'Always Defect'; a.flash = 1.0; });
}

export function getCounts(agents) {
  const c = {};
  getStratKeys().forEach(k => c[k] = 0);
  agents.forEach(a => c[a.strategy] = (c[a.strategy] || 0) + 1);
  return c;
}

export function drawChart(history) {
  const canvas = document.getElementById('chart');
  if (!canvas) return;
  const cx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  cx.clearRect(0, 0, W, H);
  if (history.length < 2) return;

  const KEYS = getStratKeys();
  const N_TOTAL = Object.values(history[0]).reduce((a, b) => a + b, 0);
  const n = history.length, step = W / (n - 1);

  KEYS.forEach((key, si) => {
    const top = [], bot = [];
    for (let i = 0; i < n; i++) {
      let sb = 0;
      for (let j = 0; j < si; j++) sb += (history[i][KEYS[j]] || 0) / N_TOTAL;
      const st = sb + (history[i][key] || 0) / N_TOTAL;
      top.push({ x: i * step, y: H - st * H });
      bot.push({ x: i * step, y: H - sb * H });
    }
    cx.beginPath();
    top.forEach((p, i) => i === 0 ? cx.moveTo(p.x, p.y) : cx.lineTo(p.x, p.y));
    [...bot].reverse().forEach(p => cx.lineTo(p.x, p.y));
    cx.closePath();
    cx.fillStyle = getStratColor(key) + '88';
    cx.fill();
    cx.beginPath();
    top.forEach((p, i) => i === 0 ? cx.moveTo(p.x, p.y) : cx.lineTo(p.x, p.y));
    cx.strokeStyle = getStratColor(key) + 'cc';
    cx.lineWidth = 1;
    cx.stroke();
  });
}

const MSGS = {
  'Tit for Tat': 'Reciprocity spreads through the culture...',
  'Always Cooperate': 'Generosity dominates the dish...',
  'Always Defect': 'Exploitation runs rampant...',
  'Grim Trigger': 'Unforgiving memory stabilises the colony...',
  'Detective': 'Cunning probers test the population...',
  'Random': 'Noise overwhelms — no clear signal...',
  'Generous TFT': 'Forgiveness takes root...',
  'Tit for Two Tats': 'Patient reciprocity grows...',
  'Pavlov': 'Adaptive learners emerge...',
};

export function getLogMessage(counts) {
  const dominant = Object.entries(counts).reduce((a, b) => b[1] > a[1] ? b : a);
  return MSGS[dominant[0]] || 'The culture shifts...';
}
