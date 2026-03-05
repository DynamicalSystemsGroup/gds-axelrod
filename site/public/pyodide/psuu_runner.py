"""Self-contained PSUU runner for Pyodide.

Combines strategies, tournament logic, KPIs, and sweep loop
so the browser can run parameter sweeps without importing from
the pipeline or gds-psuu/gds-sim packages.

Entry point: run_sweep(n_samples, seed, progress_callback)
"""

import random
from collections import Counter

# ── Constants ──

COOPERATE = "Cooperate"
DEFECT = "Defect"

R, T, S, P = 2, 3, -1, 0  # Payoff matrix

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
    """Play an iterated match, return (score_a, score_b)."""
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
    """Play round-robin, return total scores per agent name."""
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


# ── SUFs (State Update Functions) ──

def run_simulation(params, timesteps=20, initial_pop=None):
    """Run one simulation: evolutionary tournament with given params.

    Args:
        params: Dict with 'noise' and 'rounds_per_match'.
        timesteps: Number of generations to simulate.
        initial_pop: Dict mapping strategy name -> count.
            If None, defaults to 4 of each strategy.

    Returns final agent list after `timesteps` generations.
    """
    if initial_pop is None:
        initial_pop = {name: 4 for name in STRATEGY_NAMES}
    agents = []
    for name, count in initial_pop.items():
        agents.extend([name] * count)

    scores = {name: 0 for name in STRATEGY_NAMES}
    generation = 0

    for ts in range(1, timesteps + 1):
        # Block 1: tournament + update scores
        scores = round_robin_scores(
            agents, rounds=params["rounds_per_match"], noise=params["noise"]
        )

        # Block 2: evolve + advance generation
        if scores and not all(v == 0 for v in scores.values()):
            agent_scores = [(i, scores.get(a, 0)) for i, a in enumerate(agents)]
            agent_scores.sort(key=lambda x: x[1])
            n = len(agents)
            bottom_n = max(1, n // 5)
            top_n = max(1, n // 5)
            top_names = [agents[i] for i, _ in agent_scores[-top_n:]]
            bottom_indices = [i for i, _ in agent_scores[:bottom_n]]
            rng = random.Random(generation + ts)
            for idx in bottom_indices:
                agents[idx] = rng.choice(top_names)
            all_strat_names = list(STRATEGY_MAP.keys())
            for i in range(n):
                if rng.random() < 0.05:
                    agents[i] = rng.choice(all_strat_names)

        generation += 1

    return agents


# ── KPIs ──

def cooperation_rate(agents):
    if not agents:
        return 0.0
    return sum(1 for a in agents if a in COOPERATIVE_STRATEGIES) / len(agents)


def diversity(agents):
    return float(len(set(agents)))


def winner_share(agents):
    if not agents:
        return 0.0
    counts = Counter(agents)
    return max(counts.values()) / len(agents)


# ── Sweep ──

def run_sweep(n_samples=30, seed=None, progress_callback=None, timesteps=20, runs=3, initial_pop=None):
    """Run a PSUU sweep: random search over (noise, rounds_per_match).

    Args:
        n_samples: Number of parameter points to evaluate.
        seed: Random seed (None = use current time).
        progress_callback: Called with (current, total) after each evaluation.
        timesteps: Simulation timesteps per evaluation.
        runs: Monte Carlo runs per evaluation (averaged).
        initial_pop: Dict mapping strategy name -> count.
            If None, defaults to 4 of each strategy.

    Returns:
        Dict matching psuu_results.json shape.
    """
    if seed is None:
        seed = random.randrange(2**31)

    rng = random.Random(seed)

    # Generate random parameter points
    points = []
    for _ in range(n_samples):
        noise = rng.uniform(0.0, 0.15)
        rounds_per_match = rng.randint(3, 25)
        points.append({"noise": noise, "rounds_per_match": rounds_per_match})

    evaluations = []
    for idx, params in enumerate(points):
        # Average over Monte Carlo runs
        coop_sum = div_sum = ws_sum = 0.0
        for run_i in range(runs):
            agents = run_simulation(params, timesteps=timesteps, initial_pop=initial_pop)
            coop_sum += cooperation_rate(agents)
            div_sum += diversity(agents)
            ws_sum += winner_share(agents)
        scores = {
            "cooperation_rate": coop_sum / runs,
            "diversity": div_sum / runs,
            "winner_share": ws_sum / runs,
        }
        evaluations.append({"params": params, "scores": scores})

        if progress_callback:
            progress_callback(idx + 1, n_samples)

    # Find best per KPI
    best_per_kpi = {}
    for kpi_name in ["cooperation_rate", "diversity", "winner_share"]:
        maximize = kpi_name != "winner_share"
        best_eval = max(evaluations, key=lambda e: e["scores"][kpi_name]) if maximize \
            else min(evaluations, key=lambda e: e["scores"][kpi_name])
        best_per_kpi[kpi_name] = {
            "params": best_eval["params"],
            "score": best_eval["scores"][kpi_name],
            "all_scores": best_eval["scores"],
            "maximize": maximize,
        }

    # Sensitivity analysis (OAT — one-at-a-time)
    sensitivity = run_oat_sensitivity(timesteps=timesteps, runs=runs, initial_pop=initial_pop)

    return {
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
            "n_samples": n_samples,
            "seed": seed,
        },
        "simulation": {
            "timesteps": timesteps,
            "runs": runs,
        },
        "kpis": {
            "cooperation_rate": "Fraction of cooperative strategies in final population",
            "diversity": "Number of unique strategies surviving",
            "winner_share": "Population share of most dominant strategy (lower = more balanced)",
        },
        "best_per_kpi": best_per_kpi,
        "evaluations": evaluations,
        "total_evaluations": len(evaluations),
        "strategy_names": STRATEGY_NAMES,
        "sensitivity": sensitivity,
    }


# ── Sensitivity Analysis (OAT) ──

def run_oat_sensitivity(n_levels=5, timesteps=20, runs=3, initial_pop=None):
    """One-at-a-time sensitivity: vary each parameter independently from baseline.

    Returns dict: {kpi_name: {param_name: {mean_effect, relative_effect, values}}}
    """
    # Define parameter ranges and baseline
    param_defs = {
        "noise": {"min": 0.0, "max": 0.15, "type": "continuous"},
        "rounds_per_match": {"min": 3, "max": 25, "type": "integer"},
    }
    baseline = {
        "noise": 0.075,  # midpoint
        "rounds_per_match": 14,  # midpoint
    }

    kpi_fns = {
        "cooperation_rate": cooperation_rate,
        "diversity": diversity,
        "winner_share": winner_share,
    }

    # Evaluate baseline
    baseline_kpis = _evaluate_point(baseline, kpi_fns, timesteps, runs, initial_pop)

    result = {}
    for kpi_name in kpi_fns:
        result[kpi_name] = {}
        for param_name, pdef in param_defs.items():
            if pdef["type"] == "integer":
                levels = [pdef["min"] + i * (pdef["max"] - pdef["min"]) // (n_levels - 1)
                          for i in range(n_levels)]
                levels = sorted(set(int(v) for v in levels))
            else:
                step = (pdef["max"] - pdef["min"]) / (n_levels - 1)
                levels = [pdef["min"] + i * step for i in range(n_levels)]

            effects = []
            level_values = []
            for level in levels:
                point = dict(baseline)
                point[param_name] = level
                kpis = _evaluate_point(point, kpi_fns, timesteps, runs, initial_pop)
                effect = abs(kpis[kpi_name] - baseline_kpis[kpi_name])
                effects.append(effect)
                level_values.append({"param_value": level, "kpi_value": kpis[kpi_name]})

            mean_effect = sum(effects) / len(effects) if effects else 0.0
            base_val = abs(baseline_kpis[kpi_name])
            relative_effect = mean_effect / base_val if base_val > 1e-9 else 0.0

            result[kpi_name][param_name] = {
                "mean_effect": mean_effect,
                "relative_effect": relative_effect,
                "baseline_value": baseline_kpis[kpi_name],
                "values": level_values,
            }

    return {"method": "OAT", "indices": result}


def _evaluate_point(params, kpi_fns, timesteps, runs, initial_pop):
    """Evaluate a single parameter point, averaging over Monte Carlo runs."""
    kpi_sums = {k: 0.0 for k in kpi_fns}
    for _ in range(runs):
        agents = run_simulation(params, timesteps=timesteps, initial_pop=initial_pop)
        for k, fn in kpi_fns.items():
            kpi_sums[k] += fn(agents)
    return {k: v / runs for k, v in kpi_sums.items()}
