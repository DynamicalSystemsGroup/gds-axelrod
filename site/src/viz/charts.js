/**
 * Chart renderers for chapters: stacked area (Canvas), line/heatmap/bar (Plotly).
 */

import { getStratColor, getStratShort } from '../petri/agents.js';

const PLOTLY_CONFIG = { displayModeBar: false, responsive: true };

const LAYOUT_BASE = {
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'rgba(255,253,249,0.7)',
  font: { family: 'IBM Plex Mono, monospace', size: 11, color: '#8a8278' },
  xaxis: { gridcolor: 'rgba(0,0,0,0.06)', linecolor: '#8a8278', zeroline: false },
  yaxis: { gridcolor: 'rgba(0,0,0,0.06)', linecolor: '#8a8278', zeroline: false },
  margin: { t: 20, r: 20, b: 40, l: 50 },
};

export function renderRankings(container, rankings, maxScore) {
  container.innerHTML = '';
  const div = document.createElement('div');
  container.appendChild(div);

  // Sort descending by score
  const sorted = [...rankings].sort((a, b) => b.score - a.score);

  const trace = {
    type: 'bar',
    orientation: 'h',
    y: sorted.map(r => r.name),
    x: sorted.map(r => r.score),
    marker: { color: sorted.map(r => getStratColor(r.name)) },
    text: sorted.map(r => r.score.toString()),
    textposition: 'outside',
    textfont: { size: 9, color: '#8a8278' },
    hovertemplate: '%{y}: %{x}<extra></extra>',
  };

  const layout = {
    ...LAYOUT_BASE,
    margin: { t: 10, r: 40, b: 30, l: 110 },
    height: Math.max(200, sorted.length * 28 + 40),
    yaxis: { ...LAYOUT_BASE.yaxis, autorange: 'reversed' },
    xaxis: { ...LAYOUT_BASE.xaxis, title: { text: 'Score', font: { size: 10 } } },
  };

  Plotly.newPlot(div, [trace], layout, PLOTLY_CONFIG);
}

export function renderHeatmap(container, heatmap, strategies) {
  container.innerHTML = '';
  const div = document.createElement('div');
  container.appendChild(div);

  const names = strategies.map(s => s.name);
  const abbrevs = names.map(n => getStratShort(n));

  // Build z-matrix (row = row player, col = col player)
  const z = names.map(rowName =>
    names.map(colName => {
      const val = heatmap[rowName]?.[colName];
      return typeof val === 'number' ? val : null;
    })
  );

  // Build text annotations for cell values
  const annotations = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = 0; j < names.length; j++) {
      const val = z[i][j];
      if (val == null) continue;
      // Use dark text on light cells, light text on dark cells
      const maxVal = Math.max(...z.flat().filter(v => v != null));
      const intensity = maxVal > 0 ? val / maxVal : 0;
      annotations.push({
        x: abbrevs[j],
        y: abbrevs[i],
        text: String(Math.round(val)),
        showarrow: false,
        font: { size: 9, color: intensity > 0.55 ? '#fff' : '#8a8278' },
      });
    }
  }

  const trace = {
    type: 'heatmap',
    z,
    x: abbrevs,
    y: abbrevs,
    colorscale: [
      [0, 'rgba(255,253,249,0.9)'],
      [0.5, 'rgba(74,144,217,0.4)'],
      [1, 'rgba(74,144,217,0.85)'],
    ],
    hovertemplate: '%{y} vs %{x}: %{z}<extra></extra>',
    showscale: false,
  };

  const layout = {
    ...LAYOUT_BASE,
    height: Math.max(280, names.length * 32 + 60),
    margin: { t: 10, r: 10, b: 40, l: 60 },
    xaxis: { ...LAYOUT_BASE.xaxis, tickangle: 0, dtick: 1, side: 'bottom' },
    yaxis: { ...LAYOUT_BASE.yaxis, dtick: 1, autorange: 'reversed' },
    annotations,
  };

  Plotly.newPlot(div, [trace], layout, PLOTLY_CONFIG);
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
  const div = document.createElement('div');
  container.appendChild(div);

  const traces = strategyNames.map(name => ({
    type: 'scatter',
    mode: 'lines',
    name: name.split(' ').map(w => w[0]).join(''),
    x: sweep.map(s => s[xKey]),
    y: sweep.map(s => s.scores[name] || 0),
    line: { color: getStratColor(name), width: 2 },
    hovertemplate: `${name}<br>${xLabel}: %{x}<br>Score: %{y:.1f}<extra></extra>`,
  }));

  const layout = {
    ...LAYOUT_BASE,
    height: 240,
    showlegend: true,
    legend: { font: { size: 9 }, orientation: 'h', y: 1.12, x: 0 },
    xaxis: { ...LAYOUT_BASE.xaxis, title: { text: xLabel, font: { size: 10 } } },
    yaxis: { ...LAYOUT_BASE.yaxis, title: { text: 'Score', font: { size: 10 } } },
  };

  Plotly.newPlot(div, traces, layout, PLOTLY_CONFIG);
}
