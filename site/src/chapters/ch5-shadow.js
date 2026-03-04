/**
 * Chapter 5: Shadow of the Future — score vs rounds line chart.
 */

import { loadChapter, loadStrategies } from '../data/loader.js';
import { renderLineSweep } from '../viz/charts.js';

export async function initChapter5() {
  const [data, strategies] = await Promise.all([loadChapter(5), loadStrategies()]);
  const stratNames = strategies.map(s => s.name);

  const container = document.getElementById('shadow-sweep-container');
  if (!container) return;

  renderLineSweep(container, data.sweep, 'rounds', 'Match length (rounds)', stratNames);
}
