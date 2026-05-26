# ASSET_POLICY — Four Elements Phaser

## Purpose

This project copies only approved assets from the donor repository.

Donor repo:

```text
ratoker-jpg/four-elements-next
```

Old code is not copied. Assets are copied deliberately and minimally.

## Approved copy policy

Allowed to copy after user approval:

- terrain/sand tiles;
- HQ/building sprites;
- harvester/builder/unit sprites;
- mineral/resource sprites;
- obstacles/decor;
- UI icons only if needed for the current PR.

Forbidden to copy without approval:

- old screenshots;
- temporary/generated experiments;
- rejected procedural terrain;
- red-background cleanup intermediates;
- old checkerboard/foundation references unless explicitly requested;
- entire asset folders blindly.

## PR1 asset subset

PR1 should use a small explicit subset:

- approved sand/terrain asset(s);
- one HQ/base asset;
- one mineral/resource asset;
- one harvester asset;
- one or two obstacle/decor assets if needed.

Do not copy the whole 60+ MB asset tree in PR1 unless explicitly approved.

## Asset structure

Current runtime asset structure:

```text
public/assets/
  tiles/                    sand terrain PNGs
  environment/              mineral/resource PNGs
  factions/
    {cyan,green,yellow,purple}/
      buildings/            HQ + building PNGs per faction
      units/                builder/harvester spritesheets per faction
  units/
    chassis/wasp_m0/{faction}/   modular hull direction PNGs
    weapons/smoky_m0/{faction}/  modular turret direction PNGs
src/assets/
  generatedAssetManifest.ts   auto-generated runtime manifest (source of truth)
  runtimeGeneratedAssets.ts   loader helpers consumed by PreloadScene
  assetManifest.ts            legacy base manifest (kept for compatibility)
```

The generated manifest (`generatedAssetManifest.ts`) is the single source of truth
for runtime asset keys and paths. It is produced by `tools/process_art_assets.mjs`
and committed to the repository. Do not edit it manually — regenerate it with
`npm run process:art-assets`.

The asset manifest was written fresh. Do not copy the old loader.

## Naming rules

- Use stable, descriptive names.
- Prefer lowercase with hyphen or underscore consistently.
- Avoid legacy names that encode abandoned architecture.
- Keep faction names explicit if used.
- Do not rename files inside a PR without explaining why.

## Asset quality rules

Assets must be:

- visually approved;
- transparent where expected;
- not red-background working files;
- not checkerboard preview exports;
- reasonably optimized;
- grounded/aligned in-game;
- documented in the manifest.

## Terrain rule

PR1 terrain must use real approved sand/terrain visual assets.

Forbidden:

- flat-color terrain placeholder as main visual;
- procedural sand as default;
- checkerboard-looking tile repetition;
- hidden fallback that masks missing terrain assets.

If terrain assets fail to load, the app should show a clear error instead of silently rendering an unrelated placeholder.

## Asset optimization

Before copying large batches:

- inspect file sizes;
- avoid copying unused variants;
- consider PNG optimization/WebP only after visual check;
- do not change asset format without testing Phaser loading and visual quality.

## Donor repo usage

The donor repo can be used to identify:

- which assets exist;
- which assets were approved;
- intended visual style;
- scale/anchor lessons;
- naming conventions.

The donor repo must not be used to copy:

- asset loader code;
- rendering code;
- sprite profile implementation;
- migration scaffolding.

## Review checklist for asset PRs

- [ ] only approved assets copied;
- [ ] no old code copied;
- [ ] generated manifest regenerated (`npm run process:art-assets`);
- [ ] generated manifest validation passes (`npm run validate:asset-manifest`);
- [ ] assets load in browser;
- [ ] no console missing-asset errors;
- [ ] visual scale/grounding checked manually;
- [ ] file size impact noted;
- [ ] rollback plan included.
