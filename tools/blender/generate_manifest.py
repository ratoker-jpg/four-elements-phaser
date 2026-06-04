"""
Generate a manifest for a rendered TankViewer asset pack.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from factory_common import DIRECTION_CONVENTION_TEXT, dump_json  # noqa: E402

try:
    from PIL import Image
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Pillow is required for generate_manifest.py") from exc


def parse_args() -> dict:
    args = sys.argv[1:]
    parsed = {
        "input_dir": None,
        "output": None,
        "id": None,
        "kind": None,
        "m_level": None,
        "faction": None,
        "source_model": None,
        "source_details": None,
        "source_lightmap": None,
        "directions": 16,
    }
    i = 0
    while i < len(args):
        arg = args[i]
        if arg.startswith("--") and i + 1 < len(args):
            key = arg[2:].replace("-", "_")
            parsed[key] = args[i + 1]
            i += 2
        else:
            i += 1
    if parsed["input_dir"] is None:
        raise SystemExit("--input-dir is required")
    return parsed


def numeric_direction(path: Path) -> int:
    match = re.search(r"_dir(\d+)\.png$", path.name)
    if not match:
        return 10**9
    return int(match.group(1))


def main() -> None:
    args = parse_args()
    input_dir = Path(args["input_dir"])
    frames = sorted(input_dir.glob("*.png"), key=numeric_direction)
    if not frames:
        raise SystemExit(f"No PNG frames found in {input_dir}")

    width, height = Image.open(frames[0]).size
    frame_entries = []
    for frame in frames:
        frame_entries.append(
            {
                "filename": frame.name,
                "path": str(frame),
                "direction": numeric_direction(frame),
            }
        )

    manifest = {
        "id": args["id"] or input_dir.name,
        "kind": args["kind"],
        "mLevel": int(args["m_level"]) if args["m_level"] is not None else None,
        "faction": args["faction"],
        "directions": int(args["directions"]),
        "directionConvention": DIRECTION_CONVENTION_TEXT,
        "frameDimensions": {"width": width, "height": height},
        "frameList": frame_entries,
        "source": {
            "model": args["source_model"],
            "details": args["source_details"],
            "lightmap": args["source_lightmap"],
        },
        "anchor": {"mode": "preliminary", "description": "bottom-center ground contact"},
        "socket": {"mode": "preliminary", "description": "derive from source audit"},
        "barrel": {"mode": "preliminary", "description": "turret-only field"},
    }

    output = Path(args["output"]) if args["output"] else input_dir / "manifest.json"
    dump_json(output, manifest)
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
