"""Self-contained simulation runner for Pyodide.

Runs evolutionary tournament simulations and returns full trajectories.
Entry point: run_simulation_with_trajectory(params)
"""

import random
from collections import Counter

# ── Constants ──

COOPERATE = "Cooperate"
DEFECT = "Defect"

R, T, S, P = 2, 3, -1, 0

PAYOFF_TABLE = {
    (COOPERATE, COOPERATE): (R, R),
    (COOPERATE, DEFECT): (S, T),
    (DEFECT, COOPERATE): (T, S),
    (DEFECT, DEFECT): (P, P),
}

COOPERATIVE_STRATEGIES = frozenset(
    {"Tit for Tat", "Generous TFT", "Tit for Two Tats", "Always Cooperate", "Pavlov"}
)


# ── Strategies ──

class AlwaysCooperate:
    name = "Always Cooperate"
    def choose(self, history, round_num):
        return COOPERATE
    def reset(self):
        pass

class AlwaysDefect:
    name = "Always Defect"
    def choose(self, history, round_num):
        return DEFECT
    def reset(self):
        pass

class TitForTat:
    name = "Tit for Tat"
    def choose(self, history, round_num):
        if not history:
            return COOPERATE
        return history[-1][1]
    def reset(self):
        pass

class GrimTrigger:
    name = "Grim Trigger"
    def __init__(self):
        self._triggered = False
    def choose(self, history, round_num):
        if self._triggered:
            return DEFECT
        if history and history[-1][1] == DEFECT:
            self._triggered = True
            return DEFECT
        return COOPERATE
    def reset(self):
        self._triggered = False

class Detective:
    name = "Detective"
    _probe = [COOPERATE, DEFECT, COOPERATE, COOPERATE]
    def __init__(self):
        self._exploit = False
    def choose(self, history, round_num):
        if round_num < 4:
            return self._probe[round_num]
        if round_num == 4:
            self._exploit = not any(h[1] == DEFECT for h in history[:4])
        if self._exploit:
            return DEFECT
        return history[-1][1] if history else COOPERATE
    def reset(self):
        self._exploit = False

class TitForTwoTats:
    name = "Tit for Two Tats"
    def choose(self, history, round_num):
        if len(history) < 2:
            return COOPERATE
        if history[-1][1] == DEFECT and history[-2][1] == DEFECT:
            return DEFECT
        return COOPERATE
    def reset(self):
        pass

class Pavlov:
    name = "Pavlov"
    def choose(self, history, round_num):
        if not history:
            return COOPERATE
        my_last, opp_last = history[-1]
        if my_last == opp_last:
            return my_last
        return DEFECT if my_last == COOPERATE else COOPERATE
    def reset(self):
        pass

class GenerousTitForTat:
    name = "Generous TFT"
    def __init__(self, generosity=1/3, seed=42):
        self._generosity = generosity
        self._seed = seed
        self._rng = random.Random(seed)
    def choose(self, history, round_num):
        if not history:
            return COOPERATE
        if history[-1][1] == DEFECT:
            return COOPERATE if self._rng.random() < self._generosity else DEFECT
        return COOPERATE
    def reset(self):
        self._rng = random.Random(self._seed)

class RandomStrategy:
    name = "Random"
    def __init__(self, seed=42):
        self._seed = seed
        self._rng = random.Random(seed)
    def choose(self, history, round_num):
        return COOPERATE if self._rng.random() < 0.5 else DEFECT
    def reset(self):
        self._rng = random.Random(self._seed)


ALL_STRATEGIES = [
    AlwaysCooperate, AlwaysDefect, TitForTat, GrimTrigger,
    Detective, TitForTwoTats, Pavlov, GenerousTitForTat, RandomStrategy,
]

STRATEGY_MAP = {cls().name: cls for cls in ALL_STRATEGIES}
STRATEGY_NAMES = [cls().name for cls in ALL_STRATEGIES]


# ── Tournament ──

def play_match(a, b, rounds=10, noise=0.0, rng=None):
    if rng is None:
        rng = random.Random()
    a.reset()
    b.reset()
    history_a, history_b = [], []
    score_a = score_b = 0

    for r in range(rounds):
        act_a = a.choose(history_a, r)
        act_b = b.choose(history_b, r)
        if noise > 0:
            if rng.random() < noise:
                act_a = DEFECT if act_a == COOPERATE else COOPERATE
            if rng.random() < noise:
                act_b = DEFECT if act_b == COOPERATE else COOPERATE
        pa, pb = PAYOFF_TABLE[(act_a, act_b)]
        score_a += pa
        score_b += pb
        history_a.append((act_a, act_b))
        history_b.append((act_b, act_a))

    return score_a, score_b


def round_robin_scores(agent_names, rounds, noise, rng=None):
    if rng is None:
        rng = random.Random()
    scores = {name: 0 for name in agent_names}
    unique = list(set(agent_names))
    for i, name_a in enumerate(unique):
        for name_b in unique[i:]:
            count_a = agent_names.count(name_a)
            count_b = agent_names.count(name_b)
            a = STRATEGY_MAP[name_a]()
            b = STRATEGY_MAP[name_b]()
            sa, sb = play_match(a, b, rounds=rounds, noise=noise, rng=rng)
            scores[name_a] += sa * count_b
            scores[name_b] += sb * count_a
            if name_a == name_b:
                scores[name_a] -= sa
    return scores


# ── Full simulation with trajectory ──

def run_simulation_with_trajectory(
    noise=0.05,
    rounds_per_match=10,
    timesteps=30,
    initial_pop=None,
    mutation_rate=0.05,
    selection_pressure=0.2,
    seed=None,
    progress_callback=None,
):
    """Run evolutionary tournament and return full trajectory.

    Args:
        noise: Action flip probability.
        rounds_per_match: Rounds per 1v1 match.
        timesteps: Number of generations.
        initial_pop: Dict mapping strategy name -> count. Defaults to 4 each.
        mutation_rate: Probability any agent mutates per generation.
        selection_pressure: Fraction of population replaced per generation.
        seed: Random seed.
        progress_callback: Called with (current, total) each generation.

    Returns:
        Dict with trajectory, params, and KPIs.
    """
    if seed is None:
        seed = random.randrange(2**31)

    if initial_pop is None:
        initial_pop = {name: 4 for name in STRATEGY_NAMES}

    agents = []
    for name, count in initial_pop.items():
        if name in STRATEGY_MAP:
            agents.extend([name] * count)

    total_agents = len(agents)
    trajectory = []

    # Record initial state
    counts = Counter(agents)
    trajectory.append({
        "timestep": 0,
        "generation": 0,
        "population_counts": dict(counts),
        "total_agents": total_agents,
        "cooperation_rate": sum(counts.get(s, 0) for s in COOPERATIVE_STRATEGIES) / total_agents,
        "diversity": len(counts),
    })

    for ts in range(1, timesteps + 1):
        # Tournament
        scores = round_robin_scores(
            agents, rounds=rounds_per_match, noise=noise,
            rng=random.Random(seed + ts),
        )

        # Evolutionary selection
        if scores and not all(v == 0 for v in scores.values()):
            agent_scores = [(i, scores.get(a, 0)) for i, a in enumerate(agents)]
            agent_scores.sort(key=lambda x: x[1])
            n = len(agents)
            bottom_n = max(1, int(n * selection_pressure))
            top_n = max(1, int(n * selection_pressure))
            top_names = [agents[i] for i, _ in agent_scores[-top_n:]]
            bottom_indices = [i for i, _ in agent_scores[:bottom_n]]
            rng = random.Random(seed + ts * 1000)
            for idx in bottom_indices:
                agents[idx] = rng.choice(top_names)
            # Mutation
            all_strat_names = list(STRATEGY_MAP.keys())
            for i in range(n):
                if rng.random() < mutation_rate:
                    agents[i] = rng.choice(all_strat_names)

        counts = Counter(agents)
        trajectory.append({
            "timestep": ts,
            "generation": ts,
            "population_counts": dict(counts),
            "total_agents": total_agents,
            "cooperation_rate": sum(counts.get(s, 0) for s in COOPERATIVE_STRATEGIES) / total_agents,
            "diversity": len(counts),
        })

        if progress_callback:
            progress_callback(ts, timesteps)

    # Final KPIs
    final_counts = Counter(agents)
    winner = final_counts.most_common(1)[0][0] if final_counts else "N/A"
    coop_rate = sum(final_counts.get(s, 0) for s in COOPERATIVE_STRATEGIES) / total_agents

    return {
        "params": {
            "noise": noise,
            "rounds_per_match": rounds_per_match,
            "mutation_rate": mutation_rate,
            "selection_pressure": selection_pressure,
        },
        "timesteps": timesteps,
        "seed": seed,
        "total_agents": total_agents,
        "trajectory": trajectory,
        "final_kpis": {
            "winner": winner,
            "winner_share": final_counts[winner] / total_agents,
            "cooperation_rate": coop_rate,
            "diversity": len(final_counts),
        },
        "strategy_names": STRATEGY_NAMES,
    }
