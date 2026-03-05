/**
 * Formal Structure page — two-level game specification:
 *   1. The 1v1 Prisoner's Dilemma (OGS Pattern → GDSSpec)
 *   2. The Tournament/Evolution wrapper (GDSSpec)
 * Plus all Mermaid diagram visualizations from both.
 */

import { initNav } from './nav.js';
import { loadJSON } from './data/loader.js';
import { renderEcosystemNote } from './ecosystem-note.js';

async function boot() {
  initNav();
  const [formalData, vizData, tournamentData] = await Promise.all([
    loadJSON('formal.json'),
    loadJSON('viz_diagrams.json'),
    loadJSON('tournament_spec.json'),
  ]);

  renderPage(formalData, vizData, tournamentData);

  // Initialize mermaid after DOM is populated
  if (window.mermaid) {
    window.mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      flowchart: { curve: 'basis', nodeSpacing: 50, rankSpacing: 60 },
    });
    await window.mermaid.run();
  }

  renderEcosystemNote(document.getElementById('formal-content'), {
    view: 'Formal Structure',
    source: 'GDSSpec + CanonicalGDS via <code>compile_pattern_to_spec()</code>, SystemIR + GDSSpec via gds-viz',
    question: 'What is the formal mathematical structure and composition topology of this system?',
    note: 'Two specifications capture two levels of the system. The 1v1 game is a <em>degenerate</em> dynamical system — pure policy with no state (<em>h = g</em>). The tournament wraps it into a <em>stateful</em> system with population dynamics (<em>h = f<sub>θ</sub> ∘ g<sub>θ</sub></em>). Each diagram is generated from the compiled representation authoritative for that concern.',
  });
}

function renderPage(formalData, vizData, tournamentData) {
  const container = document.getElementById('formal-content');

  container.innerHTML = `
    <section class="formal-section">
      <h2>Two Levels of Specification</h2>
      <p class="formal-desc">The system is specified at two levels. The <strong>1v1 game</strong>
      defines a single Prisoner's Dilemma match as an OGS pattern — a stateless composition of
      decision and payoff blocks. The <strong>tournament</strong> wraps that game into an
      evolutionary simulation with population state, selection pressure, and tunable parameters.</p>
    </section>

    <hr class="section-rule">

    <section class="formal-section">
      <h2>The 1v1 Game</h2>
      <p class="formal-desc">${formalData.spec_description}</p>
      <div class="formal-meta">
        <span class="meta-tag">Spec: <strong>${formalData.spec_name}</strong></span>
      </div>
    </section>

    <section class="formal-section">
      <h3>Canonical Decomposition</h3>
      <div class="formula-box">${formalData.canonical.formula}</div>
      <div class="canonical-grid">
        ${renderCanonicalSection('Boundary Blocks (U)', formalData.canonical.boundary_blocks)}
        ${renderCanonicalSection('Policy Blocks (g)', formalData.canonical.policy_blocks)}
        ${renderCanonicalSection('Mechanism Blocks (f)', formalData.canonical.mechanism_blocks)}
        ${renderCanonicalSection('State Variables (X)',
          formalData.canonical.state_variables.map(sv => `${sv.entity}.${sv.variable}`))}
        ${renderCanonicalSection('Input Ports',
          formalData.canonical.input_ports.map(p => `${p.block}::${p.port}`))}
        ${renderCanonicalSection('Decision Ports',
          formalData.canonical.decision_ports.map(p => `${p.block}::${p.port}`))}
      </div>
    </section>

    <section class="formal-section">
      <h3>Block Roles</h3>
      <div id="roles-grid">${renderRoles(formalData.blocks_by_role)}</div>
    </section>

    <section class="formal-section">
      <h3>Wirings</h3>
      <div id="wirings-list">${renderWirings(formalData.wirings)}</div>
    </section>

    <section class="formal-section">
      <h3>1v1 Game Diagrams</h3>
      ${renderDiagramGroup(vizData.diagrams)}
    </section>

    <hr class="section-rule">

    <section class="formal-section">
      <h2>The Tournament</h2>
      <p class="formal-desc">${tournamentData.spec_description}</p>
      <div class="formal-meta">
        <span class="meta-tag">Spec: <strong>${tournamentData.spec_name}</strong></span>
      </div>
    </section>

    <section class="formal-section">
      <h3>Canonical Decomposition</h3>
      <div class="formula-box">${tournamentData.canonical_formula}</div>
    </section>

    <section class="formal-section">
      <h3>Tournament Diagrams</h3>
      ${renderDiagramGroup(tournamentData.diagrams)}
    </section>
  `;
}

function renderDiagramGroup(diagrams) {
  // Group by package if available, otherwise flat
  const byPackage = {};
  for (const [key, diagram] of Object.entries(diagrams)) {
    const pkg = diagram.package || '';
    if (!byPackage[pkg]) byPackage[pkg] = [];
    byPackage[pkg].push({ key, ...diagram });
  }

  let html = '';
  for (const [pkg, items] of Object.entries(byPackage)) {
    if (pkg) {
      html += `<h4>${pkg}</h4>`;
    }
    html += `<div class="diagram-grid">
      ${items.map(d => `
        <div class="diagram-card" id="diagram-${d.key}">
          <h3>${d.title}</h3>
          <p class="diagram-desc">${d.description}</p>
          <div class="diagram-render">
            <pre class="mermaid">${escapeHtml(d.mermaid)}</pre>
          </div>
        </div>
      `).join('')}
    </div>`;
  }
  return html;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderCanonicalSection(title, items) {
  if (!items || items.length === 0) {
    return `
      <div class="canonical-card empty">
        <h3>${title}</h3>
        <p class="empty-note">(empty)</p>
      </div>`;
  }
  return `
    <div class="canonical-card">
      <h3>${title}</h3>
      <ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>
    </div>`;
}

function renderRoles(blocksByRole) {
  return Object.entries(blocksByRole).map(([role, blocks]) => `
    <div class="role-card">
      <h3>${role} <span class="role-count">(${blocks.length})</span></h3>
      <table class="block-table">
        <thead><tr><th>Block</th><th>Forward In</th><th>Forward Out</th></tr></thead>
        <tbody>
          ${blocks.map(b => `
            <tr>
              <td>${b.name}</td>
              <td>${b.forward_in.join(', ') || '-'}</td>
              <td>${b.forward_out.join(', ') || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `).join('');
}

function renderWirings(wirings) {
  if (!wirings || wirings.length === 0) return '<p class="empty-note">No wirings registered.</p>';
  return wirings.map(w => `
    <div class="wiring-card">
      <h3>${w.name}</h3>
      <table class="wire-table">
        <thead><tr><th>Source</th><th>Target</th><th>Space</th></tr></thead>
        <tbody>
          ${w.wires.map(wire => `
            <tr>
              <td>${wire.source}</td>
              <td>${wire.target}</td>
              <td>${wire.space}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `).join('');
}

boot();
