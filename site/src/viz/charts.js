/**
 * Chart renderers for chapters: stacked area, line charts, heatmaps.
 */

import { getStratColor } from '../petri/agents.js';

export function renderRankings(container, rankings, maxScore) {
  let html = '<ul class="rankings-list">';
  rankings.forEach((r, i) => {
    const pct = (r.score / maxScore) * 100;
    const color = getStratColor(r.name);
    html += `<li>
      <span style="min-width:18px;color:var(--ink-dim)">${i + 1}.</span>
      <span style="min-width:120px">${r.name}</span>
      <div style="flex:1;background:var(--grid);border-radius:3px;height:6px;overflow:hidden">
        <div class="rank-bar" style="width:${pct}%;background:${color}"></div>
      </div>
      <span style="min-width:40px;text-align:right;color:var(--ink-dim);font-size:0.66rem">${r.score}</span>
    </li>`;
  });
  html += '</ul>';
  container.innerHTML = html;
}

export function renderHeatmap(container, heatmap, strategies) {
  const names = strategies.map(s => s.name);
  const n = names.length;

  container.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'heatmap-grid';
  grid.style.gridTemplateColumns = `60px repeat(${n}, 1fr)`;

  // Header row
  grid.appendChild(makeCell(''));
  names.forEach(name => {
    const short = name.split(' ').map(w => w[0]).join('');
    grid.appendChild(makeCell(short, 'var(--panel)'));
  });

  // Data rows
  names.forEach(rowName => {
    const short = rowName.split(' ').map(w => w[0]).join('');
    grid.appendChild(makeCell(short, 'var(--panel)'));
    names.forEach(colName => {
      const val = heatmap[rowName]?.[colName] ?? '-';
      const maxVal = 50; // rough max
      const intensity = typeof val === 'number' ? Math.min(val / maxVal, 1) : 0;
      const bg = typeof val === 'number'
        ? `rgba(74, 144, 217, ${intensity * 0.4})`
        : 'var(--dish)';
      grid.appendChild(makeCell(val, bg));
    });
  });

  container.appendChild(grid);
}

function makeCell(text, bg = 'var(--dish)') {
  const el = document.createElement('div');
  el.className = 'heatmap-cell';
  el.style.background = bg;
  el.textContent = text;
  return el;
}

export function renderStackedArea(container, snapshots, strategyNames) {
  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.width = 560;
  canvas.height = 200;
  canvas.style.width = '100%';
  canvas.style.height = '200px';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const n = snapshots.length;
  if (n < 2) return;

  const step = W / (n - 1);

  // Get total from first snapshot
  const total = Object.values(snapshots[0].populations).reduce((a, b) => a + b, 0);

  strategyNames.forEach((key, si) => {
    const top = [], bot = [];
    for (let i = 0; i < n; i++) {
      let sb = 0;
      for (let j = 0; j < si; j++) {
        sb += (snapshots[i].populations[strategyNames[j]] || 0) / total;
      }
      const st = sb + (snapshots[i].populations[key] || 0) / total;
      top.push({ x: i * step, y: H - st * H });
      bot.push({ x: i * step, y: H - sb * H });
    }

    ctx.beginPath();
    top.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    [...bot].reverse().forEach(p => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.fillStyle = getStratColor(key) + '88';
    ctx.fill();

    ctx.beginPath();
    top.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.strokeStyle = getStratColor(key) + 'cc';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  // Axes labels
  ctx.fillStyle = 'var(--ink-dim)';
  ctx.font = '10px IBM Plex Mono';
  ctx.fillText('Gen 0', 2, H - 4);
  ctx.fillText(`Gen ${n - 1}`, W - 40, H - 4);
}

export function renderLineSweep(container, sweep, xKey, xLabel, strategyNames) {
  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.width = 560;
  canvas.height = 200;
  canvas.style.width = '100%';
  canvas.style.height = '200px';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const pad = { l: 40, r: 10, t: 10, b: 30 };
  const plotW = W - pad.l - pad.r;
  const plotH = H - pad.t - pad.b;

  const xVals = sweep.map(s => s[xKey]);
  const xMin = Math.min(...xVals), xMax = Math.max(...xVals);

  // Find global score max
  let scoreMax = 0;
  sweep.forEach(s => {
    Object.values(s.scores).forEach(v => { if (v > scoreMax) scoreMax = v; });
  });

  // Draw axes
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t);
  ctx.lineTo(pad.l, H - pad.b);
  ctx.lineTo(W - pad.r, H - pad.b);
  ctx.stroke();

  // Labels
  ctx.fillStyle = '#8a8278';
  ctx.font = '9px IBM Plex Mono';
  ctx.fillText(xLabel, W / 2 - 20, H - 4);
  ctx.fillText('0', pad.l - 12, H - pad.b + 4);

  // Draw lines per strategy
  strategyNames.forEach(name => {
    const color = getStratColor(name);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    sweep.forEach((s, i) => {
      const x = pad.l + ((s[xKey] - xMin) / (xMax - xMin || 1)) * plotW;
      const score = s.scores[name] || 0;
      const y = pad.t + plotH - (score / scoreMax) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
  });

  // Legend
  const legendY = pad.t + 6;
  let legendX = pad.l + 4;
  strategyNames.slice(0, 5).forEach(name => {
    ctx.fillStyle = getStratColor(name);
    ctx.fillRect(legendX, legendY, 6, 6);
    ctx.fillStyle = '#8a8278';
    ctx.font = '8px IBM Plex Mono';
    const short = name.split(' ').map(w => w[0]).join('');
    ctx.fillText(short, legendX + 8, legendY + 6);
    legendX += 30;
  });
}
