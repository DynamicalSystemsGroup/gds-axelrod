/*
 * Web Worker: loads Pyodide, runs custom evolutionary simulations.
 */

let pyodide = null;
let runnerCode = null;

self.onmessage = async function (e) {
  const { type } = e.data;

  if (type === 'init') {
    try {
      self.postMessage({ type: 'status', phase: 'loading-runtime' });
      const { loadPyodide } = await import(
        'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.mjs'
      );
      pyodide = await loadPyodide();

      self.postMessage({ type: 'status', phase: 'loading-model' });
      const base = self.location.href.replace(/\/assets\/.*$/, '/').replace(/\/src\/.*$/, '/');
      const resp = await fetch(base + 'pyodide/sim_runner.py');
      if (!resp.ok) throw new Error('Failed to fetch sim_runner.py: ' + resp.status);
      runnerCode = await resp.text();
      pyodide.runPython(runnerCode);

      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message || String(err) });
    }
    return;
  }

  if (type === 'run') {
    if (!pyodide || !runnerCode) {
      self.postMessage({ type: 'error', message: 'Pyodide not initialized' });
      return;
    }

    const {
      noise = 0.05,
      rounds_per_match = 10,
      timesteps = 30,
      mutation_rate = 0.05,
      selection_pressure = 0.2,
      seed = null,
      initialPop = null,
    } = e.data;

    try {
      const progressCb = (current, total) => {
        self.postMessage({ type: 'progress', current, total });
      };
      pyodide.globals.set('_js_progress', progressCb);

      const seedArg = seed === null ? 'None' : seed;

      if (initialPop) {
        pyodide.globals.set('_js_initial_pop_json', JSON.stringify(initialPop));
      } else {
        pyodide.globals.set('_js_initial_pop_json', '');
      }

      const code = `
import json

def _progress_wrapper(current, total):
    _js_progress(current, total)

_initial_pop = json.loads(_js_initial_pop_json) if _js_initial_pop_json else None

_result = run_simulation_with_trajectory(
    noise=${noise},
    rounds_per_match=${rounds_per_match},
    timesteps=${timesteps},
    mutation_rate=${mutation_rate},
    selection_pressure=${selection_pressure},
    seed=${seedArg},
    initial_pop=_initial_pop,
    progress_callback=_progress_wrapper,
)
json.dumps(_result)
`;
      const jsonStr = pyodide.runPython(code);
      const data = JSON.parse(jsonStr);
      self.postMessage({ type: 'result', data });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message || String(err) });
    }
  }
};
