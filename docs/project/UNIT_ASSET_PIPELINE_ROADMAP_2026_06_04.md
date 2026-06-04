# UNIT-ASSET-PIPELINE Roadmap

Status: roadmap  
Project: Four Elements Phaser  
Date: 2026-06-04

## Goal

Create an offline Blender-based render factory for TankViewer hulls and turrets. The production goal is readable transparent PNG output that matches the fixed camera projection contract. The web exporter is not the production path for Wasp-class assets.

## Source archive assumptions

Source assets are local only and are not committed.

```text
art/source/tankviewer/data/
├── hulls/
│   ├── wasp/
│   ├── hornet/
│   ├── hunter/
│   ├── viking/
│   ├── dictator/
│   ├── titan/
│   └── mammoth/
└── turrets/
    ├── smoky/
    ├── firebird/
    ├── freeze/
    ├── isida/
    ├── railgun/
    ├── ricochet/
    ├── thunder/
    ├── twins/
    ├── vulcan/
    ├── hammer/
    └── striker/
```

Known texture mapping:

- `_0` = `m0`
- `_1` = `m1`
- `_2` = `m2`
- `_3` = `m3`

Known runtime alias:

- `firebird` -> `flamethrower`

## Direction target

Use the canonical 16-direction layout:

`dir0=E, dir1=ESE, dir2=SE, dir3=SSE, dir4=S, dir5=SSW, dir6=SW, dir7=WSW, dir8=W, dir9=WNW, dir10=NW, dir11=NNW, dir12=N, dir13=NNE, dir14=NE, dir15=ENE`

## Production tooling

The Blender toolchain lives in `tools/blender/`:

- `render_tank_sprite.py`
- `calibrate_camera.py`
- `plan_batch.py`
- `generate_contact_sheet.py`
- `generate_manifest.py`
- `factory_common.py`

## Output expectations

Generated working output remains ignored during factory setup:

```text
art/generated/tankviewer/
```

Each rendered pack should produce:

- transparent PNG frames
- `render_log.json`
- `manifest.json`
- optional `contact_sheet.png`

## Pilot target

First proof:

- kind: `hull`
- asset: `wasp`
- m-level: `m0`
- faction: `cyan`
- directions: `16`
- proof requirement: exactly one readable `dir0=E` frame first

Second step after proof:

- `CODEX-UNIT-ASSET-FACTORY-02` — Wasp M0 hull 16-dir cyan batch render

## Risks

- Blender missing from environment
- 3DS importer addon disabled
- source archive naming variance
- lightmap too dark if multiplied directly
- socket/barrel metadata still preliminary until audited per asset

## Current decision

Use Blender as the factory path. Do not continue Three.js/TDSLoader debugging for production asset output in this roadmap phase.
