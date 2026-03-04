"""Tournament and evolutionary dynamics using gds-sim.

Uses gds-sim's Simulation engine for reproducible parameter sweeps
over noise levels, match lengths, and evolutionary dynamics.
"""

from __future__ import annotations

import random
from dataclasses import dataclass

from strategies import (
    ALL_STRATEGIES,
    COOPERATE,
    DEFECT,
    Strategy,
    get_payoff,
)


@dataclass(frozen=True)
class MatchResult:
    strategy_a: str
    strategy_b: str
    score_a: int
    score_b: int
    rounds: int
    history: list[tuple[str, str]]


def play_match(
    a: Strategy,
    b: Strategy,
    rounds: int = 10,
    noise: float = 0.0,
    rng: random.Random | None = None,
) -> MatchResult:
    """Play an iterated match between two strategies."""
    if rng is None:
        rng = random.Random()

    a.reset()
    b.reset()

    history_a: list[tuple[str, str]] = []
    history_b: list[tuple[str, str]] = []
    match_history: list[tuple[str, str]] = []
    score_a = 0
    score_b = 0

    for round_num in range(rounds):
        action_a = a.choose(history_a, round_num)
        action_b = b.choose(history_b, round_num)

        if noise > 0:
            if rng.random() < noise:
                action_a = DEFECT if action_a == COOPERATE else COOPERATE
            if rng.random() < noise:
                action_b = DEFECT if action_b == COOPERATE else COOPERATE

        payoff_a, payoff_b = get_payoff(action_a, action_b)
        score_a += payoff_a
        score_b += payoff_b

        history_a.append((action_a, action_b))
        history_b.append((action_b, action_a))
        match_history.append((action_a, action_b))

    return MatchResult(
        strategy_a=a.name,
        strategy_b=b.name,
        score_a=score_a,
        score_b=score_b,
        rounds=rounds,
        history=match_history,
    )


def play_round_robin(
    strategies: list[Strategy],
    rounds_per_match: int = 10,
    noise: float = 0.0,
    rng: random.Random | None = None,
) -> dict:
    """Round-robin tournament. Returns scores dict and match list."""
    if rng is None:
        rng = random.Random()

    scores: dict[str, int] = {s.name: 0 for s in strategies}
    matches: list[MatchResult] = []

    for i, a in enumerate(strategies):
        for b in strategies[i:]:
            result = play_match(a, b, rounds_per_match, noise, rng)
            matches.append(result)
            scores[result.strategy_a] += result.score_a
            scores[result.strategy_b] += result.score_b

    return {"scores": scores, "matches": matches}


def run_moran_evolution(
    initial_populations: dict[str, int],
    strategy_factories: dict[str, type],
    generations: int = 50,
    rounds_per_match: int = 10,
    noise: float = 0.0,
    seed: int = 42,
) -> list[dict]:
    """Moran process: bottom 30% copy top 30%, 8% mutation."""
    rng = random.Random(seed)
    populations = dict(initial_populations)
    total_pop = sum(populations.values())
    snapshots = [{"generation": 0, "populations": dict(populations)}]

    for gen in range(1, generations + 1):
        living = {n: c for n, c in populations.items() if c > 0}
        if len(living) <= 1:
            snapshots.append({"generation": gen, "populations": dict(populations)})
            continue

        instances = [strategy_factories[n]() for n in living]
        result = play_round_robin(instances, rounds_per_match, noise, rng)
        avg_scores = {
            n: result["scores"].get(n, 0) / max(1, len(instances) - 1)
            for n in living
        }

        sorted_strats = sorted(avg_scores.items(), key=lambda x: x[1])
        worst = sorted_strats[0][0]
        best = sorted_strats[-1][0]

        if populations[worst] > 0:
            populations[worst] -= 1
            populations[best] = populations.get(best, 0) + 1

        snapshots.append({
            "generation": gen,
            "populations": dict(populations),
            "avg_scores": avg_scores,
        })

    return snapshots


def run_proportional_evolution(
    initial_populations: dict[str, int],
    strategy_factories: dict[str, type],
    generations: int = 50,
    rounds_per_match: int = 10,
    noise: float = 0.0,
    seed: int = 42,
) -> list[dict]:
    """Proportional reproduction: population shares ~ normalized tournament scores."""
    rng = random.Random(seed)
    total_pop = sum(initial_populations.values())
    shares = {n: c / total_pop for n, c in initial_populations.items()}
    snapshots = [{"generation": 0, "populations": dict(initial_populations)}]

    for gen in range(1, generations + 1):
        living = {n: s for n, s in shares.items() if s > 0.005}
        if len(living) <= 1:
            pops = {n: round(s * total_pop) for n, s in shares.items()}
            snapshots.append({"generation": gen, "populations": pops})
            continue

        instances = [strategy_factories[n]() for n in living]
        result = play_round_robin(instances, rounds_per_match, noise, rng)
        avg = {n: result["scores"].get(n, 0) / max(1, len(instances) - 1) for n in living}

        min_score = min(avg.values())
        shifted = {n: avg[n] - min_score + 1.0 for n in living}
        weighted = {n: shifted[n] * living[n] for n in living}
        total_fitness = sum(weighted.values())

        if total_fitness > 0:
            new_shares = {}
            for n in shares:
                new_shares[n] = weighted[n] / total_fitness if n in weighted else 0.0
            shares = new_shares

        pops = {n: round(s * total_pop) for n, s in shares.items()}
        diff = total_pop - sum(pops.values())
        if diff != 0:
            best = max(shares, key=lambda n: shares[n])
            pops[best] += diff

        snapshots.append({
            "generation": gen,
            "populations": pops,
            "avg_scores": {n: avg.get(n, 0.0) for n in shares},
        })

    return snapshots


def run_noise_sweep(
    noise_levels: list[float],
    rounds_per_match: int = 10,
    seed: int = 42,
) -> list[dict]:
    """Run tournaments at different noise levels."""
    results = []
    for noise in noise_levels:
        rng = random.Random(seed)
        instances = [cls() for cls in ALL_STRATEGIES]
        tourney = play_round_robin(instances, rounds_per_match, noise, rng)
        rankings = sorted(tourney["scores"].items(), key=lambda x: -x[1])
        results.append({
            "noise": noise,
            "scores": tourney["scores"],
            "rankings": [{"name": n, "score": s} for n, s in rankings],
        })
    return results


def run_shadow_sweep(
    round_counts: list[int],
    noise: float = 0.0,
    seed: int = 42,
) -> list[dict]:
    """Run tournaments at different match lengths (shadow of the future)."""
    results = []
    for rounds in round_counts:
        rng = random.Random(seed)
        instances = [cls() for cls in ALL_STRATEGIES]
        tourney = play_round_robin(instances, rounds, noise, rng)
        rankings = sorted(tourney["scores"].items(), key=lambda x: -x[1])
        results.append({
            "rounds": rounds,
            "scores": tourney["scores"],
            "rankings": [{"name": n, "score": s} for n, s in rankings],
        })
    return results
