# tools/tankviewer-web-exporter/ — Browser-Based 3DS Sprite Exporter

UNIT-ASSET-PIPELINE-02A: Feasibility spike for a Blender-free sprite pipeline.

## Overview

A standalone web page that uses Three.js + TDSLoader to load TankViewer .3ds
models, apply textures, render them through an isometric orthographic camera
matching the game's CAMERA_PROJECTION_CONTRACT, and export transparent PNG
frames + manifest.json.

**No Blender required.** Denis opens the HTML file locally in a browser.

## Quick Start

```bash
# Option 1: Open directly (may have CORS issues with file://)
# Just double-click index.html in your browser.

# Option 2: Serve locally (recommended)
cd tools/tankviewer-web-exporter
python3 -m http.server 8765
# Then open http://localhost:8765 in Chrome/Firefox
```

## Usage

1. **Open** the page in a modern browser (Chrome/Edge recommended).
2. **Select** the .3ds model file (e.g., `wasp.3ds`).
3. **Optionally select** details texture and lightmap texture.
4. **Click "Render All Directions"** — the page renders 16 directions and
   shows a preview grid.
5. **Click "Export All PNGs + Manifest"** — downloads each PNG and a
   `manifest.json` to your Downloads folder.
6. **Move** downloaded files to `art/generated/tankviewer/`.

## Direction Convention

Same as the game's `directionFromDelta()`:

- **8-dir:** 0=E, 1=SE, 2=S, 3=SW, 4=W, 5=NW, 6=N, 7=NE
- **16-dir:** 0=E, 1=ESE, 2=SE, 3=SSE, 4=S, 5=SSW, 6=SW, 7=WSW,
  8=W, 9=WNW, 10=NW, 11=NNW, 12=N, 13=NNE, 14=NE, 15=ENE

## Camera Setup

The Three.js orthographic camera is configured to match CAMERA_PROJECTION_CONTRACT:

- **Type**: Orthographic (no perspective)
- **Azimuth**: 45 degrees
- **Elevation**: arctan(1/√2) ≈ 35.264 degrees
- **Background**: Transparent (RGBA)

## Calibration

Click "Calibration Test" to render colored axis markers without loading a model.
The log shows expected screen positions computed from the projection contract.
Measure marker centers in the rendered image to determine pixel error.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Asset Name | wasp_m0_hull | Prefix for output filenames |
| Faction | cyan | Faction name in manifest |
| Directions | 16 | Number of rotation angles |
| Resolution | 256 | Output image size (square) |
| Ortho Scale | 4.0 | Camera orthographic scale |
| Z Scale | 1.0 | Model Z-axis stretch factor |

## Known Limitations (vs Blender)

| Feature | Web Exporter | Blender Pipeline |
|---------|-------------|-----------------|
| 3DS import | TDSLoader (basic) | Full Blender importer |
| Texture support | Diffuse + lightmap | Full PBR node system |
| Lightmap UV | Same UV as diffuse | Separate UV channel |
| Lighting | Basic directional | EEVEE/Cycles |
| Anti-aliasing | None (canvas) | MSAA, supersampling |
| Camera calibration | Manual comparison | Manual comparison |
| Z-stretch handling | Manual Z-scale slider | VERTICAL_STRETCH_FACTOR |
| Batch processing | Manual per-model | CLI script |
| Output quality | Good for preview | Production quality |

## Dependencies

- **Three.js** — loaded from CDN (jsDelivr), not installed in the project
- **TDSLoader** — Three.js addon, loaded from CDN
- **No npm packages added** to the game's package.json

## Relationship to Game Code

This tool is **completely standalone**:

- Not imported by any Phaser game code
- Not part of the Vite build
- Not referenced by any TypeScript module
- No changes to package.json or package-lock.json
- Source assets remain local/gitignored

## ROTATION_OFFSET_DEG

The default `ROTATION_OFFSET_DEG = -90` assumes the 3DS model faces +Y in
Three.js coordinates. After loading a model, visually verify that dir0 looks
like it's facing screen-right (East). If not, adjust the offset.

In the Blender pipeline, the offset is 225 degrees because Blender uses a
different coordinate convention (Z-up) and the camera is at azimuth 45.

## Status

**Feasibility spike** — not yet validated with real TankViewer assets.
Needs testing with actual wasp.3ds to confirm:

1. TDSLoader can parse the file without errors
2. Geometry looks correct after import
3. Textures apply correctly
4. Rendered sprites match the game's isometric projection within ±1 px
5. Direction convention produces correct facing for all 16 angles
