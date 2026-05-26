# art/generated/ — Processor Output and Reports

This directory holds output from the asset processor and validation tools.

## Contents

| File | Description |
|------|-------------|
| `manifest.generated.json` | Machine-readable manifest of all processed assets |
| `manifest.sample.json` | Sample manifest demonstrating the target schema |
| `audit-report.json` | Validation results, warnings, and errors |
| `audit-report.sample.json` | Sample audit report demonstrating the output shape |
| `buildings/` | Runtime-ready building PNGs (future) |
| `units/` | Runtime-ready civil unit spritesheets (future) |
| `modular/` | Runtime-ready modular unit PNGs (future) |
| `terrain/` | Runtime-ready terrain tile PNGs (future) |
| `resources/` | Runtime-ready resource sprites (future) |
| `fx/` | Runtime-ready VFX sprites (future) |
| `ui/` | Runtime-ready UI icons (future) |
| `decor/` | Runtime-ready decor sprites (future) |

## Current status

Only sample files are present. The full generated manifest and family
subdirectories will be produced by the asset processor (ARCH-02D).

**Runtime integration is still future ARCH-02F.** The current runtime loaders
in `src/assets/` continue to load directly from `public/assets/`.

## Regeneration

To regenerate building placement metadata:

```bash
npm run generate:building-meta
```

To validate the sample manifest:

```bash
npm run validate:asset-manifest
```
