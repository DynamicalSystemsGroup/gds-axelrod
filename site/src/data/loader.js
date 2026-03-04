/**
 * Data loader — fetches pre-computed JSON from public/data/.
 */

const cache = new Map();

export async function loadJSON(filename) {
  if (cache.has(filename)) return cache.get(filename);
  const resp = await fetch(`./data/${filename}`);
  if (!resp.ok) throw new Error(`Failed to load ${filename}: ${resp.status}`);
  const data = await resp.json();
  cache.set(filename, data);
  return data;
}

export async function loadStrategies() {
  return loadJSON('strategies.json');
}

export async function loadChapter(num) {
  const files = {
    1: 'chapter1_dilemma.json',
    2: 'chapter2_tournament.json',
    3: 'chapter3_evolution.json',
    4: 'chapter4_noise.json',
    5: 'chapter5_shadow.json',
  };
  return loadJSON(files[num]);
}

export async function loadPatternIR() {
  return loadJSON('pattern_ir.json');
}

export async function loadFormal() {
  return loadJSON('formal.json');
}

export async function loadVizDiagrams() {
  return loadJSON('viz_diagrams.json');
}

export async function loadSimResults() {
  return loadJSON('sim_results.json');
}

export async function loadNashAnalysis() {
  return loadJSON('nash_analysis.json');
}

export async function loadPsuuResults() {
  return loadJSON('psuu_results.json');
}
