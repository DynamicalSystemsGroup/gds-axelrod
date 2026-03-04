"""Generate formal structure data: GDSSpec projection + canonical decomposition.

Showcases: gds-framework + gds-games (OGS bridge).
"""

from __future__ import annotations

from pathlib import Path

from games import build_pattern
from ogs.dsl.spec_bridge import compile_pattern_to_spec
from gds.canonical import project_canonical


def generate_formal(output: Path) -> dict:
    """Project OGS Pattern → GDSSpec → CanonicalGDS, export as JSON."""
    pattern = build_pattern()
    spec = compile_pattern_to_spec(pattern)
    canonical = project_canonical(spec)

    # Block role breakdown
    blocks_by_role = {}
    for name, block in spec.blocks.items():
        role = type(block).__name__
        blocks_by_role.setdefault(role, []).append({
            "name": name,
            "forward_in": [p.name for p in block.interface.forward_in],
            "forward_out": [p.name for p in block.interface.forward_out],
            "backward_in": [p.name for p in block.interface.backward_in],
            "backward_out": [p.name for p in block.interface.backward_out],
        })

    # Wirings
    wirings = []
    for w in spec.wirings.values():
        wirings.append({
            "name": w.name,
            "wires": [
                {"source": wire.source, "target": wire.target, "space": wire.space}
                for wire in w.wires
            ],
        })

    # Canonical decomposition
    canonical_data = {
        "formula": canonical.formula(),
        "state_variables": [
            {"entity": e, "variable": v} for e, v in canonical.state_variables
        ],
        "input_ports": [
            {"block": b, "port": p} for b, p in canonical.input_ports
        ],
        "decision_ports": [
            {"block": b, "port": p} for b, p in canonical.decision_ports
        ],
        "boundary_blocks": list(canonical.boundary_blocks),
        "policy_blocks": list(canonical.policy_blocks),
        "mechanism_blocks": list(canonical.mechanism_blocks),
        "control_blocks": list(canonical.control_blocks),
        "update_map": [
            {"mechanism": m, "targets": [{"entity": e, "variable": v} for e, v in targets]}
            for m, targets in canonical.update_map
        ],
    }

    data = {
        "title": "Formal Structure",
        "spec_name": spec.name,
        "spec_description": spec.description,
        "blocks_by_role": blocks_by_role,
        "wirings": wirings,
        "types": {name: str(td) for name, td in spec.types.items()} if spec.types else {},
        "spaces": {name: str(sp) for name, sp in spec.spaces.items()} if spec.spaces else {},
        "entities": {name: str(ent) for name, ent in spec.entities.items()} if spec.entities else {},
        "canonical": canonical_data,
    }

    return data
