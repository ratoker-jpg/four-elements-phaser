# VISUAL-06B — Image Generation Prompts for Industrial Resource Candidates

Status: **Prompt reference for candidate image generation**
Project: Four Elements Phaser
Date: 2026-05-31

---

## Purpose

This file contains precise prompts for generating industrial resource visual candidates. These prompts encode the owner-approved visual direction (Option A) and asset contract from VISUAL-06A. Use these prompts with an image generation tool to produce candidate review images.

---

## Universal constraints (apply to all prompts)

```text
- Isometric 2:1 perspective RTS game asset
- Industrial mining platform style
- Transparent background (PNG with alpha)
- No terrain scene, no landscape, no sky
- No UI elements, no HUD, no text
- No building, no extractor, no drill, no pump
- No large multi-cell blob — each asset is one 1x1 cell node
- Medium accent glow — readable but not overpowering
- No chroma background in final asset
- No oversized shadows — small contact shadow only
- No white or black matte background
- No checkerboard background
- Clean alpha edges — no anti-alias fringe or dark halo
- Ore/crystal embedded in cracked industrial flooring
- Gray metallic industrial floor plate context
- Amber or teal mineral glow accent
```

---

## Prompt: resource_industrial_small_01

```text
Isometric 2:1 perspective sprite for an RTS game. A small mineral ore crystal protrusion embedded in a cracked section of gray industrial metal flooring. The ore is a small amber-glowing crystalline formation rising from a narrow crack in the floor plate. The crack is subtle and minimal, just enough to anchor the ore visually. The ore covers about 25-35% of the isometric diamond cell area. Medium faint amber glow around the crystal, not overpowering. Transparent background, no terrain, no sky, no UI. No building, no drill, no machine. Single 1x1 isometric cell node. Clean alpha edges, no dark halo. Dark contact shadow directly under the ore, not extending beyond the cell boundary.
```

---

## Prompt: resource_industrial_medium_01

```text
Isometric 2:1 perspective sprite for an RTS game. A moderate mineral ore crystal cluster embedded in a cracked section of gray industrial metal flooring. The ore is a visible amber-glowing crystalline formation rising from a wider crack pattern in the floor plate. Multiple crystal points emerge from the crack. The cluster covers about 35-50% of the isometric diamond cell area. Medium amber glow around the crystals, clearly visible but not noisy. Transparent background, no terrain, no sky, no UI. No building, no drill, no machine. Single 1x1 isometric cell node. Clean alpha edges, no dark halo. Small dark contact shadow under the ore, within cell boundary.
```

---

## Prompt: resource_industrial_large_01

```text
Isometric 2:1 perspective sprite for an RTS game. A prominent mineral ore formation embedded in a large cracked section of gray industrial metal flooring. The ore is a large amber-glowing crystalline formation rising from a significant fracture in the floor plate. Multiple tall crystal spires emerge from a wide crack pattern. The formation covers about 50-65% of the isometric diamond cell area. Strong medium amber glow around the crystals, unmistakably rich and harvestable, but not a blinding beacon. Transparent background, no terrain, no sky, no UI. No building, no drill, no machine. Single 1x1 isometric cell node. Clean alpha edges, no dark halo. Small dark contact shadow under the ore, within cell boundary.
```

---

## Prompt: resource_industrial_infinite_01

```text
Isometric 2:1 perspective sprite for an RTS game. A special large mineral ore crystal formation for an infinite resource deposit, embedded in a cracked section of gray industrial metal flooring. This is the single 1x1 cell variant that will be placed in a 3x3 group. The ore is a large amber-glowing crystalline formation with a brighter and slightly different color shift compared to the standard large variant — perhaps a deeper amber with a subtle teal undertone to mark it as special. The crack pattern around the base is more pronounced with glowing veins. The formation covers about 55-70% of the isometric diamond cell area. Brighter medium glow than the standard large variant, but still not a beacon — it should read as special without being confused with a building. Transparent background, no terrain, no sky, no UI. No building, no drill, no machine. Single 1x1 isometric cell node. Clean alpha edges, no dark halo. Small dark contact shadow under the ore, within cell boundary.
```

---

## Prompt: 3x3 infinite deposit composition preview

```text
Isometric 2:1 perspective composition preview for an RTS game. A 3x3 grid of infinite resource nodes on a gray industrial metal platform floor. Nine ore crystal formations arranged in a 3x3 isometric diamond grid, each embedded in cracked industrial flooring. The center node has the brightest amber-teal glow with the most pronounced crystal formation. The surrounding eight nodes have a moderate glow, creating a gradient effect from center to edge. The overall composition reads as a coherent special zone — a central infinite deposit — but each node is an independent 1x1 cell element. No merged blob. The gaps between nodes are visible, showing the gray floor between them. Transparent or dark neutral background. No UI, no buildings, no drills. The preview shows how the 9 nodes compose together when placed adjacent. Medium glow intensity overall — readable but not visually noisy.
```

---

## Usage notes

- These prompts are designed for image generation tools that support transparent PNG output.
- If the tool does not support transparent backgrounds natively, generate on a solid green (#00FF00) or magenta (#FF00FF) background and remove it in post-processing.
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
