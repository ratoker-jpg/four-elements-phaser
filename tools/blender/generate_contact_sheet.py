"""
Generate a labeled contact sheet from rendered direction PNGs.
"""

from __future__ import annotations

import math
import re
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from factory_common import DIRECTION_NAMES_16, direction_names  # noqa: E402

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError as exc:  # pragma: no cover
    raise SystemExit("Pillow is required for generate_contact_sheet.py") from exc


def parse_args() -> dict:
    args = sys.argv[1:]
    parsed = {
        "input_dir": None,
        "output": None,
        "directions": 16,
        "columns": 4,
        "tile_padding": 12,
    }
    i = 0
    while i < len(args):
        arg = args[i]
        if arg.startswith("--") and i + 1 < len(args):
            key = arg[2:].replace("-", "_")
            parsed[key] = int(args[i + 1]) if key in {"directions", "columns", "tile_padding"} else args[i + 1]
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


def checker(draw: ImageDraw.ImageDraw, x: int, y: int, width: int, height: int, cell: int = 16) -> None:
    colors = ("#d8d8d8", "#f0f0f0")
    rows = math.ceil(height / cell)
    cols = math.ceil(width / cell)
    for row in range(rows):
        for col in range(cols):
            color = colors[(row + col) % 2]
            draw.rectangle(
                (
                    x + col * cell,
                    y + row * cell,
                    x + min(width, (col + 1) * cell),
                    y + min(height, (row + 1) * cell),
                ),
                fill=color,
            )


def main() -> None:
    args = parse_args()
    input_dir = Path(args["input_dir"])
    frames = sorted(input_dir.glob("*.png"), key=numeric_direction)
    if not frames:
        raise SystemExit(f"No PNG frames found in {input_dir}")

    images = [Image.open(frame).convert("RGBA") for frame in frames]
    frame_w, frame_h = images[0].size
    columns = args["columns"]
    rows = math.ceil(len(images) / columns)
    padding = args["tile_padding"]
    label_h = 26
    sheet_w = columns * (frame_w + padding * 2)
    sheet_h = rows * (frame_h + label_h + padding * 2)

    sheet = Image.new("RGBA", (sheet_w, sheet_h), (24, 27, 34, 255))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default()
    names = direction_names(args["directions"])

    for index, (frame_path, image) in enumerate(zip(frames, images)):
        col = index % columns
        row = index // columns
        x = col * (frame_w + padding * 2) + padding
        y = row * (frame_h + label_h + padding * 2) + padding
        checker(draw, x, y, frame_w, frame_h)
        sheet.alpha_composite(image, (x, y))
        direction = numeric_direction(frame_path)
        label = f"dir{direction} {names[direction] if direction < len(names) else ''}".strip()
        draw.text((x, y + frame_h + 6), label, fill="#f7f7f7", font=font)

    output = Path(args["output"]) if args["output"] else input_dir / "contact_sheet.png"
    output.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(output)
    print(str(output))


if __name__ == "__main__":
    main()
