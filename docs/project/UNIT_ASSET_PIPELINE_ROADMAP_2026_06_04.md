# UNIT-ASSET-PIPELINE — 3DS TankViewer → Blender → Isometric Sprite Pipeline

Status: roadmap — UNIT-ASSET-PIPELINE-01 (tooling/calibration PR)  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Date: 2026-06-04

---

## 1. Purpose

Define the offline pipeline for converting TankViewer-style 3DS models and textures into 2D isometric sprite sheets compatible with the game's CAMERA_PROJECTION_CONTRACT.

Source assets are TankViewer .3ds geometry files plus _details.png and _lightmap.jpg textures per hull/turret per M-level. The pipeline renders each asset at 16 directions on a transparent background through an orthographic camera that matches the game's fixed isometric projection, producing separate hull and turret sprite layers for runtime compositing.

---

## 2. Source archive structure

Source assets are placed locally under an ignored/staging path and are NOT committed to the repo:

```
art/source/tankviewer/
├── data/
│   ├── hulls/
│   │   ├── wasp/                      # Wasp hull
│   │   │   ├── wasp.3ds               # Geometry (may cover all M-levels)
│   │   │   ├── wasp_0_details.png     # M0 diffuse/details texture
│   │   │   ├── wasp_0_lightmap.jpg    # M0 lightmap/baked AO
│   │   │   ├── wasp_1_details.png     # M1
│   │   │   ├── wasp_1_lightmap.jpg
│   │   │   ├── wasp_2_details.png     # M2
│   │   │   ├── wasp_2_lightmap.jpg
│   │   │   ├── wasp_3_details.png     # M3
│   │   │   └── wasp_3_lightmap.jpg
│   │   ├── hornet/
│   │   ├── hunter/
│   │   ├── viking/
│   │   ├── dictator/
│   │   ├── titan/
│   │   └── mammoth/
│   └── turrets/
│       ├── smoky/
│       │   ├── smoky.3ds              # Geometry (may cover all M-levels)
│       │   ├── smoky_0_details.png
│       │   ├── smoky_0_lightmap.jpg
│       │   ├── smoky_1_details.png
│       │   ├── smoky_1_lightmap.jpg
│       │   ├── smoky_2_details.png
│       │   ├── smoky_2_lightmap.jpg
│       │   ├── smoky_3_details.png
│       │   └── smoky_3_lightmap.jpg
│       ├── firebird/                   # = Flamethrower in game naming
│       ├── freeze/
│       ├── isida/
│       ├── railgun/
│       ├── ricochet/
│       ├── thunder/
│       ├── twins/
│       ├── vulcan/
│       ├── hammer/
│       └── striker/
```

Some .3ds files may use alternative naming (e.g. `wasp_0.3ds`, `wasp_hull.3ds`). The Blender import script handles this by scanning the directory for matching .3ds files.

---

## 3. M-level mapping

| Suffix | Game M-level | Description |
|--------|-------------|-------------|
| _0 | M0 | Base / stock modification |
| _1 | M1 | First upgrade |
| _2 | M2 | Second upgrade |
| _3 | M3 | Maximum upgrade |

Textures use the suffix pattern `{name}_{level}_details.png` and `{name}_{level}_lightmap.jpg`.

---

## 4. Firebird → Flamethrower mapping

| Source asset name | Game weapon name | Notes |
|------------------|-----------------|-------|
| firebird | flamethrower | The TankViewer source calls it "firebird"; the game's weapon config uses "flamethrower" |

All tooling and manifest generation must map `firebird` → `flamethrower` at the output path stage. The source archive is not renamed; mapping is applied during the render/manifest step.

---

## 5. Direction model: 16 directions

### Current state (8 directions)

The current blockout/modular system uses 8 directions (dir0–dir7) with a 45-degree step. The ModularTankRenderer and modularUnitAssets use:

```
dir0 = facing north (up-right in isometric)
dir1 = facing north-east
...
dir7 = facing north-west
```

### Target state (16 directions)

The production pipeline uses 16 directions with a 22.5-degree step for smoother turret rotation. This is especially important for turrets that must aim precisely at targets.

| Direction index | Angle (degrees) | Angle (radians) |
|----------------|-----------------|-----------------|
| dir0 | 0.0 | 0.0 |
| dir1 | 22.5 | π/8 |
| dir2 | 45.0 | π/4 |
| dir3 | 67.5 | 3π/8 |
| dir4 | 90.0 | π/2 |
| dir5 | 112.5 | 5π/8 |
| dir6 | 135.0 | 3π/4 |
| dir7 | 157.5 | 7π/8 |
| dir8 | 180.0 | π |
| dir9 | 202.5 | 9π/8 |
| dir10 | 225.0 | 5π/4 |
| dir11 | 247.5 | 11π/8 |
| dir12 | 270.0 | 3π/2 |
| dir13 | 292.5 | 13π/8 |
| dir14 | 315.0 | 7π/4 |
| dir15 | 337.5 | 15π/8 |

### Why 16 directions for the first pilot

- Turrets require fine-grained aiming for target-lock behavior; 8 directions produce visible "stepping" when the turret tracks a moving target.
- 16 directions give 22.5-degree resolution, which is visually acceptable for isometric tanks at typical zoom levels.
- 32 directions would be smoother but double the sprite count (32 × 2 layers × 4 factions = 256 images per hull/turret combo).
- 16 is the pragmatic balance between visual quality and asset footprint.
- Hulls may still use 8 directions in production if visual testing shows no perceptible difference for body rotation; the pilot tests both at 16 to gather data.

---

## 6. Camera calibration: CAMERA_PROJECTION_CONTRACT alignment

The game's projection contract defines:

```
screen = origin + worldX * basisX + worldY * basisY + worldZ * basisZ

basisX = { x: 38, y: 19 }   (TILE_W/2, TILE_H/2)
basisY = { x: -38, y: 19 }  (-TILE_W/2, TILE_H/2)
basisZ = { x: 0, y: -60 }   (vertical scale)
```

### Blender camera setup

To match this in Blender:

1. **Orthographic camera** — no perspective distortion.
2. **Camera rotation** — set to match the isometric angle implied by the basis vectors.
3. **Scale** — calibrated so that 1 Blender unit = 1 tile unit, and rendered pixels match the basis projection.

### Deriving Blender camera angles from basis vectors

The isometric basis vectors imply:

- basisX = {38, 19}: +X moves right and down on screen.
- basisY = {-38, 19}: +Y moves left and down on screen.
- The ground plane is a 2:1 diamond (76×38 tile).

For a true isometric projection (equal foreshortening on all three axes), the camera azimuth and elevation are:
- **Azimuth** (rotation around Z): 45 degrees
- **Elevation** (angle from horizontal): arctan(1/√2) ≈ 35.264 degrees

However, the game's basisZ = {0, -60} means the vertical scale is NOT standard isometric. The vertical stretch factor relative to the ground plane is:

```
verticalStretch = |basisZ.y| / (TILE_H / 2) = 60 / 19 ≈ 3.158
```

This means 1 world Z unit appears 3.158× taller than 1 ground-plane tile step in Y. The Blender camera must account for this by either:
- Scaling the model's Z axis by the inverse (1/3.158) before rendering, OR
- Using a non-uniform orthographic scale.

The calibration script in `tools/blender/calibrate_camera.py` computes the exact camera parameters and validates them against the contract's projection formula.

---

## 7. Output folder structure

Rendered sprites are written to the art/generated/ directory (gitignored for mass output):

```
art/generated/
├── tankviewer/
│   ├── hulls/
│   │   └── wasp/
│   │       ├── m0/
│   │       │   ├── wasp_m0_hull_cyan_dir0.png
│   │       │   ├── wasp_m0_hull_cyan_dir1.png
│   │       │   └── ... (16 dirs × 4 factions = 64 PNGs per hull per M-level)
│   │       ├── m1/
│   │       ├── m2/
│   │       └── m3/
│   └── turrets/
│       └── smoky/
│           ├── m0/
│           │   ├── smoky_m0_turret_cyan_dir0.png
│           │   └── ... (16 dirs × 4 factions = 64 PNGs per turret per M-level)
│           ├── m1/
│           ├── m2/
│           └── m3/
└── tankviewer_manifest.json
```

After visual review and approval, selected sprites are copied to `public/assets/units/` following the existing naming convention, and the manifest is regenerated.

---

## 8. Manifest schema (draft)

```json
{
  "version": 2,
  "pipeline": "tankviewer-blender-isometric",
  "generatedAt": "2026-06-04T12:00:00.000Z",
  "source": {
    "archive": "art/source/tankviewer/data",
    "mapping": {
      "firebird": "flamethrower"
    }
  },
  "entries": [
    {
      "key": "wasp_m0_hull_cyan_dir0",
      "sourceModel": "art/source/tankviewer/data/hulls/wasp/wasp.3ds",
      "sourceDiffuse": "art/source/tankviewer/data/hulls/wasp/wasp_0_details.png",
      "sourceLightmap": "art/source/tankviewer/data/hulls/wasp/wasp_0_lightmap.jpg",
      "outputPath": "art/generated/tankviewer/hulls/wasp/m0/wasp_m0_hull_cyan_dir0.png",
      "runtimePath": "assets/units/chassis/wasp_m0/cyan/wasp_m0_hull_idle_dir0_0.png",
      "category": "hull",
      "hullName": "wasp",
      "mLevel": 0,
      "faction": "cyan",
      "direction": 0,
      "directionAngleDeg": 0.0,
      "frameW": 256,
      "frameH": 256
    }
  ]
}
```

This manifest is for pipeline tracking only. The runtime manifest (`GENERATED_ASSET_MANIFEST` in `src/assets/generatedAssetManifest.ts`) continues to be generated by `tools/process_art_assets.mjs` and only includes assets that have been approved and copied to `public/assets/`.

---

## 9. PR sequence

| PR | Task | Scope |
|----|------|-------|
| UNIT-ASSET-PIPELINE-01 | Blender camera rig + 3DS import calibration | Tooling, scripts, docs. No runtime changes. No production sprites. |
| UNIT-ASSET-PIPELINE-02 | Wasp M0 hull 16-dir render + hull manifest pilot | Render Wasp M0 hull 16 directions, cyan faction. Integrate into runtime manifest. |
| UNIT-ASSET-PIPELINE-03 | Smoky M0 turret 16-dir render + turret manifest pilot | Render Smoky M0 turret 16 directions, cyan faction. Integrate with hull. |
| UNIT-ASSET-PIPELINE-04 | ProductionTankRenderer (16-dir) | New renderer using 16-dir sprites, replacing ModularTankRenderer for production assets. |
| UNIT-ASSET-PIPELINE-05+ | Additional hulls/turrets, all factions, M-levels | Expand to all hulls/turrets with validated pipeline. |

---

## 10. Pilot target

First pilot (UNIT-ASSET-PIPELINE-02/03):
- **Hull**: Wasp M0
- **Turret**: Smoky M0
- **Directions**: 16
- **Faction**: cyan first
- **Purpose**: Validate end-to-end pipeline from .3ds import through Blender render to Phaser runtime display.

---

## 11. Risks

| Risk | Mitigation |
|------|-----------|
| .3ds import produces broken geometry in Blender | Test with Wasp M0 early; if 3DS import fails, consider alternative converters (Assimp, 3ds2obj) |
| Camera calibration does not match contract within ±1 px | Calibration script reports exact error; if >1 px, adjust Blender camera scale empirically and document the offset |
| Lightmap UV does not align with details texture | Test texture application on Wasp M0; may need UV remapping in Blender |
| 16 directions produce too many assets (size/load time) | Measure first; if excessive, fall back to 8 for hulls and keep 16 for turrets only |
| Source archive structure varies from expected | Import script uses flexible scanning with clear error messages |
| Blender not available in CI | Pipeline is offline/manual; CI does not run Blender. Validation is typecheck + test + build only. |

---

## 12. Acceptance criteria for UNIT-ASSET-PIPELINE-01

1. Blender Python script can import a .3ds file and apply textures.
2. Camera calibration script renders test markers and reports pixel error vs. CAMERA_PROJECTION_CONTRACT.
3. Pipeline documentation describes the complete workflow.
4. .gitignore updated for local source/output paths.
5. Dry-run manifest/path planning test passes.
6. No runtime code changes, no gameplay changes.
7. `npm run typecheck && npm run test && npm run build && npm run qa:smoke` all pass.
