"""Build a GDSSpec for the tournament simulation and generate diagrams.

Showcases the full ecosystem:
  - gds-games: defines the base Prisoner's Dilemma game
  - gds-framework: GDSSpec + canonical decomposition for the tournament model
  - gds-viz: renders architecture + canonical diagrams
  - gds-sim: executes the simulation (gen_sim.py)

The OGS pattern defines a single PD match (2 players). This module lifts that
into a full tournament model: a population of strategy agents playing
round-robin matches, with evolutionary selection over generations.
"""

from __future__ import annotations

from gds import (
    BoundaryAction,
    GDSSpec,
    Mechanism,
    ParameterDef,
    Policy,
    SpecWiring,
    Wire,
    entity,
    interface,
    project_canonical,
    state_var,
    typedef,
)
from gds_viz import canonical_to_mermaid, spec_to_mermaid

from strategies import ALL_STRATEGIES


def build_tournament_spec() -> GDSSpec:
    """Build a GDSSpec representing the evolutionary tournament model."""
    # ── Types ──
    StrategyName = typedef("StrategyName", str, description="Name of a strategy")
    Population = typedef("Population", list, description="List of agent strategy names")
    ScoreMap = typedef("ScoreMap", dict, description="Strategy → cumulative score")
    Generation = typedef("Generation", int, description="Current generation counter")
    NoiseRate = typedef("NoiseRate", float, description="Probability of action flip")
    RoundCount = typedef("RoundCount", int, description="Rounds per match")

    # ── State entities ──
    pop_entity = entity(
        "Population",
        description="Agent population under evolutionary pressure",
        agents=state_var(Population, symbol="A", description="List of strategy names"),
        scores=state_var(ScoreMap, symbol="S", description="Per-strategy cumulative scores"),
    )
    gen_entity = entity(
        "Clock",
        description="Generation counter",
        generation=state_var(Generation, symbol="t", description="Current generation"),
    )

    # ── Blocks ──

    # Boundary: initial population + payoff matrix from OGS game
    strat_names = [cls().name for cls in ALL_STRATEGIES]
    seed_population = BoundaryAction(
        name="Seed Population",
        interface=interface(forward_out=["Population Config"]),
        options=strat_names,
        tags={"tier": "input", "domain": "Configuration"},
    )

    payoff_matrix = BoundaryAction(
        name="Payoff Matrix",
        interface=interface(forward_out=["Payoff Rules"]),
        tags={"tier": "input", "domain": "Game (OGS)"},
    )

    # Policy: round-robin tournament (uses the PD game from gds-games)
    tournament = Policy(
        name="Round-Robin Tournament",
        interface=interface(
            forward_in=["Population Config", "Payoff Rules"],
            forward_out=["Tournament Scores"],
        ),
        params_used=["noise", "rounds_per_match"],
        tags={"tier": "policy", "domain": "Game (OGS)"},
    )

    # Policy: evolutionary selection logic
    selection = Policy(
        name="Evolutionary Selection",
        interface=interface(
            forward_in=["Tournament Scores"],
            forward_out=["Next Population"],
        ),
        tags={"tier": "policy", "domain": "Evolution"},
    )

    # Mechanisms: write state
    update_scores = Mechanism(
        name="Update Scores",
        interface=interface(forward_in=["Tournament Scores"]),
        updates=[("Population", "scores")],
        tags={"tier": "mechanism", "domain": "State"},
    )

    update_agents = Mechanism(
        name="Update Agents",
        interface=interface(forward_in=["Next Population"]),
        updates=[("Population", "agents")],
        tags={"tier": "mechanism", "domain": "State"},
    )

    advance_gen = Mechanism(
        name="Advance Generation",
        interface=interface(forward_in=["Next Population"]),
        updates=[("Clock", "generation")],
        tags={"tier": "mechanism", "domain": "State"},
    )

    # ── Parameters ──
    noise_param = ParameterDef(
        name="noise",
        typedef=NoiseRate,
        description="Probability of accidental action flip per round",
    )
    rounds_param = ParameterDef(
        name="rounds_per_match",
        typedef=RoundCount,
        description="Number of iterated PD rounds per match",
    )

    # ── Assemble spec ──
    spec = GDSSpec(
        name="Axelrod Tournament Simulation",
        description=(
            "Evolutionary tournament: a population of strategy agents plays "
            "round-robin Prisoner's Dilemma matches. Successful strategies "
            "reproduce; unsuccessful ones are replaced. The base PD game is "
            "defined in gds-games (OGS), the specification in gds-framework, "
            "and the execution in gds-sim."
        ),
    )

    spec.collect(
        StrategyName, Population, ScoreMap, Generation, NoiseRate, RoundCount,
        pop_entity, gen_entity,
        seed_population, payoff_matrix, tournament, selection,
        update_scores, update_agents, advance_gen,
        noise_param, rounds_param,
    )

    spec.register_wiring(SpecWiring(
        name="Tournament Pipeline",
        description="Input → Tournament → Selection → State Updates",
        block_names=[
            "Seed Population", "Payoff Matrix",
            "Round-Robin Tournament", "Evolutionary Selection",
            "Update Scores", "Update Agents", "Advance Generation",
        ],
        wires=[
            Wire(source="Seed Population", target="Round-Robin Tournament"),
            Wire(source="Payoff Matrix", target="Round-Robin Tournament"),
            Wire(source="Round-Robin Tournament", target="Update Scores"),
            Wire(source="Round-Robin Tournament", target="Evolutionary Selection"),
            Wire(source="Evolutionary Selection", target="Update Agents"),
            Wire(source="Evolutionary Selection", target="Advance Generation"),
        ],
    ))

    return spec


def generate_tournament_diagrams() -> dict:
    """Generate mermaid diagrams from the tournament GDSSpec."""
    spec = build_tournament_spec()
    canonical = project_canonical(spec)

    # Architecture by role (default grouping)
    arch_role = spec_to_mermaid(spec, show_entities=True, show_wires=True)

    # Architecture by domain
    arch_domain = spec_to_mermaid(
        spec, group_by="domain", show_entities=True, show_wires=True,
    )

    # Canonical decomposition
    canon_diagram = canonical_to_mermaid(canonical, show_updates=True, show_parameters=True)

    return {
        "spec_name": spec.name,
        "spec_description": spec.description,
        "canonical_formula": canonical.formula(),
        "diagrams": {
            "tournament_architecture": {
                "title": "Tournament Architecture (by Role)",
                "description": "GDS block roles: boundary inputs, policies, mechanisms, and state entities.",
                "mermaid": arch_role,
            },
            "tournament_by_domain": {
                "title": "Tournament Architecture (by Domain)",
                "description": "Blocks grouped by domain: Configuration, Game (OGS), Evolution, State.",
                "mermaid": arch_domain,
            },
            "tournament_canonical": {
                "title": "Canonical Decomposition",
                "description": f"Formal GDS decomposition: {canonical.formula()}",
                "mermaid": canon_diagram,
            },
        },
    }
