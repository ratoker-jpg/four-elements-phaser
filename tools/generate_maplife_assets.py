from __future__ import annotations

import json
import math
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont


CELL_PX = 256
ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "public" / "assets" / "environment" / "maplife"
PREVIEW_DIR = OUTPUT_DIR / "previews"
SOURCE_DIR = Path(r"C:\Users\Den\Downloads\four_elements_processed_environment_256_v3_fixed\environment")
TERRAIN_PATH = ROOT / "public" / "assets" / "tiles" / "terrain_sand_clean_256x128.png"


@dataclass(frozen=True)
class AssetSpec:
    name: str
    family: str
    category: str
    footprint: int


ASSET_SPECS: list[AssetSpec] = [
    AssetSpec("env_rock_cluster_1x1", "rock", "prop", 1),
    AssetSpec("env_rock_cluster_2x2", "rock", "prop", 2),
    AssetSpec("env_rock_cluster_3x3", "rock", "prop", 3),
    AssetSpec("env_bush_dry_cluster_1x1", "bush", "prop", 1),
    AssetSpec("env_bush_dry_cluster_2x2", "bush", "prop", 2),
    AssetSpec("env_bush_dry_cluster_3x3", "bush", "prop", 3),
    AssetSpec("env_sand_crack_patch_1x1", "crack", "decal", 1),
    AssetSpec("env_sand_crack_patch_2x2", "crack", "decal", 2),
    AssetSpec("env_sand_crack_patch_3x3", "crack", "decal", 3),
    AssetSpec("env_sand_bump_patch_1x1", "bump", "decal", 1),
    AssetSpec("env_sand_bump_patch_2x2", "bump", "decal", 2),
    AssetSpec("env_sand_bump_patch_3x3", "bump", "decal", 3),
]


ROCK_SOURCES = [
    SOURCE_DIR / "rock_cluster_03.png",
    SOURCE_DIR / "rock_cluster_05.png",
    SOURCE_DIR / "rock_cluster_07.png",
    SOURCE_DIR / "rock_cluster_08.png",
]

BUSH_SOURCES = [
    SOURCE_DIR / "dry_bush_03.png",
    SOURCE_DIR / "dry_bush_05.png",
    SOURCE_DIR / "dry_bush_07.png",
    SOURCE_DIR / "dry_bush_09.png",
]

BUMP_SOURCES = [
    SOURCE_DIR / "sand_bump_03.png",
    SOURCE_DIR / "sand_bump_05.png",
    SOURCE_DIR / "sand_bump_07.png",
    SOURCE_DIR / "sand_bump_09.png",
]


def ensure_dirs() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    PREVIEW_DIR.mkdir(parents=True, exist_ok=True)


def trim_alpha(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    alpha = rgba.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
      return rgba
    return rgba.crop(bbox)


def load_sources(paths: Iterable[Path]) -> list[Image.Image]:
    return [trim_alpha(Image.open(path).convert("RGBA")) for path in paths]


def fit_image(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    scale = min(target_w / img.width, target_h / img.height)
    size = (max(1, round(img.width * scale)), max(1, round(img.height * scale)))
    return img.resize(size, Image.Resampling.LANCZOS)


def tint_image(img: Image.Image, rgba_mul: tuple[float, float, float, float]) -> Image.Image:
    r_mul, g_mul, b_mul, a_mul = rgba_mul
    r, g, b, a = img.split()
    r = r.point(lambda p: max(0, min(255, int(p * r_mul))))
    g = g.point(lambda p: max(0, min(255, int(p * g_mul))))
    b = b.point(lambda p: max(0, min(255, int(p * b_mul))))
    a = a.point(lambda p: max(0, min(255, int(p * a_mul))))
    return Image.merge("RGBA", (r, g, b, a))


def paste_bottom_center(canvas: Image.Image, img: Image.Image, cx: int, base_y: int) -> None:
    x = round(cx - img.width / 2)
    y = round(base_y - img.height)
    canvas.alpha_composite(img, (x, y))


def build_rock_asset(spec: AssetSpec, sources: list[Image.Image]) -> Image.Image:
    canvas_size = spec.footprint * CELL_PX
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    rng = random.Random(f"maplife-rock-{spec.footprint}")
    if spec.footprint == 1:
        base = fit_image(sources[2], 176, 176)
        paste_bottom_center(canvas, base, canvas_size // 2, canvas_size - 18)
        return canvas

    placements = 4 if spec.footprint == 2 else 7
    span = canvas_size - 120
    for i in range(placements):
        source = sources[i % len(sources)]
        scale_w = 160 + spec.footprint * 22 + rng.randint(-14, 18)
        scale_h = 160 + spec.footprint * 22 + rng.randint(-20, 24)
        sprite = fit_image(source, scale_w, scale_h)
        sprite = tint_image(
            sprite,
            (
                0.96 + rng.random() * 0.08,
                0.95 + rng.random() * 0.07,
                0.93 + rng.random() * 0.07,
                1.0,
            ),
        )
        cx = 60 + int(span * (i + 1) / (placements + 1)) + rng.randint(-28, 28)
        base_y = canvas_size - 28 - rng.randint(0, 30 if spec.footprint == 3 else 18)
        paste_bottom_center(canvas, sprite, cx, base_y)
    return canvas


def build_bush_asset(spec: AssetSpec, sources: list[Image.Image]) -> Image.Image:
    canvas_size = spec.footprint * CELL_PX
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    rng = random.Random(f"maplife-bush-{spec.footprint}")
    if spec.footprint == 1:
        base = fit_image(sources[2], 182, 150)
        paste_bottom_center(canvas, base, canvas_size // 2, canvas_size - 20)
        return canvas

    placements = 5 if spec.footprint == 2 else 9
    for i in range(placements):
        source = sources[i % len(sources)]
        sprite = fit_image(source, 128 + rng.randint(-10, 26), 110 + rng.randint(-8, 24))
        sprite = tint_image(
            sprite,
            (
                0.95 + rng.random() * 0.06,
                0.90 + rng.random() * 0.08,
                0.86 + rng.random() * 0.08,
                1.0,
            ),
        )
        col = i % (2 if spec.footprint == 2 else 3)
        row = i // (2 if spec.footprint == 2 else 3)
        step_x = canvas_size / ((2 if spec.footprint == 2 else 3) + 1)
        cx = int(step_x * (col + 1)) + rng.randint(-20, 20)
        base_y = canvas_size - 26 - row * 26 - rng.randint(0, 16)
        paste_bottom_center(canvas, sprite, cx, base_y)
    return canvas


def build_bump_asset(spec: AssetSpec, sources: list[Image.Image]) -> Image.Image:
    canvas_size = spec.footprint * CELL_PX
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    if spec.footprint == 1:
        bump = fit_image(sources[2], 188, 158)
        bump = tint_image(bump, (1.0, 0.98, 0.95, 0.74))
        paste_bottom_center(canvas, bump, canvas_size // 2, canvas_size - 24)
        return canvas

    main = fit_image(sources[1], int(canvas_size * 0.64), int(canvas_size * 0.56))
    main = tint_image(main, (1.0, 0.98, 0.95, 0.70 if spec.footprint == 2 else 0.64))
    paste_bottom_center(canvas, main, canvas_size // 2, canvas_size - 26)

    accents = 2 if spec.footprint == 2 else 4
    rng = random.Random(f"maplife-bump-{spec.footprint}")
    for i in range(accents):
        source = sources[(i + 1) % len(sources)]
        accent = fit_image(source, 120 + rng.randint(-10, 16), 92 + rng.randint(-6, 16))
        accent = tint_image(accent, (1.0, 0.98, 0.95, 0.42))
        cx = int(canvas_size * (0.28 + 0.16 * i)) + rng.randint(-18, 18)
        base_y = canvas_size - 38 - rng.randint(0, 14)
        paste_bottom_center(canvas, accent, cx, base_y)
    return canvas


def draw_crack_branch(draw: ImageDraw.ImageDraw, points: list[tuple[int, int]], width: int, color: tuple[int, int, int, int]) -> None:
    draw.line(points, fill=color, width=width, joint="curve")
    for x, y in points[1:-1]:
        draw.ellipse((x - width, y - width, x + width, y + width), fill=color)


def build_crack_asset(spec: AssetSpec) -> Image.Image:
    canvas_size = spec.footprint * CELL_PX
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    rng = random.Random(f"maplife-crack-{spec.footprint}")
    center_y = int(canvas_size * 0.58)
    base_color = (136, 106, 70, 128 if spec.footprint == 1 else 118 if spec.footprint == 2 else 108)

    branch_count = 3 + spec.footprint
    for branch in range(branch_count):
        start_x = int(canvas_size * (0.18 + 0.14 * branch)) + rng.randint(-18, 18)
        start_y = center_y + rng.randint(-20, 18)
        segments = 4 + spec.footprint
        points = [(start_x, start_y)]
        x = start_x
        y = start_y
        for _ in range(segments):
            x += rng.randint(26, 54) * (1 if rng.random() > 0.35 else -1)
            y += rng.randint(-22, 22)
            x = max(36, min(canvas_size - 36, x))
            y = max(50, min(canvas_size - 56, y))
            points.append((x, y))
        width = max(2, 4 - spec.footprint // 2)
        draw_crack_branch(draw, points, width, base_color)

        offshoots = 1 + rng.randint(0, 2)
        for _ in range(offshoots):
            pivot = points[rng.randint(1, len(points) - 2)]
            branch_points = [pivot]
            bx, by = pivot
            for _ in range(2 + rng.randint(0, 2)):
                bx += rng.randint(-38, 38)
                by += rng.randint(-26, 26)
                bx = max(30, min(canvas_size - 30, bx))
                by = max(44, min(canvas_size - 44, by))
                branch_points.append((bx, by))
            draw_crack_branch(draw, branch_points, max(1, width - 1), (128, 98, 64, base_color[3] - 24))

    alpha = canvas.getchannel("A").filter(ImageFilter.GaussianBlur(radius=1.4))
    canvas = Image.merge("RGBA", (*canvas.split()[:3], alpha))
    return canvas


def validate_alpha_bbox(img: Image.Image) -> tuple[int, int, int, int]:
    bbox = img.getchannel("A").getbbox()
    if bbox is None:
        raise RuntimeError("Generated image is fully transparent.")
    return bbox


def build_asset(spec: AssetSpec, rock_sources: list[Image.Image], bush_sources: list[Image.Image], bump_sources: list[Image.Image]) -> Image.Image:
    if spec.family == "rock":
        return build_rock_asset(spec, rock_sources)
    if spec.family == "bush":
        return build_bush_asset(spec, bush_sources)
    if spec.family == "bump":
        return build_bump_asset(spec, bump_sources)
    if spec.family == "crack":
        return build_crack_asset(spec)
    raise ValueError(f"Unknown family: {spec.family}")


def render_contact_sheet(records: list[dict]) -> None:
    font = ImageFont.load_default()
    cols = 3
    rows = math.ceil(len(records) / cols)
    cell_w = 320
    cell_h = 330
    sheet = Image.new("RGBA", (cols * cell_w, rows * cell_h), (20, 22, 28, 255))
    draw = ImageDraw.Draw(sheet)
    for index, record in enumerate(records):
        col = index % cols
        row = index // cols
        x0 = col * cell_w
        y0 = row * cell_h
        draw.rounded_rectangle((x0 + 10, y0 + 10, x0 + cell_w - 10, y0 + cell_h - 10), radius=18, fill=(36, 39, 48, 255))
        img = Image.open(record["path"]).convert("RGBA")
        preview = fit_image(img, 250, 250)
        px = x0 + (cell_w - preview.width) // 2
        py = y0 + 28 + (220 - preview.height) // 2
        sheet.alpha_composite(preview, (px, py))
        draw.text((x0 + 22, y0 + 248), record["name"], font=font, fill=(230, 230, 235, 255))
        draw.text((x0 + 22, y0 + 270), f'{record["width"]}x{record["height"]}  {record["category"]}', font=font, fill=(160, 170, 180, 255))
    sheet.save(PREVIEW_DIR / "maplife_contact_sheet.png")


def render_terrain_preview(records: list[dict]) -> None:
    terrain = Image.open(TERRAIN_PATH).convert("RGBA")
    tile_w, tile_h = terrain.size
    cols = 4
    rows = 3
    width = 1100
    height = 760
    preview = Image.new("RGBA", (width, height), (22, 20, 16, 255))
    draw = ImageDraw.Draw(preview)
    draw.text((24, 16), "MAPLIFE Terrain Preview", font=ImageFont.load_default(), fill=(235, 230, 210, 255))

    for row in range(rows):
        for col in range(cols):
            cx = 150 + col * 240
            cy = 120 + row * 170
            preview.alpha_composite(terrain, (cx - tile_w // 2, cy - tile_h // 2))
            preview.alpha_composite(terrain, (cx - tile_w // 2 + 38, cy - tile_h // 2 + 19))
            preview.alpha_composite(terrain, (cx - tile_w // 2 - 38, cy - tile_h // 2 + 19))

    for index, record in enumerate(records):
        img = Image.open(record["path"]).convert("RGBA")
        scaled = img.resize((round(img.width * (76 / CELL_PX)), round(img.height * (76 / CELL_PX))), Image.Resampling.LANCZOS)
        col = index % cols
        row = index // cols
        cx = 150 + col * 240
        cy = 120 + row * 170
        if record["category"] == "decal":
            px = cx - scaled.width // 2
            py = cy - scaled.height // 2 + 16
        else:
            px = cx - scaled.width // 2
            py = cy - scaled.height + 52
        preview.alpha_composite(scaled, (px, py))
        draw.text((cx - 80, cy + 86), record["name"].replace("env_", ""), font=ImageFont.load_default(), fill=(240, 235, 220, 255))
    preview.save(PREVIEW_DIR / "maplife_terrain_preview.png")


def main() -> None:
    ensure_dirs()
    rock_sources = load_sources(ROCK_SOURCES)
    bush_sources = load_sources(BUSH_SOURCES)
    bump_sources = load_sources(BUMP_SOURCES)

    records: list[dict] = []

    for spec in ASSET_SPECS:
        asset = build_asset(spec, rock_sources, bush_sources, bump_sources)
        bbox = validate_alpha_bbox(asset)
        path = OUTPUT_DIR / f"{spec.name}.png"
        asset.save(path)
        records.append(
            {
                "name": spec.name,
                "family": spec.family,
                "category": spec.category,
                "footprint": spec.footprint,
                "width": asset.width,
                "height": asset.height,
                "alphaBBox": list(bbox),
                "path": str(path),
            }
        )

    render_contact_sheet(records)
    render_terrain_preview(records)

    report = {
        "generatedBy": "tools/generate_maplife_assets.py",
        "cellSourcePx": CELL_PX,
        "outputDir": str(OUTPUT_DIR),
        "assets": records,
        "previews": {
            "contactSheet": str(PREVIEW_DIR / "maplife_contact_sheet.png"),
            "terrainPreview": str(PREVIEW_DIR / "maplife_terrain_preview.png"),
        },
        "sourceNotes": {
            "rocks": [str(path) for path in ROCK_SOURCES],
            "bushes": [str(path) for path in BUSH_SOURCES],
            "bumps": [str(path) for path in BUMP_SOURCES],
            "cracks": "procedurally generated transparent decals",
        },
    }
    (OUTPUT_DIR / "maplife_asset_report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
