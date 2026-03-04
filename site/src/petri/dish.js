/**
 * Petri dish Canvas renderer — draws agents with translucent cell aesthetic.
 */

import { getStratColor } from './agents.js';

export function sizeDish() {
  const petri = document.getElementById('petri');
  const area = document.getElementById('dish-area');
  const availW = area.clientWidth - 24;
  const availH = area.clientHeight - 60;
  const D = Math.max(220, Math.min(availW, availH, 680));
  petri.width = D;
  petri.height = D;
  const wrap = document.getElementById('dish-wrap');
  wrap.style.width = D + 'px';
  wrap.style.height = D + 'px';

  const chartWrap = document.getElementById('chart-wrap');
  const chartCanvas = document.getElementById('chart');
  if (chartWrap && chartCanvas) {
    chartCanvas.width = Math.max(100, chartWrap.clientWidth - 26);
  }
}

export function drawDish(agents, dt) {
  const petri = document.getElementById('petri');
  const ctx = petri.getContext('2d');
  const W = petri.width, H = petri.height, R = W / 2;
  ctx.clearRect(0, 0, W, H);

  ctx.save();
  ctx.beginPath();
  ctx.arc(R, R, R - 2, 0, Math.PI * 2);
  ctx.clip();

  // Agar background
  const bg = ctx.createRadialGradient(R * 0.85, R * 0.7, 0, R, R, R);
  bg.addColorStop(0, '#faf8f3');
  bg.addColorStop(1, '#ede9e0');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = 'rgba(0,0,0,0.04)';
  ctx.lineWidth = 0.5;
  const gs = W / 16;
  for (let x = gs; x < W; x += gs) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
  for (let y = gs; y < H; y += gs) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

  // Draw agents
  for (const a of agents) {
    a.pulse += dt * (1.8 + a.flash * 4);
    if (a.flash > 0) a.flash = Math.max(0, a.flash - dt);

    const ax = a.x * W, ay = a.y * H;
    const pr = a.r * W;
    const pulseMod = 1 + Math.sin(a.pulse) * 0.06;
    const cr = pr * pulseMod;
    const col = getStratColor(a.strategy);

    // Glow halo when flashing
    if (a.flash > 0) {
      const g = ctx.createRadialGradient(ax, ay, cr * 0.5, ax, ay, cr * 3.5);
      g.addColorStop(0, col + '55');
      g.addColorStop(1, col + '00');
      ctx.beginPath();
      ctx.arc(ax, ay, cr * 3.5, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    }

    // Shadow
    const shadow = ctx.createRadialGradient(ax + cr * 0.15, ay + cr * 0.15, 0, ax, ay, cr * 1.6);
    shadow.addColorStop(0, 'rgba(0,0,0,0.10)');
    shadow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(ax, ay, cr * 1.6, 0, Math.PI * 2);
    ctx.fillStyle = shadow;
    ctx.fill();

    // Body fill — translucent cell
    const grad = ctx.createRadialGradient(ax - cr * 0.3, ay - cr * 0.3, cr * 0.05, ax, ay, cr);
    grad.addColorStop(0, col + 'dd');
    grad.addColorStop(0.6, col + '99');
    grad.addColorStop(1, col + '44');
    ctx.beginPath();
    ctx.arc(ax, ay, cr, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Cell membrane
    ctx.beginPath();
    ctx.arc(ax, ay, cr, 0, Math.PI * 2);
    ctx.strokeStyle = col + 'bb';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Inner nucleus
    ctx.beginPath();
    ctx.arc(ax - cr * 0.22, ay - cr * 0.22, cr * 0.22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.fill();
  }

  // Interaction arcs
  const flashing = agents.filter(a => a.flash > 0.3);
  if (flashing.length >= 2) {
    for (let i = 0; i < Math.min(flashing.length - 1, 4); i += 2) {
      const a = flashing[i], b = flashing[i + 1];
      const ax = a.x * W, ay = a.y * H, bx = b.x * W, by = b.y * H;
      const alpha = Math.min(a.flash, b.flash) * 0.25;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      const mx = (ax + bx) / 2 + (ay - by) * 0.15;
      const my = (ay + by) / 2 + (bx - ax) * 0.15;
      ctx.quadraticCurveTo(mx, my, bx, by);
      ctx.strokeStyle = `rgba(100,100,100,${alpha})`;
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }
  }

  ctx.restore();
}
