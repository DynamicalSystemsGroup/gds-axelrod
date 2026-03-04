/**
 * Formal Structure page — GDSSpec projection + canonical decomposition.
 */

import { initNav } from './nav.js';
import { loadJSON } from './data/loader.js';
import { renderEcosystemNote } from './ecosystem-note.js';

async function boot() {
  initNav();
  const data = await loadJSON('formal.json');
  renderFormal(data);

  renderEcosystemNote(document.getElementById('formal-content'), {
    view: 'Formal Structure',
    source: 'GDSSpec + CanonicalGDS via <code>compile_pattern_to_spec()</code>',
    question: 'What is the formal mathematical structure of this system?',
    note: 'The canonical projection <em>h = f \u2218 g</em> reveals the Prisoner\u2019s Dilemma is a degenerate dynamical system \u2014 pure policy with no state (<em>h = g</em>, <em>f = \u2205</em>, <em>X = \u2205</em>). This is the correct structural characterization of compositional game theory. The same canonical form accommodates control systems, stock-flow models, and games under one algebra.',
  });
}

function renderFormal(data) {
  const container = document.getElementById('formal-content');

  // Spec overview
  container.innerHTML = `
    <section class="formal-section">
      <h2>GDS Specification</h2>
      <p class="formal-desc">${data.spec_description}</p>
      <div class="formal-meta">
        <span class="meta-tag">Name: <strong>${data.spec_name}</strong></span>
      </div>
    </section>

    <section class="formal-section">
      <h2>Canonical Decomposition</h2>
      <div class="formula-box">${data.canonical.formula}</div>
      <div class="canonical-grid">
        ${renderCanonicalSection('Boundary Blocks (U)', data.canonical.boundary_blocks)}
        ${renderCanonicalSection('Policy Blocks (g)', data.canonical.policy_blocks)}
        ${renderCanonicalSection('Mechanism Blocks (f)', data.canonical.mechanism_blocks)}
        ${renderCanonicalSection('State Variables (X)',
          data.canonical.state_variables.map(sv => `${sv.entity}.${sv.variable}`))}
        ${renderCanonicalSection('Input Ports',
          data.canonical.input_ports.map(p => `${p.block}::${p.port}`))}
        ${renderCanonicalSection('Decision Ports',
          data.canonical.decision_ports.map(p => `${p.block}::${p.port}`))}
      </div>
    </section>

    <section class="formal-section">
      <h2>Block Roles</h2>
      <div id="roles-grid">${renderRoles(data.blocks_by_role)}</div>
    </section>

    <section class="formal-section">
      <h2>Wirings</h2>
      <div id="wirings-list">${renderWirings(data.wirings)}</div>
    </section>
  `;
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
