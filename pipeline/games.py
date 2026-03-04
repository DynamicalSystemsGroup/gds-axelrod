"""OGS game definitions and PatternIR export for the Prisoner's Dilemma.

Defines the PD as OGS primitives, compiles to PatternIR, and exports JSON
for frontend consumption.
"""

from __future__ import annotations

from pathlib import Path

from ogs.dsl.compile import compile_to_ir
from ogs.dsl.composition import (
    FeedbackFlow,
    FeedbackLoop,
    Flow,
    ParallelComposition,
    SequentialComposition,
)
from ogs.dsl.games import CovariantFunction, DecisionGame
from ogs.dsl.pattern import ActionSpace, Pattern, PatternInput, TerminalCondition
from ogs.dsl.types import CompositionType, InputType, Signature, port
from ogs.ir.models import PatternIR
from ogs.ir.serialization import IRDocument, IRMetadata, save_ir

from strategies import P, R, S, T

# ── Atomic Games ──

alice_decision = DecisionGame(
    name="Alice Decision",
    signature=Signature(
        x=(port("Alice Observation"),),
        y=(port("Alice Action"),),
        r=(port("Alice Payoff"),),
        s=(port("Alice Experience"),),
    ),
    logic="Alice observes her previous round payoff and chooses {Cooperate, Defect}.",
    tags={"domain": "Alice"},
)

bob_decision = DecisionGame(
    name="Bob Decision",
    signature=Signature(
        x=(port("Bob Observation"),),
        y=(port("Bob Action"),),
        r=(port("Bob Payoff"),),
        s=(port("Bob Experience"),),
    ),
    logic="Bob observes his previous round payoff and chooses {Cooperate, Defect}.",
    tags={"domain": "Bob"},
)

payoff_computation = CovariantFunction(
    name="Payoff Computation",
    signature=Signature(
        x=(port("Alice Action"), port("Bob Action")),
        y=(port("Alice Payoff"), port("Bob Payoff")),
    ),
    logic=(
        f"Payoff matrix lookup: CC=({R},{R}), CD=({S},{T}), "
        f"DC=({T},{S}), DD=({P},{P})."
    ),
    tags={"domain": "Environment"},
)


def build_game() -> FeedbackLoop:
    """Build the PD as an OGS composite game."""
    decisions = ParallelComposition(
        name="Simultaneous Decisions",
        left=alice_decision,
        right=bob_decision,
    )

    game_round = SequentialComposition(
        name="Game Round",
        first=decisions,
        second=payoff_computation,
        wiring=[
            Flow(
                source_game=alice_decision,
                source_port="Alice Action",
                target_game=payoff_computation,
                target_port="Alice Action",
            ),
            Flow(
                source_game=bob_decision,
                source_port="Bob Action",
                target_game=payoff_computation,
                target_port="Bob Action",
            ),
        ],
    )

    return FeedbackLoop(
        name="Prisoner's Dilemma",
        inner=game_round,
        feedback_wiring=[
            FeedbackFlow(
                source_game=payoff_computation,
                source_port="Alice Payoff",
                target_game=alice_decision,
                target_port="Alice Payoff",
            ),
            FeedbackFlow(
                source_game=payoff_computation,
                source_port="Bob Payoff",
                target_game=bob_decision,
                target_port="Bob Payoff",
            ),
        ],
        signature=Signature(),
    )


def build_pattern() -> Pattern:
    """Build the complete OGS Pattern."""
    return Pattern(
        name="Axelrod Prisoner's Dilemma",
        game=build_game(),
        inputs=[
            PatternInput(
                name="Payoff Matrix",
                input_type=InputType.EXTERNAL_WORLD,
                schema_hint=f"(R, T, S, P) = ({R}, {T}, {S}, {P})",
                target_game="Payoff Computation",
                flow_label="Payoff Matrix",
            ),
        ],
        composition_type=CompositionType.FEEDBACK,
        terminal_conditions=[
            TerminalCondition(
                name="Mutual Cooperation",
                actions={"Alice Decision": "Cooperate", "Bob Decision": "Cooperate"},
                outcome="Both players cooperate (Pareto optimal)",
                description="Pareto optimum — both receive reward",
                payoff_description=f"R={R} each",
            ),
            TerminalCondition(
                name="Mutual Defection",
                actions={"Alice Decision": "Defect", "Bob Decision": "Defect"},
                outcome="Both players defect (Nash equilibrium)",
                description="Dominant strategy equilibrium",
                payoff_description=f"P={P} each",
            ),
            TerminalCondition(
                name="Alice Exploits",
                actions={"Alice Decision": "Defect", "Bob Decision": "Cooperate"},
                outcome="Alice defects while Bob cooperates",
                description="Temptation vs sucker",
                payoff_description=f"T={T} for Alice, S={S} for Bob",
            ),
            TerminalCondition(
                name="Bob Exploits",
                actions={"Alice Decision": "Cooperate", "Bob Decision": "Defect"},
                outcome="Bob defects while Alice cooperates",
                description="Temptation vs sucker",
                payoff_description=f"T={T} for Bob, S={S} for Alice",
            ),
        ],
        action_spaces=[
            ActionSpace(game="Alice Decision", actions=["Cooperate", "Defect"]),
            ActionSpace(game="Bob Decision", actions=["Cooperate", "Defect"]),
        ],
        source="dsl",
    )


def build_ir() -> PatternIR:
    """Compile Pattern to PatternIR."""
    return compile_to_ir(build_pattern())


def export_pattern_ir(output_dir: Path) -> None:
    """Export PatternIR as JSON to output directory."""
    ir = build_ir()
    from datetime import UTC, datetime

    doc = IRDocument(
        version="1.0",
        patterns=[ir],
        metadata=IRMetadata(
            source_canvases=["dsl"],
            generated_at=datetime.now(UTC),
            parser_version="0.1.0",
        ),
    )
    save_ir(doc, output_dir / "pattern_ir.json")
