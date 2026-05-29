# MAPLIFE-01 — Environment Props / Doodads / Decals: Asset Readiness Report

Status: **ASSETS MISSING — implementation blocked until approved assets arrive**
Project: Four Elements Phaser
Active repo: `ratoker-jpg/four-elements-phaser`
Phaser version: 4.1.0
Date: 2026-05-29

---

## 1. Asset availability gate result

**No suitable approved prop, doodad, or decal PNG assets exist in the repository.**

The complete asset inventory was inspected:

| Directory | Contents | Usable for MAPLIFE-01? |
|-----------|----------|----------------------|
| `public/assets/environment/` | `mineral_small_02.png`, `mineral_medium_02.png`, `mineral_large_02.png` | No — these are harvestable resources, not environment props |
| `public/assets/tiles/` | `sand_tile.png`, `sand_tile_dark.png`, `sand_tile_light.png` | No — these are terrain tiles |
| `public/assets/factions/` | Faction-specific buildings, units (builders, harvesters), combat units | No — these are gameplay entities |
| `public/assets/units/` | Wasp chassis, Smoky turret (combat units) | No — devtools/arena-only combat units |

No rock, bush, bump, crack, wreck, plant, cactus, stone, ruin, debris, or any other environment decoration PNG exists anywhere in the asset tree.

---

## 2. State model readiness

The state model (`src/state/types.ts`) already defines:

```typescript
/** Non-blocking decor types — visual life, no gameplay blocking. */
export type DecorType = 'bush' | 'sand-bump';

export interface DecorPlacement {
  tx: number;
  ty: number;
  type: DecorType;
}
```

And `MapData` includes:

```typescript
decor: DecorPlacement[];
```

The map generator (`src/state/generatedMap.ts`) currently produces empty `decor: []` arrays with a comment noting that decor is deferred until visual rendering support exists.

**State model is ready.** The type system can accommodate props/doodads. What is missing is:

1. PNG assets for each `DecorType` (and possibly additional types)
2. Asset manifest entries and loader wiring
3. Rendering support in TerrainRenderer or a new PropRenderer
4. Deterministic generation logic for decor placement

---

## 3. Required assets — exact file specifications

### 3.1 Recommended prop/doodad set for desert/sci-fi RTS identity

Based on the Phase 2 roadmap (5.11 MAPLIFE-01) and the existing terrain aesthetic (desert sand with soft clustering), the following prop types are recommended:

| Asset name | Description | Size guide | Render type | Blocking? |
|------------|-------------|------------|-------------|-----------|
| `prop_bush_dry` | Dried desert bush / scrub — small, muted green-brown | ~32×32 px frame within isometric diamond | Sprite, depth-sorted with terrain | No (visual-only) |
| `prop_bush_green` | Small green bush — rare oasis accent | ~32×32 px frame within isometric diamond | Sprite, depth-sorted with terrain | No (visual-only) |
| `prop_rock_small` | Small rock / pebble cluster — sand-colored | ~24×24 px frame within isometric diamond | Sprite, depth-sorted with terrain | No (visual-only) |
| `prop_rock_medium` | Medium rock formation — slightly larger, brown-gray | ~40×40 px frame within isometric diamond | Sprite, depth-sorted with terrain | No (visual-only) |
| `prop_sand_crack` | Sand crack / dry pattern — flat decal | ~48×48 px frame, very low alpha edges | RenderTexture stamp (decal) | No (visual-only) |
| `prop_sand_bump` | Sand dune bump / ripple — flat decal | ~48×48 px frame, very low alpha edges | RenderTexture stamp (decal) | No (visual-only) |
| `prop_wreck_debris` | Small machinery debris / wreckage — sci-fi accent | ~32×32 px frame within isometric diamond | Sprite, depth-sorted with terrain | No (visual-only) |

### 3.2 Asset format requirements

All assets must conform to the existing project conventions (per ASSET-WORKFLOW-01):

- **Format**: PNG with transparent background
- **Color space**: sRGB, pre-multiplied alpha compatible
- **Naming**: `public/assets/environment/props/{prop_name}.png`
- **Style**: Consistent with existing sand tile aesthetic — warm desert tones, isometric perspective, slightly stylized (not photorealistic)
- **Size**: Each prop should fit within approximately one isometric tile (76×38 screen pixels at current scale). Source PNGs should be larger (2-4×) for quality and scaled at render time, similar to terrain tiles (1180×741 source → 76×38 screen).
- **Origin**: Center-bottom for standing props (same as units: originX=0.5, originY=0.75). Center for flat decals.

### 3.3 Decal vs sprite distinction

- **Decals** (sand_crack, sand_bump): Flat details stamped onto the terrain RenderTexture during initial terrain rendering. No runtime overhead after initial stamp. Cannot be removed or animated. Best for static ground detail.
- **Sprites** (bush, rock, wreck): Individual Phaser Sprite objects, depth-sorted with entities. Can be animated or removed at runtime. Slightly higher runtime cost. Best for standing objects that should appear "on top of" terrain.

### 3.4 Recommended initial asset count

For a conservative first pass:

| Type | Count per standard 48×48 map |
|------|------------------------------|
| `prop_bush_dry` | 8–15 |
| `prop_bush_green` | 2–4 (rare) |
| `prop_rock_small` | 10–20 |
| `prop_rock_medium` | 4–8 |
| `prop_sand_crack` | 12–25 (decals) |
| `prop_sand_bump` | 8–15 (decals) |
| `prop_wreck_debris` | 1–3 (very rare) |

Total: ~45–90 visual elements per 48×48 map. This is conservative — roughly 1 prop per 25–50 tiles, concentrated in non-strategic areas.

---

## 4. Implementation plan (once assets arrive)

### 4.1 Phase A: Decal integration (lowest risk, highest visual impact)

1. Add `prop_sand_crack` and `prop_sand_bump` PNGs to `public/assets/environment/props/`
2. Add asset keys to `generatedAssetManifest.ts` and loader in `runtimeGeneratedAssets.ts`
3. Update `DecorType` to include `'sand-crack' | 'sand-bump'` (or use new `DecalType`)
4. Add deterministic decal placement to `generateDecor()` in `generatedMap.ts`
5. Stamp decals onto TerrainRenderer's RenderTexture during construction
6. Decals have zero runtime cost after initial stamp

### 4.2 Phase B: Standing prop integration

1. Add remaining prop PNGs to `public/assets/environment/props/`
2. Add asset keys and loader wiring
3. Expand `DecorType` with new prop types
4. Add deterministic prop placement to `generateDecor()`
5. Create `PropRenderer` (or extend TerrainRenderer) to render props as depth-sorted sprites
6. Props are visual-only — no occupancy changes, no pathfinding impact

### 4.3 Placement rules (already designed)

The map generator already has placement guard infrastructure from resource generation:

- **No props on resource tiles**: Check `occupied` set
- **No props in HQ clearance zone**: Same 5×5 exclusion as resource generation
- **No props on known construction areas**: Reserve tiles near HQ for first buildings
- **Conservative density**: ~1 prop per 25–50 tiles
- **Deterministic from seed**: Same seed → same prop placement
- **Avoid map edges**: 2-tile margin from borders
- **Cluster-based**: Props appear in small groups (2–4), not uniform scatter

### 4.4 Rendering/layering model

```
Depth 0:   Terrain RenderTexture (sand tiles + decals)
Depth 5:   Standing props (bushes, rocks, wrecks) — depth-sorted by Y
Depth 10:  Buildings / Construction sites
Depth 20:  Units (builders, harvesters)
Depth 30:  Selection highlights, feedback
Depth 40:  Debug overlays
Depth 50:  HUD
```

Standing props use the same depth-sorting as entities (Y-based) so they appear correctly behind/in-front-of units and buildings.

---

## 5. What is already in place

| Component | Status | Notes |
|-----------|--------|-------|
| `DecorType` in types.ts | Defined | `'bush' \| 'sand-bump'` — needs expansion |
| `DecorPlacement` interface | Defined | `{ tx, ty, type }` — sufficient |
| `MapData.decor` array | Present | Currently empty `[]` |
| Map generator | Ready | `generateDecor()` stub exists in git history |
| TerrainRenderer | Decal-capable | RenderTexture stamp infrastructure works |
| OccupancyMap | Decor-aware | Decor does NOT affect occupancy (visual-only) |
| PRNG / seed system | Ready | `mulberry32()` + `normalizeSeed()` for deterministic placement |
| Validation | Ready | `validateGeneratedMap()` can be extended with prop checks |

---

## 6. Blocking dependencies

| Dependency | Status | Impact |
|------------|--------|--------|
| Prop/doodad PNG assets | **MISSING** | Cannot render props without textures |
| Decal PNG assets | **MISSING** | Cannot stamp decals without textures |
| Asset pipeline for props | Partially ready | Manifest + loader infrastructure exists, needs prop entries |
| PropRenderer | Not started | Needs sprites to test depth sorting |

**FOG-01 should stay deferred** until MAPLIFE-01 is complete — fog of war is more valuable when the map has visual life to reveal.

---

## 7. Immediate next steps

1. **Art production**: Generate 7 prop/doodad/decal PNGs per the specifications in section 3
2. **Asset delivery**: Place PNGs in `public/assets/environment/props/`
3. **Re-run MAPLIFE-01**: Once assets arrive, the implementation can proceed using this readiness report as the design document
4. **No code changes needed yet**: The state model and generator stubs are ready; they just need assets to activate

---

## 8. Alternative: Minimal decal-only approach

If full prop assets are not available soon, a **minimal decal-only** approach could be implemented using programmatic decal generation (Phaser Graphics drawn to RenderTexture):

- Sand cracks: thin lines drawn programmatically onto the terrain RenderTexture
- Sand bumps: subtle elliptical highlights/shadows drawn programmatically

**However**, this violates the task rule "Do not fake assets with colored shapes." Therefore, this approach is NOT recommended and should only be considered if explicitly approved by the project owner.

---

## 9. Summary

MAPLIFE-01 is ready at the code architecture level but blocked at the asset level. The state model, map generator, renderer infrastructure, and placement logic are all prepared. What is missing is the actual PNG art for environment props, doodads, and decals. Once these assets are provided, implementation can proceed quickly following the phased plan in section 4.
