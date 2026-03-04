/**
 * Chapter 4: Noise & Forgiveness — strategy ranking crossover with noise.
 */

import { loadChapter, loadStrategies } from '../data/loader.js';
import { renderLineSweep } from '../viz/charts.js';

export async function initChapter4() {
  const [data, strategies] = await Promise.all([loadChapter(4), loadStrategies()]);
  const stratNames = strategies.map(s => s.name);

  const container = document.getElementById('noise-sweep-container');
  if (!container) return;

  renderLineSweep(container, data.sweep, 'noise', 'Noise probability', stratNames);
}
