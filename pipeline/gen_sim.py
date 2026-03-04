"""Generate gds-sim simulation data: PD tournament as a proper Model/Simulation.

Showcases: gds-sim (Model, StateUpdateBlock, Simulation, Results).
"""

from __future__ import annotations

import random
from pathlib import Path

from gds_sim import Model, Simulation, StateUpdateBlock

from strategies import ALL_STRATEGIES, STRATEGY_MAP
from tournament import play_match


def _play_round_robin_scores(agent_names: list[str], rounds: int, noise: float) -> dict[str, int]:
    """Play a round-robin and return total scores per agent name."""
    scores = {name: 0 for name in agent_names}
    unique_strategies = list(set(agent_names))

    for i, name_a in enumerate(unique_strategies):
        for name_b in unique_strategies[i:]:
            count_a = agent_names.count(name_a)
            count_b = agent_names.count(name_b)
            a = STRATEGY_MAP[name_a]()
            b = STRATEGY_MAP[name_b]()
            result = play_match(a, b, rounds=rounds, noise=noise)
            scores[name_a] += result.score_a * count_b
            scores[name_b] += result.score_b * count_a
            if name_a == name_b:
                # Self-play already counted both directions
                scores[name_a] -= result.score_a  # Remove double-count

    return scores


# ── SUBs (State Update Functions) ──

def policy_tournament(state, params, **kw):
    """Play round-robin tournament, return per-strategy scores."""
    agents = state["agents"]
    scores = _play_round_robin_scores(
        agents, rounds=params["rounds_per_match"], noise=params["noise"]
    )
    return {"scores": scores}


def suf_update_scores(state, params, signal=None, **kw):
    """Update scores from tournament results."""
    return ("scores", dict(signal["scores"]))


def suf_evolve(state, params, signal=None, **kw):
    """Evolutionary selection: top strategies reproduce, bottom die."""
    agents = list(state["agents"])
    scores = state["scores"]

    if not scores or all(v == 0 for v in scores.values()):
        return ("agents", agents)

    # Rank agents by their strategy's score
    agent_scores = [(i, scores.get(a, 0)) for i, a in enumerate(agents)]
    agent_scores.sort(key=lambda x: x[1])

    n = len(agents)
    bottom_n = max(1, n // 5)  # Bottom 20% replaced
    top_n = max(1, n // 5)     # By copies of top 20%

    top_names = [agents[i] for i, _ in agent_scores[-top_n:]]
    bottom_indices = [i for i, _ in agent_scores[:bottom_n]]

    rng = random.Random(state["generation"] + kw.get("timestep", 0))
    for idx in bottom_indices:
        agents[idx] = rng.choice(top_names)

    # Mutation: 5% chance any agent switches to a random strategy
    all_strat_names = list(STRATEGY_MAP.keys())
    for i in range(n):
        if rng.random() < 0.05:
            agents[i] = rng.choice(all_strat_names)

    return ("agents", agents)


def suf_advance_gen(state, params, signal=None, **kw):
    """Increment generation counter."""
    return ("generation", state["generation"] + 1)


def generate_sim(output: Path) -> dict:
    """Run PD tournament as gds-sim Model with parameter sweep."""
    # Initial population: equal distribution
    strat_names = [cls().name for cls in ALL_STRATEGIES]
    pop_per_strat = 4
    initial_agents = []
    for name in strat_names:
        initial_agents.extend([name] * pop_per_strat)

    model = Model(
        initial_state={
            "agents": list(initial_agents),
            "scores": {name: 0 for name in strat_names},
            "generation": 0,
        },
        state_update_blocks=[
            StateUpdateBlock(
                policies={"tournament": policy_tournament},
                variables={
                    "scores": suf_update_scores,
                },
            ),
            StateUpdateBlock(
                policies={},
                variables={
                    "agents": suf_evolve,
                    "generation": suf_advance_gen,
                },
            ),
        ],
        params={
            "noise": [0.0, 0.05, 0.1],
            "rounds_per_match": [5, 10, 20],
        },
    )

    sim = Simulation(model=model, timesteps=30, runs=1)
    results = sim.run()
    rows = results.to_list()

    # Organize by subset for frontend
    # gds-sim uses substeps: ts=0/sub=0 is initial state, then ts=N has
    # sub=1 (block 1: tournament+scores) and sub=2 (block 2: evolve+gen).
    # We want the last substep per timestep (the fully-evolved state).
    n_blocks = len(model.state_update_blocks)
    param_subsets = model._param_subsets

    subsets = {}
    for row in rows:
        subset_id = row.get("subset", 0)
        if subset_id not in subsets:
            # Map subset index to actual param values
            params = param_subsets[subset_id] if subset_id < len(param_subsets) else {}
            subsets[subset_id] = {
                "params": {k: v for k, v in params.items()},
                "trajectory": [],
            }

        ts = row.get("timestep", 0)
        sub = row.get("substep", 0)

        # Take last substep per timestep (sub=0 for ts=0, sub=n_blocks for ts>0)
        is_final = (ts == 0 and sub == 0) or (ts > 0 and sub == n_blocks)
        if not is_final:
            continue

        agents = row.get("agents", [])
        counts = {}
        for a in agents:
            counts[a] = counts.get(a, 0) + 1

        subsets[subset_id]["trajectory"].append({
            "timestep": ts,
            "generation": row.get("generation", 0),
            "population_counts": counts,
            "total_agents": len(agents),
        })

    # Extract param subsets info
    param_grid = []
    for subset_id in sorted(subsets.keys()):
        param_grid.append(subsets[subset_id]["params"])

    data = {
        "title": "Simulation",
        "description": "PD tournament modeled as a gds-sim simulation with parameter sweeps.",
        "model": {
            "initial_state_keys": list(model.initial_state.keys()),
            "state_update_blocks": [
                {
                    "policies": list(sub.policies.keys()),
                    "variables": list(sub.variables.keys()),
                }
                for sub in model.state_update_blocks
            ],
            "param_space": {k: v for k, v in model.params.items()},
        },
        "simulation": {
            "timesteps": sim.timesteps,
            "runs": sim.runs,
            "total_param_subsets": len(subsets),
        },
        "param_grid": param_grid,
        "subsets": {str(k): v for k, v in subsets.items()},
        "strategy_names": strat_names,
    }

    return data
