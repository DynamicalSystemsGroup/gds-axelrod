/**
 * Chapter 1: The Dilemma — payoff matrix.
 */

import { loadChapter } from '../data/loader.js';
import { renderPayoffMatrix } from '../viz/payoff.js';

export async function initChapter1() {
  const data = await loadChapter(1);

  const matrixContainer = document.getElementById('payoff-matrix-container');
  if (matrixContainer) {
    renderPayoffMatrix(matrixContainer, data.payoff_matrix);
  }
}
