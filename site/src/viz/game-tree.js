/**
 * PatternIR → visual game tree diagram (Canvas-based).
 */

export function renderGameTree(container, patternIR) {
  if (!patternIR || !patternIR.patterns || !patternIR.patterns[0]) {
    container.innerHTML = '<p style="color:var(--ink-dim);font-size:0.7rem">No PatternIR data</p>';
    return;
  }

  const pattern = patternIR.patterns[0];
  const { games, flows } = pattern;

  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.width = 560;
  canvas.height = 260;
  canvas.style.width = '100%';
  canvas.style.height = '260px';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;

  // Layout: position games in a tree
  const positions = {};
  const gameList = games || [];
  const centerX = W / 2;
  const topY = 50;

  if (gameList.length === 3) {
    // Typical PD layout: two decisions on top, payoff below
    positions[gameList[0].name] = { x: centerX - 120, y: topY };
    positions[gameList[1].name] = { x: centerX + 120, y: topY };
    positions[gameList[2].name] = { x: centerX, y: topY + 120 };
  } else {
    // Generic layout
    gameList.forEach((g, i) => {
      const angle = (i / gameList.length) * Math.PI * 2 - Math.PI / 2;
      positions[g.name] = {
        x: centerX + Math.cos(angle) * 140,
        y: H / 2 + Math.sin(angle) * 80,
      };
    });
  }

  // Draw flows (edges)
  const flowList = flows || [];
  ctx.lineWidth = 1.5;
  flowList.forEach(f => {
    const from = positions[f.source];
    const to = positions[f.target];
    if (!from || !to) return;

    const isFeedback = f.is_feedback || f.direction === 'contravariant';
    ctx.strokeStyle = isFeedback ? '#e74c3c88' : '#4a90d988';
    ctx.setLineDash(isFeedback ? [4, 3] : []);

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);

    if (isFeedback) {
      // Curved feedback arrow
      const mx = (from.x + to.x) / 2;
      const my = Math.max(from.y, to.y) + 50;
      ctx.quadraticCurveTo(mx, my, to.x, to.y);
    } else {
      ctx.lineTo(to.x, to.y);
    }
    ctx.stroke();

    // Arrow head
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    ctx.beginPath();
    ctx.moveTo(to.x, to.y);
    ctx.lineTo(to.x - 8 * Math.cos(angle - 0.3), to.y - 8 * Math.sin(angle - 0.3));
    ctx.lineTo(to.x - 8 * Math.cos(angle + 0.3), to.y - 8 * Math.sin(angle + 0.3));
    ctx.closePath();
    ctx.fillStyle = isFeedback ? '#e74c3c88' : '#4a90d988';
    ctx.fill();
  });

  ctx.setLineDash([]);

  // Draw game nodes
  const typeColors = {
    'decision': '#4a90d9',
    'function_covariant': '#6bc46b',
    'function_contravariant': '#e74c3c',
  };

  gameList.forEach(g => {
    const pos = positions[g.name];
    if (!pos) return;

    const color = typeColors[g.game_type] || '#8a8278';
    const r = 28;

    // Node circle
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fillStyle = color + '22';
    ctx.fill();
    ctx.strokeStyle = color + 'aa';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    ctx.fillStyle = '#2a2520';
    ctx.font = '10px IBM Plex Mono';
    ctx.textAlign = 'center';
    const words = g.name.split(' ');
    if (words.length <= 2) {
      ctx.fillText(g.name, pos.x, pos.y + 4);
    } else {
      ctx.fillText(words.slice(0, 2).join(' '), pos.x, pos.y - 2);
      ctx.fillText(words.slice(2).join(' '), pos.x, pos.y + 10);
    }

    // Type badge
    ctx.font = '8px IBM Plex Mono';
    ctx.fillStyle = color + 'aa';
    const typeLabel = g.game_type === 'decision' ? 'Decision' : 'Function';
    ctx.fillText(typeLabel, pos.x, pos.y + r + 14);
  });

  ctx.textAlign = 'start';

  // Title
  ctx.fillStyle = '#8a8278';
  ctx.font = '10px IBM Plex Mono';
  ctx.fillText('OGS PatternIR: ' + pattern.name, 10, 18);

  // Legend
  ctx.fillText('— forward flow', W - 140, H - 30);
  ctx.strokeStyle = '#4a90d988';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(W - 155, H - 33);
  ctx.lineTo(W - 145, H - 33);
  ctx.stroke();

  ctx.fillText('--- feedback', W - 140, H - 14);
  ctx.strokeStyle = '#e74c3c88';
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(W - 155, H - 17);
  ctx.lineTo(W - 145, H - 17);
  ctx.stroke();
  ctx.setLineDash([]);
}
