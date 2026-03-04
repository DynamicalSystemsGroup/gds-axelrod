# gds-axelrod

**[Live Site](https://blockscience.github.io/gds-axelrod/)**

Interactive exploration of Axelrod's iterated prisoner's dilemma tournament, built on the [GDS ecosystem](https://github.com/BlockScience/gds-core) — compositional game theory via [gds-games](https://pypi.org/project/gds-games/) (OGS).

Six showcase pages demonstrate different analytical lenses on the same Prisoner's Dilemma model: narrative story, formal structure, visualizations, simulation, Nash analysis, and parameter space search (PSUU). Each page draws from a different GDS representation — one model, many views, none compromised.

## Architecture

```
pipeline/       Python data generation (OGS PatternIR + tournament + sim + PSUU)
site/           Vite frontend (Canvas Petri dish, chapters, showcase pages)
```

## Pages

| Page | View | GDS Source |
|------|------|------------|
| Story (Home) | Narrative chapters + Petri dish sandbox | OGS Pattern + strategy definitions |
| Formal Structure | Canonical decomposition h = f . g | GDSSpec + CanonicalGDS |
| Visualizations | Mermaid diagrams from 6 view types | SystemIR + GDSSpec via gds-viz |
| Simulation | Population trajectories per parameter subset | gds-sim Model |
| Nash Analysis | Equilibria, dominance, Pareto outcomes | PatternIR (OGS) |
| PSUU | Interactive parameter space exploration | gds-psuu + gds-sim (Pyodide) |

## Development

### Pipeline (generate data)

```bash
cd pipeline
uv sync
uv run python generate.py
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

## License

Apache 2.0 — see [LICENSE](LICENSE).
