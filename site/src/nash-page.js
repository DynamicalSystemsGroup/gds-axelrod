/**
 * Nash Analysis page — payoff matrices, equilibria, dominance, Pareto.
 */

import { initNav } from './nav.js';
import { loadJSON } from './data/loader.js';
import { renderEcosystemNote } from './ecosystem-note.js';

async function boot() {
  initNav();
  const data = await loadJSON('nash_analysis.json');
  renderNash(data);

  renderEcosystemNote(document.getElementById('nash-content'), {
    view: 'Nash Analysis',
    source: 'PatternIR (game-theoretic lens via OGS)',
    question: 'What are the equilibria, dominant strategies, and Pareto outcomes?',
    note: 'Nash analysis reads from the game-theoretic lens \u2014 PatternIR carries domain vocabulary (action spaces, payoff matrices, terminal conditions) that GDSSpec does not. The formal structure page shows canonical roles; this page shows strategic structure. Same model, orthogonal questions, neither view compromises the other.',
  });
}

function renderNash(data) {
  const container = document.getElementById('nash-content');

  container.innerHTML = `
    <section class="nash-section">
      <h2>Payoff Parameters</h2>
      <div class="param-grid">
        ${Object.entries(data.payoff_params.labels).map(([key, label]) => `
          <div class="param-card">
            <span class="param-key">${key} = ${data.payoff_params[key]}</span>
            <span class="param-desc">${label}</span>
          </div>
        `).join('')}
      </div>
      <p class="constraint">Constraint: T &gt; R &gt; P &gt; S and 2R &gt; T + S</p>
    </section>

    <section class="nash-section">
      <h2>Payoff Matrices</h2>
      <div class="matrix-pair">
        ${renderMatrix('Alice Payoffs', data.payoff_matrices.alice, data.players.Alice, data.players.Bob)}
        ${renderMatrix('Bob Payoffs', data.payoff_matrices.bob, data.players.Alice, data.players.Bob)}
      </div>
    </section>

    <section class="nash-section">
      <h2>Nash Equilibria</h2>
      <div class="eq-list">
        ${data.equilibria.map((eq, i) => renderEquilibrium(eq, i)).join('')}
      </div>
    </section>

    <section class="nash-section">
      <h2>Dominant Strategies</h2>
      ${Object.keys(data.dominant_strategies).length > 0
        ? `<div class="dominant-grid">
            ${Object.entries(data.dominant_strategies).map(([player, strat]) => `
              <div class="dominant-card">
                <strong>${player}</strong>: ${strat}
                <span class="dominant-note">(strictly dominant)</span>
              </div>
            `).join('')}
          </div>`
        : '<p class="empty-note">No strictly dominant strategies found.</p>'
      }
    </section>

    <section class="nash-section">
      <h2>Pareto Optimal Outcomes</h2>
      <div class="pareto-list">
        ${data.pareto_optimal.map(p => `
          <div class="pareto-card">
            <div class="pareto-actions">Alice: ${p.alice_action}, Bob: ${p.bob_action}</div>
            <div class="pareto-payoffs">Payoffs: (${p.alice_payoff}, ${p.bob_payoff})</div>
          </div>
        `).join('')}
      </div>
    </section>

    <section class="nash-section">
      <h2>Verification</h2>
      <p class="verify-desc">Cross-referencing computed equilibria with declared terminal conditions from the OGS PatternIR.</p>
      <div class="terminal-list">
        ${data.verification.all_terminal_conditions.map(tc => `
          <div class="tc-card">
            <h3>${tc.name}</h3>
            <div class="tc-actions">${Object.entries(tc.actions).map(([p, a]) => `${p}: ${a}`).join(', ')}</div>
            <div class="tc-outcome">${tc.outcome}</div>
            <div class="tc-payoff">${tc.payoff}</div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

function renderMatrix(title, matrix, rowLabels, colLabels) {
  return `
    <div class="matrix-card">
      <h3>${title}</h3>
      <table class="payoff-matrix">
        <thead>
          <tr>
            <th></th>
            ${colLabels.map(c => `<th>${c}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${matrix.map((row, i) => `
            <tr>
              <th>${rowLabels[i]}</th>
              ${row.map(val => `<td>${val}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderEquilibrium(eq, index) {
  const alicePure = eq.alice_pure || 'Mixed';
  const bobPure = eq.bob_pure || 'Mixed';

  return `
    <div class="eq-card">
      <h3>Equilibrium ${index + 1}</h3>
      <div class="eq-strategies">
        <div>Alice: <strong>${alicePure}</strong>
          ${!eq.alice_pure ? `<span class="eq-mixed">(${formatMixed(eq.alice_strategy)})</span>` : ''}</div>
        <div>Bob: <strong>${bobPure}</strong>
          ${!eq.bob_pure ? `<span class="eq-mixed">(${formatMixed(eq.bob_strategy)})</span>` : ''}</div>
      </div>
      <div class="eq-payoff">
        Expected payoff: Alice=${eq.expected_payoff.alice.toFixed(2)}, Bob=${eq.expected_payoff.bob.toFixed(2)}
      </div>
    </div>
  `;
}

function formatMixed(strategy) {
  return Object.entries(strategy)
    .map(([action, prob]) => `${action}: ${(prob * 100).toFixed(0)}%`)
    .join(', ');
}

boot();
