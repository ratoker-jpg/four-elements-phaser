# Future PR4 / PR5 Notes — Construction, VFX, and Reusable Patterns

Date: 2026-05-25
Status: captured notes, not an active implementation task
Source: user-provided PR4/PR5 audit drafts and reusable-code audit notes

## 1. Purpose

This document preserves useful ideas from the PR4/PR5 audit drafts without turning them into an implementation contract.

Use this document later when preparing narrow task contracts for:

```text
PR14 — Passability + Pathfinding MVP
PR15 — Construction MVP
PR16 — VFX / Feel pass
```

Do not hand this document to an agent as a direct implementation task.

It contains design notes, reusable patterns, and warnings.

---

## 2. Current decision

The PR4/PR5 audit drafts are useful, but too broad to implement as one PR.

They mix:

- construction state;
- builder state machine;
- build UI;
- construction preview;
- VFX manager;
- particles;
- unit tests;
- future performance concerns.

That is too much for one implementation step.

Current order remains:

```text
PR13A — Vitest baseline
PR13B — Modular renderer/debug split
PR14  — Passability + Pathfinding MVP
PR15  — Construction MVP
PR16  — VFX / Feel pass
```

---

## 3. Useful reusable patterns from current code

### 3.1 State / render separation

Keep game logic in pure TypeScript and Phaser rendering in renderer classes.

Pattern:

```text
state update → render sync → HUD update
```

For construction:

```text
src/state/construction.ts       pure construction logic
src/phaser/render/...           visual construction site / building rendering
src/phaser/GameScene.ts         orchestration only
```

### 3.2 Harvester state machine pattern

The harvester state machine is a good reference for builder behavior.

Harvester pattern:

```text
idle → moving → action timer → returning → unloading → idle
```

Builder target pattern:

```text
idle → moving-to-site → building → idle / returning
```

Keep the same principles:

- deterministic phase machine;
- `deltaMs` clamped to avoid tab-switch jumps;
- no Phaser imports;
- easy unit testing.

### 3.3 Isometric coordinate helpers

Use existing isometric helpers for all placement and preview logic.

Important warning:

When converting pointer/world coordinates into tile coordinates, account for the map origin offset. Do not blindly call `screenToTile(worldX, worldY)` if those coordinates already include the map offset.

Expected pattern:

```text
world point from camera
minus map origin offset
then screenToTile()
```

Exact implementation must be checked against current `isometric.ts` and `TerrainRenderer` coordinate space.

### 3.4 Asset manifest pattern

Any new building/builder assets should be added through the asset manifest, not loaded ad hoc.

For each asset:

- stable key;
- runtime path;
- loading in preload;
- asset existence check;
- only approved assets.

### 3.5 Occupancy / footprint pattern

Construction needs an occupied-tile model.

Occupancy should include:

- HQ footprint;
- buildings;
- construction sites;
- obstacles;
- resources where relevant;
- reserved tiles for active placement if needed.

The starter occupancy helpers in `createInitialState.ts` are useful reference, but construction needs a runtime version derived from current `GameState`.

---

## 4. Construction MVP notes

### 4.1 Target scope for first Construction MVP

Recommended first construction slice:

```text
one building type only: Separator
one builder unit path to site
one construction site state
simple placement validation
basic visual site/progress
```

Do not include in first construction PR unless explicitly approved:

- multiple building types;
- storage;
- factory;
- production UI;
- territory requirements;
- tech tree;
- complex VFX;
- sound;
- save/load.

### 4.2 State types to consider

Likely types:

```ts
export type BuildingType = 'separator';

export interface BuildingState {
  id: string;
  type: BuildingType;
  tx: number;
  ty: number;
  faction: Faction;
  buildProgress: number;
  isComplete: boolean;
}

export interface ConstructionSiteState {
  id: string;
  buildingType: BuildingType;
  tx: number;
  ty: number;
  assignedBuilderId: string | null;
  buildTimeMs: number;
  buildProgress: number;
}

export type BuilderPhase =
  | 'idle'
  | 'moving-to-site'
  | 'building';

export interface BuilderState {
  id: string;
  ftx: number;
  fty: number;
  faction: Faction;
  phase: BuilderPhase;
  targetSiteId: string | null;
  buildTimerMs: number;
  speedTilesPerSecond: number;
}
```

These are notes only. Final names must match current `src/state/types.ts`.

### 4.3 Building config

Use a central config for cost, build time, and footprint.

Example shape:

```ts
export const BUILDING_CONFIG = {
  separator: {
    costRaw: 100,
    buildTimeMs: 5000,
    footprint: { w: 2, h: 2 },
  },
} as const;
```

Avoid adding several building types until one building works end-to-end.

### 4.4 Placement validation

`canPlaceBuilding()` should check:

- map bounds;
- footprint tiles;
- occupied tiles;
- resources / obstacles;
- sufficient resources;
- later: path reachability;
- later: territory / control requirements.

Return structured result:

```ts
{ valid: true }
{ valid: false, reason: 'occupied' }
```

Prefer machine-readable reasons over Russian UI strings inside state logic.

UI can translate reason codes later.

### 4.5 Deterministic IDs

Avoid inside state logic:

```ts
Date.now()
Math.random()
```

They make tests brittle and state non-deterministic.

Prefer:

- state-owned counters;
- injected ID generator;
- predictable prefixes in tests.

Example:

```ts
state.nextId += 1;
const id = `site_${state.nextId}`;
```

### 4.6 Delta clamp warning

If update logic clamps `deltaMs`, tests must account for it.

Bad example:

```ts
updateConstruction(state, 2500);
expect(progress).toBeCloseTo(0.5);
```

If the function clamps `deltaMs` to `200`, this test is wrong.

Better:

```ts
for (let i = 0; i < 13; i += 1) {
  updateConstruction(state, 200);
}
```

or expose a deterministic helper for tests.

---

## 5. Construction preview notes

A visual placement preview is useful, but it should not be bundled with the first pure construction logic PR if the PR gets large.

Preview should show:

- building footprint;
- valid / invalid state;
- reason if invalid;
- cost / build time;
- clear cancel behavior.

Controls to consider:

```text
1 — select Separator
Esc — cancel placement
Left click — place if valid
```

Implementation warning:

Preview must use the same coordinate and footprint logic as state validation. Do not duplicate placement rules in the renderer.

---

## 6. Event / VFX notes

The hybrid approach is preferred:

```text
state mutates directly
state update returns events for VFX/UI
renderer/VFX consumes events
```

Good use cases for events:

- construction started;
- builder arrived;
- building progress milestone;
- building completed;
- resource gathered;
- resource delivered.

Do not make the entire simulation event-driven yet.

Events are for feedback, not the core source of truth.

Possible shape:

```ts
export type GameEvent =
  | { type: 'construction-started'; siteId: string; tx: number; ty: number }
  | { type: 'building-completed'; buildingId: string; tx: number; ty: number }
  | { type: 'resource-delivered'; harvesterId: string; amount: number };
```

Keep payloads typed. Avoid `payload: any`.

---

## 7. VFX scope notes

Useful VFX ideas from the draft:

- dust on unit movement;
- pulse on resource gather;
- pulse on delivery to HQ;
- construction start dust;
- construction complete pulse;
- progress feedback.

But VFX should be a separate feel pass unless a tiny visual cue is required for Construction MVP.

First construction PR should not include a full `VFXManager` unless the scope is explicitly approved.

---

## 8. Testing notes

Useful early tests:

- `canPlaceBuilding()` accepts empty valid tile;
- rejects outside map;
- rejects occupied footprint;
- rejects insufficient resources;
- `placeBuilding()` deducts resources;
- creates construction site;
- assigns builder;
- builder reaches site;
- progress completes after repeated ticks;
- completed site becomes building.

Before construction tests, add baseline tests for existing logic:

- `tileToScreen` / `screenToTile`;
- `directionFromDelta`;
- `createInitialState` smoke;
- `updateGameState` smoke.

Do not test Phaser rendering in unit tests.

Manual QA remains required for visuals.

---

## 9. Performance notes

Target near-term scale:

```text
medium: up to ~50 units, up to ~100 buildings
```

Do not over-optimize now.

Useful future optimizations:

- occupancy set/cache;
- spatial lookup for resource/building search;
- object pooling for frequent VFX particles;
- renderer object registries for buildings/sites;
- path cache invalidation when occupancy changes.

Do not introduce these unless a concrete PR needs them.

---

## 10. Warnings from the audit drafts

### 10.1 Do not implement PR4 + PR5 together

The draft plan estimated 9–13 days and mixed logic, UI, VFX, builder AI, and tests. That must be split.

### 10.2 Do not use Rex plugins now

Rex docs can be secondary reference, but runtime dependencies are not allowed without mini-audit.

### 10.3 Do not expand combat

The modular tank system is useful, but it belongs to future combat work. Do not use it as justification to add attack logic now.

### 10.4 Do not put more keyboard/debug logic into GameScene

GameScene already has enough orchestration/debug responsibility. Future input/debug work should move into dedicated classes.

---

## 11. Future task extraction

When ready, create separate task contracts.

### PR13A — Vitest Baseline

Goal:

- add Vitest;
- add `npm test`;
- test pure TS logic only.

### PR13B — Modular renderer/debug split

Goal:

- extract Wasp/Smoky renderer and debug overlay from `EntityRenderer`;
- no behavior changes.

### PR14 — Passability + Pathfinding MVP

Goal:

- create passability grid from current state;
- add basic BFS/path-to-adjacent behavior;
- use for harvesters/builders later.

### PR15 — Construction MVP

Goal:

- one building type;
- validation;
- construction site;
- builder state machine;
- minimal visual feedback;
- tests.

### PR16 — VFX / Feel pass

Goal:

- dust;
- pulses;
- construction feedback;
- visual polish only.

---

## 12. One-line rule

Use these notes as raw material, not as a direct implementation prompt.

Split construction and VFX into narrow PRs, keep simulation pure, and test the logic before adding visual polish.
