/**
 * Chapter 1: The Dilemma — payoff matrix + architecture by domain diagram.
 */

import { loadChapter, loadVizDiagrams } from '../data/loader.js';
import { renderPayoffMatrix } from '../viz/payoff.js';

export async function initChapter1() {
  const [data, vizData] = await Promise.all([loadChapter(1), loadVizDiagrams()]);

  const matrixContainer = document.getElementById('payoff-matrix-container');
  if (matrixContainer) {
    renderPayoffMatrix(matrixContainer, data.payoff_matrix);
  }

  const archContainer = document.getElementById('arch-domain-container');
  if (archContainer && vizData.diagrams?.ogs_architecture_by_domain) {
    const diagram = vizData.diagrams.ogs_architecture_by_domain;
    const pre = document.createElement('pre');
    pre.className = 'mermaid';
    pre.textContent = diagram.mermaid;
    archContainer.innerHTML = '';
    archContainer.appendChild(pre);

    // Render with mermaid if loaded
    if (window.mermaid) {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: 'neutral',
        flowchart: { curve: 'basis', nodeSpacing: 50, rankSpacing: 60 },
      });
      await window.mermaid.run({ nodes: [pre] });
    }
  }
}
