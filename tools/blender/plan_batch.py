"""
Create a batch render plan for TankViewer assets without rendering them.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from factory_common import GENERATED_ROOT, SOURCE_ROOT, dump_json, planned_specs, specs_to_json  # noqa: E402


def parse_args() -> dict:
    args = sys.argv[1:]
    parsed = {
        "source_root": str(SOURCE_ROOT),
        "output_root": str(GENERATED_ROOT),
        "output": None,
        "directions": 16,
        "pilot_only": False,
    }
    i = 0
    while i < len(args):
        arg = args[i]
        if arg in {"--source-root", "--output-root", "--output"} and i + 1 < len(args):
            parsed[arg[2:].replace("-", "_")] = args[i + 1]
            i += 2
        elif arg == "--directions" and i + 1 < len(args):
            parsed["directions"] = int(args[i + 1])
            i += 2
        elif arg == "--pilot-only":
            parsed["pilot_only"] = True
            i += 1
        else:
            i += 1
    return parsed


def main() -> None:
    args = parse_args()
    specs = planned_specs(Path(args["source_root"]), Path(args["output_root"]), args["directions"])
    if args["pilot_only"]:
        specs = [
            spec
            for spec in specs
            if (spec.kind == "hull" and spec.source_name == "wasp" and spec.m_level == 0 and spec.faction == "cyan")
            or (spec.kind == "turret" and spec.source_name == "smoky" and spec.m_level == 0 and spec.faction == "cyan")
        ]

    payload = {
        "task": "CODEX-UNIT-ASSET-FACTORY-01",
        "directions": args["directions"],
        "count": len(specs),
        "specs": specs_to_json(specs),
    }

    output = Path(args["output"]) if args["output"] else Path(args["output_root"]) / "batch_plan.json"
    dump_json(output, payload)
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
