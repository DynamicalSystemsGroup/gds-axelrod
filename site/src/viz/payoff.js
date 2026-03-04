/**
 * Payoff matrix renderer.
 */

export function renderPayoffMatrix(container, data) {
  const { actions, payoffs } = data;

  let html = '<table class="payoff-matrix"><tr><th></th>';
  actions.forEach(a => html += `<th>${a}</th>`);
  html += '</tr>';

  actions.forEach((rowAction, i) => {
    html += `<tr><th>${rowAction}</th>`;
    actions.forEach((colAction, j) => {
      const [pa, pb] = payoffs[i][j];
      const isNash = rowAction === 'Defect' && colAction === 'Defect';
      const isPareto = rowAction === 'Cooperate' && colAction === 'Cooperate';
      const cls = isNash ? 'highlight' : '';
      html += `<td class="${cls}"><span style="color:var(--c-tft)">${pa}</span>, <span style="color:var(--c-def)">${pb}</span>`;
      if (isNash) html += '<br><small style="color:var(--ink-dim)">Nash</small>';
      if (isPareto) html += '<br><small style="color:var(--ink-dim)">Pareto</small>';
      html += '</td>';
    });
    html += '</tr>';
  });

  html += '</table>';
  container.innerHTML = html;
}
