# art/staged/ — Approved Assets Ready for Processing

This directory holds assets that have passed visual review and are ready for
the asset processor. Assets here follow the naming conventions from
`docs/ASSET_PIPELINE_STRATEGY.md` section 6.

## Staging rules

1. Only visually approved assets belong here.
2. Filenames must match the per-family naming conventions.
3. Each staged asset should have a corresponding source file in `art/source/`
   (warning if missing, not an error).
4. Do not commit assets that have not been reviewed.

## Subdirectory structure

```
staged/
├── buildings/    # Building PNGs per faction
├── units/        # Builder/harvester spritesheets
├── modular/      # Modular unit direction PNGs
├── terrain/      # Terrain tile PNGs
├── resources/    # Resource/mineral sprites
├── fx/           # Particle/VFX sprites
├── ui/           # UI icon PNGs
└── decor/        # Obstacle/decor sprites
```

## Current status

This directory is currently empty. Assets will be staged here during
ARCH-02D (processor/generator MVP) and later phases.
