# Fog of War and Vision System — Technical Design Audit

Status: **Design/audit document — docs only, no runtime changes**
Project: Four Elements Phaser
Active repo: `ratoker-jpg/four-elements-phaser`
Phaser version: 4.1.0
Date: 2026-06-21

---

## 1. Executive summary

### Current status

The codebase has **no fog-of-war or vision system whatsoever**. There is no tile visibility tracking, no explored/unexplored state, no line-of-sight computation, and no rendering of fog. Every entity on the map is always visible to the player, always rendered, always shown on the minimap, and always selectable. The only fog-related data that exists is `BuildingConfig.visionRadius` (static config values per building type) and the purple faction's `territoryVisionRadiusBonus: 1` (a config placeholder with no runtime behavior).

### Recommended model

A **three-state tile visibility model** (unexplored / explored / visible) with **player-only vision** for MVP. Vision sources are buildings and units with configurable radii. Visibility is recomputed incrementally on movement and building events. The explored grid persists across frames and in saves; the visible grid is fully recomputed each update cycle.

### Biggest risks

1. **Performance** — Visibility recomputation on every unit movement for 48×48 or 64×64 maps could be expensive if not throttled or incremental.
2. **Renderer integration** — The current `EntityRenderer` has no visibility culling; every sprite exists in the scene. Adding fog requires a per-entity visibility toggle without breaking the depth-sorting system.
3. **Save migration** — Old saves (version 1) have no explored grid. Migration must create a fully-explored fallback to avoid breaking existing games.
4. **Minimap complexity** — The minimap currently shows all entities. Fog-of-war requires filtering markers and rendering fog state on the minimap canvas, which is a significant change to `HudMinimap`.

### Implementation recommendation

Split into four PRs: (08A) state/grid foundation + tests, (08B) render integration + debug overlay, (08C) minimap fog, (08D) selection/save/load integration. Each PR should be independently mergeable and not break existing systems.

---

## 2. Current code audit

### 2.1 Where map state lives

**File:** `src/state/types.ts`

`MapData` (lines 156–167) contains:
- `terrain: TerrainType[][]` — 2D array of terrain types per tile
- `hq: HqPlacement` — single HQ with `{ tx, ty, faction }`
- `resources: ResourcePlacement[]` — resource node positions
- `obstacles: ObstaclePlacement[]` — obstacle positions
- `decor: DecorPlacement[]` — decoration positions
- `buildings: BuildingPlacement[]` — completed buildings (`{ tx, ty, type }` only)
- `builders: BuilderPlacement[]` — builder units
- `constructionSites: ConstructionSitePlacement[]` — in-progress sites

**Gap:** No visibility grid, no explored grid, no tile ownership, no fog state. The only per-tile data is `terrain`, which is purely visual ground type.

### 2.2 Where units/buildings/resources live

| Entity | Type | Location | Has faction? |
|--------|------|----------|-------------|
| Builders | `BuilderPlacement` | `mapData.builders` | No — inherits from `playerFaction` via `flattenMapEntities()` |
| Harvesters | `HarvesterState` | `state.harvesters` | Yes — `faction: Faction` field |
| Buildings | `BuildingPlacement` | `mapData.buildings` | No — assumed player-owned |
| Resources | `ResourcePlacement` | `mapData.resources` | No — neutral by definition |
| Construction sites | `ConstructionSitePlacement` | `mapData.constructionSites` | No — assumed player-owned |
| Modular combat | `ModularCombatUnit` | `state.extraModularCombat` | Yes — `faction: Faction` |
| Arena vehicles | `BlockoutVehicleState` | `state.blockoutVehicles` | Yes — `faction` + `team: ArenaTeam` |

**Gap:** Builders and buildings lack explicit ownership. For single-player MVP this is acceptable (all are player-owned), but any future enemy/multiplayer system would need faction fields on `BuildingPlacement` and `BuilderPlacement`.

### 2.3 Where ownership/team/faction is represented

- `GameState.playerFaction: Faction` — single global field, always `'cyan'` by default
- `Faction = 'cyan' | 'green' | 'yellow' | 'purple'` — four factions defined
- `ArenaTeam = 'ally' | 'enemy'` — only exists in Arena/blockout context
- **No per-tile ownership.** No territory system.
- **Purple faction config** has `passiveBonus.kind = 'vision_territory'` with `territoryVisionRadiusBonus: 1` — but this is a **config placeholder only**. No runtime code reads or applies it.

### 2.4 Where minimap markers are produced

**File:** `src/phaser/ui/hud/minimapViewModel.ts`

`buildMinimapMarkers()` iterates ALL entities in `GameState` with **no visibility filtering**:
- HQ → green rect (size 5)
- Buildings → type-colored rects (size 4)
- Construction sites → yellow rects (size 3)
- Builders → purple circles (size 3)
- Harvesters → green circles (size 3)
- Resource nodes → orange circles (size 2, depleted skipped)
- Selection highlights → pulsing cyan rings

**Gap:** No fog filtering. All markers are shown regardless of visibility. No "last known position" concept for explored-but-not-visible areas.

### 2.5 Where rendering visibility could be applied

**File:** `src/phaser/render/EntityRenderer.ts`

- `syncHarvesters()` — sets sprite position and visibility every frame. Already has a `visible` toggle pattern (depleted resources). Could extend to fog-based visibility.
- `syncResources()` — hides depleted resources via `img.setVisible(false)`. Same toggle pattern.
- `renderStaticEntities()` — HQ and builders rendered once at init. Would need a mechanism to toggle visibility.
- **No sprite pooling or occlusion system.** Every sprite exists in the Phaser scene at all times.
- **Depth sorting** (`computeDepthValue()`) is based on tile Y position. Fog visibility toggle must not break depth ordering.

**File:** `src/phaser/render/RenderManager.ts`

- `syncCivilRenderState()` — single sync phase that updates all renderers. A fog renderer could be added here.
- No viewport culling exists. All entities are synced every frame.

### 2.6 Where selection/input could be affected

**File:** `src/phaser/input/GameInputController.ts`

- `detectClickTarget()` — iterates all harvesters/builders/resources, checks click proximity. **No visibility check.**
- `finalizeDragSelect()` — screen-space rect test against all unit positions. **No visibility check.**
- `handleDoubleClickSameType()` — viewport containment test. **No visibility check.**
- Control group recall (`recallGroup()`) — restores saved selection. No pruning of fog-hidden units.

### 2.7 Where save/load could be affected

**File:** `src/state/saveGame.ts`

- `SAVE_VERSION = 1` — single version, no migration beyond `ensureBuilderIds()`
- Serializes entire `GameState` via `JSON.stringify`
- Strips `blockoutVehicles` and `blockoutObstacles` (dev-only)
- **Gap:** No fog/visibility data is saved. Adding explored grid requires: (a) version bump to 2, (b) migration that creates fully-explored grid for version-1 saves, (c) serialization of explored grid.

### 2.8 BuildingType → production config mapping (vision radius lookup gap)

**File:** `src/config/buildingRuntimeMapping.ts`

The runtime system uses **hyphenated BuildingType keys** (`raw-storage`, `matter-storage`, `units-factory`) while the production config (`buildingData.ts`) uses **underscored AcceptedBuildingId keys** (`raw_storage`, `energy_storage`, `units_factory`). The canonical mapping lives in `buildingRuntimeMapping.ts`:

```typescript
// Runtime → Production mapping
export const BUILDING_TYPE_TO_PRODUCTION_ID: Partial<Record<BuildingType, AcceptedBuildingId>> = {
  'separator': 'separator',
  'raw-storage': 'raw_storage',
  'matter-storage': 'energy_storage',  // ← legacy naming: runtime "matter-storage" → production "energy_storage"
  'element-storage': 'elements_storage',
  'power-plant': 'power_plant',
  'energy-plant': 'energy_reactor',   // ← visual-ready, no mechanic
  'units-factory': 'units_factory',
};

// Reverse: Production → Runtime
export const PRODUCTION_ID_TO_BUILDING_TYPE: Partial<Record<AcceptedBuildingId, BuildingType>> = {
  'separator': 'separator',
  'raw_storage': 'raw-storage',
  'energy_storage': 'matter-storage',  // ← reverse of the legacy mapping
  'elements_storage': 'element-storage',
  'power_plant': 'power-plant',
  'energy_reactor': 'energy-plant',
  'units_factory': 'units-factory',
};
```

**Special case:** `matter-storage` (runtime) → `energy_storage` (production). This is a legacy naming inconsistency where the runtime key uses "matter" but the production config uses "energy". The player sees "Хранилище энергии" (Energy Storage) via the display name resolution.

**Relevance to fog/vision:** The fog system needs to look up `BuildingConfig.visionRadius` for each building. This radius is stored in the production config under `AcceptedBuildingId` keys. When iterating `mapData.buildings` (which use `BuildingType`), the fog system must translate through `BUILDING_TYPE_TO_PRODUCTION_ID` to find the correct production config and its `visionRadius`.

**Recommended helper for fog implementation:**

```typescript
// Proposed addition to src/config/visionConfig.ts (or buildingRuntimeMapping.ts)

import { BUILDING_CONFIGS } from './buildingData';
import { BUILDING_TYPE_TO_PRODUCTION_ID } from './buildingRuntimeMapping';
import type { BuildingType } from '../state/types';

/**
 * Get the vision radius for a runtime BuildingType.
 * Returns 0 if the building type has no mapping or no visionRadius.
 */
export function getVisionRadiusForRuntimeBuildingType(buildingType: BuildingType): number {
  const prodId = BUILDING_TYPE_TO_PRODUCTION_ID[buildingType];
  if (prodId) {
    const config = BUILDING_CONFIGS[prodId];
    if (config?.visionRadius !== undefined) {
      return config.visionRadius;
    }
  }
  return 0; // Unknown or visual-only buildings get no vision
}
```

This helper centralizes the BuildingType → production config → visionRadius lookup and should be tested in `fogVision08.test.ts`:

- `getVisionRadiusForRuntimeBuildingType('separator')` → 3
- `getVisionRadiusForRuntimeBuildingType('matter-storage')` → 2 (maps to `energy_storage`)
- `getVisionRadiusForRuntimeBuildingType('energy-plant')` → 0 (visual-ready, no mechanic)
- `getVisionRadiusForRuntimeBuildingType('nonexistent' as BuildingType)` → 0 (safe fallback)

### 2.9 Current gaps summary

| Gap | Impact |
|-----|--------|
| No tile visibility tracking | Cannot determine what player has seen |
| No explored grid | Cannot show "previously seen but not visible" |
| No vision source computation | `BuildingConfig.visionRadius` is unused config |
| No vision radius helper bridging BuildingType → production config | Must translate through `buildingRuntimeMapping.ts` to find radii |
| No fog rendering | All tiles and entities always visible |
| No minimap fog | All markers always shown |
| No selection visibility filter | Can select/click entities in fog |
| No save serialization for explored state | Old saves have no fog data |
| No debug overlay for fog | No devtools support for testing |
| Purple faction bonus unimplemented | `territoryVisionRadiusBonus` is dead config |
| No enemy entity model (outside Arena) | Only player-owned entities exist in standard mode |

---

## 3. Vision model proposal

### 3.1 Three tile states

| State | Meaning | Rendering | Minimap | Selectable |
|-------|---------|-----------|---------|-----------|
| **unexplored** | Never seen by player | Black/opaque overlay | Black | No |
| **explored** | Seen before, not currently in vision | Dimmed overlay; no active entities shown | Dimmed terrain; no unit markers | No (unless own unit) |
| **visible** | Currently inside a vision source's radius | Normal rendering | Normal markers | Yes |

This is the standard RTS fog model used by StarCraft, AoE2, and AoE4.

### 3.2 Owner/team scope

**MVP: Player vision only.**

- The player controls a single faction. Vision is computed for `playerFaction` only.
- Enemy visibility is **deferred** — no enemy AI or multiplayer system exists in standard mode. Arena mode has ally/enemy teams but uses a completely separate combat system. Fog should not be applied in Arena mode initially.
- Neutral resources: visible when in explored or visible tiles. Resource positions discovered in explored tiles remain visible as static map data (no resource movement), but resource counts/states update only when the tile is visible.

**Deferred for later:**
- Per-faction vision grids (multiplayer)
- Enemy unit visibility (requires enemy AI)
- Allied vision sharing (requires ally system)

### 3.3 Vision sources

| Source | Proposed radius (tiles) | Rationale |
|--------|------------------------|-----------|
| HQ | 8 | Matches existing `BuildingConfig.visionRadius: 8` |
| Separator | 3 | Matches existing `BuildingConfig.visionRadius: 3` |
| Raw Storage | 2 | Matches existing `BuildingConfig.visionRadius: 2` |
| Matter Storage | 2 | Matches existing `BuildingConfig.visionRadius: 2` |
| Element Storage | 2 | Matches existing `BuildingConfig.visionRadius: 2` |
| Power Plant | 3 | Matches existing `BuildingConfig.visionRadius: 3` |
| Units Factory | 3 | Matches existing `BuildingConfig.visionRadius: 3` |
| Energy Plant | 0 | Matches existing `BuildingConfig.visionRadius: 0` (visual-ready, no mechanic) |
| Builder | 4 | Proposed constant — standard RTS unit vision |
| Harvester | 5 | Proposed constant — harvesters typically have extended range to find resources |
| Purple territory bonus | +1 per adjacent owned tile (proposed) | Implementing `territoryVisionRadiusBonus: 1` from config |

**Note:** The building radii are **existing config values** that are currently unused. They are not invented — they are wired from `src/config/buildingData.ts`. The unit radii (builder=4, harvester=5) are **proposed constants** not yet in code. They should be added to a new vision config file and validated through playtesting.

### 3.4 Purple faction vision bonus

The purple faction's config already declares `passiveBonus.kind = 'vision_territory'` with `territoryVisionRadiusBonus: 1`. Two implementation options:

**Option A: Territory-based bonus (recommended for later)**
- Define "territory" as tiles within a building's influence zone (e.g., tiles adjacent to player buildings)
- Purple buildings get +1 vision radius for each territory tile within their radius
- This requires a territory system that doesn't exist yet

**Option B: Flat radius bonus (simpler, recommended for MVP)**
- Purple faction buildings get a flat +1 to their vision radius
- Much simpler to implement; no territory system needed
- Can be upgraded to Option A when territory is designed

**Recommendation:** Use Option B for MVP. Mark Option A as a deferred enhancement. The `territoryVisionRadiusBonus` config value can be repurposed as a flat bonus until territory is designed.

---

## 4. Data model proposal

### 4.1 Visibility grid

```typescript
// New file: src/state/visibility.ts

/** Per-tile visibility state for a single player/faction. */
export type TileVisibility = 'unexplored' | 'explored' | 'visible';

/** Vision system state — stored on GameState. */
export interface VisionState {
  /** Explored grid: true if tile has ever been seen. Persists across frames and in saves. */
  explored: boolean[][];
  /** Visible grid: true if tile is currently in vision. Recomputed each update. NOT saved. */
  visible: boolean[][];
  /** Dirty flag: set when vision sources change (unit moved, building completed). */
  dirty: boolean;
}
```

### 4.2 Vision source registry

```typescript
/** A single vision source at a tile position. */
export interface VisionSource {
  tx: number;
  ty: number;
  radius: number;
  /** Optional: for purple faction territory bonus. */
  factionBonus?: number;
}
```

Vision sources are **computed, not stored**. Each update cycle, the vision system collects all sources:
- Each building in `mapData.buildings` → radius from `BuildingConfig.visionRadius`
- Each builder in `mapData.builders` → builder vision radius (proposed: 4)
- Each harvester in `state.harvesters` → harvester vision radius (proposed: 5)
- HQ in `mapData.hq` → HQ radius (8)

This avoids storing a separate source array and keeps the system stateless regarding sources.

### 4.3 Tile coordinate format

All grids use the same coordinate system as `MapData.terrain`: `[y][x]` indexing where `y` is row (0 = top) and `x` is column (0 = left). Grid dimensions are `mapWidth × mapHeight`.

### 4.4 Serialization shape

```typescript
// Added to GameState:
vision: VisionState;

// In saveGame.ts, serialize only `explored` grid:
// `visible` is recomputed on load, not persisted.
// `dirty` is recalculated, not persisted.
```

### 4.5 Version migration for old saves

When loading a save with `version === 1` (no `vision` field):
- Create `VisionState` with `explored` grid initialized to **all true** (fully explored)
- This preserves the "everything visible" behavior of pre-fog saves
- Compute `visible` grid on first update cycle

### 4.6 What is persistent vs. recalculated

| Data | Persistent (saved) | Recalculated on load |
|------|-------------------|---------------------|
| `explored` grid | Yes | No |
| `visible` grid | No | Yes — recomputed from vision sources |
| `dirty` flag | No | Yes — set to `true` on load |
| Vision sources | No | Computed from buildings/units each cycle |
| Purple faction bonus | No | Computed from `playerFaction` + config |

---

## 5. Update algorithm

### 5.1 When visibility recalculates

Vision recalculates when **any vision source changes position or a new source appears/disappears**:
- Unit moves to a new tile (builder path step, harvester phase change)
- Building completed (new vision source added)
- Building destroyed (source removed — deferred, no destruction yet)
- Game loaded (full recompute)

### 5.2 Full recompute vs. incremental dirty update

**MVP: Full recompute on dirty flag.**

When `dirty === true`:
1. Clear `visible` grid to all `false`
2. Collect all vision sources (buildings + units)
3. For each source, mark all tiles within radius as `visible = true`
4. For each newly visible tile, set `explored = true`
5. Set `dirty = false`

**Performance analysis with complexity formula:**

The cost of a full recompute is:

```
C = S × (2r² + 2r + 1) + T
```

Where:
- `S` = number of vision sources (buildings + units)
- `r` = average vision radius (typically 3–5)
- `2r² + 2r + 1` = number of tiles in a diamond of radius r (sum of odd numbers from 1 to 2r+1)
- `T` = total tiles in the map (for the initial clear step)

For a 48×48 map with 10 sources and average radius 4:
```
C = 10 × (2×16 + 8 + 1) + 2304 = 10 × 41 + 2304 = 410 + 2304 = 2714 operations
```
This is very fast — well under 1ms. Even with 30 sources on a 64×64 map:
```
C = 30 × 41 + 4096 = 1230 + 4096 = 5326 operations
```
Still trivially fast. The earlier estimate of ~1.15M operations was overly pessimistic because it counted per-tile per-source checks rather than directly marking diamond tiles. The actual implementation iterates only tiles within each source's diamond, not all tiles for each source.

**Later optimization (deferred):**
- Incremental update: only recalculate tiles around the source that moved
- Spatial hash of vision sources for O(n) neighbor lookup
- Throttled recompute (every N frames instead of every frame)
- Tile-based dirty regions instead of global dirty flag

### 5.3 Cadence

- **On movement:** Set `dirty = true` when a unit's tile position changes (not every sub-tile interpolation step)
- **On building completion:** Set `dirty = true`
- **Throttle:** If performance becomes an issue, limit recomputation to once per N ms (e.g., 100ms) rather than every frame
- **GameScene integration:** Call `recomputeVisibility()` after `updateBuilders()` and construction site progress in the civil update loop, before renderer sync

### 5.4 Vision radius shape

**MVP: Diamond (Manhattan distance)**

Diamond radius matches the isometric tile grid and is cheaper to compute:
```
visible if |dx| + |dy| <= radius
```

**Deferred alternative: Circular (Euclidean distance)**
```
visible if dx² + dy² <= radius²
```

Circular radius looks more natural but is slightly more expensive and doesn't align with tile boundaries. For a tile-based game, diamond is the standard choice (StarCraft uses diamond).

### 5.5 Obstacles blocking vision

**Deferred.** The current map has no wall or obstacle system that should block line-of-sight. When such a system is added, vision computation would need ray-casting or shadow-casting. This is a significant complexity increase and should be a separate PR after the basic vision system is working.

---

## 6. Rendering integration

### 6.1 Fog overlay layer

Add a new renderer: `FogRenderer` (or extend `TerrainRenderer`).

**Approach:** Render a full-screen fog overlay on top of the terrain but below entities:
1. **Unexplored tiles:** Fully opaque black/dark overlay (player has never seen this area)
2. **Explored tiles:** Semi-transparent dark overlay (player has seen but can't see now — no active entities rendered)
3. **Visible tiles:** No overlay (normal rendering)

**Implementation option:** Use a Phaser `RenderTexture` or `Graphics` object that draws a colored rectangle per tile based on visibility state. The overlay sits at a specific depth between terrain and entities.

### 6.2 Main scene rendering rules

| Tile state | Terrain | Entities (own) | Resources | Buildings |
|-----------|---------|---------------|-----------|-----------|
| unexplored | Hidden (black overlay) | Not rendered | Not rendered | Not rendered |
| explored | Dimmed (dark overlay) | Not rendered | Rendered (static, last-known state) | Rendered (static) |
| visible | Normal | Rendered | Rendered (live state) | Rendered (live state) |

### 6.3 Entity visibility policy

**MVP: Own units always visible (recommended)**

- Own units (builders, harvesters) are always rendered regardless of fog state
- Justification: The player controls these units and needs to see them at all times. This matches AoE4 behavior where your own units are always visible even in fog.
- Alternative: Own units only visible when in explored/visible tiles — this would be confusing and is not recommended for MVP.

**Enemy entities (deferred):**
- Enemy units: Only rendered when in visible tiles
- Enemy buildings: Rendered in explored tiles at last-known state, hidden in unexplored

### 6.4 Resources visibility policy

**MVP: Resources visible in explored tiles, updated only in visible tiles**

- When a tile transitions from unexplored → visible, resource positions and types are recorded
- When a tile transitions from visible → explored, resource sprites remain visible but their state is frozen (depletion status is last-known)
- When a tile becomes visible again, resource states update to current
- Rationale: StarCraft and AoE4 both show resource positions after exploration. Hiding resources in explored-but-not-visible tiles would be confusing for the player.

### 6.5 Camera projection contract compliance

The fog overlay must respect the isometric ground plane:
- Fog tiles are drawn at ground level using `tileToScreen()` projection
- No screen-space assumptions (no axis-aligned rectangles)
- The fog overlay depth must be between terrain and entities in the depth sort

---

## 7. Minimap integration

### 7.1 Minimap fog rendering

Add fog state rendering to `HudMinimap.render()`:

| Tile state | Minimap appearance |
|-----------|-------------------|
| unexplored | Black (no detail) |
| explored | Dark/dimmed terrain color, no entity markers |
| visible | Normal brightness, all markers shown |

**Implementation:** Before drawing markers, paint the minimap canvas with per-tile fog colors. This requires iterating the visibility grid and drawing small rectangles for each tile state.

### 7.2 Marker visibility rules

- **Own units/buildings:** Always shown on minimap regardless of fog (player always knows where their own units are)
- **Resources:** Shown in explored and visible tiles only
- **Enemy entities (deferred):** Shown only in visible tiles
- **Construction sites:** Shown in explored and visible tiles

### 7.3 Selected marker behavior

Selected unit highlights (cyan pulsing rings) always show — the player selected these units and knows their position.

### 7.4 Feedback pings from #316

**MVP: Pings show through fog.**

Rationale: Pings are player-initiated feedback (build started, build completed, alert). They represent information the player already has. Hiding them in fog would be confusing. This matches AoE4 behavior where alerts and notifications are not blocked by fog.

**Deferred alternative:** Pings in unexplored areas could be shown with a "?" indicator instead of a tile position. This requires product decision.

### 7.5 Preserved functionality

- Minimap click-to-camera: Must work regardless of fog state
- Drag-to-pan: Must work regardless of fog state
- Viewport rectangle: Always visible
- Marker priority: Fog rendering is lowest priority (drawn first), markers drawn on top

---

## 8. Selection/input integration

### 8.1 Selection visibility policy

**MVP rule (resolves apparent contradiction with entity rendering):**

The selection system uses a **two-tier visibility filter** that distinguishes between **own entities** and **future enemy entities**:

| Entity type | In visible tile | In explored (not visible) tile | In unexplored tile |
|------------|----------------|-------------------------------|--------------------|
| **Own units** (builders, harvesters) | Selectable ✓ | Selectable ✓ | Selectable ✓ |
| **Own buildings** | Selectable ✓ | Selectable ✓ | Selectable ✓ |
| **Enemy units** (future) | Selectable ✓ | Not selectable ✗ | Not selectable ✗ |
| **Enemy buildings** (future) | Selectable ✓ | Not selectable ✗ | Not selectable ✗ |
| **Resources** | Selectable ✓ | Selectable ✓ (last-known) | Not selectable ✗ |

**Rationale:** Own units are always selectable regardless of fog state because the player controls them and needs to issue commands at all times (matches AoE4 behavior). This overrides the general rule that entities in non-visible tiles are not selectable. For MVP, all entities are player-owned, so the selection filter is effectively a no-op — but the code should be structured with the two-tier check in place so enemy entities are correctly filtered when they are added later.

**Implementation in `detectClickTarget()` and `finalizeDragSelect()`:**
```typescript
// Pseudocode for visibility-aware selection
function isSelectable(entity, vision: VisionState, isOwnEntity: boolean): boolean {
  if (isOwnEntity) return true;  // Own units always selectable
  return vision.visible[entity.ty][entity.tx]; // Enemy: only if visible
}
```

### 8.2 Click targeting

`detectClickTarget()` and `finalizeDragSelect()` must apply the two-tier filter from Section 8.1:
- **Own entities:** Always included in click/drag results, regardless of tile visibility
- **Enemy entities (future):** Only included if `vision.visible[entity.ty][entity.tx]` is `true`
- **Resources:** Treated as neutral — selectable in explored and visible tiles, not in unexplored

### 8.3 Drag-box respects visibility

`finalizeDragSelect()` applies the same two-tier filter (Section 8.1):
1. Add all own units in the drag rect (always, regardless of fog)
2. Skip any enemy units in the drag rect that are not in visible tiles (deferred — no enemy system yet, but the filter should be in place)

### 8.4 Double-click same-type

`handleDoubleClickSameType()` currently selects all same-type units in the viewport. For fog:
- Only select units that are in visible tiles (or always-selectable own units)
- This is mostly a no-op for MVP since all units are player-owned and always visible

### 8.5 Control groups with hidden/dead units

When recalling a control group:
- If a unit in the group is dead: already handled by `pruneMissingEntities()`
- If a unit is in an unexplored tile (future: enemy unit): skip it or select it but don't center camera on it
- **MVP:** No change needed — all units in control groups are player-owned and always visible

### 8.6 Commands on non-visible targets (deferred)

When attack-move or targeted commands are added in the future, the system should:
- Show "Target not visible" feedback if the target tile is not visible
- Prevent targeting enemy units in fog
- This is fully deferred and not part of the current MVP

---

## 9. Feedback integration

### 9.1 "No vision" feedback (deferred)

When targeting commands are added:
- If the player tries to target an enemy in fog, show "Нет обзора" / "Target not visible" warning via the #316 feedback layer
- Use `FeedbackStore.addFeedback()` with type `warning`, code `target-not-visible`, dedupeKey `target-not-visible`

### 9.2 Minimap ping policy

- Pings from #316 (build started, build completed) show through fog (see Section 7.4)
- Future enemy-activity pings should be filtered: only show if the ping location is in visible or explored tiles
- **MVP:** No change needed — current pings are player-initiated and should always be visible

### 9.3 Idle worker alerts

Idle worker alerts from #316 should not be affected by fog. The player always knows about their own idle workers regardless of vision. No change needed.

### 9.4 No spam rules

The existing dedupe system in `FeedbackStore` (2-second window, dedupeKey) handles spam prevention. Any new fog-related feedback should use appropriate dedupeKeys:
- `target-not-visible` → dedupeKey `target-not-visible`
- `enemy-detected` → dedupeKey `enemy-detected-{tx}-{ty}`

---

## 10. Save/load and devtools

### 10.1 Explored state saving

The `explored` grid is the only fog data that needs to be saved:
```typescript
// In saveGame.ts sanitizeForSave():
vision: {
  explored: state.vision.explored,
  visible: [],  // not saved — recomputed on load
  dirty: true,  // force recompute on load
}
```

### 10.2 Visible state recalculation on load

On load:
1. Load `explored` grid from save
2. Create empty `visible` grid (all false)
3. Set `dirty = true`
4. On first GameScene update, `recomputeVisibility()` will compute `visible` from current vision sources

### 10.3 Migration for old saves (version 1)

When loading a save with `version === 1` and no `vision` field:
```typescript
// Migration: create fully-explored vision state
state.vision = {
  explored: Array.from({ length: mapHeight }, () => Array(mapWidth).fill(true)),
  visible: Array.from({ length: mapHeight }, () => Array(mapWidth).fill(false)),
  dirty: true,
};
```
This preserves the "everything visible" behavior of pre-fog saves.

**Migration design rationale:**

- **Why fully-explored?** Old saves have no explored grid. Setting all tiles to `explored = true` means the player won't see black/unexplored areas in areas they've already been playing — the game continues as if they had already explored everything. This avoids the jarring experience of suddenly seeing fog in an ongoing game.
- **Why not fully-visible?** The `visible` grid must be recomputed from current vision sources, not set to all-true. If the player's units and buildings are clustered, only their surroundings should be visible — the rest should show as explored (dimmed). Setting `visible = all-true` would be incorrect and would be overwritten on the first recompute anyway.
- **Why `dirty = true`?** This forces an immediate recompute of the `visible` grid on the first update cycle after loading, ensuring visibility matches current building/unit positions.
- **Version bump to 2:** `SAVE_VERSION` in `saveGame.ts` should be incremented to `2`. The migration path is: `v1 (no vision) → v2 (with vision)`. There is no v2→v3 path yet. Future changes to the vision data model would require a v2→v3 migration.
- **No data loss:** The migration is additive — it only adds a `vision` field. No existing save data is removed or altered.

### 10.4 Debug overlay

Add new debug overlay options to `DevtoolsPanel` and `DebugOverlayRenderer`:

| Debug option | Description |
|-------------|-------------|
| **Reveal all** | Set all tiles to visible+explored (cheat mode) |
| **Show vision sources** | Draw circles around each vision source (buildings + units) |
| **Show visibility grid** | Color tiles: red=unexplored, yellow=explored, green=visible |
| **Log dirty recomputes** | Console log when visibility is recomputed and how long it takes |

Add to `debugRenderFlags`:
```typescript
fogOfWar: boolean;           // toggle fog rendering on/off
visionGrid: boolean;         // show visibility grid overlay
visionSources: boolean;      // show vision source radii
```

---

## 11. Testing strategy

### 11.1 Required future tests

| Test category | Test description |
|--------------|-----------------|
| **Visibility grid math** | Diamond radius computation, boundary handling, off-map tiles |
| **Vision source add/remove** | Building completed adds source, building destroyed removes source (deferred) |
| **Movement updates vision** | Unit moves to new tile → dirty flag set → visible grid updated |
| **Building completion updates vision** | Construction site completes → new building adds vision source |
| **Explored persists after leaving** | Tile explored when visible → remains explored when unit moves away |
| **Visible recalculates after load** | Save with explored grid → load → visible grid recomputed |
| **Minimap fog respects transform** | Minimap fog rendering matches tile coordinate transform |
| **Selection ignores hidden entities** | Enemy units in fog not selectable (deferred) |
| **Control groups prune missing** | Dead/fog-hidden units handled in group recall (deferred) |
| **Save migration** | Version-1 save loads with fully-explored vision |
| **Performance smoke** | 48×48 map with 20+ vision sources recomputes in < 5ms |
| **Regression: HUD/minimap** | All #312–#316 systems work with vision system active |
| **Regression: selection** | Drag-box, double-click, control groups still work |
| **Regression: feedback** | Status lane, pings, dedupe still work |
| **Purple faction bonus** | Purple buildings have +1 vision radius |
| **Vision radius lookup mapping** | `getVisionRadiusForRuntimeBuildingType()` returns correct radius for all BuildingTypes including `matter-storage` → `energy_storage` edge case |
| **Arena mode isolation** | Vision system is no-op in Arena; no fog overlay, no visibility filter, no minimap fog |

### 11.2 Test file location

New test file: `src/__tests__/fogVision08.test.ts`

---

## 12. Implementation plan

### FOG-VISION-IMPLEMENTATION-08A — State/grid foundation

**Scope:**
- New file `src/state/visibility.ts` — `VisionState`, `TileVisibility`, `VisionSource` types
- New file `src/config/visionConfig.ts` — vision radius constants (builder=4, harvester=5) + `getVisionRadiusForRuntimeBuildingType()` helper (see Section 2.8)
- `recomputeVisibility()` pure function — full recompute from vision sources (using `getVisionRadiusForRuntimeBuildingType()` for building radii)
- `addVisionSource()` / `removeVisionSource()` helpers (or just recompute from GameState)
- Add `vision: VisionState` to `GameState`
- Initialize `vision` in `createInitialState()` — HQ provides starting vision
- Tests: grid math, recompute, explored persistence, `getVisionRadiusForRuntimeBuildingType()` mapping correctness (see Section 2.8 test cases), performance smoke

**PR risk:** Low — adds new state but doesn't change rendering or input

**Arena mode:** Fog is NOT applied in Arena mode. Arena uses a completely separate combat system (`ModularCombatUnit`, `BlockoutVehicleState`) with no connection to the industrial map's building/unit model. The vision system's `recomputeVisibility()` should check `if (state.extraModularCombat?.length > 0) return;` or similar to skip Arena games. Arena PRs are out of scope for 08A–08D.

### FOG-VISION-IMPLEMENTATION-08B — Render integration

**Scope:**
- New `FogRenderer` — draws fog overlay in main scene (between terrain and entities)
- Integrate with `RenderManager.syncCivilRenderState()`
- EntityRenderer: toggle entity visibility based on `vision.visible` grid (own units always visible per Section 6.3)
- Resource visibility: show in explored tiles, update in visible tiles
- Debug overlay: vision grid, vision sources, reveal-all toggle
- No minimap changes yet

**PR risk:** Medium — changes rendering pipeline, could affect depth sorting

**Arena mode:** FogRenderer should be a no-op in Arena mode. Arena games don't have `VisionState` or building/unit vision sources on the industrial map.

### FOG-VISION-IMPLEMENTATION-08C — Minimap fog

**Scope:**
- Draw fog state on minimap canvas (unexplored=black, explored=dimmed, visible=normal)
- Filter markers by visibility (own units always shown)
- Preserve ping-through-fog behavior
- Preserve click/drag/viewport functionality

**PR risk:** Medium — changes minimap rendering, could affect click accuracy

**Arena mode:** No minimap fog changes in Arena. Arena minimap shows all entities as it does today.

### FOG-VISION-IMPLEMENTATION-08D — Selection/save/load integration

**Scope:**
- `detectClickTarget()` — apply two-tier visibility filter from Section 8.1 (own units always selectable, future enemies filtered)
- `finalizeDragSelect()` — apply same two-tier filter
- Save migration: version bump to 2, explored grid serialization, v1→v2 migration (see Section 10.3 for rationale)
- Control group prune for fog-hidden units (deferred if no enemy system)
- Feedback edge cases ("Target not visible" deferred)

**PR risk:** Low — changes input handling but only adds filters, doesn't change core behavior

**Arena mode:** No selection visibility changes in Arena. Arena selection uses the `BlockoutVehicleState` system, not the industrial map's builder/harvester model.

### Alternative split consideration

If 08B (render integration) proves too complex, it could be split further:
- 08B1: Fog overlay only (no entity visibility toggle)
- 08B2: Entity visibility toggle (per-entity setVisible based on fog)

This keeps the overlay (visual effect) separate from the entity filtering (gameplay effect).

---

## 13. Risks and decisions needed from Denis

### Product decisions required

| # | Question | Options | Default if undecided |
|---|----------|---------|---------------------|
| 1 | Should resources stay visible after explored? | Yes (StarCraft/AoE4 style) / No (harder fog) | Yes |
| 2 | Should own units always be visible even outside vision? | Yes (player controls them) / No (hardcore fog) | Yes |
| 3 | Should fog hide only enemy entities or also neutral resources? | Enemy only / Enemy + neutral / Configurable | Enemy only |
| 4 | Should territory provide permanent explored or active visible? | Permanent explored / Active visible when in range | Permanent explored |
| 5 | Should purple faction vision be stronger territory vision or flat bonus? | Territory-based / Flat +1 radius / Both | Flat +1 (MVP) |
| 6 | Should pings appear through fog? | Always / Only in explored / Only in visible | Always |
| 7 | Should fog affect control group camera centering? | Yes (can't center on fog) / No (always center) | No |

### Technical risks

| Risk | Mitigation |
|------|-----------|
| Performance on 64×64 maps | Profile early; throttle recompute if needed; incremental update as fallback |
| Renderer depth sorting with fog overlay | Test fog depth carefully; fog must be between terrain and entities |
| Save migration breaking old saves | Fully-explored fallback for v1 saves; extensive save/load tests |
| Minimap canvas performance with fog | Minimap fog can be rendered at lower resolution (every 2nd tile) |
| Fog overlay visual quality | Start with simple per-tile rectangles; upgrade to smooth gradients later |

---

## 14. Acceptance criteria for future implementation

When the fog/vision system is fully implemented (across PRs 08A–08D), the following must be true:

- [ ] Unexplored tiles show as black/dark on both main scene and minimap
- [ ] Explored tiles show dimmed on main scene, dimmed on minimap, with static buildings/resources
- [ ] Visible tiles show normally on both main scene and minimap
- [ ] Moving a unit expands visible area; leaving an area transitions tiles to explored
- [ ] Building completion creates a new vision source and updates visibility
- [ ] Minimap click-to-camera still works through fog
- [ ] Minimap drag-to-pan still works through fog
- [ ] Minimap pings show through fog
- [ ] Own units remain selectable regardless of fog state
- [ ] Enemy entities (future) are not selectable when in fog
- [ ] Drag-box selection respects visibility (enemy units in fog excluded)
- [ ] Save/load preserves explored state
- [ ] Old saves (v1) load with fully-explored fallback
- [ ] Debug overlay shows vision grid, vision sources, and reveal-all
- [ ] Performance: visibility recompute < 5ms on 48×48 map with 20+ sources
- [ ] No regression in #312 HUD layout
- [ ] No regression in #313 command card (S/F/R/HOME work)
- [ ] No regression in #314 minimap interaction
- [ ] No regression in #315 selection/control groups
- [ ] No regression in #316 feedback/pings/status lane
- [ ] Arena mode is unaffected (fog not applied in Arena)
- [ ] Purple faction buildings have +1 vision radius (MVP flat bonus)

---

## Appendix: Relationship to existing docs

This audit is step 7 in the AoE4-inspired UX redesign roadmap:

| Step | Task | Status |
|------|------|--------|
| 1 | VISUAL-AOE4-UX-REDESIGN-ROADMAP-01 | Merged |
| 2 | HUD-LAYOUT-REBUILD-02 | Merged (PR #312) |
| 3 | COMMAND-CARD-REBUILD-03 | Merged (PR #313) |
| 4 | MINIMAP-INTERACTION-04 | Merged (PR #314) |
| 5 | SELECTION-CONTROL-GROUPS-05 | Merged (PR #315) |
| 6 | FEEDBACK-ALERTS-06 | Merged (PR #316) |
| **7** | **FOG-VISION-AUDIT-07** | **This document** |
| 8 | FOG-VISION-IMPLEMENTATION-08 | After this audit (split into 08A–08D) |

This audit depends on:
- `docs/project/VISUAL_AOE4_UX_REDESIGN_ROADMAP_2026_06_20.md` — overall UX direction
- `docs/project/CAMERA_PROJECTION_CONTRACT.md` — camera projection rules
- `docs/project/VISUAL_ROADMAP.md` — visual direction context
