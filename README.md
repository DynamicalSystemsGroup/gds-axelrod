# gds-axelrod

Interactive exploration of Axelrod's iterated prisoner's dilemma tournament, built on [gds-games](https://github.com/BlockScience/gds-core) (OGS) compositional game theory.

Scroll-driven narrative (5 chapters) + real-time Petri dish sandbox. Lab-notebook aesthetic.

## Architecture

```
pipeline/       Python data generation (OGS PatternIR + tournament simulations)
site/           Vite + GSAP frontend (Canvas Petri dish, scroll-driven chapters)
visual_layout.md  Design reference (self-contained HTML prototype)
```

## Development

### Pipeline (generate data)

```bash
cd pipeline
uv venv
uv pip install -e ../../gds-core/packages/gds-games -e ../../gds-core/packages/gds-framework
.venv/bin/python generate.py
cp output/*.json ../site/public/data/
```

### Site (dev server)

```bash
cd site
npm install
npm run dev
```

### Build

```bash
cd site
npm run build    # outputs to site/dist/
```

## Chapters

| # | Title | Key Visual |
|---|-------|------------|
| 1 | The Dilemma | Payoff matrix + OGS PatternIR game tree |
| 2 | The Tournament | Heatmap grid + rankings |
| 3 | Evolution | Stacked area (Moran vs Proportional) |
| 4 | Noise & Forgiveness | Strategy ranking crossover |
| 5 | Shadow of the Future | Score vs rounds sweep |
| Sandbox | The Petri Dish | Real-time evolutionary simulation |
