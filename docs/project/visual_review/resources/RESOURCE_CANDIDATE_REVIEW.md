# VISUAL-06B — Resource Candidate Asset Review Package

Status: **Review-only — no runtime integration, no production assets**
Project: Four Elements Phaser
Repo: `ratoker-jpg/four-elements-phaser`
Date: 2026-05-31

---

## 1. Purpose

This document is the review package for industrial resource visual candidates. It accompanies candidate PNG images placed in this directory and defines what the project owner should evaluate before approving assets for production integration in VISUAL-06C.

This is a visual review package only. It does not integrate anything into the game runtime. It does not modify manifests, preloaders, renderers, or any source code.

---

## 2. Approved owner decisions

The following decisions were made by the project owner before this review package was created:

```text
Visual direction:         Option A — Mineral ore/crystal node (crystal overlay only, no platform tile/floor slab)
Normal resources:         1x1 richness-tier nodes only — very_poor, poor, medium, rich, very_rich
Central infinite:         Separate 2x2 deposit (infinite_center_2x2), not part of 1x1 classification
No normal 2x2/3x3:       No normal multi-cell resource assets; only infinite is 2x2
No 3x3 infinite:          Central infinite is a single 2x2 object, not a group of 1x1 nodes
Depleted state:           Do NOT create a depleted asset in this step; keep current hidden/removed behavior
Glow brightness:          Medium accent glow, readable against gray platform tiles, not overly bright
```

These decisions are sourced from VISUAL-06A (docs/project/VISUAL_06_RESOURCE_FIELD_VISUAL_MODEL.md) and owner direction for VISUAL-06B.

---

## 3. Scope

- Provide prompts for generating static industrial resource candidate images externally.
- Define expected candidate filenames and review location under `docs/project/visual_review/resources/`.
- Define acceptance checklist for candidate approval.
- Document that candidate PNG images are pending external generation and are not included in this PR.

Candidate PNG images are not included in this PR because image generation was unavailable in the execution environment. This package is still review-only and prepares the next visual generation step.

### Non-goals

```text
- No code changes.
- No asset manifest changes.
- No preload changes.
- No renderer changes.
- No runtime behavior.
- No src/** changes.
- No public/** changes.
- No production asset placement.
- No depleted visual asset.
- No economy/resource amount changes.
- No depletion logic changes.
- No pathfinding/occupancy changes.
- No map size migration.
```

---

## 4. Candidate requirements

Each candidate image must satisfy the following requirements derived from the VISUAL-06A asset contract:

### Format

- Transparent PNG, 32-bit RGBA.
- No background, no chroma key, no checkerboard, no white/black matte.
- Clean alpha boundaries — no anti-alias fringe or dark halo on edges.

### Perspective

- Consistent 2:1 isometric camera matching all other game assets.
- The tile diamond is 76x38 px at runtime; source art should be clear enough to remain readable after scaling down.

### Visual direction (Option A)

- Mineral ore/crystal protrusion embedded in a cracked section of industrial flooring.
- The ore is a crystalline or metallic formation rising from a break in the gray platform surface.
- A crack or marking around the base provides visual anchor that this cell contains a resource.
- Ore color is a distinct accent against gray platform — amber or teal glow recommended.

### Richness variants (all 1x1 footprint)

All normal resource nodes are 1x1 footprint. Richness is shown by crystal count/density and glow intensity — not by footprint size.

- **very_poor**: 1-2 tiny crystals, weak glow. Barely rising from the floor.
- **poor**: 2-4 small crystals, low glow. Clearly a resource but not rich.
- **medium**: 5-8 moderate crystals, medium glow. Standard field node.
- **rich**: 8-12 crystals, stronger glow. Dense cluster, unmistakably rich.
- **very_rich**: 12-16 crystals, bright glow. Densest 1x1 node, still fits one cell.

### Central infinite deposit (2x2 footprint)

- **infinite_center_2x2**: Large central infinite mineral deposit. The only 2x2 resource visual. Not part of the 1x1 richness classification. Special glow (amber-teal shift), must read as special without being confused with a building.

### Glow

- Medium accent glow — readable against gray industrial tiles, not overly bright.
- Glow should not create visual noise in dense resource fields.
- Glow should not look like a tile tint variation.

### Prohibitions

- No drill, extractor, pump, or mechanical device as the primary visual element.
- No metal base ring or mechanical mounting around the ore.
- No normal 2x2 or 3x3 resource assets — only the central infinite deposit is 2x2.
- No building-like silhouette — resources must read as harvestable material, not structures.
- No oversized shadow — small contact shadow acceptable, must not extend beyond cell boundary.

---

## 5. Candidate checklist

Use this checklist to evaluate each candidate image:

| # | Criterion | Pass | Fail | Notes |
|---|-----------|------|------|-------|
| 1 | Transparent PNG, no background | | | |
| 2 | Clean alpha boundaries, no fringe/halo | | | |
| 3 | Consistent 2:1 isometric perspective | | | |
| 4 | All normal variants fit one 1x1 isometric footprint | | | |
| 5 | Richness tiers distinguishable by crystal count/density/glow, not footprint size | | | |
| 6 | Central infinite is 2x2 footprint, visually special but not building-like | | | |
| 7 | Medium glow, not noisy or overpowering | | | |
| 8 | Ore reads as raw mineral, not a structure or machine | | | |
| 9 | No platform tile or floor slab included in 1x1 crystal sprites | | | |
| 10 | No oversized shadow beyond cell boundary | | | |
| 11 | No drill/extractor/mechanical element | | | |
| 12 | No metal base ring as primary framing | | | |
| 13 | No normal 2x2 or 3x3 resource assets | | | |
| 14 | No gameplay/economy assumptions in art | | | |
| 15 | Readable at gameplay zoom after scaling | | | |

---

## 6. How owner should review candidates

1. Open each candidate PNG in this directory.
2. Evaluate against the checklist above.
3. Compare very_poor, poor, medium, rich, and very_rich variants side-by-side for visual consistency.
4. Evaluate the 2x2 central infinite deposit separately — it is a single 2x2 object, not a group of 1x1 nodes.
5. Decide:
   - **Approve as-is**: Candidate passes all checklist items and can proceed to VISUAL-06C.
   - **Approve with modifications**: Candidate is close but needs specific changes (document which items need revision).
   - **Reject**: Candidate does not meet requirements. New candidates must be generated.
6. Communicate decision to the executor with specific feedback.

---

## 7. Next step after approval

- If candidates are approved: Proceed to VISUAL-06C — move approved assets to `public/assets/environment/` (asset-only PR, no manifest/preload/renderer changes).
- If candidates need revision: Re-generate with modified prompts based on owner feedback. Create a new candidate set in this directory.
- If candidates are rejected: Discuss alternative visual approach and create new candidate set.

---

## References

```text
docs/project/VISUAL_06_RESOURCE_FIELD_VISUAL_MODEL.md — design/contract (source of truth)
docs/project/CURRENT_NEXT_STEP.md — VISUAL-06 guardrails
docs/project/PROJECT_STATE.md — current operational state
```
