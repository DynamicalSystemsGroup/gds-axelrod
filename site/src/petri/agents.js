/**
 * Agent model and Brownian motion for the Petri dish.
 */

const STRATS = {
  'Tit for Tat':       { short: 'TfT',   color: '#4a90d9' },
  'Always Cooperate':  { short: 'Coop',  color: '#6bc46b' },
  'Always Defect':     { short: 'Def',   color: '#e74c3c' },
  'Grim Trigger':      { short: 'Grud',  color: '#9b59b6' },
  'Detective':         { short: 'Det',   color: '#f39c12' },
  'Random':            { short: 'Rnd',   color: '#95a5a6' },
  'Generous TFT':      { short: 'GTFT',  color: '#2ecc71' },
  'Tit for Two Tats':  { short: 'Tf2T',  color: '#3498db' },
  'Pavlov':            { short: 'Pav',   color: '#e67e22' },
};

const STRAT_KEYS = Object.keys(STRATS);

export function getStratColor(name) {
  return STRATS[name]?.color || '#888';
}

export function getStratShort(name) {
  return STRATS[name]?.short || name.slice(0, 4);
}

export function getStratKeys() {
  return STRAT_KEYS;
}

export function getStratMeta() {
  return STRATS;
}

function rnd(a, b) { return a + Math.random() * (b - a); }

export function createAgent(id, stratName) {
  return {
    id,
    strategy: stratName,
    score: 0,
    x: rnd(0.05, 0.95),
    y: rnd(0.05, 0.95),
    vx: rnd(-0.001, 0.001),
    vy: rnd(-0.001, 0.001),
    r: rnd(0.012, 0.022),
    pulse: Math.random() * Math.PI * 2,
    flash: 0,
  };
}

export function createPopulation(n = 120) {
  const agents = [];
  for (let i = 0; i < n; i++) {
    const k = STRAT_KEYS[i % STRAT_KEYS.length];
    agents.push(createAgent(i, k));
  }
  return agents;
}

export function moveAgents(agents, dt) {
  for (const a of agents) {
    a.x += a.vx * dt * 60;
    a.y += a.vy * dt * 60;
    // Brownian nudge
    a.vx += (Math.random() - 0.5) * 0.00008;
    a.vy += (Math.random() - 0.5) * 0.00008;
    // Damping
    a.vx *= 0.995;
    a.vy *= 0.995;
    // Clamp to circle
    const cx = a.x - 0.5, cy = a.y - 0.5;
    const d = Math.sqrt(cx * cx + cy * cy);
    if (d > 0.46) {
      const nx = cx / d, ny = cy / d;
      a.vx -= nx * 0.002;
      a.vy -= ny * 0.002;
      a.x = 0.5 + nx * 0.45;
      a.y = 0.5 + ny * 0.45;
    }
  }
}
