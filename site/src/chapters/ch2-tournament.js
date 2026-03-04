/**
 * Chapter 2: The Tournament — GDSSpec architecture diagram + heatmap + rankings.
 *
 * The architecture diagram comes from gds-viz rendering a GDSSpec that represents
 * the full tournament model (gds-games + gds-framework + gds-viz ecosystem).
 */

import { loadChapter, loadStrategies, loadJSON } from '../data/loader.js';
import { renderRankings, renderHeatmap } from '../viz/charts.js';

export async function initChapter2() {
  const [data, strategies, specData] = await Promise.all([
    loadChapter(2),
    loadStrategies(),
    loadJSON('tournament_spec.json'),
  ]);

  // Tournament architecture diagram (GDSSpec → gds-viz)
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

  const heatmapContainer = document.getElementById('tournament-heatmap-container');
  if (heatmapContainer) {
    renderHeatmap(heatmapContainer, data.heatmap, strategies);
  }

  const rankingsContainer = document.getElementById('tournament-rankings-container');
  if (rankingsContainer) {
    const maxScore = Math.max(...data.rankings.map(r => r.score));
    renderRankings(rankingsContainer, data.rankings, maxScore);
  }
}
