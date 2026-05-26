# art/source/ — Authoring Files

This directory holds original authoring files: PSDs, high-resolution source
sheets, reference images, and working files.

**This directory is gitignored.** Source files are typically large and do not
belong in the repository. Artists work here locally.

If a source file must be shared, use the project's asset sharing workflow
(not a direct git commit).

## Subdirectory structure

When assets are added, they should follow this layout:

```
source/
├── buildings/    # Source sheets for buildings per faction
├── units/        # Source sheets for builder/harvester
├── modular/      # Source sheets for modular units (Wasp, Smoky, etc.)
├── terrain/      # Source sheets for terrain tiles
├── resources/    # Source sheets for resource sprites
├── fx/           # Source sheets for particles/VFX
├── ui/           # Source sheets for UI icons
└── decor/        # Source sheets for obstacles/decor
```

Each subdirectory may contain `.psd`, `.kra`, `.ase`, or high-res `.png` files.
These are authoring formats — not runtime assets.
