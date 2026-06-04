# Blender TankViewer Factory

This directory contains the offline render factory for TankViewer `.3ds` hulls and turrets. It is the production path for readable asset output. The browser/Three.js exporter is experimental only and should not be used for Wasp-class production renders.

## Scripts

- `render_tank_sprite.py`
  Renders one direction or a full 8/16-direction pack to transparent PNGs and writes a render log plus manifest.
- `calibrate_camera.py`
  Writes the camera projection report and, when Blender is available, renders a calibration PNG.
- `plan_batch.py`
  Builds a non-rendering batch plan for all supported hulls, turrets, M-levels, and factions.
- `generate_contact_sheet.py`
  Builds a labeled contact sheet from rendered PNGs.
- `generate_manifest.py`
  Generates or regenerates a manifest from a rendered output folder.
- `factory_common.py`
  Shared constants, naming helpers, and asset catalog.

## Supported asset catalog

### Hulls

- `wasp`
- `hornet`
- `hunter`
- `viking`
- `dictator`
- `titan`
- `mammoth`

### Turrets

- `smoky`
- `firebird` -> runtime name `flamethrower`
- `freeze`
- `isida`
- `railgun`
- `ricochet`
- `thunder`
- `twins`
- `vulcan`
- `hammer`
- `striker`

### M-level mapping

- `_0` = `m0`
- `_1` = `m1`
- `_2` = `m2`
- `_3` = `m3`

### Factions

- `cyan`
- `green`
- `yellow`
- `purple`

## Direction convention

The canonical 16-direction convention is:

`dir0=E, dir1=ESE, dir2=SE, dir3=SSE, dir4=S, dir5=SSW, dir6=SW, dir7=WSW, dir8=W, dir9=WNW, dir10=NW, dir11=NNW, dir12=N, dir13=NNE, dir14=NE, dir15=ENE`

## Expected local source layout

Source assets are local-only and must not be committed:

```text
art/source/tankviewer/
└── data/
    ├── hulls/
    │   └── wasp/
    │       ├── Wasp_0123.3ds
    │       ├── Wasp_0_details.png
    │       └── Wasp_0_lightmap.jpg
    └── turrets/
        └── smoky/
            ├── Smoky_0123.3ds
            ├── Smoky_0_details.png
            └── Smoky_0_lightmap.jpg
```

## Commands

Check Blender:

```powershell
blender --version
```

Plan the full batch without rendering:

```powershell
py tools\blender\plan_batch.py --source-root art\source\tankviewer --output-root art\generated\tankviewer
```

Render one Wasp M0 hull proof frame when Blender is installed:

```powershell
blender --background --python tools\blender\render_tank_sprite.py -- ^
  --kind hull ^
  --source-root art\source\tankviewer ^
  --source-name wasp ^
  --m-level 0 ^
  --faction cyan ^
  --directions 16 ^
  --direction-index 0 ^
  --output art\generated\tankviewer\hulls\wasp\m0\cyan
```

Generate a contact sheet:

```powershell
py tools\blender\generate_contact_sheet.py --input-dir art\generated\tankviewer\hulls\wasp\m0\cyan
```

Generate a manifest from an output folder:

```powershell
py tools\blender\generate_manifest.py ^
  --input-dir art\generated\tankviewer\hulls\wasp\m0\cyan ^
  --id wasp_m0_hull ^
  --kind hull ^
  --m-level 0 ^
  --faction cyan ^
  --source-model Wasp_0123.3ds ^
  --source-details Wasp_0_details.png ^
  --source-lightmap Wasp_0_lightmap.jpg
```

## Blender requirement

This factory requires Blender 3.x+ with the 3DS importer addon enabled. If Blender is missing, the scripts still write planning/report files but they do not fake renders.
