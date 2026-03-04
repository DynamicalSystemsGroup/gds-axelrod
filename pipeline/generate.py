"""Main pipeline: generates all chapter JSON data for the frontend.

Usage:
    cd pipeline && uv run python generate.py
"""

from __future__ import annotations

import json
from pathlib import Path

from games import build_ir, export_pattern_ir
from gen_formal import generate_formal
from gen_nash import generate_nash
from gen_psuu import generate_psuu
from gen_sim import generate_sim
from gen_tournament_spec import generate_tournament_diagrams
from gen_viz import generate_viz
from strategies import (
    ALL_STRATEGIES,
    STRATEGY_MAP,
    STRATEGY_META,
    AlwaysCooperate,
    AlwaysDefect,
    TitForTat,
    get_payoff,
)
from tournament import (
    play_match,
    play_round_robin,
    run_moran_evolution,
    run_noise_sweep,
    run_proportional_evolution,
    run_shadow_sweep,
)

OUTPUT = Path(__file__).parent / "output"


def write_json(name: str, data: object) -> None:
    path = OUTPUT / name
    path.write_text(json.dumps(data, indent=2, default=str))
    print(f"  -> {path.name} ({path.stat().st_size:,} bytes)")


def generate_strategies() -> None:
    """Export strategy metadata for frontend rendering."""
    write_json("strategies.json", STRATEGY_META)


def generate_chapter1_dilemma() -> None:
    """Ch1: Single interaction between two agents — payoff matrix exploration."""
    # Head-to-head: TfT vs Always Defect
    a, b = TitForTat(), AlwaysDefect()
    result = play_match(a, b, rounds=10)

    data = {
        "title": "The Dilemma",
        "payoff_matrix": {
            "players": ["Alice", "Bob"],
            "actions": ["Cooperate", "Defect"],
            "payoffs": [
                [list(get_payoff("Cooperate", "Cooperate")), list(get_payoff("Cooperate", "Defect"))],
                [list(get_payoff("Defect", "Cooperate")), list(get_payoff("Defect", "Defect"))],
            ],
        },
        "example_match": {
            "strategy_a": result.strategy_a,
            "strategy_b": result.strategy_b,
            "score_a": result.score_a,
            "score_b": result.score_b,
            "rounds": result.rounds,
            "history": result.history,
        },
    }
    write_json("chapter1_dilemma.json", data)


def generate_chapter2_tournament() -> None:
    """Ch2: Round-robin tournament with all 9 strategies."""
    instances = [cls() for cls in ALL_STRATEGIES]
    result = play_round_robin(instances, rounds_per_match=10)

    rankings = sorted(result["scores"].items(), key=lambda x: -x[1])

    # Build heatmap: strategy vs strategy scores
    heatmap = {}
    for m in result["matches"]:
        heatmap.setdefault(m.strategy_a, {})[m.strategy_b] = m.score_a
        if m.strategy_a != m.strategy_b:
            heatmap.setdefault(m.strategy_b, {})[m.strategy_a] = m.score_b

    data = {
        "title": "The Tournament",
        "rounds_per_match": 10,
        "rankings": [{"name": n, "score": s} for n, s in rankings],
        "heatmap": heatmap,
        "total_matches": len(result["matches"]),
    }
    write_json("chapter2_tournament.json", data)


def generate_chapter3_evolution() -> None:
    """Ch3: Evolutionary dynamics — Moran process + proportional reproduction."""
    pop_each = 10
    initial = {cls().name: pop_each for cls in ALL_STRATEGIES}
    factories = {cls().name: cls for cls in ALL_STRATEGIES}

    moran = run_moran_evolution(
        initial, factories, generations=100, rounds_per_match=10, seed=42,
    )
    proportional = run_proportional_evolution(
        initial, factories, generations=100, rounds_per_match=10, seed=42,
    )

    data = {
        "title": "Evolution",
        "initial_populations": initial,
        "moran": moran,
        "proportional": proportional,
    }
    write_json("chapter3_evolution.json", data)


def generate_chapter4_noise() -> None:
    """Ch4: Noise sweep — how trembling hand changes the game."""
    noise_levels = [round(n * 0.01, 2) for n in range(0, 31, 2)]
    sweep = run_noise_sweep(noise_levels, rounds_per_match=10, seed=42)

    data = {
        "title": "Noise & Forgiveness",
        "noise_levels": noise_levels,
        "sweep": sweep,
    }
    write_json("chapter4_noise.json", data)


def generate_chapter5_shadow() -> None:
    """Ch5: Shadow of the future — match length sweep."""
    round_counts = [1, 2, 3, 5, 10, 20, 50, 100, 200]
    sweep = run_shadow_sweep(round_counts, noise=0.0, seed=42)

    data = {
        "title": "Shadow of the Future",
        "round_counts": round_counts,
        "sweep": sweep,
    }
    write_json("chapter5_shadow.json", data)


def main() -> None:
    OUTPUT.mkdir(exist_ok=True)
    print("Generating gds-axelrod data...\n")

    print("[strategies]")
    generate_strategies()

    print("\n[chapter 1: The Dilemma]")
    generate_chapter1_dilemma()

    print("\n[chapter 2: The Tournament]")
    generate_chapter2_tournament()

    print("\n[chapter 3: Evolution]")
    generate_chapter3_evolution()

    print("\n[chapter 4: Noise & Forgiveness]")
    generate_chapter4_noise()

    print("\n[chapter 5: Shadow of the Future]")
    generate_chapter5_shadow()

    print("\n[PatternIR]")
    export_pattern_ir(OUTPUT)
    print(f"  -> pattern_ir.json")

    print("\n[Formal Structure]")
    write_json("formal.json", generate_formal(OUTPUT))

    print("\n[Visualizations]")
    write_json("viz_diagrams.json", generate_viz(OUTPUT))

    print("\n[Simulation]")
    write_json("sim_results.json", generate_sim(OUTPUT))

    print("\n[Tournament GDSSpec]")
    write_json("tournament_spec.json", generate_tournament_diagrams())

    print("\n[Nash Analysis]")
    write_json("nash_analysis.json", generate_nash(OUTPUT))

    print("\n[PSUU Analysis]")
    write_json("psuu_results.json", generate_psuu(OUTPUT))

    print("\nDone! All data in pipeline/output/")


if __name__ == "__main__":
    main()
