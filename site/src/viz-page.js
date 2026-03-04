/**
 * Visualizations page — renders all Mermaid diagrams from gds-viz + ogs.viz.
 */

import { initNav } from './nav.js';
import { loadJSON } from './data/loader.js';
import { renderEcosystemNote } from './ecosystem-note.js';

async function boot() {
  initNav();
  const data = await loadJSON('viz_diagrams.json');
  renderDiagrams(data);

  // Initialize mermaid after DOM is populated
  if (window.mermaid) {
    window.mermaid.initialize({
      startOnLoad: false,
      theme: 'neutral',
      flowchart: { curve: 'basis', nodeSpacing: 50, rankSpacing: 60 },
    });
    await window.mermaid.run();
  }

  renderEcosystemNote(document.getElementById('viz-content'), {
    view: 'Visualizations',
    source: 'SystemIR + GDSSpec via gds-viz',
    question: 'What does the composition topology look like from different perspectives?',
    note: 'gds-viz produces 6 view types from the same compiled representations \u2014 structural topology from SystemIR, role-based architecture from GDSSpec, parameter influence from the spec\u2019s registry. Each Mermaid diagram is generated from the representation authoritative for that concern, not from a single lossy export.',
  });
}

function renderDiagrams(data) {
  const container = document.getElementById('viz-content');

  // Group by package
  const byPackage = {};
  for (const [key, diagram] of Object.entries(data.diagrams)) {
    const pkg = diagram.package || 'Unknown';
    if (!byPackage[pkg]) byPackage[pkg] = [];
    byPackage[pkg].push({ key, ...diagram });
  }

  let html = '';
  for (const [pkg, diagrams] of Object.entries(byPackage)) {
    html += `<section class="viz-section">
      <h2>${pkg}</h2>
      <div class="diagram-grid">
        ${diagrams.map(d => `
          <div class="diagram-card" id="diagram-${d.key}">
            <h3>${d.title}</h3>
            <p class="diagram-desc">${d.description}</p>
            <div class="diagram-render">
              <pre class="mermaid">${escapeHtml(d.mermaid)}</pre>
            </div>
          </div>
        `).join('')}
      </div>
    </section>`;
  }

  container.innerHTML = html;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

boot();
