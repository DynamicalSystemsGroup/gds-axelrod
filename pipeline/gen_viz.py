"""Generate all Mermaid diagram strings for visualization page.

Showcases: gds-viz (6 GDS views) + ogs.viz (6 OGS views).
"""

from __future__ import annotations

from pathlib import Path

from games import build_ir, build_pattern
from ogs.dsl.spec_bridge import compile_pattern_to_spec
from ogs.viz import generate_all_views as ogs_generate_all_views
from gds.canonical import project_canonical
from gds_viz import (
    canonical_to_mermaid,
    spec_to_mermaid,
    system_to_mermaid,
    params_to_mermaid,
)


def generate_viz(output: Path) -> dict:
    """Generate all Mermaid diagram strings from both gds-viz and ogs.viz."""
    # Build artifacts
    pattern = build_pattern()
    ir = build_ir()
    spec = compile_pattern_to_spec(pattern)
    canonical = project_canonical(spec)
    system_ir = ir.to_system_ir()

    diagrams = {}

    # ── OGS views (6) ──
    ogs_views = ogs_generate_all_views(ir)
    for view_name, mermaid_str in ogs_views.items():
        diagrams[f"ogs_{view_name}"] = {
            "title": _ogs_title(view_name),
            "description": _ogs_description(view_name),
            "mermaid": mermaid_str,
            "package": "gds-games (ogs.viz)",
        }

    # ── GDS views ──
    # View 1: System structure (flat block topology)
    diagrams["gds_system"] = {
        "title": "System Structure",
        "description": "Flat block topology from SystemIR — blocks with role-based shapes and wiring edges.",
        "mermaid": system_to_mermaid(system_ir),
        "package": "gds-viz",
    }

    # View 2: System structure (hierarchical)
    diagrams["gds_system_hierarchy"] = {
        "title": "System Hierarchy",
        "description": "Hierarchical composition tree showing block nesting.",
        "mermaid": system_to_mermaid(system_ir, show_hierarchy=True),
        "package": "gds-viz",
    }

    # View 3: Spec architecture
    diagrams["gds_spec"] = {
        "title": "Specification Architecture",
        "description": "Architecture-level view with blocks grouped by role, entity cylinders, and wiring edges.",
        "mermaid": spec_to_mermaid(spec),
        "package": "gds-viz",
    }

    # View 4: Canonical decomposition
    diagrams["gds_canonical"] = {
        "title": "Canonical Decomposition (h = f ∘ g)",
        "description": "Formal GDS decomposition: state variables, boundary inputs, policies, mechanisms.",
        "mermaid": canonical_to_mermaid(canonical),
        "package": "gds-viz",
    }

    # View 5: Parameter influence
    diagrams["gds_params"] = {
        "title": "Parameter Influence",
        "description": "Parameter (Θ) influence diagram: which parameters affect which blocks and entities.",
        "mermaid": params_to_mermaid(spec),
        "package": "gds-viz",
    }

    data = {
        "title": "Visualizations",
        "diagrams": diagrams,
        "total_count": len(diagrams),
    }

    return data


def _ogs_title(view_name: str) -> str:
    titles = {
        "structural": "Game Structural Topology",
        "architecture_by_role": "Architecture by Role",
        "architecture_by_domain": "Architecture by Domain",
        "hierarchy": "Composition Hierarchy",
        "flow_topology": "Flow Topology (Covariant)",
        "terminal_conditions": "Terminal Conditions",
    }
    return titles.get(view_name, view_name.replace("_", " ").title())


def _ogs_description(view_name: str) -> str:
    descriptions = {
        "structural": "Full game topology with all flows — decision games, functions, and feedback loops.",
        "architecture_by_role": "Games grouped by GameType (decision, covariant function, etc.).",
        "architecture_by_domain": "Games grouped by domain tag (Alice, Bob, Environment).",
        "hierarchy": "Nested composition tree showing sequential, parallel, and feedback structure.",
        "flow_topology": "Forward (covariant) flows only — useful for data flow analysis.",
        "terminal_conditions": "State transition diagram showing all possible outcomes.",
    }
    return descriptions.get(view_name, "")
