# VISUAL-06B — Image Generation Prompts for Industrial Resource Candidates

Status: **Prompt reference for candidate image generation**
Project: Four Elements Phaser
Date: 2026-05-31

---

## Purpose

This file contains precise prompts for generating industrial resource visual candidates. These prompts encode the owner-approved visual direction (Option A) and the updated resource model from VISUAL-06B1: normal 1×1 richness-tier nodes plus one separate 2×2 central infinite deposit. Use these prompts with an image generation tool to produce candidate review images.

---

## Universal constraints (apply to all prompts)

```text
- Isometric 2:1 perspective RTS game asset
- Industrial mining platform style
- Crystal overlay only for normal variants — no platform tile, no floor slab in the sprite
- Transparent or magenta background (PNG with alpha)
- No terrain scene, no landscape, no sky
- No UI elements, no HUD, no text
- No building, no extractor, no drill, no pump
- Normal variants must fit inside one 1x1 isometric diamond footprint
- Richness shown by crystal count/density/glow intensity, not footprint size
- Central infinite fits inside one 2x2 isometric footprint
- Medium accent glow — readable but not overpowering
- No chroma background in final asset
- No oversized shadows — small contact shadow only
- No white or black matte background
- No checkerboard background
- Clean alpha edges — no anti-alias fringe or dark halo
- Amber or teal mineral glow accent
```

---

## Prompt: resource_industrial_very_poor_01

```text
Isometric 2:1 perspective sprite for an RTS game. A very poor mineral resource node — just 1 to 2 tiny amber crystal shards barely rising from the floor, with a very weak glow. The crystals are small and sparse, the weakest possible resource presence. Crystal overlay only — no platform tile, no floor slab, no cracked flooring. The sprite must fit entirely inside one 1x1 isometric diamond footprint. Magenta or transparent background. No terrain, no sky, no UI. No building, no drill, no machine. Clean alpha edges, no dark halo. Tiny contact shadow, within cell boundary.
```

---

## Prompt: resource_industrial_poor_01

```text
Isometric 2:1 perspective sprite for an RTS game. A poor mineral resource node — 2 to 4 small amber crystals with a low glow, forming a sparse cluster. Clearly a resource but not rich. Crystal overlay only — no platform tile, no floor slab, no cracked flooring. The sprite must fit entirely inside one 1x1 isometric diamond footprint. Magenta or transparent background. No terrain, no sky, no UI. No building, no drill, no machine. Clean alpha edges, no dark halo. Small contact shadow, within cell boundary.
```

---

## Prompt: resource_industrial_medium_01

```text
Isometric 2:1 perspective sprite for an RTS game. A medium mineral resource node — 5 to 8 moderate amber crystals with a visible medium glow, forming a standard cluster. The default field node — clearly harvestable, clearly a resource. Crystal overlay only — no platform tile, no floor slab, no cracked flooring. The sprite must fit entirely inside one 1x1 isometric diamond footprint. Magenta or transparent background. No terrain, no sky, no UI. No building, no drill, no machine. Clean alpha edges, no dark halo. Small contact shadow, within cell boundary.
```

---

## Prompt: resource_industrial_rich_01

```text
Isometric 2:1 perspective sprite for an RTS game. A rich mineral resource node — 8 to 12 amber crystals with a stronger glow, forming a dense cluster. Unmistakably rich and harvestable. Crystal overlay only — no platform tile, no floor slab, no cracked flooring. The sprite must fit entirely inside one 1x1 isometric diamond footprint despite the density. Magenta or transparent background. No terrain, no sky, no UI. No building, no drill, no machine. Clean alpha edges, no dark halo. Small contact shadow, within cell boundary.
```

---

## Prompt: resource_industrial_very_rich_01

```text
Isometric 2:1 perspective sprite for an RTS game. A very rich mineral resource node — 12 to 16 amber crystals with a bright glow, forming the densest possible cluster that still fits one cell. Dense but still within 1x1 isometric diamond footprint. Crystal overlay only — no platform tile, no floor slab, no cracked flooring. Magenta or transparent background. No terrain, no sky, no UI. No building, no drill, no machine. Clean alpha edges, no dark halo. Small contact shadow, within cell boundary.
```

---

## Prompt: resource_industrial_infinite_center_2x2_01

```text
Isometric 2:1 perspective sprite for an RTS game. A large central infinite mineral deposit — the only 2x2 resource visual. A massive amber-teal glowing crystal formation that occupies a 2x2 isometric footprint. The glow shifts from amber to a subtle teal tone to mark it as special and unique. The formation has a pronounced central crystal surrounded by smaller supporting crystals. Must read as a special infinite resource, not a building or structure. No drill, no extractor, no mechanical elements. The sprite must fit inside one 2x2 isometric footprint. Magenta or transparent background. No terrain, no sky, no UI. Clean alpha edges, no dark halo. Contact shadow within 2x2 boundary.
```

---

## Usage notes

- These prompts are designed for image generation tools that support transparent or magenta PNG output.
- If the tool does not support transparent backgrounds natively, generate on a solid magenta (#FF00FF) background and remove it in post-processing.
- Each prompt produces a single candidate for review. Multiple generation attempts may be needed for quality.
- Candidates are placed in `docs/project/visual_review/resources/` only — never in `public/assets/`.
- After owner approval, approved candidates move to `public/assets/environment/` in VISUAL-06C (asset-only PR).

---

## Re-generation instructions

If candidates need revision based on owner feedback:

1. Identify which specific checklist items failed.
2. Modify the corresponding prompt above to address the feedback.
3. Re-generate the candidate image.
4. Replace the candidate file in this directory.
5. Re-submit for owner review.

Do not modify the universal constraints unless the owner explicitly changes the visual direction.
