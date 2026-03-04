/**
 * PSUU Analysis page — interactive parameter space exploration.
 *
 * Loads pre-computed results immediately, then initializes a Pyodide
 * Web Worker in the background for live sweeps.
 */

import { initNav } from './nav.js';
import { loadJSON } from './data/loader.js';
import { renderEcosystemNote } from './ecosystem-note.js';

const KPI_LABELS = {
  cooperation_rate: 'Cooperation Rate',
  diversity: 'Diversity',
  winner_share: 'Winner Share',
};

const KPI_KEYS = Object.keys(KPI_LABELS);

const STRATEGY_DEFAULTS = [
  { name: 'Always Cooperate', short: 'Coop', pop: 4 },
  { name: 'Always Defect', short: 'Def', pop: 4 },
  { name: 'Tit for Tat', short: 'TfT', pop: 4 },
  { name: 'Grim Trigger', short: 'Grudger', pop: 4 },
  { name: 'Detective', short: 'Det', pop: 4 },
  { name: 'Tit for Two Tats', short: 'Tf2T', pop: 4 },
  { name: 'Pavlov', short: 'Pav', pop: 4 },
  { name: 'Generous TFT', short: 'GTFT', pop: 4 },
  { name: 'Random', short: 'Rnd', pop: 4 },
];

let currentData = null;
let currentFocusKpi = 'cooperation_rate';
let worker = null;
let workerReady = false;
let sweepStartTime = null;

// ── Boot ──

async function boot() {
  initNav();
  const data = await loadJSON('psuu_results.json');
  currentData = data;
  renderPage(data);
  bindControls();
  initWorker();
}

// ── Full page render ──

function renderPage(data) {
  const container = document.getElementById('psuu-content');

  // Clear previous ecosystem note if re-rendering
  const oldNote = container.querySelector('.ecosystem-note');
  if (oldNote) oldNote.remove();

  container.innerHTML = `
    <section class="psuu-section psuu-controls">
      <div class="controls-row">
        <div class="control-group">
          <label for="kpi-focus">KPI Focus</label>
          <select id="kpi-focus">
            ${KPI_KEYS.map(k =>
              `<option value="${k}"${k === currentFocusKpi ? ' selected' : ''}>${KPI_LABELS[k]}</option>`
            ).join('')}
          </select>
        </div>
        <div class="control-group">
          <label for="samples-slider">Samples: <span id="samples-label">30</span></label>
          <input type="range" id="samples-slider" min="10" max="100" step="5" value="30">
        </div>
        <div class="control-group">
          <label for="timesteps-slider">Timesteps: <span id="timesteps-label">20</span></label>
          <input type="range" id="timesteps-slider" min="5" max="50" step="5" value="20">
        </div>
        <div class="control-group">
          <label for="runs-slider">MC Runs: <span id="runs-label">3</span></label>
          <input type="range" id="runs-slider" min="1" max="5" step="1" value="3">
        </div>
        <div class="control-group">
          <button id="run-btn" disabled>Loading Python...</button>
        </div>
        <div class="control-group">
          <span id="run-status" class="run-status"></span>
        </div>
      </div>
      <details class="pop-details">
        <summary>Initial Population</summary>
        <div class="pop-grid">
          ${STRATEGY_DEFAULTS.map(s => `
            <div class="pop-item">
              <label for="pop-${s.short}">${s.short}</label>
              <input type="number" id="pop-${s.short}" data-strategy="${s.name}" min="0" max="20" value="${s.pop}" class="pop-input">
            </div>
          `).join('')}
        </div>
      </details>
    </section>

    <section class="psuu-section">
      <h2>Search Configuration</h2>
      <p class="sim-desc">${data.description}</p>
      <div class="model-overview">
        <div class="model-card">
          <h3>Parameter Space</h3>
          ${Object.entries(data.space).map(([k, v]) =>
            `<div><strong>${k}</strong>: ${v.type} [${v.min}, ${v.max}]</div>`
          ).join('')}
        </div>
        <div class="model-card">
          <h3>Optimizer</h3>
          <div>${data.optimizer.type}</div>
          <div>${data.optimizer.n_samples} samples, seed=${data.optimizer.seed}</div>
        </div>
        <div class="model-card">
          <h3>Simulation</h3>
          <div>${data.simulation.timesteps} timesteps</div>
          <div>${data.simulation.runs} Monte Carlo runs</div>
        </div>
        <div class="model-card">
          <h3>KPIs</h3>
          ${Object.entries(data.kpis).map(([k, desc]) =>
            `<div><strong>${KPI_LABELS[k]}</strong>: ${desc}</div>`
          ).join('')}
        </div>
      </div>
    </section>

    <section class="psuu-section">
      <h2>Best Parameters per KPI</h2>
      <div id="best-grid" class="best-grid"></div>
    </section>

    <section class="psuu-section">
      <h2>Parameter Space Exploration</h2>
      <p class="sim-desc">Each point is one evaluation (noise, rounds_per_match). Color encodes <strong id="scatter-kpi-label">${KPI_LABELS[currentFocusKpi]}</strong>. Size encodes diversity. Hover for details.</p>
      <div class="scatter-wrap">
        <div id="scatter-plot"></div>
      </div>
    </section>

    <section class="psuu-section">
      <h2>All Evaluations</h2>
      <p class="sim-desc"><span id="eval-count">${data.total_evaluations}</span> parameter points evaluated.</p>
      <div class="eval-table-wrap">
        <table class="eval-table">
          <thead>
            <tr>
              <th>#</th>
              <th>noise</th>
              <th>rounds</th>
              ${KPI_KEYS.map(k => `<th>${KPI_LABELS[k]}</th>`).join('')}
            </tr>
          </thead>
          <tbody id="eval-tbody"></tbody>
        </table>
      </div>
    </section>
  `;

  updateBestCards(data, currentFocusKpi);
  updateEvalTable(data);
  drawScatter(data, currentFocusKpi);

  renderEcosystemNote(container, {
    view: 'PSUU Analysis',
    source: 'gds-psuu (Sweep + ParameterSpace + KPI) + gds-sim',
    question: 'Which parameter combination optimizes which KPI?',
    note: 'gds-psuu formalizes parameter search as a first-class object \u2014 ParameterSpace, KPI functions, and an optimizer form a structured exploration pipeline. Combined with gds-sim for execution, it turns \u201cwhich parameters are best?\u201d from an ad-hoc script into a reproducible analysis. The interactive explorer runs the same model in-browser via Pyodide.',
    links: [
      { label: 'Parameter Selection Under Uncertainty', url: 'https://blog.block.science/how-to-perform-parameter-selection-under-uncertainty/' },
    ],
  });
}

// ── Best-per-KPI cards ──

function updateBestCards(data, focusKpi) {
  const grid = document.getElementById('best-grid');
  if (!grid) return;

  grid.innerHTML = Object.entries(data.best_per_kpi).map(([kpi, best]) => `
    <div class="best-card${kpi === focusKpi ? ' focused' : ''}">
      <h3>${KPI_LABELS[kpi]}</h3>
      <div class="best-score">${best.score.toFixed(3)}</div>
      <div class="best-goal">${best.maximize ? 'maximized' : 'minimized'}</div>
      <div class="best-params">
        ${Object.entries(best.params).map(([k, v]) =>
          `<div class="param-pill"><span class="param-key">${k}</span> = ${typeof v === 'number' ? v.toFixed(4) : v}</div>`
        ).join('')}
      </div>
      <div class="best-others">
        ${Object.entries(best.all_scores)
          .filter(([k]) => k !== kpi)
          .map(([k, v]) => `<span class="other-kpi">${KPI_LABELS[k]}: ${v.toFixed(3)}</span>`)
          .join('')}
      </div>
    </div>
  `).join('');
}

// ── Evaluation table ──

function updateEvalTable(data) {
  const tbody = document.getElementById('eval-tbody');
  if (!tbody) return;

  tbody.innerHTML = data.evaluations.map((ev, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${ev.params.noise.toFixed(4)}</td>
      <td>${ev.params.rounds_per_match}</td>
      ${KPI_KEYS.map(k => `<td>${ev.scores[k].toFixed(3)}</td>`).join('')}
    </tr>
  `).join('');

  const countEl = document.getElementById('eval-count');
  if (countEl) countEl.textContent = data.total_evaluations;
}

// ── Scatter plot (Plotly) ──

function scatterColorscale(focusKpi) {
  if (focusKpi === 'winner_share') {
    // Inverted: low is good (green), high is bad (red)
    return [[0, 'rgba(80,220,60,0.85)'], [0.5, 'rgba(200,200,60,0.85)'], [1, 'rgba(220,80,60,0.85)']];
  }
  // Normal: low is bad (red), high is good (green)
  return [[0, 'rgba(220,80,60,0.85)'], [0.5, 'rgba(200,200,60,0.85)'], [1, 'rgba(80,220,60,0.85)']];
}

function drawScatter(data, focusKpi) {
  const plotDiv = document.getElementById('scatter-plot');
  if (!plotDiv) return;

  const evals = data.evaluations;
  const focusScores = evals.map(e => e.scores[focusKpi]);
  const divScores = evals.map(e => e.scores.diversity);
  const divMin = Math.min(...divScores);
  const divMax = Math.max(...divScores);

  // Scale diversity to marker size 6–20
  const sizes = divScores.map(d =>
    divMax > divMin ? 6 + ((d - divMin) / (divMax - divMin)) * 14 : 10
  );

  const shortLabel = focusKpi === 'cooperation_rate' ? 'Coop Rate'
    : focusKpi === 'diversity' ? 'Diversity' : 'Winner Share';

  const trace = {
    type: 'scatter',
    mode: 'markers',
    x: evals.map(e => e.params.noise),
    y: evals.map(e => e.params.rounds_per_match),
    marker: {
      size: sizes,
      color: focusScores,
      colorscale: scatterColorscale(focusKpi),
      showscale: true,
      colorbar: {
        title: { text: shortLabel, font: { size: 10 } },
        thickness: 14,
        len: 0.8,
      },
      line: { width: 1, color: 'rgba(0,0,0,0.15)' },
    },
    text: evals.map(e =>
      `noise: ${e.params.noise.toFixed(4)}<br>rounds: ${e.params.rounds_per_match}<br>` +
      KPI_KEYS.map(k => `${KPI_LABELS[k]}: ${e.scores[k].toFixed(3)}`).join('<br>')
    ),
    hoverinfo: 'text',
  };

  const layout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'rgba(255,253,249,0.7)',
    font: { family: 'IBM Plex Mono, monospace', size: 11, color: '#8a8278' },
    height: 420,
    margin: { t: 20, r: 80, b: 50, l: 60 },
    xaxis: {
      title: { text: 'noise', font: { size: 11 } },
      gridcolor: 'rgba(0,0,0,0.06)',
      linecolor: '#8a8278',
      zeroline: false,
    },
    yaxis: {
      title: { text: 'rounds_per_match', font: { size: 11 } },
      gridcolor: 'rgba(0,0,0,0.06)',
      linecolor: '#8a8278',
      zeroline: false,
    },
  };

  const config = { displayModeBar: false, responsive: true };

  // Use react for efficient updates, newPlot for first render
  if (plotDiv.data) {
    Plotly.react(plotDiv, [trace], layout, config);
  } else {
    Plotly.newPlot(plotDiv, [trace], layout, config);
  }
}

// ── Controls ──

function readInitialPop() {
  const pop = {};
  const inputs = document.querySelectorAll('.pop-input');
  let anyNonDefault = false;
  inputs.forEach(input => {
    const name = input.dataset.strategy;
    const val = parseInt(input.value, 10) || 0;
    if (val > 0) pop[name] = val;
    if (val !== 4) anyNonDefault = true;
  });
  // Return null if all defaults (server will use default)
  return anyNonDefault ? pop : null;
}

function bindControls() {
  // KPI focus dropdown
  document.addEventListener('change', (e) => {
    if (e.target.id === 'kpi-focus') {
      currentFocusKpi = e.target.value;
      if (currentData) {
        drawScatter(currentData, currentFocusKpi);
        updateBestCards(currentData, currentFocusKpi);
        const label = document.getElementById('scatter-kpi-label');
        if (label) label.textContent = KPI_LABELS[currentFocusKpi];
      }
    }
  });

  // Sliders — live label update
  document.addEventListener('input', (e) => {
    const labelMap = {
      'samples-slider': 'samples-label',
      'timesteps-slider': 'timesteps-label',
      'runs-slider': 'runs-label',
    };
    const labelId = labelMap[e.target.id];
    if (labelId) {
      const label = document.getElementById(labelId);
      if (label) label.textContent = e.target.value;
    }
  });

  // Run button
  document.addEventListener('click', (e) => {
    if (e.target.id === 'run-btn' && workerReady) {
      startSweep();
    }
  });
}

function startSweep() {
  const btn = document.getElementById('run-btn');
  const status = document.getElementById('run-status');
  const samples = parseInt(document.getElementById('samples-slider')?.value || '30', 10);
  const timesteps = parseInt(document.getElementById('timesteps-slider')?.value || '20', 10);
  const runs = parseInt(document.getElementById('runs-slider')?.value || '3', 10);
  const initialPop = readInitialPop();
  const seed = Date.now() % 2147483647;

  btn.disabled = true;
  btn.textContent = 'Running...';
  sweepStartTime = performance.now();
  if (status) status.textContent = 'Starting sweep...';

  worker.postMessage({ type: 'run', samples, seed, timesteps, runs, initialPop });
}

// ── Web Worker ──

function initWorker() {
  worker = new Worker(new URL('./workers/psuu-worker.js', import.meta.url), { type: 'module' });

  worker.onmessage = (e) => {
    const msg = e.data;
    const btn = document.getElementById('run-btn');
    const status = document.getElementById('run-status');

    switch (msg.type) {
      case 'status': {
        const phases = {
          'loading-runtime': 'Loading Python runtime...',
          'installing-packages': 'Setting up packages...',
          'loading-model': 'Loading model...',
        };
        if (btn) btn.textContent = phases[msg.phase] || msg.phase;
        break;
      }

      case 'ready':
        workerReady = true;
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Run Sweep';
        }
        if (status) status.textContent = 'Python ready';
        break;

      case 'progress': {
        const elapsed = ((performance.now() - sweepStartTime) / 1000).toFixed(1);
        if (status) status.textContent = `Evaluating ${msg.current}/${msg.total}... (${elapsed}s)`;
        break;
      }

      case 'result': {
        const elapsed = ((performance.now() - sweepStartTime) / 1000).toFixed(1);
        currentData = msg.data;
        updateBestCards(currentData, currentFocusKpi);
        drawScatter(currentData, currentFocusKpi);
        updateEvalTable(currentData);
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Run Sweep';
        }
        if (status) status.textContent = `Done — ${msg.data.total_evaluations} evaluations in ${elapsed}s`;
        break;
      }

      case 'error':
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Run Sweep';
        }
        if (status) status.textContent = `Error: ${msg.message}`;
        console.error('PSUU worker error:', msg.message);
        break;
    }
  };

  worker.postMessage({ type: 'init' });
}

boot();
