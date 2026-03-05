/**
 * Chapter 2: The Tournament — heatmap + rankings.
 */

import { loadChapter, loadStrategies } from '../data/loader.js';
import { renderRankings, renderHeatmap } from '../viz/charts.js';

export async function initChapter2() {
  const [data, strategies] = await Promise.all([
    loadChapter(2),
    loadStrategies(),
  ]);

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
