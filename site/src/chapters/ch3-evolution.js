/**
 * Chapter 3: Evolution — stacked area charts for Moran + Proportional.
 */

import { loadChapter, loadStrategies } from '../data/loader.js';
import { renderStackedArea } from '../viz/charts.js';

export async function initChapter3() {
  const [data, strategies] = await Promise.all([loadChapter(3), loadStrategies()]);
  const stratNames = strategies.map(s => s.name);

  const container = document.getElementById('evolution-chart-container');
  if (!container) return;

  container.innerHTML = `
    <div style="margin-bottom:10px">
      <button class="btn evo-toggle on" data-mode="proportional">Proportional</button>
      <button class="btn evo-toggle" data-mode="moran">Moran</button>
    </div>
    <div id="evo-chart-area"></div>
  `;

  const chartArea = document.getElementById('evo-chart-area');

  function render(mode) {
    const snapshots = mode === 'moran' ? data.moran : data.proportional;
    renderStackedArea(chartArea, snapshots, stratNames);

    container.querySelectorAll('.evo-toggle').forEach(btn => {
      btn.classList.toggle('on', btn.dataset.mode === mode);
    });
  }

  container.querySelectorAll('.evo-toggle').forEach(btn => {
    btn.addEventListener('click', () => render(btn.dataset.mode));
  });

  render('proportional');
}
