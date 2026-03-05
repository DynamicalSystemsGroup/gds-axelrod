/**
 * Chapter 6 (Appendix): Under the Hood — architecture diagrams.
 *
 * Renders the OGS architecture-by-domain diagram and the tournament
 * architecture diagram into the technical appendix section.
 */

import { loadVizDiagrams, loadJSON } from '../data/loader.js';

export async function initAppendix() {
  const [vizData, specData] = await Promise.all([
    loadVizDiagrams(),
    loadJSON('tournament_spec.json'),
  ]);

  // OGS architecture by domain diagram
  const archContainer = document.getElementById('arch-domain-container');
  if (archContainer && vizData.diagrams?.ogs_architecture_by_domain) {
    const diagram = vizData.diagrams.ogs_architecture_by_domain;
    const pre = document.createElement('pre');
    pre.className = 'mermaid';
    pre.textContent = diagram.mermaid;
    archContainer.innerHTML = '';
    archContainer.appendChild(pre);

    if (window.mermaid) {
      window.mermaid.initialize({
        startOnLoad: false,
        theme: 'neutral',
        flowchart: { curve: 'basis', nodeSpacing: 50, rankSpacing: 60 },
      });
      await window.mermaid.run({ nodes: [pre] });
    }
  }

  // Tournament architecture diagram
  const diagramContainer = document.getElementById('tournament-game-diagram');
  if (diagramContainer && specData.diagrams?.tournament_architecture) {
    const diagram = specData.diagrams.tournament_architecture;
    const pre = document.createElement('pre');
    pre.className = 'mermaid';
    pre.textContent = diagram.mermaid;
    diagramContainer.innerHTML = '';
    diagramContainer.appendChild(pre);

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
