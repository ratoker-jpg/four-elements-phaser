# tools/tankviewer-web-exporter/ — Browser-Based 3DS Sprite Exporter

UNIT-ASSET-PIPELINE-02A: Feasibility spike for a Blender-free sprite pipeline.

## Overview

A standalone web page that uses Three.js + TDSLoader to load TankViewer .3ds
models, apply textures, render them through an isometric orthographic camera
matching the game's CAMERA_PROJECTION_CONTRACT, and export transparent PNG
frames + manifest.json.

**No Blender required.** Denis opens the HTML file locally in a browser.

**Config-aware**: Upload a TankViewer `config.xml` to auto-discover model
entries, expected filenames, and camera-radius. The browser cannot read disk
paths automatically, so you still select local files manually — but the tool
validates that selected filenames match the config entry.

> **Important**: The web exporter is **experimental**. config.xml is the
> source-of-truth for file mapping, but this tool is a diagnostic/preview
> aid, not a production render path. The next step is to verify the
> config-aware exporter with a real config.xml from TankViewer.zip, then
> decide whether material/camera reverse-engineering is worth continuing.

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
2. **Optionally upload** a `config.xml` file from TankViewer.zip to enable
   config-aware mode (see [Config.xml Mode](#configxml-mode) below).
3. **Select** the .3ds model file (e.g., `Wasp_0123.3ds`).
4. **Optionally select** details texture and lightmap texture.
5. **Click "Render All Directions"** — the page renders 16 directions and
   shows a preview grid.
6. **Click "Export All PNGs + Manifest"** — downloads each PNG and a
   `manifest.json` to your Downloads folder.
7. **Move** downloaded files to `art/generated/tankviewer/`.

## Config.xml Mode

The web exporter can optionally read a TankViewer `config.xml` to become
config-aware. This does **not** change rendering behavior — it provides
diagnostic metadata, file validation, and auto-fills asset names.

### What config.xml contains

TankViewer.zip includes `config.xml` alongside `TankViewer.exe` and `movie.swf`.
The XML structure is:

```xml
<root camera-radius="750">
  <hulls>
    <model file="hulls/Wasp_0123.3ds" lightmap="hulls/Wasp_0_lightmap.jpg"
           details="hulls/Wasp_0_details.png"/>
  </hulls>
  <turrets>
    <model file="turrets/Smoky_0123.3ds" lightmap="turrets/Smoky_0_lightmap.jpg"
           details="turrets/Smoky_0_details.png"/>
  </turrets>
  <colormaps>
    <colormap ... />
  </colormaps>
</root>
```

Key elements:
- **camera-radius** on `<root>`: The TankViewer camera distance. May inform
  ortho scale decisions but is not applied automatically.
- **hulls/model**: Each entry maps a .3ds file to its details + lightmap
  textures for a specific hull M-level.
- **turrets/model**: Same structure for turrets.
- **colormaps/colormap**: Faction color maps (informational only — no
  rendering impact in the web exporter).

### Config-aware workflow

1. Upload `config.xml` via the new "Config.xml" panel.
2. Select **Kind** (Hull / Turret) — populates the Asset dropdown.
3. Select **Asset** (e.g., "Wasp") — populates the M-level dropdown.
4. Select **M-level** (e.g., M0) — shows expected filenames and camera-radius.
5. Select your local .3ds, details, and lightmap files as usual.
6. The tool validates whether selected filenames match the config entry and
   shows warnings if they don't.
7. The Asset Name field auto-fills based on the config entry
   (e.g., `wasp_m0_hull`).

### Inference rules

The tool infers asset metadata from config.xml paths:

| Path Pattern | Inference |
|---|---|
| `hulls/Wasp_0123.3ds` | Kind=Hull, Asset=Wasp |
| `turrets/Smoky_0123.3ds` | Kind=Turret, Asset=Smoky |
| `Wasp_0_details.png` | M-level=0 |
| `Wasp_2_lightmap.jpg` | M-level=2 |

The trailing `_####` (4 digits) on .3ds filenames is the model rotation index
(not M-level). M-level is inferred from the `_0_`, `_1_`, `_2_`, `_3_` suffix
on details/lightmap filenames.

### File validation

When a config entry is selected, the tool compares selected local filenames
against the expected filenames from the config. Mismatches produce a warning
banner and a log entry. This catches common errors like selecting the wrong
M-level's texture or a different hull's model.

The validation is filename-only — it does not check file contents, paths, or
extensions beyond the name match.

## Auto Fit Model

**ON by default.** When enabled, the exporter automatically normalizes the
model scale so that it fits within the render frame regardless of the original
3DS model's unit size.

TankViewer .3ds models use large raw units (e.g., Wasp bbox spans 264 x 462 x
181.5 units). Without auto-fit, the default ortho scale of 4.0 causes the model
to be entirely outside the camera frustum, producing fully transparent/empty
PNGs.

### How auto-fit works

The auto-fit uses a **wrapper group** pattern (Option B) to ensure correct
centering + scaling transform:

1. After loading the 3DS model, the exporter computes the bounding box.
2. The raw model (child) has its position set to `-center`, centering vertices
   at the wrapper's local origin.
3. A wrapper `THREE.Group` is created. The child is added to it.
4. The maximum dimension (X, Y, or Z) of the bounding box is computed.
5. A uniform scale factor is calculated: `normalizeScale = targetSize / maxDim`.
6. The **wrapper** (not the child) is scaled:
   `wrapper.scale = (normalizeScale, normalizeScale * zScale, normalizeScale)`.
7. This produces the correct transform: `normalizeScale * (V - center)` instead
   of the buggy `normalizeScale * V - center`.

**Why wrapper group?** In Three.js, `object.position` is not multiplied by the
object's own scale. Setting `position = -center` then `scale = normalizeScale`
on the same object produces `scale * V - center`, which for Wasp (center
≈ 1124, 611, 50) places the model at ≈(-1117, -607, -50) — far from origin.
The wrapper group fixes this by separating centering (child position) from
scaling (wrapper scale).

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

## Manifest config-aware fields

When a config.xml entry is selected, the manifest includes a `sourceConfig`
section recording the config-derived metadata:

```json
{
  "sourceConfig": {
    "enabled": true,
    "cameraRadius": 750,
    "configModelFile": "hulls/Wasp_0123.3ds",
    "configDetailsFile": "hulls/Wasp_0_details.png",
    "configLightmapFile": "hulls/Wasp_0_lightmap.jpg"
  }
}
```

When no config.xml is loaded, `sourceConfig.enabled` is `false`.

These fields are purely informational — they record which config entry the
user selected, not what was actually rendered. The actual model/texture files
are chosen by the user and may differ from the config (in which case the
validation warnings would have been shown in the UI).

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
| config.xml aware | Yes (diagnostic) | N/A |
| File validation | Yes (filename match) | N/A |
| SWF shader reverse | No | N/A |
| 3-layer compositing | Yes (spike-composite.html) | N/A |
| Faction paint | 4 presets (spike) | N/A |
| MeshBasicMaterial | Yes (composite mode) | N/A |

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

## Composite Spike (WEBEXPORTER-SPIKE-01)

### File: `spike-composite.html`

A separate spike file that adds **TankViewer 3-layer texture compositing** to
the web exporter. This is a visual proof-of-concept — not production integration
until Denis visually verifies the output against Flash TankViewer screenshots.

### TankViewer compositing formula

CODEX-WEBEXPORTER-REVERSE-01 reverse-engineered the Flash SWF and found that
TankViewer composes textures externally using Flash blend modes:

```
composite = HARDLIGHT(colormap, MULTIPLY(lightmap, details))
```

Step-by-step:
1. Draw `details` as base (source-over)
2. Draw `lightmap` using Canvas2D `globalCompositeOperation = "multiply"`
3. Draw `colormap` (faction paint) using Canvas2D `globalCompositeOperation = "hard-light"`
4. Restore alpha from details PNG — transparent UV areas stay transparent

This matches Flash's `BlendMode.MULTIPLY` and `BlendMode.HARDLIGHT` exactly.
The Canvas2D composite operations produce the same result.

### Why no dynamic lighting in composite mode

The lightmap already contains **baked lighting** from 3ds Max. Applying it via
Canvas2D multiply bakes the lighting into the texture. Using MeshBasicMaterial
(no Three.js light response) with the composited texture produces the correct
visual result — the same approach TankViewer/Flash uses (no real-time lights).

### Faction paint presets

| Paint | RGB | CSS | Source |
|-------|-----|-----|--------|
| Green | (64, 70, 36) | `rgb(64, 70, 36)` | Archive colormap pixel data |
| Purple | (120, 0, 180) | `rgb(120, 0, 180)` | Approximation |
| Yellow | (230, 200, 0) | `rgb(230, 200, 0)` | Approximation |
| Cyan | (0, 180, 200) | `rgb(0, 180, 200)` | Approximation |

For the first spike, solid colors are acceptable. Real colormaps from
TankViewer.zip (1x1 pixel PNG/JPG) can be loaded later for exact color
matching.

### Material mode selector

The spike adds a **Material Mode** dropdown with two options:

| Mode | Material | Lighting | Description |
|------|----------|----------|-------------|
| Raw (default) | MeshStandardMaterial | Ambient + Directional | Details as diffuse map, lightmap as lightMap |
| TankViewer Composite | MeshBasicMaterial | None (baked) | Composited texture from 3-layer formula |

Default is "Raw" to preserve existing exporter behavior. Switch to
"TankViewer Composite" to see the Flash-like rendering.

### Proof workflow (for Denis)

1. Open `spike-composite.html` in a browser (serve locally for best results)
2. Upload `config.xml` from TankViewer.zip
3. Select **Hull → Wasp → M0**
4. Select `Wasp_0123.3ds` as the 3DS model
5. Select `Wasp_0_details.png` as the details texture
6. Select `Wasp_0_lightmap.jpg` as the lightmap texture
7. Switch **Material Mode** to "TankViewer Composite"
8. Select a **Faction Paint** (green, purple, yellow, or cyan)
9. Check the **Composite Preview** canvas (128x128 thumbnail)
10. Click **Render All Directions** — renders 16 directions with composited texture
11. Compare rendered output to Flash TankViewer screenshot of Wasp M0

**Success criteria:**
- Tank is visible with correct green/purple/yellow/cyan tint
- Lightmap shading is visible (tank has depth/shadow, not flat)
- Alpha transparency works (track cutouts and UV margins are transparent)
- Proportions match Flash TankViewer

### Manifest composite fields

When using composite mode, the exported manifest includes:

```json
{
  "materialMode": "tankviewer-composite",
  "paint": {
    "faction": "green",
    "color": "rgb(64, 70, 36)"
  },
  "sourceConfig": {
    "enabled": true,
    "cameraRadius": 750,
    "configModelFile": "hulls/Wasp_0123.3ds",
    "configDetailsFile": "hulls/Wasp_0_details.png",
    "configLightmapFile": "hulls/Wasp_0_lightmap.jpg"
  }
}
```

In raw mode, `materialMode` is `"raw"` and `paint` is `null`.

### Tests

`tests/unit/tools/tankviewerComposite.test.ts` — 20 tests covering:
- Faction paint preset keys and RGB values
- Material mode names
- Manifest records `materialMode = "tankviewer-composite"`
- Manifest records paint/faction color
- sourceConfig remains intact across material modes
- Compositing formula step ordering

### Next steps depend on visual comparison

If the composite spike visually matches Flash TankViewer:
- Integrate composite mode into `index.html` (main exporter)
- Support real colormap image loading from TankViewer.zip
- Add per-model texture size detection (hull=512, turret=256)
- Batch sprite generation pipeline

If the composite spike does NOT match Flash:
- Investigate whether some colormaps use OVERLAY instead of HARDLIGHT
- Adjust paint color values from real colormaps
- Consider ShaderMaterial for more precise blend control

## Status

**Feasibility spike** — validated with real TankViewer Wasp assets:

1. TDSLoader parses Wasp_0123.3ds successfully
2. Auto-fit normalizes model scale so it fits the render frame
3. Textures apply correctly via file picker
4. Direction convention: dir0=E (needs visual verification per model)
5. Empty PNG root cause: fixed by auto-fit + camera near/far adjustment
6. config.xml parsing: hulls, turrets, colormaps, camera-radius all extracted
7. Config-aware selectors: Kind → Asset → M-level workflow functional
8. File validation: warns on filename mismatches against config entry
9. Composite spike (WEBEXPORTER-SPIKE-01): 3-layer compositing proof added

**This does NOT make the web exporter production-ready.** It remains an
experimental diagnostic/preview tool. The next step is for Denis to visually
verify the composite spike against Flash TankViewer, then decide whether to
integrate compositing into the main exporter.
