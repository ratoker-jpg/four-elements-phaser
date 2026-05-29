# MAPLIFE Core Desert Decor Pack

This folder contains the first production MAPLIFE desert decor pack used by `MAPLIFE-02A`.

Decor families:
- `env_rock_cluster_{1x1,2x2,3x3}.png`
- `env_bush_dry_cluster_{1x1,2x2,3x3}.png`
- `env_sand_crack_patch_{1x1,2x2,3x3}.png`
- `env_sand_bump_patch_{1x1,2x2,3x3}.png`

Rules:
- Decorative-only visuals.
- No pathfinding, occupancy, build-placement, fog, or economy effects.
- Final PNGs use alpha transparency with no chroma background.

Artifacts:
- `maplife_asset_report.json`: per-file dimensions and QA metadata.
- `previews/maplife_contact_sheet.png`: pack overview.
- `previews/maplife_terrain_preview.png`: terrain-context preview.

Generation:
- Source pack assembled by `tools/generate_maplife_assets.py`.
- Runtime keys/paths are wired through `src/assets/maplifeDecor.ts` and the generated asset manifest.
