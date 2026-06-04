# tools/blender/ — Blender Pipeline for TankViewer 3DS → Isometric Sprites

UNIT-ASSET-PIPELINE-01: Camera rig + 3DS import calibration tooling.

## Overview

This directory contains Blender Python scripts for the offline rendering pipeline
that converts TankViewer-style 3DS models into 2D isometric sprite sheets
compatible with the game's CAMERA_PROJECTION_CONTRACT.

## Scripts

### render_tank_sprite.py

Imports a .3ds file, applies textures, sets up an orthographic isometric camera,
and renders the model at multiple rotation angles to transparent PNG files.

**Direction convention:** dir0 = E (screen-right), matching the game's
`directionFromDelta()` mapping: E=0, SE=1, S=2, SW=3, W=4, NW=5, N=6, NE=7.
For 16 directions: 0=E, 1=ESE, 2=SE, 3=SSE, 4=S, 5=SSW, 6=SW, 7=WSW,
8=W, 9=WNW, 10=NW, 11=NNW, 12=N, 13=NNE, 14=NE, 15=ENE.

**Usage:**

```bash
blender --background --python tools/blender/render_tank_sprite.py -- \
    --source art/source/tankviewer/data/hulls/wasp \
    --model wasp.3ds \
    --diffuse wasp_0_details.png \
    --lightmap wasp_0_lightmap.jpg \
    --output art/generated/tankviewer/hulls/wasp/m0 \
    --directions 16 \
    --faction cyan \
    --name wasp_m0_hull
```

**Arguments:**

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--source` | Yes | - | Directory containing .3ds and texture files |
| `--model` | No | - | .3ds filename within source directory |
| `--diffuse` | No | - | Diffuse/details texture filename |
| `--lightmap` | No | - | Lightmap texture filename |
| `--output` | Yes | - | Output directory for rendered PNGs |
| `--directions` | No | 16 | Number of rotation directions to render |
| `--faction` | No | cyan | Faction name for output naming |
| `--name` | No | tank | Asset name prefix for output files |
| `--resolution` | No | 256 | Output image resolution (square) |
| `--orthographic-scale` | No | 4.0 | Blender orthographic camera scale |

**Error handling:**

- If source files are not found, the script prints a clear error message and
  exits cleanly (exit code 0). This ensures CI is not broken when source assets
  are not present (they are intentionally local/uncommitted).

### calibrate_camera.py

Renders calibration markers through the isometric camera and computes expected
screen positions using the CAMERA_PROJECTION_CONTRACT formula. Generates a
calibration image for manual comparison — measure marker centers in the rendered
PNG against expected positions in the report.

**Usage (full render inside Blender):**

```bash
blender --background --python tools/blender/calibrate_camera.py -- \
    --output art/generated/tankviewer/calibration
```

**Usage (compare-only, no Blender needed):**

```bash
python3 tools/blender/calibrate_camera.py --compare-only \
    --output art/generated/tankviewer/calibration
```

**Arguments:**

| Argument | Required | Default | Description |
|----------|----------|---------|-------------|
| `--output` | No | art/generated/tankviewer/calibration | Output directory |
| `--resolution` | No | 512 | Render resolution for calibration image |
| `--orthographic-scale` | No | 5.0 | Camera orthographic scale |
| `--compare-only` | No | false | Skip Blender render, just show report |

**Calibration process:**

1. Run the calibration render inside Blender.
2. Open the rendered image (`calibration_render.png`) in an image editor.
3. Measure the pixel coordinates of each colored marker.
4. Compare against expected positions in `calibration_report.json`.
5. Report the pixel error for each calibration point.
6. Target: within ±1 px of the expected position.

**Calibration points:**

| Point | World position | Color | What it tests |
|-------|---------------|-------|---------------|
| ground_origin | (0,0,0) | White | Origin alignment |
| plus_X_tile_step | (1,0,0) | Red | X-axis basis |
| plus_Y_tile_step | (0,1,0) | Green | Y-axis basis |
| plus_Z_height | (0,0,1) | Blue | Z-axis basis |
| combined_1_1_1 | (1,1,1) | Yellow | Combined projection |
| minus_X_tile_step | (-1,0,0) | Orange | Negative X |
| minus_Y_tile_step | (0,-1,0) | Cyan | Negative Y |
| ground_1_1 | (1,1,0) | Purple | Ground diagonal |
| plus_2X_tile_step | (2,0,0) | Pink | Double X step |
| half_Z_height | (0,0,0.5) | Light blue | Half Z step |

## Camera setup

The Blender camera is configured to match the game's CAMERA_PROJECTION_CONTRACT:

```
screen = origin + worldX * basisX + worldY * basisY + worldZ * basisZ

basisX = { x: 38, y: 19 }
basisY = { x: -38, y: 19 }
basisZ = { x: 0, y: -60 }
```

The camera uses:
- **Type**: Orthographic (no perspective distortion)
- **Azimuth**: 45 degrees
- **Elevation**: arctan(1/sqrt(2)) ≈ 35.264 degrees
- **Background**: Transparent (render_tank_sprite) or dark gray (calibrate_camera)

The vertical scale is non-standard: basisZ.y = -60 per unit (vs. standard
isometric ~19 per unit). This makes objects appear taller. The calibration
script validates that the rendered output matches these exact projection values.

## Source archive structure

Source assets must be placed locally under:

```
art/source/tankviewer/data/
├── hulls/
│   ├── wasp/
│   │   ├── wasp.3ds
│   │   ├── wasp_0_details.png     # M0 diffuse
│   │   ├── wasp_0_lightmap.jpg    # M0 lightmap
│   │   ├── wasp_1_details.png     # M1
│   │   ├── wasp_1_lightmap.jpg
│   │   ├── wasp_2_details.png     # M2
│   │   ├── wasp_2_lightmap.jpg
│   │   ├── wasp_3_details.png     # M3
│   │   └── wasp_3_lightmap.jpg
│   ├── hornet/
│   ├── hunter/
│   ├── viking/
│   ├── dictator/
│   ├── titan/
│   └── mammoth/
└── turrets/
    ├── smoky/
    │   ├── smoky.3ds
    │   ├── smoky_0_details.png
    │   ├── smoky_0_lightmap.jpg
    │   └── ... (M1-M3)
    ├── firebird/          # = flamethrower in game
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

This directory is gitignored. Source assets are NOT committed to the repo.

## M-level mapping

| Suffix | Game M-level |
|--------|-------------|
| _0 | M0 |
| _1 | M1 |
| _2 | M2 |
| _3 | M3 |

## Firebird to Flamethrower mapping

The TankViewer source calls the flamethrower turret "firebird". The game's
weapon config uses "flamethrower". The mapping is applied during manifest
generation, not at the source file level.

| Source name | Game name |
|------------|-----------|
| firebird | flamethrower |

## First pilot target

- **Hull**: Wasp M0
- **Turret**: Smoky M0
- **Directions**: 16
- **Faction**: cyan first
- **Purpose**: Validate the end-to-end pipeline from .3ds import through
  Blender render to Phaser runtime display.

## Why 16 directions

1. Turrets require fine-grained aiming for target-lock behavior.
   8 directions produce visible "stepping" when tracking a moving target.
2. 16 directions give 22.5-degree resolution, which is visually acceptable
   for isometric tanks at typical zoom levels.
3. 32 directions would double the sprite count with diminishing visual returns.
4. Hulls may still use 8 directions if visual testing shows no perceptible
   difference; the pilot tests both at 16 to gather data.

## Prerequisites

- **Blender** 3.x+ installed and available on PATH
- **io_scene_3ds** addon enabled in Blender (Import-Export: 3DS Format)
- Source TankViewer assets placed under `art/source/tankviewer/data/`

## Manual Blender command for Denis

Render Wasp M0 hull (cyan, 16 directions):

```bash
blender --background --python tools/blender/render_tank_sprite.py -- \
    --source art/source/tankviewer/data/hulls/wasp \
    --model wasp.3ds \
    --diffuse wasp_0_details.png \
    --lightmap wasp_0_lightmap.jpg \
    --output art/generated/tankviewer/hulls/wasp/m0 \
    --directions 16 \
    --faction cyan \
    --name wasp_m0_hull \
    --resolution 256
```

Render Smoky M0 turret (cyan, 16 directions):

```bash
blender --background --python tools/blender/render_tank_sprite.py -- \
    --source art/source/tankviewer/data/turrets/smoky \
    --model smoky.3ds \
    --diffuse smoky_0_details.png \
    --lightmap smoky_0_lightmap.jpg \
    --output art/generated/tankviewer/turrets/smoky/m0 \
    --directions 16 \
    --faction cyan \
    --name smoky_m0_turret \
    --resolution 256
```

Run calibration:

```bash
blender --background --python tools/blender/calibrate_camera.py -- \
    --output art/generated/tankviewer/calibration
```

View calibration report (no Blender needed):

```bash
python3 tools/blender/calibrate_camera.py --compare-only \
    --output art/generated/tankviewer/calibration
```
