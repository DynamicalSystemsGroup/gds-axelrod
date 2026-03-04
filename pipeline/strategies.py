"""Strategy implementations for the iterated Prisoner's Dilemma.

Nine strategies from Nicky Case's "The Evolution of Trust" plus
Generous TFT from Nowak & Sigmund (1992).

Each strategy implements: choose(history, round_num) -> action, reset().
"""

from __future__ import annotations

import random
from typing import ClassVar, Protocol, runtime_checkable

COOPERATE = "Cooperate"
DEFECT = "Defect"

# Payoff parameters — Nicky Case's version: T > R > P > S, 2R > T + S
R = 2  # Reward (mutual cooperation)
T = 3  # Temptation (defect while other cooperates)
S = -1  # Sucker (cooperate while other defects)
P = 0  # Punishment (mutual defection)

PAYOFF_TABLE: dict[tuple[str, str], tuple[int, int]] = {
    (COOPERATE, COOPERATE): (R, R),
    (COOPERATE, DEFECT): (S, T),
    (DEFECT, COOPERATE): (T, S),
    (DEFECT, DEFECT): (P, P),
}


def get_payoff(action_a: str, action_b: str) -> tuple[int, int]:
    """Get payoff for a pair of actions."""
    return PAYOFF_TABLE[(action_a, action_b)]


@runtime_checkable
class Strategy(Protocol):
    """Protocol for iterated PD strategies."""

    @property
    def name(self) -> str: ...

    @property
    def description(self) -> str: ...

    @property
    def color(self) -> str: ...

    @property
    def short(self) -> str: ...

    def choose(self, history: list[tuple[str, str]], round_num: int) -> str: ...

    def reset(self) -> None: ...


class AlwaysCooperate:
    name = "Always Cooperate"
    short = "Coop"
    description = "Always plays Cooperate. Naive but maximizes mutual benefit."
    color = "#6bc46b"

    def choose(self, history: list[tuple[str, str]], round_num: int) -> str:
        return COOPERATE

    def reset(self) -> None:
        pass


class AlwaysDefect:
    name = "Always Defect"
    short = "Def"
    description = "Always plays Defect. Exploits cooperators."
    color = "#e74c3c"

    def choose(self, history: list[tuple[str, str]], round_num: int) -> str:
        return DEFECT

    def reset(self) -> None:
        pass


class TitForTat:
    name = "Tit for Tat"
    short = "TfT"
    description = "Cooperates first, then copies opponent's last move."
    color = "#4a90d9"

    def choose(self, history: list[tuple[str, str]], round_num: int) -> str:
        if not history:
            return COOPERATE
        return history[-1][1]

    def reset(self) -> None:
        pass


class GrimTrigger:
    name = "Grim Trigger"
    short = "Grudger"
    description = "Cooperates until opponent defects once, then defects forever."
    color = "#9b59b6"

    def __init__(self) -> None:
        self._triggered = False

    def choose(self, history: list[tuple[str, str]], round_num: int) -> str:
        if self._triggered:
            return DEFECT
        if history and history[-1][1] == DEFECT:
            self._triggered = True
            return DEFECT
        return COOPERATE

    def reset(self) -> None:
        self._triggered = False


class Detective:
    name = "Detective"
    short = "Det"
    description = "Probes with C,D,C,C then exploits or mimics."
    color = "#f39c12"

    _probe_sequence: ClassVar[list[str]] = [COOPERATE, DEFECT, COOPERATE, COOPERATE]

    def __init__(self) -> None:
        self._exploit = False

    def choose(self, history: list[tuple[str, str]], round_num: int) -> str:
        if round_num < 4:
            return self._probe_sequence[round_num]
        if round_num == 4:
            opponent_defected = any(h[1] == DEFECT for h in history[:4])
            self._exploit = not opponent_defected
        if self._exploit:
            return DEFECT
        return history[-1][1] if history else COOPERATE

    def reset(self) -> None:
        self._exploit = False


class TitForTwoTats:
    name = "Tit for Two Tats"
    short = "Tf2T"
    description = "Cooperates unless opponent defected in both of the last 2 rounds."
    color = "#3498db"

    def choose(self, history: list[tuple[str, str]], round_num: int) -> str:
        if len(history) < 2:
            return COOPERATE
        if history[-1][1] == DEFECT and history[-2][1] == DEFECT:
            return DEFECT
        return COOPERATE

    def reset(self) -> None:
        pass


class Pavlov:
    name = "Pavlov"
    short = "Pav"
    description = "Win-stay, lose-shift. Repeats if both played same; switches if different."
    color = "#e67e22"

    def choose(self, history: list[tuple[str, str]], round_num: int) -> str:
        if not history:
            return COOPERATE
        my_last, opp_last = history[-1]
        if my_last == opp_last:
            return my_last
        return DEFECT if my_last == COOPERATE else COOPERATE

    def reset(self) -> None:
        pass


class GenerousTitForTat:
    name = "Generous TFT"
    short = "GTFT"
    description = "Tit-for-Tat but forgives defection ~1/3 of the time."
    color = "#2ecc71"

    def __init__(self, generosity: float = 1 / 3, seed: int = 42) -> None:
        self._generosity = generosity
        self._seed = seed
        self._rng = random.Random(seed)

    def choose(self, history: list[tuple[str, str]], round_num: int) -> str:
        if not history:
            return COOPERATE
        if history[-1][1] == DEFECT:
            return COOPERATE if self._rng.random() < self._generosity else DEFECT
        return COOPERATE

    def reset(self) -> None:
        self._rng = random.Random(self._seed)


class RandomStrategy:
    name = "Random"
    short = "Rnd"
    description = "Cooperates or defects with 50/50 probability."
    color = "#95a5a6"

    def __init__(self, seed: int = 42) -> None:
        self._seed = seed
        self._rng = random.Random(seed)

    def choose(self, history: list[tuple[str, str]], round_num: int) -> str:
        return COOPERATE if self._rng.random() < 0.5 else DEFECT

    def reset(self) -> None:
        self._rng = random.Random(self._seed)


ALL_STRATEGIES: list[type] = [
    AlwaysCooperate,
    AlwaysDefect,
    TitForTat,
    GrimTrigger,
    Detective,
    TitForTwoTats,
    Pavlov,
    GenerousTitForTat,
    RandomStrategy,
]

STRATEGY_MAP: dict[str, type] = {cls().name: cls for cls in ALL_STRATEGIES}

STRATEGY_META: list[dict] = [
    {"name": cls().name, "short": cls().short, "color": cls().color, "description": cls().description}
    for cls in ALL_STRATEGIES
]
