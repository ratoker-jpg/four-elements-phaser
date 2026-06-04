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
2. **Select** the .3ds model file (e.g., `Wasp_0123.3ds`).
3. **Optionally select** details texture and lightmap texture.
4. **Click "Render All Directions"** — the page renders 16 directions and
   shows a preview grid.
5. **Click "Export All PNGs + Manifest"** — downloads each PNG and a
   `manifest.json` to your Downloads folder.
6. **Move** downloaded files to `art/generated/tankviewer/`.

## Auto Fit Model

**ON by default.** When enabled, the exporter automatically normalizes the
model scale so that it fits within the render frame regardless of the original
3DS model's unit size.

TankViewer .3ds models use large raw units (e.g., Wasp bbox spans 264 x 462 x
181.5 units). Without auto-fit, the default ortho scale of 4.0 causes the model
to be entirely outside the camera frustum, producing fully transparent/empty
PNGs.

### How auto-fit works

1. After loading the 3DS model, the exporter computes the bounding box.
2. The model is centered around the origin.
3. The maximum dimension (X, Y, or Z) of the bounding box is computed.
4. A uniform scale factor is calculated: `normalizeScale = targetSize / maxDim`.
5. The model is scaled uniformly by this factor so the max dimension equals
   the target size (default: 3.0 world units).
6. The Z Scale slider is applied on top of the normalization.

### Auto-fit UI controls

| Control | Default | Description |
|---------|---------|-------------|
| Auto Fit Model | ON | Enable/disable automatic scale normalization |
| Fit Target Size | 3.0 | Target max dimension in world units after normalization |

### Auto-fit log output

When auto-fit is applied, the log shows:
- Original bounding box (min → max)
- Original size (X x Y x Z)
- Normalize scale factor applied
- Final bounding box (centered + scaled)
- Final max dimension (should match target)
- Effective orthoScale

### When to turn auto-fit OFF

If you need to render at the original 3DS model scale (e.g., for debugging or
comparing raw geometry), uncheck "Auto Fit Model" and increase the Ortho Scale
manually to match the model's size.

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
- **Near/Far**: 0.01 / 10000 (accommodates raw TankViewer model units)
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
| Z Scale | 1.0 | Model Z-axis stretch factor (applied on top of auto-fit) |
| Auto Fit Model | ON | Normalize model scale to fit render frame |
| Fit Target Size | 3.0 | Max dimension in world units after normalization |

## Manifest auto-fit fields

The exported `manifest.json` includes an `autoFit` section:

```json
{
  "autoFit": {
    "enabled": true,
    "targetSize": 3.0,
    "originalSize": "264.00 x 462.00 x 181.50",
    "normalizeScale": 0.006494,
    "finalSize": "3.00"
  },
  "orthoScale": 4.0
}
```

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
| Auto-fit scale | Yes (default ON) | N/A (manual) |

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

**Feasibility spike** — validated with real TankViewer Wasp assets:

1. TDSLoader parses Wasp_0123.3ds successfully
2. Auto-fit normalizes model scale so it fits the render frame
3. Textures apply correctly via file picker
4. Direction convention: dir0=E (needs visual verification per model)
5. Empty PNG root cause: fixed by auto-fit + camera near/far adjustment
