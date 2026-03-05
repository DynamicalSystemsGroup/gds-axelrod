/**
 * Simulation page — gds-sim results with Plotly charts + custom sim runner.
 *
 * Features:
 * - Interactive Plotly stacked area charts per parameter subset
 * - Per-subset KPI summary cards (winner, cooperation rate, diversity)
 * - Custom simulation runner via Pyodide web worker
 */

import { initNav } from './nav.js';
import { loadJSON } from './data/loader.js';
import { renderEcosystemNote } from './ecosystem-note.js';

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

let worker = null;
let workerReady = false;

// ── Boot ──

async function boot() {
  initNav();
  const data = await loadJSON('sim_results.json');
  renderSim(data);
  initWorker();

  renderEcosystemNote(document.getElementById('sim-content'), {
    view: 'Simulation',
    source: 'gds-sim Model (state + state-update blocks + parameter space)',
    question: 'How does the system evolve over time under different parameter regimes?',
    note: 'gds-sim provides the execution semantics that GDS specifications deliberately omit. The specification captures <em>what</em> a system is; gds-sim adds <em>how</em> it runs. This separation means the same model feeds both formal analysis (previous pages) and simulation without either constraining the other.',
  });
}

// ── Plotly stacked area chart ──

const PLOTLY_LAYOUT_BASE = {
  paper_bgcolor: 'transparent',
  plot_bgcolor: 'rgba(255,253,249,0.7)',
  font: { family: 'IBM Plex Mono, monospace', size: 10, color: '#8a8278' },
  margin: { t: 10, r: 10, b: 36, l: 40 },
  showlegend: false,
  xaxis: {
    title: { text: 'Generation', font: { size: 10 } },
    gridcolor: 'rgba(0,0,0,0.06)',
    linecolor: '#8a8278',
    zeroline: false,
  },
  yaxis: {
    title: { text: 'Population', font: { size: 10 } },
    gridcolor: 'rgba(0,0,0,0.06)',
    linecolor: '#8a8278',
    zeroline: false,
  },
};

function drawPlotlyChart(container, trajectory, strategyNames, height = 240) {
  const generations = trajectory.map(t => t.timestep);

  const traces = strategyNames.map(name => ({
    type: 'scatter',
    mode: 'lines',
    name,
    x: generations,
    y: trajectory.map(t => t.population_counts[name] || 0),
    stackgroup: 'one',
    fillcolor: (COLORS[name] || '#666') + 'aa',
    line: { width: 0.5, color: COLORS[name] || '#666' },
    hovertemplate: `${name}: %{y}<extra></extra>`,
  }));

  const layout = {
    ...PLOTLY_LAYOUT_BASE,
    height,
  };

  Plotly.newPlot(container, traces, layout, {
    displayModeBar: false,
    responsive: true,
  });
}

// ── Per-subset KPI summary ──

function computeSubsetKPIs(trajectory, strategyNames) {
  const final = trajectory[trajectory.length - 1];
  const counts = final.population_counts;
  const total = final.total_agents;

  const COOP_SET = new Set([
    'Tit for Tat', 'Generous TFT', 'Tit for Two Tats',
    'Always Cooperate', 'Pavlov',
  ]);

  let cooperators = 0;
  let winner = '';
  let winnerCount = 0;
  let diversity = 0;

  for (const name of strategyNames) {
    const c = counts[name] || 0;
    if (c > 0) diversity++;
    if (COOP_SET.has(name)) cooperators += c;
    if (c > winnerCount) {
      winnerCount = c;
      winner = name;
    }
  }

  return {
    winner,
    winnerShare: (winnerCount / total * 100).toFixed(0),
    cooperationRate: (cooperators / total * 100).toFixed(0),
    diversity,
  };
}

// ── Full page render ──

function renderSim(data) {
  const container = document.getElementById('sim-content');

  container.innerHTML = `
    <section class="sim-section">
      <h2>Model Architecture</h2>
      <p class="sim-desc">${data.description}</p>
      <div class="model-overview">
        <div class="model-card">
          <h3>State</h3>
          <ul>${data.model.initial_state_keys.map(k => `<li>${k}</li>`).join('')}</ul>
        </div>
        <div class="model-card">
          <h3>Blocks</h3>
          ${data.model.state_update_blocks.map((b, i) => `
            <div class="sub-block">
              <strong>Block ${i + 1}</strong>
              <div>Policies: ${b.policies.join(', ') || 'none'}</div>
              <div>Variables: ${b.variables.join(', ')}</div>
            </div>
          `).join('')}
        </div>
        <div class="model-card">
          <h3>Parameter Space</h3>
          ${Object.entries(data.model.param_space).map(([k, v]) =>
            `<div><strong>${k}</strong>: [${v.join(', ')}]</div>`
          ).join('')}
        </div>
        <div class="model-card">
          <h3>Simulation</h3>
          <div>${data.simulation.timesteps} timesteps</div>
          <div>${data.simulation.runs} run(s)</div>
          <div>${data.simulation.total_param_subsets} parameter subsets</div>
        </div>
      </div>
    </section>

    <section class="sim-section">
      <h2>Population Trajectories</h2>
      <p class="sim-desc">Each chart shows how strategy populations evolve under different
      parameter settings. Hover for details.</p>
      <div class="sim-legend" id="sim-legend"></div>
      <div class="subset-grid" id="subset-grid"></div>
    </section>

    <section class="sim-section sim-narrative">
      <h2>From Trajectories to Optimization</h2>

      <p>Each chart above is a <strong>state trajectory</strong> — the time-ordered
      sequence of population states produced by one <strong>simulation run</strong>.
      The run is fully determined by a <strong>simulation configuration</strong>:
      a specific assignment of parameters (noise, rounds per match) that defines
      one point in <strong>parameter space</strong>.</p>

      <div class="term-stack">
        <div class="term-step">
          <span class="term-label">Parameter Vector</span>
          <span class="term-arrow">→</span>
          <span class="term-label">Simulation Config</span>
          <span class="term-arrow">→</span>
          <span class="term-label">Monte Carlo Runs</span>
          <span class="term-arrow">→</span>
          <span class="term-label">Trajectories</span>
          <span class="term-arrow">→</span>
          <span class="term-label">Metrics</span>
          <span class="term-arrow">→</span>
          <span class="term-label">KPIs</span>
        </div>
      </div>

      <p>A <strong>metric</strong> summarizes a single trajectory — e.g. the cooperation
      rate at the final generation. Because the simulation is <strong>stochastic</strong>
      (noise flips actions randomly), a single run doesn't tell the full story.
      <strong>Monte Carlo batches</strong> — multiple runs of the same configuration
      with different random seeds — reveal the <strong>distribution of outcomes</strong>,
      not just one realization.</p>

      <p><strong>KPIs</strong> aggregate metrics across Monte Carlo runs: expected
      cooperation rate, diversity, winner share. A KPI summarizes a configuration's
      performance, not a single run.</p>

      <p>This creates a <strong>mapping</strong>: each point in parameter space maps
      to a set of KPIs. The mapping is noisy, non-linear, and computationally expensive
      to evaluate. The natural question becomes: <em>which configuration optimizes
      which KPI?</em></p>

      <p>That's exactly what the <a href="./psuu.html">PSUU Analysis</a> page does —
      it searches the parameter space systematically, evaluating configurations and
      surfacing the ones that maximize cooperation, diversity, or balance.</p>
    </section>

    <section class="sim-section">
      <h2>Run Your Own</h2>
      <p class="sim-desc">Configure parameters and run a custom evolutionary simulation in-browser.
      Adjust <strong>mutation rate</strong> (how often strategies randomly change) and
      <strong>selection pressure</strong> (what fraction of the population is replaced each generation).</p>
      <div class="custom-sim-controls">
        <div class="control-row">
          <div class="control-group">
            <label for="custom-noise">Noise: <span id="custom-noise-label">0.05</span></label>
            <input type="range" id="custom-noise" min="0" max="0.3" step="0.01" value="0.05">
          </div>
          <div class="control-group">
            <label for="custom-rounds">Rounds: <span id="custom-rounds-label">10</span></label>
            <input type="range" id="custom-rounds" min="3" max="50" step="1" value="10">
          </div>
          <div class="control-group">
            <label for="custom-timesteps">Generations: <span id="custom-timesteps-label">40</span></label>
            <input type="range" id="custom-timesteps" min="10" max="100" step="5" value="40">
          </div>
          <div class="control-group">
            <label for="custom-mutation">Mutation: <span id="custom-mutation-label">5%</span></label>
            <input type="range" id="custom-mutation" min="0" max="0.2" step="0.01" value="0.05">
          </div>
          <div class="control-group">
            <label for="custom-selection">Selection: <span id="custom-selection-label">20%</span></label>
            <input type="range" id="custom-selection" min="0.05" max="0.5" step="0.05" value="0.2">
          </div>
        </div>
        <details class="pop-details">
          <summary>Initial Population</summary>
          <div class="pop-grid">
            ${STRATEGY_DEFAULTS.map(s => `
              <div class="pop-item">
                <label for="sim-pop-${s.short}">${s.short}</label>
                <input type="number" id="sim-pop-${s.short}" data-strategy="${s.name}" min="0" max="30" value="${s.pop}" class="sim-pop-input">
              </div>
            `).join('')}
          </div>
        </details>
        <div class="control-row">
          <button id="custom-run-btn" disabled>Loading Python...</button>
          <span id="custom-status" class="run-status"></span>
        </div>
      </div>
      <div id="custom-result"></div>
    </section>
  `;

  // Legend
  document.getElementById('sim-legend').innerHTML = data.strategy_names.map(name =>
    `<span class="legend-item"><span class="legend-swatch" style="background:${COLORS[name] || '#666'}"></span>${name}</span>`
  ).join('');

  // Render subset charts
  const grid = document.getElementById('subset-grid');
  const sortedSubsets = Object.entries(data.subsets).sort(([a], [b]) => Number(a) - Number(b));

  for (const [subsetId, subset] of sortedSubsets) {
    const card = document.createElement('div');
    card.className = 'subset-card';

    const paramLabel = Object.entries(subset.params)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');

    const kpis = computeSubsetKPIs(subset.trajectory, data.strategy_names);

    card.innerHTML = `
      <div class="subset-header">
        <div>
          <h3>Subset ${subsetId}</h3>
          <div class="param-label">${paramLabel}</div>
        </div>
        <div class="subset-kpis">
          <span class="kpi-pill" title="Dominant strategy">
            <span class="kpi-swatch" style="background:${COLORS[kpis.winner] || '#666'}"></span>
            ${kpis.winner} (${kpis.winnerShare}%)
          </span>
          <span class="kpi-pill" title="Cooperation rate">Coop: ${kpis.cooperationRate}%</span>
          <span class="kpi-pill" title="Species diversity">Diversity: ${kpis.diversity}</span>
        </div>
      </div>
      <div class="subset-chart"></div>
    `;

    grid.appendChild(card);

    const chartDiv = card.querySelector('.subset-chart');
    drawPlotlyChart(chartDiv, subset.trajectory, data.strategy_names);
  }

  // Bind custom sim controls
  bindCustomControls();
}

// ── Custom simulation controls ──

function bindCustomControls() {
  // Live label updates for sliders
  const sliderMap = {
    'custom-noise': { label: 'custom-noise-label', format: v => v },
    'custom-rounds': { label: 'custom-rounds-label', format: v => v },
    'custom-timesteps': { label: 'custom-timesteps-label', format: v => v },
    'custom-mutation': { label: 'custom-mutation-label', format: v => `${Math.round(v * 100)}%` },
    'custom-selection': { label: 'custom-selection-label', format: v => `${Math.round(v * 100)}%` },
  };

  document.addEventListener('input', (e) => {
    const cfg = sliderMap[e.target.id];
    if (cfg) {
      const el = document.getElementById(cfg.label);
      if (el) el.textContent = cfg.format(e.target.value);
    }
  });

  document.addEventListener('click', (e) => {
    if (e.target.id === 'custom-run-btn' && workerReady) {
      runCustomSim();
    }
  });
}

function readCustomPop() {
  const pop = {};
  const inputs = document.querySelectorAll('.sim-pop-input');
  let anyNonDefault = false;
  inputs.forEach(input => {
    const name = input.dataset.strategy;
    const val = parseInt(input.value, 10) || 0;
    if (val > 0) pop[name] = val;
    if (val !== 4) anyNonDefault = true;
  });
  return anyNonDefault ? pop : null;
}

function runCustomSim() {
  const btn = document.getElementById('custom-run-btn');
  const status = document.getElementById('custom-status');
  const noise = parseFloat(document.getElementById('custom-noise')?.value || '0.05');
  const rounds = parseInt(document.getElementById('custom-rounds')?.value || '10', 10);
  const timesteps = parseInt(document.getElementById('custom-timesteps')?.value || '40', 10);
  const mutation = parseFloat(document.getElementById('custom-mutation')?.value || '0.05');
  const selection = parseFloat(document.getElementById('custom-selection')?.value || '0.2');
  const initialPop = readCustomPop();
  const seed = Date.now() % 2147483647;

  btn.disabled = true;
  btn.textContent = 'Running...';
  if (status) status.textContent = 'Starting simulation...';

  worker.postMessage({
    type: 'run',
    noise,
    rounds_per_match: rounds,
    timesteps,
    mutation_rate: mutation,
    selection_pressure: selection,
    seed,
    initialPop,
  });
}

function renderCustomResult(data) {
  const container = document.getElementById('custom-result');
  if (!container) return;

  const kpis = data.final_kpis;
  const paramStr = `noise=${data.params.noise}, rounds=${data.params.rounds_per_match}, ` +
    `mutation=${(data.params.mutation_rate * 100).toFixed(0)}%, ` +
    `selection=${(data.params.selection_pressure * 100).toFixed(0)}%`;

  container.innerHTML = `
    <div class="custom-result-card">
      <div class="custom-result-header">
        <h3>Result</h3>
        <div class="param-label">${paramStr}</div>
        <div class="subset-kpis">
          <span class="kpi-pill">
            <span class="kpi-swatch" style="background:${COLORS[kpis.winner] || '#666'}"></span>
            ${kpis.winner} (${(kpis.winner_share * 100).toFixed(0)}%)
          </span>
          <span class="kpi-pill">Coop: ${(kpis.cooperation_rate * 100).toFixed(0)}%</span>
          <span class="kpi-pill">Diversity: ${kpis.diversity}</span>
        </div>
      </div>
      <div id="custom-chart"></div>
    </div>
  `;

  drawPlotlyChart(
    document.getElementById('custom-chart'),
    data.trajectory,
    data.strategy_names,
    320,
  );
}

// ── Web Worker ──

function initWorker() {
  worker = new Worker(new URL('./workers/sim-worker.js', import.meta.url), { type: 'module' });

  worker.onmessage = (e) => {
    const msg = e.data;
    const btn = document.getElementById('custom-run-btn');
    const status = document.getElementById('custom-status');

    switch (msg.type) {
      case 'status': {
        const phases = {
          'loading-runtime': 'Loading Python runtime...',
          'loading-model': 'Loading model...',
        };
        if (btn) btn.textContent = phases[msg.phase] || msg.phase;
        break;
      }

      case 'ready':
        workerReady = true;
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Run Simulation';
        }
        if (status) status.textContent = 'Python ready';
        break;

      case 'progress': {
        if (status) status.textContent = `Generation ${msg.current}/${msg.total}...`;
        break;
      }

      case 'result': {
        renderCustomResult(msg.data);
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Run Simulation';
        }
        if (status) status.textContent = 'Done';
        break;
      }

      case 'error':
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Run Simulation';
        }
        if (status) status.textContent = `Error: ${msg.message}`;
        console.error('Sim worker error:', msg.message);
        break;
    }
  };

  worker.postMessage({ type: 'init' });
}

boot();
