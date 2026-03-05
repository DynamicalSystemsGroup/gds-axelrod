"""Generate gds-psuu analysis data: parameter space exploration for the PD tournament.

Showcases: gds-psuu (Sweep, ParameterSpace, KPI, RandomSearchOptimizer).

Answers: "Which parameter combination maximizes cooperation?"
"""

from __future__ import annotations

from collections import Counter
from pathlib import Path

from gds_psuu import (
    Continuous,
    Integer,
    KPI,
    ParameterSpace,
    RandomSearchOptimizer,
    Sweep,
    WeightedSum,
)
from gds_psuu.sensitivity import OATAnalyzer
from gds_psuu.evaluation import Evaluator
from gds_sim import Model, Results, StateUpdateBlock

from gen_sim import (
    _play_round_robin_scores,
    policy_tournament,
    suf_advance_gen,
    suf_evolve,
    suf_update_scores,
)
from strategies import ALL_STRATEGIES, STRATEGY_MAP

COOPERATIVE_STRATEGIES = frozenset(
    {"Tit For Tat", "Generous TfT", "Tit For Two Tats", "Always Cooperate", "Pavlov"}
)


# ── KPI functions ──


def _final_agents(results: Results) -> list[str]:
    """Extract final-timestep agent list from results."""
    rows = results.to_list()
    if not rows:
        return []
    last = rows[-1]
    return last.get("agents", [])


def cooperation_rate(results: Results) -> float:
    """Fraction of cooperative strategies in the final population."""
    agents = _final_agents(results)
    if not agents:
        return 0.0
    cooperative = sum(1 for a in agents if a in COOPERATIVE_STRATEGIES)
    return cooperative / len(agents)


def diversity(results: Results) -> float:
    """Number of unique strategies surviving at final timestep."""
    agents = _final_agents(results)
    return float(len(set(agents)))


def winner_share(results: Results) -> float:
    """Population share of the most dominant strategy."""
    agents = _final_agents(results)
    if not agents:
        return 0.0
    counts = Counter(agents)
    return max(counts.values()) / len(agents)


# ── Pipeline entry point ──


def generate_psuu(output: Path) -> dict:
    """Run PSUU analysis on the PD tournament model."""
    strat_names = [cls().name for cls in ALL_STRATEGIES]
    pop_per_strat = 4
    initial_agents = []
    for name in strat_names:
        initial_agents.extend([name] * pop_per_strat)

    # Base model with NO params — PSUU injects them per evaluation
    model = Model(
        initial_state={
            "agents": list(initial_agents),
            "scores": {name: 0 for name in strat_names},
            "generation": 0,
        },
        state_update_blocks=[
            StateUpdateBlock(
                policies={"tournament": policy_tournament},
                variables={"scores": suf_update_scores},
            ),
            StateUpdateBlock(
                policies={},
                variables={
                    "agents": suf_evolve,
                    "generation": suf_advance_gen,
                },
            ),
        ],
    )

    space = ParameterSpace(
        params={
            "noise": Continuous(min_val=0.0, max_val=0.15),
            "rounds_per_match": Integer(min_val=3, max_val=25),
        }
    )

    kpis = [
        KPI(name="cooperation_rate", fn=cooperation_rate),
        KPI(name="diversity", fn=diversity),
        KPI(name="winner_share", fn=winner_share),
    ]

    optimizer = RandomSearchOptimizer(n_samples=30, seed=42)

    sweep = Sweep(
        model=model,
        space=space,
        kpis=kpis,
        optimizer=optimizer,
        timesteps=20,
        runs=3,
    )

    results = sweep.run()

    # Build output
    best_per_kpi = {}
    for kpi_name in results.kpi_names:
        maximize = kpi_name != "winner_share"  # lower winner_share = more balanced
        best = results.best(kpi_name, maximize=maximize)
        best_per_kpi[kpi_name] = {
            "params": best.params,
            "score": best.scores[kpi_name],
            "all_scores": best.scores,
            "maximize": maximize,
        }

    summaries = [
        {"params": s.params, "scores": s.scores} for s in results.summaries
    ]

    # Sensitivity analysis (OAT)
    evaluator = Evaluator(base_model=model, kpis=kpis, timesteps=20, runs=3)
    oat = OATAnalyzer(n_levels=5)
    sensitivity_result = oat.analyze(evaluator, space)

    # Format sensitivity for JSON
    sensitivity = {
        "method": sensitivity_result.method,
        "indices": {},
    }
    for kpi_name in results.kpi_names:
        sensitivity["indices"][kpi_name] = {}
        for param_name in space.params:
            metrics = sensitivity_result.indices[kpi_name][param_name]
            sensitivity["indices"][kpi_name][param_name] = {
                "mean_effect": metrics["mean_effect"],
                "relative_effect": metrics["relative_effect"],
            }

    # Multi-KPI objective examples
    objective_examples = [
        {
            "name": "Maximize Cooperation",
            "weights": {"cooperation_rate": 1.0, "diversity": 0.0, "winner_share": 0.0},
        },
        {
            "name": "Balanced (Coop + Diversity)",
            "weights": {"cooperation_rate": 0.6, "diversity": 0.3, "winner_share": -0.1},
        },
        {
            "name": "Diversity First",
            "weights": {"cooperation_rate": 0.2, "diversity": 0.8, "winner_share": -0.2},
        },
    ]

    data = {
        "title": "PSUU Analysis",
        "description": (
            "Parameter Space Uncertainty & Sensitivity analysis: "
            "which noise/rounds combination maximizes cooperation?"
        ),
        "space": {
            "noise": {"type": "continuous", "min": 0.0, "max": 0.15},
            "rounds_per_match": {"type": "integer", "min": 3, "max": 25},
        },
        "optimizer": {
            "type": "RandomSearch",
            "n_samples": 30,
            "seed": 42,
        },
        "simulation": {
            "timesteps": 20,
            "runs": 3,
        },
        "kpis": {
            "cooperation_rate": "Fraction of cooperative strategies in final population",
            "diversity": "Number of unique strategies surviving",
            "winner_share": "Population share of most dominant strategy (lower = more balanced)",
        },
        "best_per_kpi": best_per_kpi,
        "evaluations": summaries,
        "total_evaluations": len(summaries),
        "strategy_names": strat_names,
        "sensitivity": sensitivity,
        "objective_examples": objective_examples,
    }

    return data
