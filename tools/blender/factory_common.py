"""
Shared helpers for the TankViewer -> Blender -> sprite factory pipeline.

These helpers are pure Python so they can be used outside Blender for planning,
manifest generation, and contact-sheet work.
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable
import json
import re

TILE_W = 76
TILE_H = 38
BASIS_X = {"x": TILE_W / 2, "y": TILE_H / 2}
BASIS_Y = {"x": -TILE_W / 2, "y": TILE_H / 2}
BASIS_Z = {"x": 0, "y": -60}

SOURCE_ROOT = Path("art/source/tankviewer")
GENERATED_ROOT = Path("art/generated/tankviewer")
REPORTS_ROOT = Path("art/reports/tankviewer")

HULLS = [
    "wasp",
    "hornet",
    "hunter",
    "viking",
    "dictator",
    "titan",
    "mammoth",
]

TURRETS = [
    "smoky",
    "firebird",
    "freeze",
    "isida",
    "railgun",
    "ricochet",
    "thunder",
    "twins",
    "vulcan",
    "hammer",
    "striker",
]

FACTIONS = ["cyan", "green", "yellow", "purple"]
M_LEVELS = [0, 1, 2, 3]

SOURCE_TO_RUNTIME_NAME = {
    "firebird": "flamethrower",
}

DIRECTION_NAMES_8 = ["E", "SE", "S", "SW", "W", "NW", "N", "NE"]
DIRECTION_NAMES_16 = [
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
    "N",
    "NNE",
    "NE",
    "ENE",
]

DIRECTION_CONVENTION_TEXT = (
    "dir0=E, dir1=ESE, dir2=SE, dir3=SSE, dir4=S, dir5=SSW, dir6=SW, "
    "dir7=WSW, dir8=W, dir9=WNW, dir10=NW, dir11=NNW, dir12=N, "
    "dir13=NNE, dir14=NE, dir15=ENE"
)


def ensure_parent_on_path() -> None:
    """No-op helper kept for symmetry with other scripts."""


def kind_to_source_dir(kind: str) -> str:
    if kind == "hull":
        return "hulls"
    if kind == "turret":
        return "turrets"
    raise ValueError(f"Unsupported kind: {kind}")


def runtime_name(source_name: str) -> str:
    return SOURCE_TO_RUNTIME_NAME.get(source_name, source_name)


def m_level_tag(m_level: int) -> str:
    return f"m{m_level}"


def asset_id(kind: str, source_name: str, m_level: int) -> str:
    suffix = "hull" if kind == "hull" else "turret"
    return f"{runtime_name(source_name)}_{m_level_tag(m_level)}_{suffix}"


def frame_filename(kind: str, source_name: str, m_level: int, faction: str, direction: int) -> str:
    return f"{asset_id(kind, source_name, m_level)}_{faction}_dir{direction}.png"


def direction_names(num_directions: int) -> list[str]:
    if num_directions == 8:
        return list(DIRECTION_NAMES_8)
    if num_directions == 16:
        return list(DIRECTION_NAMES_16)
    return [f"dir{i}" for i in range(num_directions)]


def direction_angle(direction: int, num_directions: int) -> float:
    return round(direction * (360.0 / num_directions), 4)


def source_files_for(source_name: str, m_level: int) -> tuple[str, str]:
    return (f"{source_name}_{m_level}_details.png", f"{source_name}_{m_level}_lightmap.jpg")


def candidate_model_names(source_name: str) -> list[str]:
    title = source_name.capitalize()
    return [
        f"{title}_0123.3ds",
        f"{title}.3ds",
        f"{source_name}.3ds",
        f"{title}_{source_name}.3ds",
    ]


def resolve_model_file(source_dir: Path, source_name: str) -> Path | None:
    for candidate in candidate_model_names(source_name):
        path = source_dir / candidate
        if path.exists():
            return path

    matches = sorted(source_dir.glob("*.3ds"))
    if len(matches) == 1:
        return matches[0]

    pattern = re.compile(re.escape(source_name), re.IGNORECASE)
    for match in matches:
        if pattern.search(match.name):
            return match
    return None


def resolve_named_file(source_dir: Path, candidate_name: str) -> Path | None:
    direct = source_dir / candidate_name
    if direct.exists():
        return direct

    pattern = re.compile(rf"^{re.escape(candidate_name)}$", re.IGNORECASE)
    for match in source_dir.iterdir():
        if match.is_file() and pattern.match(match.name):
            return match
    return None


@dataclass
class AssetSpec:
    kind: str
    source_name: str
    runtime_name: str
    m_level: int
    faction: str
    directions: int
    source_dir: str
    model_file: str | None
    details_file: str
    lightmap_file: str
    output_dir: str
    render_log: str
    manifest_path: str


def build_asset_spec(
    source_root: Path,
    output_root: Path,
    kind: str,
    source_name: str,
    m_level: int,
    faction: str,
    directions: int = 16,
) -> AssetSpec:
    category_dir = kind_to_source_dir(kind)
    category_root = source_root / "data" / category_dir
    nested_source_dir = category_root / source_name
    source_dir = nested_source_dir if nested_source_dir.exists() else category_root
    model = resolve_model_file(source_dir, source_name)
    details_name, lightmap_name = source_files_for(source_name, m_level)
    details_file = resolve_named_file(source_dir, details_name)
    lightmap_file = resolve_named_file(source_dir, lightmap_name)
    output_dir = output_root / category_dir / runtime_name(source_name) / m_level_tag(m_level) / faction
    return AssetSpec(
        kind=kind,
        source_name=source_name,
        runtime_name=runtime_name(source_name),
        m_level=m_level,
        faction=faction,
        directions=directions,
        source_dir=str(source_dir),
        model_file=str(model) if model else None,
        details_file=details_file.name if details_file else details_name,
        lightmap_file=lightmap_file.name if lightmap_file else lightmap_name,
        output_dir=str(output_dir),
        render_log=str(output_dir / "render_log.json"),
        manifest_path=str(output_dir / "manifest.json"),
    )


def planned_specs(
    source_root: Path,
    output_root: Path,
    directions: int = 16,
    factions: Iterable[str] = FACTIONS,
) -> list[AssetSpec]:
    specs: list[AssetSpec] = []
    for source_name in HULLS:
        for m_level in M_LEVELS:
            for faction in factions:
                specs.append(build_asset_spec(source_root, output_root, "hull", source_name, m_level, faction, directions))
    for source_name in TURRETS:
        for m_level in M_LEVELS:
            for faction in factions:
                specs.append(build_asset_spec(source_root, output_root, "turret", source_name, m_level, faction, directions))
    return specs


def dump_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)


def specs_to_json(specs: Iterable[AssetSpec]) -> list[dict]:
    return [asdict(spec) for spec in specs]
