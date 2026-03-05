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

  // Remove loading indicator and any previous data sections, keep narrative
  const loading = container.querySelector('.loading');
  if (loading) loading.remove();
  const oldData = container.querySelector('.psuu-data');
  if (oldData) oldData.remove();

  // Build the data sections
  const dataWrapper = document.createElement('div');
  dataWrapper.className = 'psuu-data';
  dataWrapper.innerHTML = `
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
      <h2>KPI Landscapes</h2>
      <p class="sim-desc">The parameter space as a 3D landscape. Each point is one
      evaluation — noise and rounds per match define the ground plane, the KPI
      value is the height. Drag to rotate, scroll to zoom. The shape of each
      surface reveals where cooperation thrives, where diversity peaks, and
      where single strategies dominate.</p>
      <div class="kpi-3d-grid">
        <div id="kpi-3d-coop" class="kpi-3d-chart"></div>
        <div id="kpi-3d-diversity" class="kpi-3d-chart"></div>
        <div id="kpi-3d-winner" class="kpi-3d-chart"></div>
      </div>
    </section>

    <section class="psuu-section">
      <h2>Config → KPI Flow</h2>
      <p class="sim-desc">Each line traces one configuration from its input parameters
      (noise, rounds) through to its KPI outcomes. Green lines are high-cooperation
      configs; red are defection-dominated. Drag on any axis to filter.</p>
      <div id="kpi-parallel-plot" class="kpi-parallel-full"></div>
    </section>

    <section class="psuu-section psuu-objective">
      <h2>Multi-KPI Objective</h2>
      <p class="sim-desc">gds-psuu's <strong>WeightedSum</strong> objective combines multiple KPIs
      into a single scalar score: <code>score = w1 * KPI1 + w2 * KPI2 + ...</code>.
      Negative weights minimize that KPI. Drag the sliders to define your own
      tradeoff — the best configuration updates live.</p>
      <div class="objective-controls">
        <div class="objective-presets">
          <label>Presets:</label>
          <button class="preset-btn" data-preset="coop">Max Cooperation</button>
          <button class="preset-btn" data-preset="balanced">Balanced</button>
          <button class="preset-btn" data-preset="diversity">Diversity First</button>
        </div>
        <div class="weight-sliders">
          ${KPI_KEYS.map(k => `
            <div class="weight-row">
              <label>${KPI_LABELS[k]}</label>
              <input type="range" class="weight-slider" data-kpi="${k}"
                min="-1" max="1" step="0.1" value="${k === 'cooperation_rate' ? '1' : k === 'winner_share' ? '-0.1' : '0.3'}">
              <span class="weight-val" id="weight-val-${k}">${k === 'cooperation_rate' ? '1.0' : k === 'winner_share' ? '-0.1' : '0.3'}</span>
            </div>
          `).join('')}
        </div>
      </div>
      <div id="objective-result" class="objective-result"></div>
      <div id="objective-chart" class="objective-chart"></div>
    </section>

    <section class="psuu-section psuu-sensitivity">
      <h2>Sensitivity Analysis</h2>
      <p class="sim-desc">gds-psuu's <strong>OATAnalyzer</strong> (One-at-a-Time) varies each
      parameter independently from a baseline, measuring how much each KPI changes.
      <strong>Mean effect</strong> shows absolute importance; <strong>relative effect</strong>
      normalizes by baseline value. Taller bars = more influential parameter.</p>
      <div class="sensitivity-grid">
        <div id="sensitivity-bar" class="sensitivity-chart"></div>
        <div id="sensitivity-profile" class="sensitivity-chart"></div>
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

  container.appendChild(dataWrapper);

  updateBestCards(data, currentFocusKpi);
  updateEvalTable(data);
  drawScatter(data, currentFocusKpi);
  drawKpi3dPlots(data);
  drawParallelCoords(data);
  updateObjective(data);
  drawSensitivity(data);

  renderEcosystemNote(container, {
    view: 'PSUU Analysis',
    source: 'gds-psuu (Sweep + ParameterSpace + KPI) + gds-sim',
    question: 'Which parameter combination optimizes which KPI?',
    note: 'gds-psuu formalizes parameter search as a first-class object \u2014 ParameterSpace, KPI functions, and an optimizer form a structured exploration pipeline. Combined with gds-sim for execution, it turns \u201cwhich parameters are best?\u201d from an ad-hoc script into a reproducible analysis. The interactive explorer runs the same model in-browser via Pyodide.',
    links: [
      { label: 'From Nash to Lyapunov', url: 'https://blog.block.science/from-nash-to-lyapunov/' },
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

// ── KPI Trade-off Scatter ──

function drawKpiTradeoff(data) {
  const plotDiv = document.getElementById('kpi-tradeoff-plot');
  if (!plotDiv) return;

  const evals = data.evaluations;

  // Group evaluations by (coop_rate, diversity) bucket to show cluster sizes
  const buckets = new Map();
  for (const e of evals) {
    // Round to avoid float key issues
    const key = `${e.scores.cooperation_rate.toFixed(3)},${e.scores.diversity.toFixed(1)}`;
    if (!buckets.has(key)) {
      buckets.set(key, { evals: [], coop: e.scores.cooperation_rate, div: e.scores.diversity });
    }
    buckets.get(key).evals.push(e);
  }

  const points = [...buckets.values()];
  const maxCount = Math.max(...points.map(p => p.evals.length));

  // Use noise as x-axis instead — shows all 30 points spread out
  // Left chart: noise vs cooperation rate, colored by rounds, sized by diversity
  const trace = {
    type: 'scatter',
    mode: 'markers',
    x: evals.map(e => e.params.noise),
    y: evals.map(e => e.scores.cooperation_rate),
    marker: {
      size: evals.map(e => 6 + (e.scores.diversity / 9) * 14),
      color: evals.map(e => e.params.rounds_per_match),
      colorscale: [[0, 'rgba(220,80,60,0.85)'], [0.5, 'rgba(200,200,60,0.85)'], [1, 'rgba(80,180,60,0.85)']],
      showscale: true,
      colorbar: {
        title: { text: 'Rounds', font: { size: 9 } },
        thickness: 12,
        len: 0.8,
      },
      line: { width: 1, color: 'rgba(0,0,0,0.15)' },
    },
    text: evals.map(e =>
      `noise: ${e.params.noise.toFixed(4)}<br>rounds: ${e.params.rounds_per_match}<br>` +
      `Coop Rate: ${(e.scores.cooperation_rate * 100).toFixed(1)}%<br>` +
      `Diversity: ${e.scores.diversity.toFixed(0)} strategies<br>` +
      `Winner Share: ${(e.scores.winner_share * 100).toFixed(1)}%`
    ),
    hoverinfo: 'text',
  };

  const layout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'rgba(255,253,249,0.7)',
    font: { family: 'IBM Plex Mono, monospace', size: 10, color: '#8a8278' },
    title: { text: 'Parameter → Outcome', font: { size: 12, family: 'IM Fell English, serif', color: '#2a2520' }, x: 0.02, xanchor: 'left' },
    height: 380,
    margin: { t: 40, r: 80, b: 50, l: 60 },
    xaxis: {
      title: { text: 'Noise', font: { size: 10 } },
      gridcolor: 'rgba(0,0,0,0.06)',
      linecolor: '#8a8278',
      zeroline: false,
    },
    yaxis: {
      title: { text: 'Cooperation Rate', font: { size: 10 } },
      gridcolor: 'rgba(0,0,0,0.06)',
      linecolor: '#8a8278',
      zeroline: false,
      range: [-0.05, 1.05],
      tickvals: [0, 0.25, 0.5, 0.75, 1],
      ticktext: ['0%', '25%', '50%', '75%', '100%'],
    },
  };

  if (plotDiv.data) {
    Plotly.react(plotDiv, [trace], layout, { displayModeBar: false, responsive: true });
  } else {
    Plotly.newPlot(plotDiv, [trace], layout, { displayModeBar: false, responsive: true });
  }
}

// ── 3D KPI Landscapes ──

function drawKpi3dPlots(data) {
  const evals = data.evaluations;
  const noises = evals.map(e => e.params.noise);
  const rounds = evals.map(e => e.params.rounds_per_match);

  const kpis = [
    {
      id: 'kpi-3d-coop', title: 'Cooperation Rate',
      z: evals.map(e => e.scores.cooperation_rate),
      colorscale: [[0, '#e74c3c'], [0.5, '#f0c040'], [1, '#2ecc71']],
    },
    {
      id: 'kpi-3d-diversity', title: 'Diversity',
      z: evals.map(e => e.scores.diversity),
      colorscale: [[0, '#95a5a6'], [0.5, '#3498db'], [1, '#9b59b6']],
    },
    {
      id: 'kpi-3d-winner', title: 'Winner Share',
      z: evals.map(e => e.scores.winner_share),
      colorscale: [[0, '#2ecc71'], [0.5, '#f0c040'], [1, '#e74c3c']],
    },
  ];

  for (const kpi of kpis) {
    const plotDiv = document.getElementById(kpi.id);
    if (!plotDiv) continue;

    const scatter = {
      type: 'scatter3d',
      mode: 'markers',
      x: noises,
      y: rounds,
      z: kpi.z,
      marker: {
        size: 4,
        color: kpi.z,
        colorscale: kpi.colorscale,
        opacity: 0.9,
        line: { width: 0.5, color: 'rgba(0,0,0,0.2)' },
      },
      text: evals.map((e, i) =>
        `noise: ${e.params.noise.toFixed(4)}<br>rounds: ${e.params.rounds_per_match}<br>${kpi.title}: ${typeof kpi.z[i] === 'number' && kpi.z[i] <= 1 ? (kpi.z[i] * 100).toFixed(1) + '%' : kpi.z[i]}`
      ),
      hoverinfo: 'text',
      name: 'Evaluations',
    };

    const mesh = {
      type: 'mesh3d',
      x: noises,
      y: rounds,
      z: kpi.z,
      intensity: kpi.z,
      colorscale: kpi.colorscale,
      opacity: 0.35,
      showscale: false,
      name: 'Surface',
    };

    const layout = {
      paper_bgcolor: 'transparent',
      font: { family: 'IBM Plex Mono, monospace', size: 9, color: '#8a8278' },
      title: { text: kpi.title, font: { size: 12, family: 'IM Fell English, serif', color: '#2a2520' }, x: 0.5, xanchor: 'center' },
      margin: { t: 40, r: 10, b: 10, l: 10 },
      scene: {
        xaxis: { title: { text: 'Noise', font: { size: 9 } }, gridcolor: 'rgba(0,0,0,0.06)' },
        yaxis: { title: { text: 'Rounds', font: { size: 9 } }, gridcolor: 'rgba(0,0,0,0.06)' },
        zaxis: { title: { text: kpi.title, font: { size: 9 } }, gridcolor: 'rgba(0,0,0,0.06)' },
        camera: { eye: { x: 1.5, y: 1.5, z: 1.2 } },
        bgcolor: 'rgba(255,253,249,0.7)',
      },
    };

    if (plotDiv.data) {
      Plotly.react(plotDiv, [mesh, scatter], layout, { displayModeBar: false, responsive: true });
    } else {
      Plotly.newPlot(plotDiv, [mesh, scatter], layout, { displayModeBar: false, responsive: true });
    }
  }
}

// ── Parallel Coordinates ──

function drawParallelCoords(data) {
  const plotDiv = document.getElementById('kpi-parallel-plot');
  if (!plotDiv) return;

  const evals = data.evaluations;

  const trace = {
    type: 'parcoords',
    line: {
      color: evals.map(e => e.scores.cooperation_rate),
      colorscale: [[0, 'rgba(220,80,60,0.85)'], [0.5, 'rgba(200,200,60,0.85)'], [1, 'rgba(80,220,60,0.85)']],
      showscale: true,
      colorbar: {
        title: { text: 'Coop Rate', font: { size: 9 } },
        thickness: 12,
        len: 0.5,
        y: 0.5,
      },
    },
    dimensions: [
      {
        label: 'Noise',
        values: evals.map(e => e.params.noise),
        range: [0, 0.15],
        tickvals: [0, 0.05, 0.1, 0.15],
        ticktext: ['0', '0.05', '0.10', '0.15'],
      },
      {
        label: 'Rounds/Match',
        values: evals.map(e => e.params.rounds_per_match),
        range: [3, 25],
        tickvals: [3, 10, 15, 20, 25],
      },
      {
        label: 'Coop Rate',
        values: evals.map(e => e.scores.cooperation_rate),
        range: [0, 1],
        tickvals: [0, 0.25, 0.5, 0.75, 1],
        ticktext: ['0%', '25%', '50%', '75%', '100%'],
      },
      {
        label: 'Diversity',
        values: evals.map(e => e.scores.diversity),
        range: [1, 9],
        tickvals: [1, 3, 5, 7, 9],
      },
      {
        label: 'Winner Share',
        values: evals.map(e => e.scores.winner_share),
        range: [0, 1],
        tickvals: [0, 0.25, 0.5, 0.75, 1],
        ticktext: ['0%', '25%', '50%', '75%', '100%'],
      },
    ],
  };

  const layout = {
    paper_bgcolor: 'transparent',
    font: { family: 'IBM Plex Mono, monospace', size: 10, color: '#8a8278' },
    title: { text: 'Config → KPI Mapping', font: { size: 12, family: 'IM Fell English, serif', color: '#2a2520' }, x: 0.02, xanchor: 'left' },
    height: 380,
    margin: { t: 50, r: 60, b: 20, l: 60 },
  };

  if (plotDiv.data) {
    Plotly.react(plotDiv, [trace], layout, { displayModeBar: false, responsive: true });
  } else {
    Plotly.newPlot(plotDiv, [trace], layout, { displayModeBar: false, responsive: true });
  }
}

// ── Multi-KPI Objective ──

function getWeights() {
  const weights = {};
  document.querySelectorAll('.weight-slider').forEach(slider => {
    weights[slider.dataset.kpi] = parseFloat(slider.value);
  });
  return weights;
}

function computeObjectiveScore(scores, weights) {
  let total = 0;
  for (const [kpi, w] of Object.entries(weights)) {
    // Normalize diversity to 0-1 range (max 9 strategies) for fair weighting
    const val = kpi === 'diversity' ? scores[kpi] / 9 : scores[kpi];
    total += w * val;
  }
  return total;
}

function updateObjective(data) {
  const resultDiv = document.getElementById('objective-result');
  const chartDiv = document.getElementById('objective-chart');
  if (!resultDiv || !chartDiv) return;

  const weights = getWeights();
  const evals = data.evaluations;

  // Score all evaluations
  const scored = evals.map((e, i) => ({
    idx: i,
    params: e.params,
    scores: e.scores,
    objective: computeObjectiveScore(e.scores, weights),
  }));
  scored.sort((a, b) => b.objective - a.objective);
  const best = scored[0];

  // Format active weights
  const activeWeights = Object.entries(weights)
    .filter(([, w]) => Math.abs(w) > 0.001)
    .map(([k, w]) => `${w > 0 ? '+' : ''}${w.toFixed(1)} * ${KPI_LABELS[k]}`)
    .join('  ');

  resultDiv.innerHTML = `
    <div class="objective-best">
      <div class="objective-formula"><code>${activeWeights || '(all zero)'}</code></div>
      <div class="objective-score">Best score: <strong>${best.objective.toFixed(4)}</strong></div>
      <div class="best-params">
        ${Object.entries(best.params).map(([k, v]) =>
          `<div class="param-pill"><span class="param-key">${k}</span> = ${typeof v === 'number' ? v.toFixed(4) : v}</div>`
        ).join('')}
      </div>
      <div class="best-others">
        ${KPI_KEYS.map(k => `<span class="other-kpi">${KPI_LABELS[k]}: ${best.scores[k].toFixed(3)}</span>`).join('')}
      </div>
    </div>
  `;

  // Bar chart: top 10 evaluations ranked by objective
  const top = scored.slice(0, Math.min(15, scored.length));
  const trace = {
    type: 'bar',
    x: top.map((_, i) => `#${i + 1}`),
    y: top.map(t => t.objective),
    marker: {
      color: top.map(t => t.objective),
      colorscale: [[0, '#e74c3c'], [0.5, '#f0c040'], [1, '#2ecc71']],
    },
    text: top.map(t =>
      `noise: ${t.params.noise.toFixed(4)}<br>rounds: ${t.params.rounds_per_match}<br>` +
      `Score: ${t.objective.toFixed(4)}<br>` +
      KPI_KEYS.map(k => `${KPI_LABELS[k]}: ${t.scores[k].toFixed(3)}`).join('<br>')
    ),
    hoverinfo: 'text',
  };

  const layout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'rgba(255,253,249,0.7)',
    font: { family: 'IBM Plex Mono, monospace', size: 10, color: '#8a8278' },
    title: { text: 'Top Configurations by Objective', font: { size: 12, family: 'IM Fell English, serif', color: '#2a2520' }, x: 0.02, xanchor: 'left' },
    height: 280,
    margin: { t: 40, r: 20, b: 40, l: 50 },
    xaxis: { title: { text: 'Rank', font: { size: 10 } } },
    yaxis: { title: { text: 'Objective Score', font: { size: 10 } }, gridcolor: 'rgba(0,0,0,0.06)' },
  };

  if (chartDiv.data) {
    Plotly.react(chartDiv, [trace], layout, { displayModeBar: false, responsive: true });
  } else {
    Plotly.newPlot(chartDiv, [trace], layout, { displayModeBar: false, responsive: true });
  }
}

// ── Sensitivity Analysis ──

function drawSensitivity(data) {
  if (!data.sensitivity) return;
  drawSensitivityBars(data.sensitivity);
  drawSensitivityProfiles(data.sensitivity);
}

function drawSensitivityBars(sensitivity) {
  const plotDiv = document.getElementById('sensitivity-bar');
  if (!plotDiv) return;

  const indices = sensitivity.indices;
  const kpiNames = Object.keys(indices);
  const paramNames = Object.keys(indices[kpiNames[0]]);

  // Grouped bar chart: one group per KPI, one bar per parameter
  const colors = { noise: '#e67e22', rounds_per_match: '#3498db' };
  const traces = paramNames.map(param => ({
    type: 'bar',
    name: param === 'rounds_per_match' ? 'Rounds/Match' : 'Noise',
    x: kpiNames.map(k => KPI_LABELS[k]),
    y: kpiNames.map(k => indices[k][param].mean_effect),
    marker: { color: colors[param] },
    text: kpiNames.map(k =>
      `${param}: mean_effect=${indices[k][param].mean_effect.toFixed(4)}<br>` +
      `relative_effect=${(indices[k][param].relative_effect * 100).toFixed(1)}%`
    ),
    hoverinfo: 'text',
  }));

  const layout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'rgba(255,253,249,0.7)',
    font: { family: 'IBM Plex Mono, monospace', size: 10, color: '#8a8278' },
    title: { text: 'Parameter Importance (Mean Effect)', font: { size: 12, family: 'IM Fell English, serif', color: '#2a2520' }, x: 0.02, xanchor: 'left' },
    barmode: 'group',
    height: 320,
    margin: { t: 40, r: 20, b: 50, l: 60 },
    yaxis: { title: { text: 'Mean Effect', font: { size: 10 } }, gridcolor: 'rgba(0,0,0,0.06)' },
    legend: { x: 0.7, y: 0.95, font: { size: 9 } },
  };

  if (plotDiv.data) {
    Plotly.react(plotDiv, traces, layout, { displayModeBar: false, responsive: true });
  } else {
    Plotly.newPlot(plotDiv, traces, layout, { displayModeBar: false, responsive: true });
  }
}

function drawSensitivityProfiles(sensitivity) {
  const plotDiv = document.getElementById('sensitivity-profile');
  if (!plotDiv) return;

  const indices = sensitivity.indices;
  // Show response profiles: how each KPI changes as noise varies
  // Pick the most interesting KPI to profile (cooperation_rate)
  const kpiColors = {
    cooperation_rate: '#2ecc71',
    diversity: '#9b59b6',
    winner_share: '#e74c3c',
  };

  const traces = [];
  for (const [kpiName, paramData] of Object.entries(indices)) {
    const noiseData = paramData.noise;
    if (!noiseData?.values) continue;
    traces.push({
      type: 'scatter',
      mode: 'lines+markers',
      name: KPI_LABELS[kpiName],
      x: noiseData.values.map(v => v.param_value),
      y: noiseData.values.map(v => v.kpi_value),
      line: { color: kpiColors[kpiName], width: 2 },
      marker: { size: 6 },
    });
  }

  const layout = {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'rgba(255,253,249,0.7)',
    font: { family: 'IBM Plex Mono, monospace', size: 10, color: '#8a8278' },
    title: { text: 'Response Profile: KPI vs Noise', font: { size: 12, family: 'IM Fell English, serif', color: '#2a2520' }, x: 0.02, xanchor: 'left' },
    height: 320,
    margin: { t: 40, r: 20, b: 50, l: 60 },
    xaxis: { title: { text: 'Noise', font: { size: 10 } }, gridcolor: 'rgba(0,0,0,0.06)' },
    yaxis: { title: { text: 'KPI Value', font: { size: 10 } }, gridcolor: 'rgba(0,0,0,0.06)' },
    legend: { x: 0.6, y: 0.95, font: { size: 9 } },
  };

  if (plotDiv.data) {
    Plotly.react(plotDiv, traces, layout, { displayModeBar: false, responsive: true });
  } else {
    Plotly.newPlot(plotDiv, traces, layout, { displayModeBar: false, responsive: true });
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
        drawKpi3dPlots(currentData);
        drawParallelCoords(currentData);
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

    // Weight sliders — update label and recompute objective
    if (e.target.classList.contains('weight-slider')) {
      const kpi = e.target.dataset.kpi;
      const valEl = document.getElementById(`weight-val-${kpi}`);
      if (valEl) valEl.textContent = parseFloat(e.target.value).toFixed(1);
      if (currentData) updateObjective(currentData);
    }
  });

  // Objective preset buttons
  const presets = {
    coop: { cooperation_rate: 1.0, diversity: 0.0, winner_share: 0.0 },
    balanced: { cooperation_rate: 0.6, diversity: 0.3, winner_share: -0.1 },
    diversity: { cooperation_rate: 0.2, diversity: 0.8, winner_share: -0.2 },
  };
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('preset-btn')) {
      const preset = presets[e.target.dataset.preset];
      if (!preset) return;
      for (const [kpi, w] of Object.entries(preset)) {
        const slider = document.querySelector(`.weight-slider[data-kpi="${kpi}"]`);
        if (slider) slider.value = w;
        const valEl = document.getElementById(`weight-val-${kpi}`);
        if (valEl) valEl.textContent = w.toFixed(1);
      }
      if (currentData) updateObjective(currentData);
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
        drawKpi3dPlots(currentData);
        drawParallelCoords(currentData);
        updateObjective(currentData);
        drawSensitivity(currentData);
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
