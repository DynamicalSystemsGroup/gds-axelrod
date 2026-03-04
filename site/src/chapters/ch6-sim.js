/**
 * Chapter 6: Simulation Matrix — gds-sim parameter sweep results.
 */

import { loadJSON } from '../data/loader.js';

const COLORS = {
  'Always Cooperate': '#6bc46b',
  'Always Defect': '#e74c3c',
  'Tit for Tat': '#4a90d9',
  'Grim Trigger': '#9b59b6',
  'Detective': '#f39c12',
  'Tit for Two Tats': '#3498db',
  'Pavlov': '#e67e22',
  'Generous TFT': '#2ecc71',
  'Random': '#95a5a6',
};

const TICK_MS = 100;

export async function initChapter6() {
  const data = await loadJSON('sim_results.json');

  renderLegend(data.strategy_names);

  const grid = document.getElementById('subset-grid-inline');
  if (!grid) return;

  const sortedSubsets = Object.entries(data.subsets).sort(([a], [b]) => Number(a) - Number(b));

  for (const [subsetId, subset] of sortedSubsets) {
    const card = document.createElement('div');
    card.className = 'subset-card';

    const paramLabel = Object.entries(subset.params)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');

    const maxGen = subset.trajectory.length - 1;

    card.innerHTML = `
      <div class="subset-header">
        <div>
          <h3>Subset ${subsetId}</h3>
          <div class="param-label">${paramLabel}</div>
        </div>
        <div class="subset-controls">
          <button class="btn sim-play">Play</button>
          <input type="range" class="sim-slider" min="0" max="${maxGen}" value="${maxGen}">
          <span class="gen-label">Gen <span class="gen-num">${maxGen}</span>/${maxGen}</span>
        </div>
      </div>
      <canvas class="pop-chart" width="500" height="220"></canvas>
    `;

    grid.appendChild(card);

    const canvas = card.querySelector('canvas');
    const slider = card.querySelector('.sim-slider');
    const genNum = card.querySelector('.gen-num');
    const playBtn = card.querySelector('.sim-play');

    const state = {
      trajectory: subset.trajectory,
      strategyNames: data.strategy_names,
      canvas,
      slider,
      genNum,
      playBtn,
      frame: maxGen,
      maxFrame: maxGen,
      playing: false,
      timerId: null,
    };

    drawChart(state);

    slider.addEventListener('input', () => {
      stop(state);
      state.frame = Number(slider.value);
      genNum.textContent = state.frame;
      drawChart(state);
    });

    playBtn.addEventListener('click', () => {
      if (state.playing) {
        stop(state);
      } else {
        play(state);
      }
    });
  }
}

function play(s) {
  if (s.frame >= s.maxFrame) {
    s.frame = 0;
    s.slider.value = 0;
    s.genNum.textContent = '0';
    drawChart(s);
  }
  s.playing = true;
  s.playBtn.textContent = 'Pause';
  s.timerId = setInterval(() => {
    s.frame++;
    if (s.frame > s.maxFrame) {
      s.frame = s.maxFrame;
      stop(s);
      return;
    }
    s.slider.value = s.frame;
    s.genNum.textContent = s.frame;
    drawChart(s);
  }, TICK_MS);
}

function stop(s) {
  s.playing = false;
  s.playBtn.textContent = 'Play';
  if (s.timerId) {
    clearInterval(s.timerId);
    s.timerId = null;
  }
}

function renderLegend(names) {
  const el = document.getElementById('sim-legend-inline');
  if (!el) return;
  el.innerHTML = names.map(name =>
    `<span class="legend-item"><span class="legend-swatch" style="background:${COLORS[name] || '#666'}"></span>${name}</span>`
  ).join('');
}

function drawChart(s) {
  const { canvas, trajectory, strategyNames, frame } = s;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const M = { top: 14, right: 14, bottom: 26, left: 36 };
  const pW = W - M.left - M.right;
  const pH = H - M.top - M.bottom;

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(255,253,249,0.7)';
  ctx.fillRect(0, 0, W, H);

  if (!trajectory || trajectory.length === 0) return;

  const total = trajectory.length;
  const vis = frame + 1;
  const maxPop = trajectory[0].total_agents;
  const colors = strategyNames.map(n => COLORS[n] || '#666');

  for (let si = strategyNames.length - 1; si >= 0; si--) {
    ctx.beginPath();
    ctx.moveTo(M.left, M.top + pH);

    for (let t = 0; t < vis; t++) {
      const x = M.left + (t / Math.max(1, total - 1)) * pW;
      let cum = 0;
      for (let j = 0; j <= si; j++) cum += (trajectory[t].population_counts[strategyNames[j]] || 0);
      ctx.lineTo(x, M.top + pH - (cum / maxPop) * pH);
    }

    for (let t = vis - 1; t >= 0; t--) {
      const x = M.left + (t / Math.max(1, total - 1)) * pW;
      let cum = 0;
      for (let j = 0; j < si; j++) cum += (trajectory[t].population_counts[strategyNames[j]] || 0);
      ctx.lineTo(x, M.top + pH - (cum / maxPop) * pH);
    }

    ctx.closePath();
    ctx.fillStyle = colors[si] + 'aa';
    ctx.fill();
    ctx.strokeStyle = colors[si];
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  if (frame < total - 1) {
    const px = M.left + (frame / Math.max(1, total - 1)) * pW;
    ctx.strokeStyle = 'rgba(42,37,32,0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(px, M.top);
    ctx.lineTo(px, M.top + pH);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.strokeStyle = '#8a8278';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(M.left, M.top);
  ctx.lineTo(M.left, M.top + pH);
  ctx.lineTo(M.left + pW, M.top + pH);
  ctx.stroke();

  ctx.fillStyle = '#8a8278';
  ctx.font = '9px "IBM Plex Mono",monospace';
  ctx.textAlign = 'center';
  ctx.fillText('Gen 0', M.left + 14, M.top + pH + 16);
  ctx.fillText('Gen ' + (total - 1), M.left + pW - 14, M.top + pH + 16);
  ctx.textAlign = 'right';
  ctx.fillText(String(maxPop), M.left - 4, M.top + 10);
  ctx.fillText('0', M.left - 4, M.top + pH + 3);
}
