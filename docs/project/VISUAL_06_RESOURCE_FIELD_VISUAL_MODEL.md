# VISUAL-06A — Resource Field Visual Model and Asset Contract

Status: **Design/contract document — docs only, no runtime changes, no assets**
Project: Four Elements Phaser
Repo: `ratoker-jpg/four-elements-phaser`
Phaser version: 4.1.0
Date: 2026-05-31

---

## 1. Purpose

This document defines the visual model, asset contract, and field composition rules for industrial resource fields in the Four Elements Phaser RTS game. It exists to prevent resource work from being done by memory or ad-hoc asset replacement. Any future implementation PR must reference this document as the source of truth for resource visual direction.

This is a design and contract document only. It does not implement anything. It does not generate assets. It does not change runtime code, gameplay, economy, or depletion logic.

---

## 2. Current context

```text
VISUAL-05A production industrial map integration is COMPLETE.
- PR #144, #145, #146, #147, #148 are all merged.
- Industrial generated map is now the default for new games.
- mapStyle 'industrial' and 'sand' both remain available.
- Current production small is still 32×32.
- 96×96 / 128×128 / 192×192 migration is deferred and out of scope for this design.
```

Current resource rendering state:

```text
- ResourceType: 'small' | 'medium' | 'large' | 'infinite'
- Asset keys: mineral_small, mineral_medium, mineral_large (desert crystal aesthetic)
- No infinite-specific asset; infinite uses mineral_large at scale 0.65
- Resource scales: small=0.3, medium=0.4, large=0.5, infinite=0.65
- Resource origin: (0.5, 0.75) — centered horizontally, 75% down for isometric grounding
- Resource depth: 100 + worldY (standard entity painter's algorithm)
- Depleted resources: hidden via setVisible(false)
- Asset paths: assets/environment/mineral_small_02.png, mineral_medium_02.png, mineral_large_02.png
```

The current mineral crystal sprites use a sand/desert color palette that does not match the industrial biome direction. They are readable but visually inconsistent with the industrial platform tiles and frame.

---

## 3. Goals

- Resources must match the industrial mining platform / industrial mineral wasteland visual direction established in VISUAL-05A.
- Resource fields must be readable at gameplay zoom levels — the player should instantly see where resources are and distinguish richness tiers (very_poor through very_rich) and the central infinite deposit.
- Resource nodes must stand out against gray/industrial platform tiles without being visually jarring. Contrast should come from color and glow, not size alone.
- Resource visuals must support the three field types present in the current map: starter fields near HQ, mid/far clusters, and the central infinite deposit.
- Normal resource nodes are always 1×1 — each resource occupies exactly one isometric cell. Richness is shown by crystal count/density/glow, not footprint size.
- Resource fields are groups of 1×1 richness-tier nodes. The only 2×2 mineral is the central infinite deposit, which is a separate visual category.

---

## 4. Non-goals

```text
- No resource gameplay changes.
- No economy changes.
- No resource amount changes.
- No depletion logic changes.
- No pathfinding or occupancy changes.
- No production asset integration in this PR.
- No map size migration.
- No final asset approval in this PR.
- No changes to ResourceType enum or RESOURCE_RAW_AMOUNTS.
- No changes to the existing mineral_small/medium/large assets — they remain as sand fallback.
```

---

## 5. Visual direction

Three possible industrial resource visual directions are defined below. The project owner must approve one direction before any assets are produced.

### Option A — Mineral ore node embedded in cracked industrial flooring

**Description**: A visible mineral/ore deposit embedded in a cracked or marked section of industrial flooring. The ore itself is a crystalline or metallic protrusion rising from a break in the platform surface. The surrounding floor crack provides visual context that this cell contains a resource. The ore color is a distinct accent (amber, teal, or violet glow) against the gray platform.

**Readability strengths**:
- Naturally integrates with the industrial platform surface — looks like part of the floor, not an object placed on top.
- The crack/marking provides a visual anchor that reads clearly at gameplay zoom.
- Richness variants (very_poor through very_rich) can be distinguished by crystal count/density and glow intensity, all within the same 1×1 footprint.

**Risks**:
- If the crack is too subtle, resources may blend into the floor at low zoom.
- Cracked flooring may visually conflict with the industrial tile variants that already have wear/crack patterns.
- Requires careful color balancing so ore glow does not look like a tile tint variation.

**Fit with industrial biome**: Strong. This direction treats resources as mineral deposits that the platform was built to extract — the platform surface cracks reveal the ore beneath. It reinforces the "mining platform" narrative.

### Option B — Glowing crystal/ore cluster with metal base ring

**Description**: A distinct mineral crystal or ore cluster sitting on a small metal base or ring embedded in the platform. The crystal is the primary visual element — a glowing formation rising from a mechanical mounting. The metal base provides a deliberate industrial framing. Color is a bright accent (amber, teal, or warm white glow) that contrasts sharply with the gray platform.

**Readability strengths**:
- The metal base ring provides immediate visual separation from the floor — unambiguous "this is an object, not a tile feature."
- The crystal shape is inherently distinct from flat platform tiles.
- Glow can be very readable at any zoom level.

**Risks**:
- The metal base ring may look like a building or structure rather than a natural resource.
- If the base is too large relative to the crystal, it may look like a small machine rather than an ore deposit.
- Bright glow against gray may create visual noise in dense resource fields.

**Fit with industrial biome**: Moderate. The industrial mounting implies that resources are extracted via installed infrastructure, which supports the mining platform narrative. However, it may over-domesticate the resource — they should feel like raw ore, not processed materials.

### Option C — Mining drill/extractor marker over resource cell

**Description**: A small mechanical marker, drill head, or extraction nozzle positioned over the resource cell. The visible element is a compact industrial device — a drill bit, a pump, or a small extractor — with a resource icon or glow underneath indicating what is being extracted. The device is small enough to fit within one isometric cell.

**Readability strengths**:
- Uniquely industrial — no ambiguity about the mining platform context.
- A drill/extractor immediately communicates "this is a resource extraction point."
- Could be very readable as a distinct silhouette against the flat platform.

**Risks**:
- May look too much like a building or placed structure, confusing the player about whether it is a resource or a constructible.
- Adds visual complexity per cell — dense resource fields would look like clusters of machinery.
- Depleted state becomes harder to visualize (does the drill stop? does it disappear?).
- Does not match the current resource model where resources are raw materials, not installed devices.

**Fit with industrial biome**: Moderate-weak. While highly industrial, this direction shifts resources from "raw ore" to "extraction equipment," which changes the visual semantics. It also creates a read ambiguity with the building system. Resources should read as harvestable material, not as structures.

---

## 6. Recommended model

**Recommended direction: Option A** — Mineral ore node embedded in cracked industrial flooring, with a visible ore protrusion and accent glow.

Rationale:
- Best fit with the mining platform narrative — the platform was built to extract ore revealed by surface fractures.
- Most natural integration with existing industrial tiles — ore deposits are part of the floor, not objects on top.
- Clear silhouette for each size variant without requiring a metal base or mechanical element.
- Avoids building/structure confusion that Options B and C risk.
- Simplest depletion visual: ore fades or disappears, crack remains (or crack fades too).

Recommended model constraints:
- Normal resource nodes are 1×1 per cell. Richness is visual only (crystal count/density/glow), not footprint size.
- Normal nodes are classified by richness tier: very_poor, poor, medium, rich, very_rich.
- The central infinite deposit is the only 2×2 resource visual. It is a separate category, not part of the 1×1 richness-tier classification.
- No normal 2×2 or 3×3 resource assets.
- Clear silhouette — the ore protrusion must be taller than the floor plane so it reads as a distinct object.
- Glowing ore/mineral accent — amber or teal glow is recommended to contrast against gray industrial tiles.
- Industrial base/plate is optional — a subtle crack or marking around the ore is sufficient.
- Visual richness may later map to resource amount, but this design doc does not implement that mapping.
- The current runtime ResourceType ('small' | 'medium' | 'large' | 'infinite') remains unchanged until a later implementation task maps or renames it.

---

## 7. Resource categories / variants

These are visual variants only. They do not imply economy amount changes. The existing `ResourceType` enum and `RESOURCE_RAW_AMOUNTS` remain unchanged until a later implementation task maps or renames them.

### Normal 1×1 richness-tier nodes

All normal resource nodes are 1×1 footprint. Richness is shown by crystal count, density, and glow intensity — not by footprint size. No normal 2×2 or 3×3 resource assets exist.

| Variant | Visual description | Crystal density | Distinguishing features |
|---------|-------------------|----------------|------------------------|
| **very_poor** | 1–2 tiny crystals, barely rising from the floor. Weak glow. | 1–2 crystals | Weakest glow, minimal visual footprint, subtle presence. |
| **poor** | 2–4 small crystals with low glow. | 2–4 crystals | Low glow intensity, small cluster, clearly a resource but not rich. |
| **medium** | 5–8 moderate crystals with visible medium glow. | 5–8 crystals | Medium glow intensity, clearly harvestable, standard field node. |
| **rich** | 8–12 crystals with stronger glow. Dense cluster. | 8–12 crystals | Strong glow, dense crystal formation, unmistakably rich. |
| **very_rich** | 12–16 crystals, dense but still within 1×1 footprint. Bright glow. | 12–16 crystals | Densest 1×1 node, strong glow, visually exceptional for a single cell. |

### Central infinite deposit (separate category)

| Variant | Visual description | Footprint | Distinguishing features |
|---------|-------------------|-----------|------------------------|
| **infinite_center_2x2** | Large central infinite mineral deposit with special glow. The only 2×2 resource visual. Not part of the 1×1 richness classification. | 2×2 isometric cells | Unique visual — must read as special without being confused with a building. Recommended: brighter glow, unique color shift (amber-teal), large crystal formation. |

Important notes:
- The infinite deposit currently uses the `mineral_large` asset at scale 0.65. The new design provides a dedicated 2×2 infinite visual rather than scaling up a 1×1 variant.
- The central infinite deposit is NOT modeled as a group of 1×1 nodes. It is a single 2×2 resource object.
- No normal 2×2 or 3×3 resource assets — the infinite_center_2x2 is the only multi-cell resource visual.
- Visual richness may later map to resource amount, but this design doc does not implement that mapping.
- The current runtime ResourceType ('small' | 'medium' | 'large' | 'infinite') remains unchanged until a later implementation task maps or renames it.

---

## 8. Field composition rules

### Starter field near HQ

- Location: north/east of HQ (toward the map center from the lower-left start).
- Composition: 1×1 richness-tier nodes (mix of poor, medium, rich) in a loose cluster.
- Visual rules:
  - Nodes should be close enough to read as a group, but with clear gaps between them for unit pathing.
  - No two nodes should overlap visually — each must be individually selectable at gameplay zoom.
  - The cluster should have a readable shape (roughly oval or crescent, not a dense blob).

### Mid/far fields

- Composition: 2–5 1×1 richness-tier nodes per cluster.
- Visual rules:
  - Denser groupings are acceptable since these fields are discovered, not immediately visible.
  - Individual nodes still must be distinguishable — no merged blob sprites.

### Central infinite deposit

- Composition: A single 2×2 infinite_center_2x2 resource object.
- Visual rules:
  - The infinite deposit is the only 2×2 resource visual. It is not composed of 1×1 nodes.
  - It should read as a coherent, visually special "field center" — a unique focal point on the map.
  - Recommended: special glow (amber-teal shift), pronounced crystal formation.
  - The infinite deposit must not visually block movement or hide passable/blocked status of adjacent cells.
  - The deposit must remain compatible with grid/pathfinding — it occupies 4 cells in the logical grid (2×2).

### General field rules

- No normal 2×2 or 3×3 resource assets — only the central infinite deposit is 2×2.
- Fields should not visually hide passable/blocked status — a player must be able to see where paths exist between resource nodes.
- 1×1 resource node sprites must not extend significantly beyond the isometric diamond of their cell at runtime scale.
- In dense fields, node glow should not produce a wash of light that obscures the platform surface.

---

## 9. Asset contract

This section defines the expected asset contract for future asset generation and review. No assets are created in this PR.

### General requirements

- 1×1 resource node sprite per richness variant.
- 2×2 resource sprite for the central infinite deposit (the only multi-cell resource visual).
- Transparent PNG — 32-bit RGBA, no background, no chroma key inside the final asset.
- Consistent isometric camera — sprites must match the existing 2:1 isometric perspective used by all other game assets.
- Normal 1×1 sprites are crystal overlay only — no platform tile, no floor slab included in the sprite.
- Readable at runtime tile scale (76×38 px tile) — sprites are loaded at source resolution and scaled down. Source art should be clear enough to remain readable after scaling.
- No oversized shadows — small contact shadow is acceptable, but the shadow must not extend beyond the cell boundary.
- No gameplay-relevant information encoded only in art — resource type must be readable from code/state, not only from visual appearance.
- No anti-alias fringe or dark halo on edges — clean alpha boundaries.

### Filename/naming proposal

```text
resource_industrial_very_poor_01.png
resource_industrial_poor_01.png
resource_industrial_medium_01.png
resource_industrial_rich_01.png
resource_industrial_very_rich_01.png
resource_industrial_infinite_center_2x2_01.png
```

The `_01` suffix allows for variant alternatives without renaming existing files.

### Asset key mapping proposal

```text
resource_industrial_very_poor       → resource_industrial_very_poor_01
resource_industrial_poor            → resource_industrial_poor_01
resource_industrial_medium          → resource_industrial_medium_01
resource_industrial_rich            → resource_industrial_rich_01
resource_industrial_very_rich       → resource_industrial_very_rich_01
resource_industrial_infinite_center_2x2 → resource_industrial_infinite_center_2x2_01
```

These keys would be added to `generatedAssetManifest.ts` alongside the existing sand-era mineral keys. The existing keys (`mineral_small`, `mineral_medium`, `mineral_large`) remain as sand fallback.

No depleted visual asset is included in the current plan — depleted resources continue using `setVisible(false)`. A depleted asset can be added later if desired.

### Review directory proposal

Candidate assets for visual review should be placed in a temporary review directory during the asset review PR:

```text
docs/project/visual_review/resources/
```

This is for review only — not for runtime loading. Only after visual approval are assets moved to `public/assets/` and added to the manifest.

---

## 10. Origin / anchor expectations

The future implementation PR must inspect the current resource rendering code and align with existing isometric placement and grounding rules. This section documents the current conventions and what the implementation PR must verify.

### Current conventions (from EntityRenderer.ts)

```text
- Resource origin: (0.5, 0.75) — centered horizontally, 75% down vertically.
- Resource depth: 100 + worldY — standard entity painter's algorithm.
- Resource scale: small=0.3, medium=0.4, large=0.5, infinite=0.65.
- Position: tileToScreen(tx, ty) + mapOriginOffset.
- Depleted: setVisible(false) — sprite exists but is hidden.
```

### Implementation PR requirements

- The implementation PR must verify that these origin/depth/scale values still produce correct results with the new industrial resource sprites.
- If new sprites have different visual centers, the origin may need adjustment — but this must be documented and tested, not silently changed.
- Do not invent final numeric origin values in this design doc. The actual values must be determined by inspecting the sprites against the isometric grid at runtime.
- The depth model (100 + worldY) must be preserved — resources render in front of terrain (depth 0) and behind or at the same layer as buildings.

---

## 11. Depleted-state visual expectation

### Current behavior

Depleted resources are hidden via `setVisible(false)`. The sprite still exists in memory but is not rendered. The cell becomes available for movement/occupancy (per RESOURCE-01).

### Visual goal for industrial resources

- Depleted resource should become visually empty or ghost-like rather than disappearing entirely, if a dedicated depleted asset is produced.
- A dedicated depleted visual asset (`resource_industrial_depleted_01.png`) is recommended — a faint crack or marking where the ore was, rendered at low contrast. This communicates "there was a resource here, it is now gone" without blocking the view.
- However, the simplest acceptable approach is to continue using `setVisible(false)` — no depleted visual at all. This is acceptable because the current gameplay does not require a depleted visual marker.
- Depleted visual must not block movement unless current state logic says it blocks. This design doc must not change depletion logic.

### Decision required

- If a depleted visual is desired, the asset review PR (VISUAL-06B) should include a depleted variant for review.
- If not desired, `setVisible(false)` continues and no depleted asset is needed.

---

## 12. Future implementation PR sequence

### VISUAL-06B — Resource candidate asset review package

**Scope**: Produce 2–3 static visual candidate images for industrial resource nodes. No runtime integration. Place candidates in `docs/project/visual_review/resources/` for owner review.

**Non-goals**: No code changes, no asset manifest changes, no runtime behavior.

**Validation**: Candidate images are PNG, transparent background, correct isometric perspective.

**Rollback**: Delete the review directory. No runtime impact.

---

### VISUAL-06C — Approved resource assets added to repo

**Scope**: After owner approves a visual direction, add approved PNG resource assets to `public/assets/environment/`. This PR is asset-only:
- No manifest changes.
- No preload changes.
- No renderer changes.
- No runtime loading.
- No `src/**` changes.

**Non-goals**: No manifest/preload/renderer changes, no mapStyle/resourceStyle flag, no production rendering, no runtime behavior.

**Validation**:
- Confirm files are present at expected paths under `public/assets/environment/`.
- Confirm PNGs are transparent and visually approved.
- Confirm no `src/**` files changed.
- Runtime loading is not validated in 06C because wiring is deferred to 06D.

**Rollback**: Remove the newly added approved asset files. No runtime/code rollback needed.

---

### VISUAL-06D — Preload/manifest wiring behind mapStyle or resourceStyle flag

**Scope**: Add a `resourceStyle: 'industrial' | 'sand'` configuration (or extend `mapStyle` to cover resources). Wire the industrial resource assets to load when the industrial style is active. Sand resources load when sand style is active. Update `RESOURCE_ASSET_MAP` to be style-aware. This is the first PR allowed to touch `generatedAssetManifest.ts`, asset manifest entries, and preload wiring for industrial resources.

**Non-goals**: No visual replacement of production resources yet — just wiring behind a flag. No gameplay changes.

**Validation**: Both sand and industrial resource sets load correctly when their style is selected. Tests pass.

**Rollback**: Remove the style-aware wiring and manifest entries. Fallback to sand resources.

---

### VISUAL-06E — Production resource rendering replacement for industrial only

**Scope**: When `mapStyle === 'industrial'` (or `resourceStyle === 'industrial'`), render industrial resource sprites instead of sand mineral sprites. Update scale map, origin if needed, depleted visual if a depleted asset was approved. Verify at gameplay zoom.

**Non-goals**: No sand resource changes. No economy/depletion/pathfinding changes. No map size migration.

**Validation**: Industrial resources render correctly. Sand fallback still works. Starter resources visible/reachable. Save/load not broken. Central infinite deposit present.

**Rollback**: Revert to sand resource rendering for all map styles.

---

### VISUAL-06F — QA polish if readability issues appear

**Scope**: Small fixes to resource visual readability — scale adjustments, glow intensity tuning, origin shifts. No feature additions.

**Non-goals**: No new assets, no gameplay changes, no new systems.

**Validation**: Resources readable at default zoom. No regression in sand mode.

**Rollback**: Revert individual fix commits.

---

## 13. Acceptance criteria for future implementation

The following criteria apply to each VISUAL-06 implementation PR:

```text
- Game still starts without errors.
- No economy changes — RESOURCE_RAW_AMOUNTS unchanged.
- No pathfinding or occupancy changes.
- Starter resources are visible and reachable from HQ.
- Resource nodes are readable at default gameplay zoom.
- Sand fallback resources not broken — sand map style still works.
- Save/load not broken — old saves load as saved.
- Central infinite deposit remains present near map center.
- No map size migration — current production small is still 32×32.
- Depletion behavior unchanged — depleted resources free their cell for movement.
- No changes to ResourceType enum or resource placement algorithms.
```

---

## 14. Open questions for owner review

These questions were resolved by owner decisions during VISUAL-06B1. They are retained for historical reference.

1. **Which visual option is preferred?** — RESOLVED: Option A (ore in cracked floor).

2. **Should the infinite deposit be a special 1×1 marker group or a visually larger center composition?** — RESOLVED: The central infinite deposit is a single 2×2 resource visual (infinite_center_2x2), not a group of 1×1 nodes.

3. **Should depleted state have a specific visual asset or just hide/remove the node?** — RESOLVED: No depleted asset in this step. Keep current hidden/removed behavior.

4. **How bright should resource glow be against industrial tiles?** — RESOLVED: Medium accent glow, readable against gray platform tiles, not overly bright.

---

## References

```text
docs/project/VISUAL_ROADMAP.md — accepted planning direction
docs/project/VISUAL_SYSTEM_AUDIT.md — accepted audit with resource visual model audit (Section 9)
docs/project/VISUAL_05A_PRODUCTION_INDUSTRIAL_MAP_INTEGRATION_PLAN.md — production integration plan
docs/project/PROJECT_STATE.md — current operational state
docs/project/CURRENT_NEXT_STEP.md — VISUAL-06 guardrails
docs/project/POST_VISUAL_05A_QA_POLISH_BACKLOG.md — QA checklist
```
