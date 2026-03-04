/**
 * Petri dish controls: speed, pause, shock, reset.
 */

const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];

export function initControls(state) {
  state.paused = false;
  state.speed = 1;
  state.spdIdx = 2;

  document.getElementById('btn-pause').addEventListener('click', () => {
    state.paused = !state.paused;
    const b = document.getElementById('btn-pause');
    b.textContent = state.paused ? '▶ Play' : '⏸ Pause';
    b.classList.toggle('on', !state.paused);
  });

  document.getElementById('btn-fast').addEventListener('click', () => {
    state.spdIdx = Math.min(state.spdIdx + 1, SPEEDS.length - 1);
    state.speed = SPEEDS[state.spdIdx];
    document.getElementById('spd').textContent = state.speed + '×';
  });

  document.getElementById('btn-slow').addEventListener('click', () => {
    state.spdIdx = Math.max(state.spdIdx - 1, 0);
    state.speed = SPEEDS[state.spdIdx];
    document.getElementById('spd').textContent = state.speed + '×';
  });

  document.getElementById('btn-shock').addEventListener('click', () => {
    if (state.onShock) state.onShock();
  });

  document.getElementById('btn-reset').addEventListener('click', () => {
    if (state.onReset) state.onReset();
  });
}
