"""Generate Nash equilibrium analysis data.

Showcases: nashpy + OGS PatternIR.
Ported from gds-core/packages/gds-examples/games/prisoners_dilemma_nash/.
"""

from __future__ import annotations

from pathlib import Path

import nashpy as nash
import numpy as np

from games import build_ir, build_pattern
from strategies import P, R, S, T


def build_payoff_matrices(ir):
    """Build payoff matrices from PatternIR terminal conditions.

    Returns (alice_payoffs, bob_payoffs) as 2x2 numpy arrays.
    Rows = Alice's actions, Cols = Bob's actions.
    """
    # Action ordering
    alice_actions = None
    bob_actions = None
    for asp in ir.action_spaces:
        if "Alice" in asp.game:
            alice_actions = asp.actions
        elif "Bob" in asp.game:
            bob_actions = asp.actions

    if not alice_actions or not bob_actions:
        raise ValueError("Could not find action spaces for Alice and Bob")

    n_alice = len(alice_actions)
    n_bob = len(bob_actions)
    alice_payoffs = np.zeros((n_alice, n_bob))
    bob_payoffs = np.zeros((n_alice, n_bob))

    # Parse payoffs from terminal conditions
    for tc in ir.terminal_conditions:
        alice_action = tc.actions.get("Alice Decision")
        bob_action = tc.actions.get("Bob Decision")
        if alice_action is None or bob_action is None:
            continue

        i = alice_actions.index(alice_action)
        j = bob_actions.index(bob_action)

        # Parse payoff_description: e.g. "R=2 each" or "T=3 for Alice, S=-1 for Bob"
        desc = tc.payoff_description
        if "each" in desc:
            val = _parse_value(desc.split("=")[1].split(" ")[0])
            alice_payoffs[i, j] = val
            bob_payoffs[i, j] = val
        elif "for Alice" in desc and "for Bob" in desc:
            parts = desc.split(",")
            for part in parts:
                val = _parse_value(part.split("=")[1].split(" ")[0])
                if "Alice" in part:
                    alice_payoffs[i, j] = val
                elif "Bob" in part:
                    bob_payoffs[i, j] = val

    return alice_payoffs, bob_payoffs


def _parse_value(s: str) -> float:
    """Parse a numeric value from a string."""
    return float(s.strip().rstrip(","))


def compute_nash_equilibria(alice_payoffs, bob_payoffs):
    """Compute Nash equilibria using nashpy support enumeration."""
    game = nash.Game(alice_payoffs, bob_payoffs)
    equilibria = list(game.support_enumeration())
    return equilibria


def find_dominant_strategies(alice_payoffs, bob_payoffs, alice_actions, bob_actions):
    """Find strictly dominant strategies."""
    result = {}

    # Check Alice's strategies
    for i in range(len(alice_actions)):
        dominates_all = True
        for j in range(len(alice_actions)):
            if i == j:
                continue
            if not all(alice_payoffs[i, k] > alice_payoffs[j, k] for k in range(len(bob_actions))):
                dominates_all = False
                break
        if dominates_all:
            result["Alice"] = alice_actions[i]

    # Check Bob's strategies
    for i in range(len(bob_actions)):
        dominates_all = True
        for j in range(len(bob_actions)):
            if i == j:
                continue
            if not all(bob_payoffs[k, i] > bob_payoffs[k, j] for k in range(len(alice_actions))):
                dominates_all = False
                break
        if dominates_all:
            result["Bob"] = bob_actions[i]

    return result


def find_pareto_optimal(alice_payoffs, bob_payoffs, alice_actions, bob_actions):
    """Find Pareto optimal outcomes."""
    outcomes = []
    for i in range(len(alice_actions)):
        for j in range(len(bob_actions)):
            outcomes.append({
                "alice_action": alice_actions[i],
                "bob_action": bob_actions[j],
                "alice_payoff": float(alice_payoffs[i, j]),
                "bob_payoff": float(bob_payoffs[i, j]),
            })

    pareto = []
    for o in outcomes:
        dominated = False
        for other in outcomes:
            if (other["alice_payoff"] >= o["alice_payoff"] and
                other["bob_payoff"] >= o["bob_payoff"] and
                (other["alice_payoff"] > o["alice_payoff"] or
                 other["bob_payoff"] > o["bob_payoff"])):
                dominated = True
                break
        if not dominated:
            pareto.append(o)

    return pareto


def generate_nash(output: Path) -> dict:
    """Full Nash analysis pipeline: PatternIR → payoff matrices → equilibria."""
    ir = build_ir()
    alice_payoffs, bob_payoffs = build_payoff_matrices(ir)

    # Action spaces
    alice_actions = None
    bob_actions = None
    for asp in ir.action_spaces:
        if "Alice" in asp.game:
            alice_actions = asp.actions
        elif "Bob" in asp.game:
            bob_actions = asp.actions

    # Nash equilibria
    equilibria = compute_nash_equilibria(alice_payoffs, bob_payoffs)
    eq_data = []
    for alice_strat, bob_strat in equilibria:
        # Interpret mixed strategies
        eq_entry = {
            "alice_strategy": {
                alice_actions[i]: float(alice_strat[i])
                for i in range(len(alice_actions))
            },
            "bob_strategy": {
                bob_actions[i]: float(bob_strat[i])
                for i in range(len(bob_actions))
            },
        }

        # Identify pure strategies
        if max(alice_strat) > 0.99:
            eq_entry["alice_pure"] = alice_actions[int(np.argmax(alice_strat))]
        if max(bob_strat) > 0.99:
            eq_entry["bob_pure"] = bob_actions[int(np.argmax(bob_strat))]

        # Expected payoff
        eq_entry["expected_payoff"] = {
            "alice": float(alice_strat @ alice_payoffs @ bob_strat),
            "bob": float(alice_strat @ bob_payoffs @ bob_strat),
        }
        eq_data.append(eq_entry)

    # Dominant strategies
    dominant = find_dominant_strategies(alice_payoffs, bob_payoffs, alice_actions, bob_actions)

    # Pareto optimal
    pareto = find_pareto_optimal(alice_payoffs, bob_payoffs, alice_actions, bob_actions)

    # Verification: cross-reference with terminal conditions
    declared_equilibria = []
    for tc in ir.terminal_conditions:
        if "nash" in tc.outcome.lower() or "equilibrium" in tc.outcome.lower():
            declared_equilibria.append({
                "name": tc.name,
                "actions": dict(tc.actions),
                "outcome": tc.outcome,
            })

    declared_pareto = []
    for tc in ir.terminal_conditions:
        if "pareto" in tc.outcome.lower() or "optimal" in tc.description.lower():
            declared_pareto.append({
                "name": tc.name,
                "actions": dict(tc.actions),
                "outcome": tc.outcome,
            })

    data = {
        "title": "Nash Analysis",
        "description": "Full game-theoretic analysis of the Prisoner's Dilemma via nashpy.",
        "players": {
            "Alice": alice_actions,
            "Bob": bob_actions,
        },
        "payoff_matrices": {
            "alice": alice_payoffs.tolist(),
            "bob": bob_payoffs.tolist(),
        },
        "payoff_params": {
            "R": R, "T": T, "S": S, "P": P,
            "labels": {
                "R": "Reward (mutual cooperation)",
                "T": "Temptation (defect while other cooperates)",
                "S": "Sucker (cooperate while other defects)",
                "P": "Punishment (mutual defection)",
            },
        },
        "equilibria": eq_data,
        "dominant_strategies": dominant,
        "pareto_optimal": pareto,
        "verification": {
            "declared_equilibria": declared_equilibria,
            "declared_pareto": declared_pareto,
            "computed_equilibria_count": len(eq_data),
            "all_terminal_conditions": [
                {
                    "name": tc.name,
                    "actions": dict(tc.actions),
                    "outcome": tc.outcome,
                    "description": tc.description,
                    "payoff": tc.payoff_description,
                }
                for tc in ir.terminal_conditions
            ],
        },
    }

    return data
