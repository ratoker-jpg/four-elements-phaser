#!/usr/bin/env python3
"""
Offline alpha-bounds generator for building PNG placement metadata.

BUILD-ANCHOR-02: Generator-only. No rendering changes.

Scans building PNG assets under public/assets/factions/*/buildings/ and
produces structured TypeScript metadata compatible with BuildingPlacementMeta.

Uses Python + PIL (Pillow) — already available in the environment.
Zero npm dependencies required.

Usage:
    python3 tools/generate_building_meta.py

Output:
    src/assets/generatedBuildingMeta.ts

Why Python instead of Node.js:
    - PIL/Pillow is already installed; no npm PNG parser dependency needed.
    - The generator is a dev-only tool, not part of the runtime bundle.
    - Output is committed TypeScript; the generator only runs when assets change.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from PIL import Image

# ─── Project paths ───────────────────────────────────────────────────

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
PUBLIC_ASSETS = PROJECT_ROOT / "public" / "assets" / "factions"
OUTPUT_FILE = PROJECT_ROOT / "src" / "assets" / "generatedBuildingMeta.ts"

# ─── Constants (must match src/state/types.ts + src/assets/buildingAssets.ts) ──

FACTIONS = ["cyan", "green", "yellow", "purple"]

# Hyphenated building types matching BuildingType in state/types.ts.
BUILDING_TYPES = [
    "separator",
    "raw-storage",
    "matter-storage",
    "power-plant",
    "command-relay",
    "units-factory",
]

# Map hyphenated building type to underscore filename suffix.
# Must match BUILDING_KEY_SUFFIXES in buildingAssets.ts.
BUILDING_FILE_NAMES = {
    "separator": "separator.png",
    "raw-storage": "raw_storage.png",
    "matter-storage": "matter_storage.png",
    "power-plant": "power_plant.png",
    "command-relay": "command_relay.png",
    "units-factory": "units_factory.png",
}

# Map hyphenated building type to underscore key suffix.
# Must match BUILDING_KEY_SUFFIXES in buildingAssets.ts.
BUILDING_KEY_SUFFIXES = {
    "separator": "separator",
    "raw-storage": "raw_storage",
    "matter-storage": "matter_storage",
    "power-plant": "power_plant",
    "command-relay": "command_relay",
    "units-factory": "units_factory",
}

# Footprint sizes from BUILDING_CONFIG in src/state/construction.ts.
# Only 'separator' has a confirmed config entry.
# Other types use assumed defaults — reported as warnings.
CONFIRMED_FOOTPRINTS = {
    "separator": (2, 2),
}

# Assumed default footprint for types without BUILDING_CONFIG.
# All current building art appears to be 2x2 isometric structures.
DEFAULT_FOOTPRINT = (2, 2)

# Isometric tile constants (must match src/config/worldConfig.ts).
TILE_W = 76
TILE_H = 38
HALF_TILE_W = TILE_W // 2  # 38

# ─── Alpha-bounds computation ────────────────────────────────────────


def compute_alpha_bounds(img: Image.Image) -> dict:
    """
    Compute the bounding box of non-transparent pixels in a RGBA image.

    Returns { left, top, right, bottom } where right/bottom are exclusive
    bounds (like array slices), matching AlphaBounds in buildingPlacementMeta.ts.

    If the image has no non-transparent pixels, returns None.
    """
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    width, height = img.size
    pixels = img.load()

    left = width
    top = height
    right = 0
    bottom = 0

    for y in range(height):
        for x in range(width):
            _, _, _, a = pixels[x, y]
            if a > 0:
                if x < left:
                    left = x
                if x >= right:
                    right = x + 1  # exclusive
                if y < top:
                    top = y
                if y >= bottom:
                    bottom = y + 1  # exclusive

    if right <= left or bottom <= top:
        return None  # no visible content

    return {"left": left, "top": top, "right": right, "bottom": bottom}


def compute_ground_line_ratio(img: Image.Image, alpha_bounds: dict) -> float:
    """
    Estimate where the building's visual base sits relative to source height.

    Heuristic: find the row with the widest alpha content (most non-transparent
    pixels). This is typically the building's base/ground line. Shadows below
    the base tend to be narrower.

    groundLineRatio = groundLineY / sourceHeight

    Falls back to alpha_bounds.bottom / sourceHeight if the widest-row
    heuristic fails.
    """
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    width, height = img.size
    pixels = img.load()

    top = alpha_bounds["top"]
    bottom = alpha_bounds["bottom"]  # exclusive

    max_alpha_width = 0
    ground_line_y = bottom - 1  # default: bottom of visible content

    for y in range(top, bottom):
        row_count = 0
        for x in range(width):
            _, _, _, a = pixels[x, y]
            if a > 0:
                row_count += 1
        if row_count > max_alpha_width:
            max_alpha_width = row_count
            ground_line_y = y

    ratio = ground_line_y / height
    return round(ratio, 6)


def compute_origin_x(alpha_bounds: dict, source_width: int) -> float:
    """
    Compute Phaser setOrigin() X value.

    The origin X should be at the horizontal center of the visible content,
    relative to the source image width. This ensures the sprite is centered
    horizontally over the placement point.
    """
    visible_center_x = (alpha_bounds["left"] + alpha_bounds["right"]) / 2.0
    origin_x = visible_center_x / source_width
    return round(origin_x, 6)


def detect_category(visible_width: int, visible_height: int) -> str:
    """
    Detect building visual category based on aspect ratio.

    - 'tower': tall/narrow (height/width > 1.5)
    - 'flat': wide/short (height/width < 0.7)
    - 'structure': default
    """
    if visible_width == 0:
        return "structure"
    ratio = visible_height / visible_width
    if ratio > 1.5:
        return "tower"
    if ratio < 0.7:
        return "flat"
    return "structure"


def compute_target_display_width(footprint_w: int, footprint_h: int) -> int:
    """
    Compute the desired rendered width in screen pixels.

    For isometric 2:1 projection:
      isometric diamond width = (footprintW + footprintH - 2) * HALF_TILE_W

    Buildings extend beyond the footprint diamond (they are tall structures).
    A reasonable display width scales the diamond width by the footprint area.
    For a 2x2 building: (2 + 2) * 38 = 152px (about 2 tiles wide).
    """
    return (footprint_w + footprint_h) * HALF_TILE_W


# ─── Per-PNG processing ──────────────────────────────────────────────


def process_building_png(
    faction: str,
    building_type: str,
) -> dict | None:
    """
    Process a single building PNG and return a BuildingPlacementMeta dict.

    Returns None if the PNG file is missing or has no visible content.
    """
    filename = BUILDING_FILE_NAMES[building_type]
    png_path = PUBLIC_ASSETS / faction / "buildings" / filename

    if not png_path.exists():
        return None

    img = Image.open(png_path)
    source_width, source_height = img.size

    # Alpha bounds
    alpha_bounds = compute_alpha_bounds(img)
    if alpha_bounds is None:
        return None

    visible_width = alpha_bounds["right"] - alpha_bounds["left"]
    visible_height = alpha_bounds["bottom"] - alpha_bounds["top"]

    # Ground line
    ground_line_ratio = compute_ground_line_ratio(img, alpha_bounds)

    # Origin
    origin_x = compute_origin_x(alpha_bounds, source_width)
    origin_y = ground_line_ratio

    # Footprint
    if building_type in CONFIRMED_FOOTPRINTS:
        fp_w, fp_h = CONFIRMED_FOOTPRINTS[building_type]
        footprint_source = "BUILDING_CONFIG"
    else:
        fp_w, fp_h = DEFAULT_FOOTPRINT
        footprint_source = "assumed-default"

    # Category
    category = detect_category(visible_width, visible_height)

    # Display scale
    target_display_width = compute_target_display_width(fp_w, fp_h)
    computed_scale = round(target_display_width / source_width, 6)

    # Asset key
    key_suffix = BUILDING_KEY_SUFFIXES[building_type]
    asset_key = f"building_{faction}_{key_suffix}"

    return {
        "buildingType": building_type,
        "faction": faction,
        "assetKey": asset_key,
        "sourceWidth": source_width,
        "sourceHeight": source_height,
        "alphaBounds": alpha_bounds,
        "visibleWidth": visible_width,
        "visibleHeight": visible_height,
        "footprintW": fp_w,
        "footprintH": fp_h,
        "anchorMode": "south-vertex",
        "category": category,
        "groundLineRatio": ground_line_ratio,
        "originX": origin_x,
        "originY": origin_y,
        "targetDisplayWidth": target_display_width,
        "computedScale": computed_scale,
        "_footprintSource": footprint_source,  # metadata for report, not in TS output
    }


# ─── TypeScript output generation ────────────────────────────────────


def generate_typescript(entries: list[dict]) -> str:
    """Generate the TypeScript source file with building placement metadata."""

    lines = []
    lines.append("/**")
    lines.append(
        " * Auto-generated building placement metadata."
    )
    lines.append(
        " *"
    )
    lines.append(
        " * Generated by: tools/generate_building_meta.py (BUILD-ANCHOR-02)"
    )
    lines.append(
        " * DO NOT EDIT MANUALLY — re-run the generator when assets change."
    )
    lines.append(
        " *"
    )
    lines.append(
        " * This file is committed to version control so the runtime does not"
    )
    lines.append(
        " * need to scan PNGs at build or game time."
    )
    lines.append(" */")
    lines.append("")
    lines.append(
        "import type { BuildingPlacementMeta } from './buildingPlacementMeta';"
    )
    lines.append("")
    lines.append("export const GENERATED_BUILDING_META: BuildingPlacementMeta[] = [")
    for entry in entries:
        lines.append("  {")
        lines.append(f"    buildingType: '{entry['buildingType']}',")
        lines.append(f"    faction: '{entry['faction']}',")
        lines.append(f"    assetKey: '{entry['assetKey']}',")
        lines.append(f"    sourceWidth: {entry['sourceWidth']},")
        lines.append(f"    sourceHeight: {entry['sourceHeight']},")
        ab = entry["alphaBounds"]
        lines.append(
            f"    alphaBounds: {{ left: {ab['left']}, top: {ab['top']}, "
            f"right: {ab['right']}, bottom: {ab['bottom']} }},"
        )
        lines.append(f"    visibleWidth: {entry['visibleWidth']},")
        lines.append(f"    visibleHeight: {entry['visibleHeight']},")
        lines.append(f"    footprintW: {entry['footprintW']},")
        lines.append(f"    footprintH: {entry['footprintH']},")
        lines.append(f"    anchorMode: '{entry['anchorMode']}',")
        lines.append(f"    category: '{entry['category']}',")
        lines.append(f"    groundLineRatio: {entry['groundLineRatio']},")
        lines.append(f"    originX: {entry['originX']},")
        lines.append(f"    originY: {entry['originY']},")
        lines.append(f"    targetDisplayWidth: {entry['targetDisplayWidth']},")
        lines.append(f"    computedScale: {entry['computedScale']},")
        lines.append("  },")
    lines.append("];")
    lines.append("")

    return "\n".join(lines)


# ─── Main ─────────────────────────────────────────────────────────────


def main() -> None:
    print("=" * 60)
    print("BUILD-ANCHOR-02: Offline building alpha-bounds generator")
    print("=" * 60)
    print()

    entries: list[dict] = []
    missing_pngs: list[str] = []
    missing_configs: set[str] = set()
    empty_pngs: list[str] = []

    for faction in FACTIONS:
        for building_type in BUILDING_TYPES:
            result = process_building_png(faction, building_type)
            if result is None:
                filename = BUILDING_FILE_NAMES[building_type]
                png_path = PUBLIC_ASSETS / faction / "buildings" / filename
                if not png_path.exists():
                    missing_pngs.append(f"{faction}/{building_type}")
                else:
                    empty_pngs.append(f"{faction}/{building_type}")
                continue

            if result["_footprintSource"] == "assumed-default":
                missing_configs.add(building_type)

            entries.append(result)

    # ─── Console report ──────────────────────────────────────────────

    print(f"Processed: {len(entries)} building/faction combinations")
    print(f"  6 types x 4 factions = 24 expected")
    print()

    if missing_pngs:
        print(f"MISSING PNG files ({len(missing_pngs)}):")
        for m in missing_pngs:
            print(f"  - {m}")
        print()

    if empty_pngs:
        print(f"EMPTY or fully-transparent PNGs ({len(empty_pngs)}):")
        for e in empty_pngs:
            print(f"  - {e}")
        print()

    if missing_configs:
        print(f"Building types WITHOUT BUILDING_CONFIG entry (using assumed default {DEFAULT_FOOTPRINT}):")
        for bt in sorted(missing_configs):
            print(f"  - {bt} (assumed footprint: {DEFAULT_FOOTPRINT[0]}x{DEFAULT_FOOTPRINT[1]})")
        print()

    # Print summary table
    print(f"{'Faction':<8} {'Type':<18} {'Source':>10} {'AlphaBounds':>28} {'Visible':>12} {'GLR':>8} {'Scale':>8} {'Cat':<10} {'FP':>5}")
    print("-" * 120)
    for e in entries:
        ab = e["alphaBounds"]
        ab_str = f"L{ab['left']} T{ab['top']} R{ab['right']} B{ab['bottom']}"
        vis_str = f"{e['visibleWidth']}x{e['visibleHeight']}"
        fp_str = f"{e['footprintW']}x{e['footprintH']}"
        print(
            f"{e['faction']:<8} {e['buildingType']:<18} "
            f"{e['sourceWidth']}x{e['sourceHeight']:>5} "
            f"{ab_str:>28} {vis_str:>12} "
            f"{e['groundLineRatio']:>8.4f} {e['computedScale']:>8.4f} "
            f"{e['category']:<10} {fp_str:>5}"
        )

    # ─── Write output ────────────────────────────────────────────────

    ts_source = generate_typescript(entries)
    OUTPUT_FILE.write_text(ts_source, encoding="utf-8")
    print()
    print(f"Output written to: {OUTPUT_FILE.relative_to(PROJECT_ROOT)}")
    print(f"  {len(entries)} metadata entries generated")
    print()
    print("Next step: BUILD-ANCHOR-03 — south-vertex renderer formula")


if __name__ == "__main__":
    main()
