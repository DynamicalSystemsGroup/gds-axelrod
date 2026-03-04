/*
 * Web Worker: loads Pyodide, runs PSUU sweeps.
 * Uses Pyodide ESM entry point (module worker).
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

      self.postMessage({ type: 'status', phase: 'installing-packages' });
      await pyodide.loadPackage('micropip');

      self.postMessage({ type: 'status', phase: 'loading-model' });
      const base = self.location.href.replace(/\/assets\/.*$/, '/').replace(/\/src\/.*$/, '/');
      const resp = await fetch(base + 'pyodide/psuu_runner.py');
      if (!resp.ok) throw new Error('Failed to fetch psuu_runner.py: ' + resp.status);
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

    const { samples = 30, seed = null, timesteps = 20, runs = 3, initialPop = null } = e.data;

    try {
      const progressCb = (current, total) => {
        self.postMessage({ type: 'progress', current, total });
      };
      pyodide.globals.set('_js_progress', progressCb);

      const seedArg = seed === null ? 'None' : seed;

      // Pass initial_pop as a JSON string via a Python global
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

_result = run_sweep(
    n_samples=${samples},
    seed=${seedArg},
    progress_callback=_progress_wrapper,
    timesteps=${timesteps},
    runs=${runs},
    initial_pop=_initial_pop,
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
