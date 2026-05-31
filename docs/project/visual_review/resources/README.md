# Industrial Resource Candidate Visual Review

Status: **Review package — prompts ready, candidate images pending external generation**
Project: Four Elements Phaser
Date: 2026-05-31

---

## What is this directory?

This directory contains the visual review package for industrial resource field candidates (VISUAL-06B/B1). It is for review only — nothing here is used by the game runtime.

## Files

| File | Purpose |
|------|---------|
| `RESOURCE_CANDIDATE_REVIEW.md` | Review checklist, acceptance criteria, and owner review instructions |
| `PROMPTS.md` | Precise image generation prompts for each resource variant |
| `README.md` | This file — directory overview and status |

## Resource model

Normal resources are 1×1 richness-tier nodes distinguished by crystal count/density/glow, not footprint size. The central infinite deposit is a separate 2×2 visual. No normal 2×2 or 3×3 resource assets.

## Candidate image status

Candidate PNG images have NOT been generated in this package. Image generation was not available in the execution environment at the time of PR creation.

The prompts in `PROMPTS.md` are ready to use with any image generation tool that supports transparent PNG output. Use them to produce:

```text
candidate_a_very_poor_01.png              — very_poor 1x1 resource node
candidate_a_poor_01.png                   — poor 1x1 resource node
candidate_a_medium_01.png                 — medium 1x1 resource node
candidate_a_rich_01.png                   — rich 1x1 resource node
candidate_a_very_rich_01.png              — very_rich 1x1 resource node
candidate_a_infinite_center_2x2_01.png    — central infinite 2x2 deposit
```

After generation, place them in this directory for owner review.

## How to generate candidates

1. Open `PROMPTS.md`.
2. Copy each prompt into your image generation tool.
3. Ensure transparent PNG output (or remove magenta background in post-processing).
4. Save each output with the filename listed above.
5. Place in this directory.
6. Proceed with the checklist in `RESOURCE_CANDIDATE_REVIEW.md`.

## What this directory is NOT

- Not a runtime asset path. Nothing here is loaded by the game.
- Not a production asset directory. Do not reference these files from `src/` or `public/`.
- Not a manifest entry. Do not add these files to `generatedAssetManifest.ts`.

After owner visual approval, approved assets move to `public/assets/environment/` in VISUAL-06C.
