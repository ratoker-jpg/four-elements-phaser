# Player Integration MVP — Implementation Audit

**Project:** Four Elements Phaser  
**Repo:** `ratoker-jpg/four-elements-phaser`  
**Date:** 2026-06-07  
**Mode:** DOCS-ONLY AUDIT PR — no runtime code, no src/ edits, no assets  
**Branch:** `PIM-IMPLEMENTATION-AUDIT-01-docs`

---

## 1. Executive Summary

### Is the roadmap implementable?

Yes. The PLAYER_INTEGRATION_MVP roadmap is implementable within the existing Phaser 4.1.0 codebase. The project already has a solid architectural foundation: pure TS state layer, Phaser rendering layer, DOM HUD layer — all with clear separation. The core mechanics loop (economy, construction, production, combat, movement) is closed and operational. Generated hull and turret sprite registries with on-demand loaders exist. The production config data model (BodyConfig, WeaponConfig with M0-M3 scaling) is in place. The remaining work is connecting existing systems into a player-facing tank loop and adding the strategic layer on top.

### Main architectural risks

1. **Asset preload gate explosion.** Currently generated assets load only in dev/arena mode via `isDevtoolsEnabled()`. Normal game mode never loads hull/turret sprites. The Standard game flow must gain bounded on-demand loading without triggering a 1792+2560 PNG preload.

2. **BlockoutVehicleRenderer is dev/arena-only.** The renderer currently only activates when devtools/arena is on. Normal game flow has no tank rendering path. Making generated sprites visible in Standard mode requires either extending BlockoutVehicleRenderer to work outside dev/arena or creating a lighter production renderer that reuses the same sprite resolution logic.

3. **Production system only handles builder/harvester.** `ProducibleUnitType` is currently `'builder' | 'harvester'`. Extending it to support `tank` (bodyId + weaponId composition) requires new queue item models, cost structures, and spawn logic without breaking existing civil production.

4. **No player-facing unit identity.** All labels use English internal IDs (wasp, hornet, smoky). The localization system exists (`t()` function, `displayNameKey` fields in configs) but tank composite names like "Оса + Смоки" are not wired.

5. **DOM HUD coupling to civil loop.** PlaytestHud is tightly coupled to the civil economy flow (economy readout, harvester status, separator status, factory queue for builders/harvesters). Adding tank production UI and RTS-style command grid requires either major PlaytestHud extension or a parallel HUD system.

6. **Movement visual micro-stutter / tile-step feel.** Current movement is tile-based with functional acceleration, speed, and pathfinding already implemented. The problem is not that movement is absent — it is that the rendering layer snaps between tile positions, producing a visual tile-step feel. Visual interpolation (easing between tile positions), acceleration/braking easing overlays, dust particles, and inertia overshoot are missing at the renderer-state smoothing layer. These are purely rendering-layer concerns and do not require pathfinding or occupancy rewrites.

### Recommended final implementation order

```
Step 1 (Track A)  — Asset visibility / loading / rendering across modes
Step 2 (Track B)  — Russian unit identity / player-facing labels
Step 3 (Track F)  — Movement feel / visual smoothing MVP
Step 4 (Track D)  — Body/weapon production config
Step 5 (Track E)  — Unit Factory tank production MVP
Step 6 (Track G)  — RTS HUD MVP
Step 7 (Track H)  — M-level progression
Step 8 (Track I)  — Fog / territory / minimap
Step 9 (Track J)  — Combat VFX late slice
     (Track C)  — Systemic asset profile contract (parallel, docs/design, does not block Track E)
```

Tracks A → B → F form the first player-facing slice: see tank, name tank, move tank smoothly. Track D adds production config. Track E adds tank production (core game loop). Track G adds RTS control. Track H adds progression. Tracks I-J add strategic and visual depth. Track C runs in parallel as docs/design and does not block Track E unless this audit proves otherwise.

### What must happen before Step 1

- PR #230 (HULL-VISUAL-FIXUP-02) must be merged — it provides the per-hull visual profiles that Step A relies on.
- PR #232 (WORKFLOW-CLEANUP-01) should be merged to avoid branch conflicts.
- Manual visual QA of current hull sprites in Arena must confirm that generated sprites render correctly at the per-hull profile values.

### What must NOT be done

- No bot/strategic AI/enemy base-building AI/attack-wave AI — hard block.
- No full 1792 hull + 2560 turret preload at startup.
- No mass rerender of assets.
- No copying old Canvas implementation code from glm-game-sandbox or four-elements-next.
- No broad renderer rewrite unless this audit proves it unavoidable.
- No combat VFX before the foundation player tank loop is complete.
- No fog/territory before the core player-facing tank loop works end-to-end.

---

## 2. Current Repo Implementation Map

### Asset registry and loading

| Component | Current Files | Responsibilities | Gaps | Extension Points | Risky Coupling |
|---|---|---|---|---|---|
| Hull registry | `src/assets/generatedHullAssets.ts` | Hull IDs, factions, mods, 16-dir paths, on-demand loader, per-hull visual profiles | No index.json metadata; profiles are hardcoded constants | `preloadGeneratedHullSet()` — add bounded subset loading for Standard mode | `resolveGeneratedHullKey()` depends on `scene.textures.exists()` |
| Turret registry | `src/assets/generatedTurretAssets.ts` | Turret IDs, weapon→turret mapping, 16-dir paths, on-demand loader | No per-turret visual profiles (only global constants); no index.json | `preloadGeneratedTurretSet()` — add bounded loading | `weaponIdToTurretId()` mapping is a manual bridge between runtime IDs and asset folder names |
| PreloadScene | `src/phaser/PreloadScene.ts` | Loads terrain, buildings, civil units; conditionally loads modular combat + hull/turret sets in arena mode | Standard mode never loads hull/turret sprites; no on-demand loading during gameplay | Add bounded hull/turret preloading for Standard mode startup; add late-loading API for mid-game unit creation | `isDevtoolsEnabled()` gate is the only conditional — needs a new Standard game asset gate |

### Rendering

| Component | Current Files | Responsibilities | Gaps | Extension Points | Risky Coupling |
|---|---|---|---|---|---|
| BlockoutVehicleRenderer | `src/phaser/render/BlockoutVehicleRenderer.ts` | Renders blockout vehicles (Graphics + generated hull/turret sprites), selection rings, HP bars, depth sorting | Only active in dev/arena mode; per-frame sprite lifecycle management; hardcoded debug labels | Make usable outside arena; add Russian labels; extract overlay rendering for production HUD | Tightly coupled to `BlockoutVehicleState` shape |
| ModularTankRenderer | `src/phaser/render/ModularTankRenderer.ts` | Legacy modular tank renderer (procedural body/turret) | Likely unused after BlockoutVehicleRenderer took over | May be removable or kept as ultimate fallback | Check if anything still references it |
| Vehicle geometry | `src/phaser/render/blockoutVehicleGeometry.ts` | Computes projected box geometry for blockout rendering | Geometry values are tuning constants | Must stay in sync with generated sprite profiles | None significant |

### State model

| Component | Current Files | Responsibilities | Gaps | Extension Points | Risky Coupling |
|---|---|---|---|---|---|
| Game state types | `src/state/types.ts` | Full GameState interface, all type definitions | `ProducibleUnitType` = `'builder' \| 'harvester'` only; `ModularCombatUnit` is hardcoded to wasp/smoky/m0; `blockoutVehicles` is optional/arena-only | Extend ProducibleUnitType; add tank queue item; make combat units first-class state (not just arena) | `EconomyState` assumes civil-only production |
| Production system | `src/state/production.ts` | Factory queue management, cost lookup, start/cancel | Only handles builder/harvester; cost model is switch/case; no body+weapon composition | Add tank production with composed body+weapon cost | `startUnitProduction()` directly mutates `state.economy.matter/elements` |
| Blockout vehicle state | `src/state/blockoutVehicleState.ts` | BlockoutVehicleState type, create helper | Arena-only; not persisted; not connected to production | Needs a production vehicle counterpart that IS persisted and connects to factory spawn | Many arena-specific fields (aiMode, etc.) |

### Config data

| Component | Current Files | Responsibilities | Gaps | Extension Points | Risky Coupling |
|---|---|---|---|---|---|
| Blockout body data | `src/config/blockoutBodyData.ts` | Body profiles with referenceM3 HP/speed/mass, mount offsets | Only blockout/Arena data; no production BodyConfig instances | BodyConfig type exists in coreMechanicsTypes.ts but no data file populates it yet | `displayName` is English, no `displayNameKey` |
| Blockout weapon data | `src/config/blockoutWeaponData.ts` | Weapon profiles with damage model, barrel lengths | Only blockout/Arena data; `displayName` is English | WeaponConfig data exists in weaponData.ts with `displayNameKey` but blockout data lacks it | Two parallel weapon data systems (blockout + production) |
| Production weapon data | `src/config/weaponData.ts` | Full WeaponConfig with M0-M3 scaling, range bands, fire types | Missing body production data; no production cost fields | Add BodyConfig data file; add production cost fields to both body and weapon configs | `displayNameKey` references localization keys that may not exist for all bodies yet |
| Core mechanics types | `src/config/coreMechanicsTypes.ts` | BodyConfig, WeaponConfig, FactionConfig, BuildingConfig, ResourceClassConfig types | BodyConfig has no production cost fields; no body-weapon compatibility matrix | Add cost fields; add compatibility model | Types are stable and well-designed |

### UI/HUD

| Component | Current Files | Responsibilities | Gaps | Risky Coupling |
|---|---|---|---|---|
| PlaytestHud | `src/phaser/ui/PlaytestHud.ts` | Economy readout, build buttons, production buttons (builder/harvester only), harvester/separator/factory status, tooltips | No tank production UI; no unit selection info; no command grid; no minimap; civil-loop-only | Tightly coupled to `GameState` civil fields; DOM-only, no Phaser dependency |
| ArenaMenu | `src/phaser/ui/ArenaMenu.ts` | Arena unit composer (body/weapon/team), roster, help overlay | Arena-only; uses English display names; no production flow | Uses `BODY_PROFILES.displayName` (English) |
| ArenaUnitComposer | `src/phaser/ui/ArenaUnitComposer.ts` | Body/weapon/team selector for Arena | Arena-only; no cost display; no tier locking | Selects from all 7 bodies and 11 weapons without restriction |

### Validation tools

| Component | Current Files | Responsibilities | Gaps |
|---|---|---|---|
| Hull validator | `tools/validate_hull_assets.mjs` | Validates hull PNG matrix completeness | Run manually; not in CI |
| Turret validator | `tools/validate_turret_assets.mjs` | Validates turret PNG matrix completeness | Run manually; not in CI |

---

## 3. Reference Repo Findings

### 3.1 glm-game-sandbox

**Docs/files inspected:**
- `docs/project/GLM_FUTURE_VISION_HYPOTHESES_20260510.md`
- `docs/project/ARCHITECTURE_TARGET.md`
- `docs/project/ARCH_MAP_01_MAIN_SYSTEMS_MAP.md`
- `src/config/units.js`, `src/config/buildings.js`, `src/config/factions.js`, `src/config/environment.js`, `src/config/sprite_profiles.js`
- `src/systems/command_system.js`, `src/systems/movement_system.js`
- `src/economy/economy_system.js`, `src/construction/construction_system.js`
- `src/game/game_state.js`
- `fe-next/src/systems/movement.js`, `fe-next/src/systems/harvesting.js`, `fe-next/src/systems/economy.js`
- `fe-next/src/ui/hud.js`, `fe-next/src/game/state.js`

**Reusable concepts/specs:**
- **Fog of war two-layer model** (unexplored / explored-not-visible / visible) with per-unit and per-building vision radii — conceptually clean, can be adapted to pure TS state.
- **Territory coloring by cell ownership** — cells claimed by placing buildings, spreading outward from buildings with a configurable radius. The model of `claimTerritory()` and cell-owner grid is directly portable as a design.
- **Movement visual smoothing** — `fe-next/src/systems/movement.js` has `moveProgress` (0..1 interpolation between tiles), which is the exact pattern needed for Track F visual interpolation without changing occupancy.
- **Economy processing pipeline** — raw → matter → elements with separator cycle — already implemented in phaser but the sandbox's pipeline visualization concepts are useful for HUD.
- **Command system** — `src/systems/command_system.js` has a command queue model that maps well to the RTS command grid needed for Track G.

**What not to copy:**
- All Canvas rendering code — Phaser replaces it entirely.
- `main.js` monolithic game loop — Phaser has its own scene lifecycle.
- Old JavaScript patterns (no types, mutable global state) — Phaser project uses TypeScript with strict state model.
- `sprite_profiles.js` manual per-unit tuning — the Phaser project uses `GeneratedHullVisualProfile` which is already more systematic.

### 3.2 four-elements-next

**Docs/files inspected:**
- `docs/NEXT_00_BLUEPRINT.md`
- `docs/architecture/NEXT_ARCHITECTURE_OVERVIEW.md`
- `docs/ASSET_POLICY.md`, `docs/ARCHITECTURE_RULES.md`, `docs/DECISIONS_LOG.md`
- `docs/project/ROADMAP_RTS_FEEL_NOTES_20260519.md`
- `docs/project/PHASER_SPIKE_RESULT_20260524.md`
- `docs/project/BUILDING_ASSETS_CHECKPOINT_20260519.md`
- `docs/project/ASSET_PIPELINE_ARCH_01.md`
- `src/systems/economy.ts`, `src/systems/production.ts`, `src/systems/power.ts`, `src/systems/control.ts`
- `src/systems/territory.ts`, `src/systems/harvesting.ts`, `src/systems/construction.ts`
- `src/config/buildings.ts`, `src/core/constants.ts`
- `src/render-phaser/vfx/inertia.ts`, `src/render-phaser/vfx/dust-emitter.ts`, `src/render-phaser/vfx/feedback-effects.ts`
- `src/render/economy-hud.ts`, `src/render/production-panel.ts`, `src/render/build-menu.ts`
- `src/render/territory.ts`, `src/game/map-types.ts`, `src/game/game-state.ts`

**Reusable concepts/specs:**
- **Body/weapon composition model** — `production.ts` has a composed unit model where body cost + weapon cost are summed. The `TankProductionRequest` with bodyId + weaponId fields is the exact model needed for Track E.
- **T1/T2/T3 unlock model** — buildings unlock at tech tiers; factories at different tiers produce different hull classes. Light bodies (wasp, hornet) at T1, medium (hunter, viking, dictator) at T2, heavy (titan, mammoth) at T3. This maps directly to Track D's tier locking.
- **M0-M3 upgrade by combat contribution** — kills + damage dealt accumulate toward M1/M2/M3. The `MLevelProgress` type tracking `killsAccumulated` and `damageDealt` is the model for Track H.
- **Movement VFX** — `inertia.ts` has velocity damping and visual overshoot; `dust-emitter.ts` has per-tile dust particle emission on movement start. These are directly portable as rendering-layer VFX for Track F.
- **Territory system** — `territory.ts` has a cell-grid ownership model with per-building spread radius. Uses `updateTerritory()` called on building placement. Clean pure-TS model adaptable for Track I.
- **Production panel UI** — `production-panel.ts` has a body selector + weapon selector + cost display + queue visualization. The DOM structure is a strong reference for Track G's factory integration.
- **SC2-inspired HUD layout** — `ROADMAP_RTS_FEEL_NOTES_20260519.md` describes minimap bottom-left, info center, commands bottom-right. This is the Track G layout reference.

**What not to copy:**
- The entire `src/render/` DOM rendering system — Phaser project uses Phaser's Graphics and Image objects, not DOM for game rendering.
- The old TypeScript implementations that assume a different game loop architecture.
- `game-state.ts` global mutable state — Phaser project uses explicit `GameState` passed through functions.
- Any Next-specific building/unit types that don't match the accepted Phaser config model.

---

## 4. Final Dependency Graph

```
Track A (Asset visibility) ──┐
  ↓                           │
Track B (Russian labels)     │ Track C (Asset profiles) — parallel docs/design,
  ↓                           │ does NOT block Track E
Track F (Movement feel)  ←───┤ depends on A (sprites visible for interpolation)
  ↓                           │
Track D (Production config) ─┤ independent of A/B/F, can start in parallel
  ↓                           │
Track E (Tank production) ←──┘ depends on A (sprites load), D (config data)
  ↓                           │
Track G (RTS HUD) ←── B (labels), E (production UI), F (movement commands)
  ↓
Track H (M-level progression) ←── D (config), E (production), G (upgrade UI)
  ↓
Track I (Fog/territory/minimap) ←── G (minimap in HUD), E (units to reveal)
  ↓
Track J (Combat VFX) ←── A (sprite rendering), E (combat units), F (movement)
```

**Parallel opportunities:**
- Track C runs in parallel as docs/design and does NOT block Track E
- Track D can run in parallel with Tracks A + B + F
- Track F is pulled forward before D/E because visual smoothing is renderer-only and only needs A (sprites visible); it does not require E (tank production) to start
- Track J prototyping can start anytime but must not merge before E + F

**Sequential constraints:**
- F must wait for A (sprites visible for interpolation to have something to smooth)
- E must wait for A + D
- G must wait for B + E + F
- H must wait for D + E + G
- I must wait for E + G

**Docs/spec decisions required before:**
- Track D: Denis must confirm T1/T2/T3 unlock table, starter unit composition, production costs
- Track E: Denis must confirm tank queue model (body+weapon as single item vs separate)
- Track G: Denis must confirm HUD layout priorities (which panels first)
- Track H: Denis must confirm M-level upgrade formula (kills? damage? both?)
- Track I: Denis must confirm territory spread model (building-based vs unit-based vs both)

---

## 5. Final Implementation Sequence

### Step 1 — PIM-STEP-01: Asset visibility / loading / rendering across player modes (Track A)

| Field | Value |
|---|---|
| Risk | High+ |
| Goal | Make generated hull and turret sprites load and display in Standard and Debug game modes, not just Arena. Scope is strictly asset visibility, loading, and rendering — no production vehicle state adapter, no factory production, no starter tank creation |
| Prerequisites | PR #230 merged; manual hull QA confirmed |
| Expected files/functions touched | `src/phaser/PreloadScene.ts` (add bounded Standard-mode loading), `src/phaser/GameScene.ts` (remove arena-only renderer gate), possibly `src/phaser/render/BlockoutVehicleRenderer.ts` (ensure it works outside arena) |
| What must NOT be touched | State types, production system, economy, PlaytestHud, ArenaMenu, factory logic, vehicle state adapter, starter tank creation. Track A may define how Standard mode will render already-existing/loaded combat vehicle state, but must not create a production/state model — that belongs in Track E |
| Tool classification | GLM-only |
| Expected PR size | Medium |
| Validation commands | `npm run typecheck && npm run test && npm run build && npm run qa:smoke` |
| Manual QA checklist | (1) Start Standard game — no 1792+2560 PNG preload. (2) Bounded hull+turret sprite set loads without errors. (3) Arena still works identically. (4) No 404 for hull/turret assets. (5) Fallback to blockout cube works if sprite not loaded. (6) BlockoutVehicleRenderer renders generated sprites in Standard/Debug mode (not just arena) |
| Acceptance criteria | Standard mode loads bounded hull+turret sprite set (recommended: starter-only preload = 32 PNG — see Section 6 preload strategy comparison); BlockoutVehicleRenderer renders generated sprites outside arena; no full matrix preload; no production vehicle state adapter in this step |
| Rollback risk | Low — adding bounded loading does not break existing Arena path |

### Step 2 — PIM-STEP-02: Russian unit identity and player-facing labels (Track B)

| Field | Value |
|---|---|
| Risk | High |
| Goal | Replace English IDs in player-visible UI with Russian labels; support composite names like "Оса + Смоки" |
| Prerequisites | None (can start in parallel with Step 1) |
| Expected files/functions touched | `src/config/localization.ts`, `src/config/blockoutBodyData.ts` (add displayNameKey), `src/phaser/ui/ArenaMenu.ts` (use localized names), `src/phaser/render/BlockoutVehicleRenderer.ts` (debug labels), possibly new `src/config/unitLabels.ts` |
| What must NOT be touched | Internal stable IDs (wasp, hornet, etc. stay English), state types, production logic |
| Tool classification | GLM-only |
| Expected PR size | Small |
| Validation commands | `npm run typecheck && npm run test && npm run build` |
| Manual QA checklist | (1) ArenaMenu shows "Оса + Смоки" instead of "Wasp+Smoky". (2) Debug labels still show English IDs for developer reference. (3) Composite name formatting works for all 7×10=70 body+weapon combos. |
| Acceptance criteria | All player-visible UI shows Russian names; internal IDs unchanged; `displayNameKey` fields added to body profiles; composite name helper exists |
| Rollback risk | Low — labels are display-only |

### Step 3 — PIM-STEP-03: Movement feel and visual smoothing MVP (Track F)

| Field | Value |
|---|---|
| Risk | High |
| Goal | Add visual interpolation between tile positions to eliminate micro-stutter / tile-step feel; acceleration/braking easing; dust particles; inertia overshoot; direction smoothing. This is a rendering-layer fix — does not change pathfinding, occupancy, or game logic speed |
| Prerequisites | Step 1 (sprites visible — interpolation needs sprites to smooth). Does NOT require Step 5 (tank production) |
| Expected files/functions touched | `src/phaser/render/BlockoutVehicleRenderer.ts` (interpolation), `src/state/blockoutVehicleState.ts` (add visual interpolation fields), possibly new `src/phaser/render/vehicleInterpolation.ts`, `src/phaser/render/dustEmitter.ts` |
| What must NOT be touched | Occupancy system, pathfinding, game logic speed |
| Tool classification | GLM-only for interpolation logic; dust emitter can reference four-elements-next's `dust-emitter.ts` design |
| Expected PR size | Large |
| Validation commands | `npm run typecheck && npm run test && npm run build` |
| Manual QA checklist | (1) Tanks visually ease between tiles instead of snapping. (2) Acceleration/braking visible on start/stop. (3) Dust particles emit on movement start. (4) Direction changes are smooth (easing or crossfade). (5) Logical tile occupancy unchanged. (6) Arena movement still works. |
| Acceptance criteria | Visual position interpolates between tiles; acceleration/braking easing implemented; dust MVP particles present; direction smoothing works; occupancy/pathfinding unchanged |
| Rollback risk | Medium — adds rendering state but does not change game logic |

### Step 4 — PIM-STEP-04: Body/weapon production config (Track D)

| Field | Value |
|---|---|
| Risk | High |
| Goal | Add production BodyConfig data file with all 7 bodies; add cost/compatibility/tier fields to both body and weapon configs; create tier unlock model |
| Prerequisites | Denis must confirm T1/T2/T3 unlock table, starter composition, production costs |
| Expected files/functions touched | New `src/config/bodyData.ts`, `src/config/weaponData.ts` (add cost fields), `src/config/coreMechanicsTypes.ts` (add cost/tier/compatibility types), `src/state/types.ts` (add tier state) |
| What must NOT be touched | Blockout data files, Arena rendering, PlaytestHud |
| Tool classification | GLM-only |
| Expected PR size | Medium |
| Validation commands | `npm run typecheck && npm run test && npm run build` |
| Manual QA checklist | (1) All 7 bodies have production BodyConfig entries. (2) Cost fields populated. (3) Tier model compiles. (4) Body-weapon compatibility matrix exists. (5) Starter tank (Wasp + Smoky) is the default. |
| Acceptance criteria | BodyConfig data file with all 7 bodies; cost/tier/compatibility types; Denis-confirmed values marked; backward compatible with existing WeaponConfig |
| Rollback risk | Low — config-only, no runtime behavior change |

### Step 5 — PIM-STEP-05: Unit Factory tank production MVP (Track E)

| Field | Value |
|---|---|
| Risk | High+ |
| Goal | Extend production system to produce tanks (body+weapon composition); add TankProductionQueueItem; spawn logic; M0 default; tier locking; starter tank |
| Prerequisites | Step 1 (sprites load), Step 4 (production config). Note: production vehicle state adapter and starter tank creation belong here in Track E, not in Track A |
| Expected files/functions touched | `src/state/production.ts`, `src/state/types.ts`, `src/state/createInitialState.ts`, `src/state/updateGameState.ts`, `src/phaser/GameScene.ts`, possibly `src/phaser/render/BlockoutVehicleRenderer.ts` |
| What must NOT be touched | Civil production (builder/harvester) — must keep working; economy constants |
| Tool classification | GLM-only |
| Expected PR size | Large |
| Validation commands | `npm run typecheck && npm run test && npm run build && npm run qa:smoke` |
| Manual QA checklist | (1) Factory can produce tank (body+weapon). (2) Cost deducted correctly. (3) Tank spawns at factory with M0 default. (4) Tier locking prevents producing T2/T3 tanks without prerequisite. (5) Starter tank exists on new game. (6) Civil production still works. (7) Save/load preserves tank production state. |
| Acceptance criteria | `ProducibleUnitType` extended with tank; tank queue item has bodyId + weaponId; spawn creates a production vehicle (not arena-only blockout); tier locking enforced; starter tank present; civil production unbroken |
| Rollback risk | High — touches production state and save format |

### Step 6 — PIM-STEP-06: RTS HUD MVP (Track G)

| Field | Value |
|---|---|
| Risk | High+ |
| Goal | Create RTS-style HUD with selected unit info, command grid, factory integration, multi-select MVP, hotkeys |
| Prerequisites | Step 2 (Russian labels), Step 5 (production UI), Step 3 (movement commands) |
| Expected files/functions touched | New `src/phaser/ui/RtsHud.ts`, possibly `src/phaser/ui/CommandGrid.ts`, `src/phaser/ui/UnitInfoPanel.ts`, `src/phaser/ui/MinimapPlaceholder.ts`, `src/phaser/GameScene.ts` (wire HUD) |
| What must NOT be touched | PlaytestHud (keep for civil loop until RtsHud replaces it); ArenaMenu (keep for Arena mode) |
| Tool classification | GLM-only |
| Expected PR size | Large |
| Validation commands | `npm run typecheck && npm run test && npm run build` |
| Manual QA checklist | (1) Selected tank shows info panel (name, HP, weapon, M-level). (2) Command grid with Move/Attack/Stop/Patrol placeholders. (3) Factory panel shows tank production options. (4) Multi-select shows unit count and average HP. (5) Hotkeys work (S=stop, A=attack-move). (6) PlaytestHud still works in civil mode. (7) ArenaMenu still works in Arena mode. |
| Acceptance criteria | RTS HUD renders in Standard mode; selected unit info displays; command grid functional; factory production integrated; multi-select MVP works; hotkeys wired; existing HUDs unbroken |
| Rollback risk | Medium — new UI component, existing HUDs preserved |

### Step 7 — PIM-STEP-07: M-level progression (Track H)

| Field | Value |
|---|---|
| Risk | High |
| Goal | Track kills + damage dealt; unlock M1/M2/M3 upgrades; upgrade UI; separate body vs turret upgrade; T3 direct M1+ production as design-only |
| Prerequisites | Step 4 (config with M0-M3 data), Step 5 (production), Step 6 (upgrade UI in HUD) |
| Expected files/functions touched | `src/state/types.ts` (add MLevelProgress), new `src/state/mLevelProgress.ts`, `src/state/updateGameState.ts` (combat contribution tracking), `src/phaser/ui/RtsHud.ts` (upgrade button), `src/config/weaponData.ts` / new `src/config/bodyData.ts` (M-level values already exist) |
| What must NOT be touched | M0-M3 scaling formulas (already accepted); base damage/HP values |
| Tool classification | GLM-only |
| Expected PR size | Medium |
| Validation commands | `npm run typecheck && npm run test && npm run build` |
| Manual QA checklist | (1) Kills and damage tracked per unit. (2) M1/M2/M3 unlock thresholds configurable. (3) Upgrade button appears in HUD when threshold met. (4) Upgrading applies M-level stat scaling. (5) Body and turret upgrade separate. (6) M0 default on production. |
| Acceptance criteria | Kill/damage tracking state; M-level upgrade unlock logic; upgrade UI in RTS HUD; M0→M3 scaling applied on upgrade; T3 direct M1+ documented as design-only |
| Rollback risk | Low — additive state and UI |

### Step 8 — PIM-STEP-08: Fog / territory / minimap (Track I)

| Field | Value |
|---|---|
| Risk | High |
| Goal | Pure TS visibility model (two-layer fog); fog render strategy; territory ownership/spread; minimap architecture |
| Prerequisites | Step 5 (units to reveal), Step 6 (minimap in HUD) |
| Expected files/functions touched | New `src/state/fog.ts`, `src/state/territory.ts`, `src/phaser/render/FogRenderer.ts`, `src/phaser/render/TerritoryRenderer.ts`, `src/phaser/ui/Minimap.ts`, `src/state/types.ts` (add fog/territory state) |
| What must NOT be touched | Camera rotation (forbidden); projection contract; existing rendering depth sorting |
| Tool classification | GLM-only for state and rendering; Codex not needed |
| Expected PR size | Large |
| Validation commands | `npm run typecheck && npm run test && npm run build` |
| Manual QA checklist | (1) Unexplored areas are dark. (2) Explored-but-not-visible areas are dimmed. (3) Visible areas near units/buildings are clear. (4) Territory coloring shows owned cells. (5) Territory expands from buildings. (6) Minimap shows terrain + units + fog. (7) Performance acceptable (no per-frame full-map recalc). |
| Acceptance criteria | Two-layer fog state model; fog rendering on isometric ground plane; territory cell ownership model; territory spread from buildings; minimap renders fog + territory + units; projection-compliant rendering |
| Rollback risk | High — new rendering layer, potential performance impact |

### Step 9 — PIM-STEP-09: Combat VFX late slice (Track J)

| Field | Value |
|---|---|
| Risk | High |
| Goal | Weapon VFX profiles; muzzle flash / projectile / beam / hit effects; which VFX are procedural vs need assets |
| Prerequisites | Step 1 (sprite rendering), Step 5 (combat units), Step 3 (movement for projectile tracking) |
| Expected files/functions touched | New `src/config/vfxProfiles.ts`, `src/phaser/render/VfxRenderer.ts`, possibly `src/phaser/render/projectile.ts`, `src/phaser/render/beam.ts`, `src/phaser/render/muzzleFlash.ts` |
| What must NOT be touched | Combat logic (hit model, damage calc); weapon configs |
| Tool classification | GLM-only for procedural VFX; Blender/local analysis needed for any pre-rendered VFX assets |
| Expected PR size | Medium |
| Validation commands | `npm run typecheck && npm run test && npm run build` |
| Manual QA checklist | (1) Smoky projectile visible on fire. (2) Thunder splash effect on impact. (3) Railgun beam visible. (4) Flamethrower cone visual. (5) Freeze cone visual. (6) Isida beam visual. (7) Vulcan rapid-fire tracers. (8) Twins plasma projectiles. (9) Ricochet bouncing projectile. (10) Hammer shotgun spread. (11) Muzzle flash on all weapons. |
| Acceptance criteria | VFX profile config for all 10 weapons; at least procedural VFX for all weapons; muzzle flash implemented; hit effect implemented; documented which VFX need Blender assets later |
| Rollback risk | Low — additive rendering layer |

### Parallel — PIM-STEP-C: Systemic asset profile contract (Track C)

| Field | Value |
|---|---|
| Risk | High |
| Goal | Formalize per-hull and per-turret visual profiles; introduce metadata validation; determine what needs Codex/local analysis |
| Prerequisites | Step 1 (sprites visible in Standard mode) |
| Expected files/functions touched | `src/assets/generatedHullAssets.ts` (add profile validation), possibly `src/assets/generatedTurretAssets.ts` (add per-turret profiles), `tools/validate_hull_assets.mjs` (extend) |
| What must NOT be touched | Sprite rendering in production; runtime behavior changes |
| Tool classification | GLM-only for code; Codex/local PNG analysis recommended for computing artBounds, groundAnchor, mountPoint from actual pixel data |
| Expected PR size | Medium |
| Validation commands | `npm run typecheck && npm run test && npm run build && node tools/validate_hull_assets.mjs` |
| Manual QA checklist | (1) Per-hull profiles have validated scale/origin/offset values. (2) Per-turret profile system exists even if values are global defaults. (3) Validation tool checks profile completeness. (4) Documentation of which values need Codex/local analysis. |
| Acceptance criteria | Per-hull profiles validated; per-turret profile interface defined; validation tool extended; documented list of values that need pixel analysis vs manual tuning |
| Rollback risk | Medium — profile values directly affect visual rendering |
| Blocking | Does NOT block Track E or any other sequential step. Runs in parallel as docs/design work. |

---

## 6. Track A Audit — Asset Visibility Across Modes

### Why generated assets are visible in dev/Arena but not in normal game flow

Generated hull and turret sprites are only preloaded when `isDevtoolsEnabled()` returns true (i.e., when `?devtools=1` or `?arena=1` is in the URL). In `PreloadScene.preload()`, the hull/turret loading block is wrapped in:

```ts
if (isDevtoolsEnabled()) {
  // load modularUnits + hull sets + turret sets
} else {
  console.log('[PreloadScene] modularUnits loading skipped (standard mode).');
}
```

Additionally, `BlockoutVehicleRenderer` is only instantiated and synced when the game is in arena/devtools mode. In Standard game mode, the `blockoutVehicles` array in `GameState` is empty/undefined, so even if textures were loaded, there would be no vehicles to render.

### Exact preload gates

1. **PreloadScene gate:** `isDevtoolsEnabled()` — controls whether `preloadGeneratedHullSet()` and `preloadGeneratedTurretSet()` are called at all.
2. **GameScene gate:** Arena/devtools mode controls whether `BlockoutVehicleRenderer` is instantiated and whether `blockoutVehicles` state is populated.
3. **Texture existence gate:** `resolveGeneratedHullKey()` and `resolveGeneratedTurretKey()` check `scene.textures.exists(key)` — if a texture was never loaded, the resolver returns null and the blockout fallback is used.

### Standard/Debug/Arena entry points

| Mode | URL | Assets loaded | Renderer active |
|---|---|---|---|
| Standard | `/` | Terrain, buildings, civil units only | No BlockoutVehicleRenderer |
| Debug | `/?devtools=1` | All Standard + modularUnits + hull/turret subsets | BlockoutVehicleRenderer active |
| Arena | `/?devtools=1&arena=1` | All Debug + Arena-specific setup | BlockoutVehicleRenderer + ArenaMenu |

### Bounded preload strategy comparison

The on-demand loader `preloadGeneratedHullSet(scene, hull, faction, mod)` loads exactly 16 PNGs (one per direction) for one hull+faction+mod combination. Three strategies exist for Standard mode startup:

| Strategy | PNG count | What loads | Pros | Cons |
|---|---|---|---|---|
| **Starter-only** | 32 (16 hull + 16 turret) | Wasp + Smoky, 1 faction, m0 | Minimum download; fastest startup; sufficient for very first frame | Can only render starter tank; any other body/weapon shows blockout cube until late-loaded |
| **Current-faction M0** | 272 (112 hull + 160 turret) | 7 hulls + 10 turrets, 1 faction, m0 | All player faction tanks visible immediately; no late-load stutter when switching units | 8.5× more PNGs than starter-only; loads hulls player may never produce this game |
| **Lazy load on factory selection/production** | 32 + on-demand | Starter at startup; additional sets loaded when factory selects body/weapon | Minimal startup cost; only loads what player actually uses | Loading delay when selecting a new body type; potential stutter on first production of each hull type |
| **Full matrix** (forbidden) | 1792 + 2560 = 4352 | All 7 hulls × 4 factions × 4 mods × 16 dir | Everything available | Completely unacceptable; 8-second+ preload on fast connections; violates hard constraint |

**Recommended: Starter-only preload (32 PNG)** for Track A Step 1.

Justification: The starter-only strategy is the safest choice for the first implementation step because: (1) it has the smallest possible surface area — only the Wasp hull and Smoky turret are loaded, making debugging and QA straightforward; (2) it guarantees no startup performance regression; (3) the late-loading API (Track A, future step or Track E) will handle additional body/weapon sets when the factory produces them; (4) blockout cube fallback for unloaded sprites already works and is visually acceptable for non-starter units in the MVP. The current-faction M0 strategy (272 PNGs) is a reasonable optimization for a later step, but should not be the initial implementation because it bundles loading logic with config assumptions about which hulls are player-faction.

### How to avoid full 1792 hull + 2560 turret preload

Never call `preloadGeneratedHullSet()` or `preloadGeneratedTurretSet()` for all 4 factions × 4 mods × all hulls/turrets. Load only:
- Starter tank at game start (Wasp + Smoky, m0 = 32 PNGs — recommended for Step 1)
- Additional hull/weapon sets on-demand when factory selects or produces them (late-loading via Phaser's `scene.load.start()` after initial preload)
- M1/M2/M3 mod sets only when a unit actually upgrades to that level

### How to preserve fallback

`resolveGeneratedHullKey()` already returns `null` when the texture doesn't exist. `BlockoutVehicleRenderer.renderVehicle()` already has a fallback path: when `useGeneratedHull` is false, it draws the blockout cube. This fallback must be preserved and must work in Standard mode — if a texture set hasn't been loaded for a faction/mod combo, the cube appears instead.

### Whether BlockoutVehicleRenderer is enough or a new renderer is actually needed

**BlockoutVehicleRenderer is sufficient** for the MVP. It already handles:
- Generated hull sprites with per-hull profiles
- Generated turret sprites with 16-dir resolution
- Fallback to procedural blockout when sprites not loaded
- HP bars, selection rings, depth sorting, overlay rendering
- Direction arrows, move target markers, aim lines

What it needs to work in Standard mode:
1. Remove the arena/devtools-only instantiation gate in GameScene
2. Ensure it can render when `blockoutVehicles` is empty (Track A scope — just the rendering gate)
3. Add support for production vehicle state (not just `BlockoutVehicleState`) — **this belongs in Track E**, not Track A

The cleanest approach is to create a thin adapter that maps production vehicle state to the same rendering interface BlockoutVehicleRenderer expects, rather than creating a new renderer. **However, this adapter is Track E scope.** Track A only removes the gate and enables the renderer to exist in Standard mode. Track E will provide the adapter when tank production creates actual vehicles.

### Whether PreloadScene should change and how

Yes, PreloadScene must change:
1. Add a Standard-mode hull/turret loading block (outside the `isDevtoolsEnabled()` gate) that loads player faction sets at m0.
2. Add a late-loading API that other scenes can call to load additional hull/turret sets on demand (e.g., when a factory produces a tank with a new body type).
3. Keep the Arena loading block unchanged.

---

## 7. Track B Audit — Localization / Unit Identity

### Where English IDs appear

1. **ArenaMenu roster:** `BODY_PROFILES[row.bodyId]?.displayName ?? row.bodyId` — `displayName` is "Wasp", "Hornet", etc.
2. **ArenaUnitComposer body/weapon selectors:** Uses `BODY_PROFILES` and `WEAPON_PROFILES` displayName fields.
3. **BlockoutVehicleRenderer debug labels:** `${vehicle.bodyId}+${vehicle.weaponId}` — raw English IDs.
4. **devArena.ts spawn messages:** `${bodyName}+${weaponName} placed at...` — capitalized English IDs.
5. **PlaytestHud:** Uses `t()` for most labels but production buttons show `t('hud_builder')` / `t('hud_harvesterUnit')` — already localized.

### Where Russian labels should be centralized

A single `src/config/unitLabels.ts` module should provide:
- Body Russian names: wasp → "Оса", hornet → "Шершень", hunter → "Охотник", viking → "Викинг", dictator → "Диктатор", titan → "Титан", mammoth → "Мамонт"
- Weapon Russian names: smoky → "Смоки", thunder → "Гром", railgun → "Рельса", flamethrower → "Огнемёт", freeze → "Фриз", isida → "Изида", vulcan → "Вулкан", twins → "Твинс", ricochet → "Рикошет", hammer → "Молот"
- Composite name helper: `getCompositeUnitName(bodyId, weaponId)` → "Оса + Смоки"
- Role labels: wasp → "Лёгкий разведчик", hornet → "Быстрый рейдер", etc.

This module should use the existing localization system (`t()` function with `displayNameKey` lookup) as its backing store, with the composite helper as a convenience wrapper.

### How to keep internal IDs stable

Internal IDs (`wasp`, `hornet`, `smoky`, etc.) must never change — they are used in state serialization, asset paths, config lookups, and save files. The Russian labels are purely display-layer concerns. The `displayNameKey` field in `WeaponConfig` already demonstrates this pattern: `id: 'smoky'` (stable) + `displayNameKey: 'weapon_smoky'` (localization key → "Смоки"). BodyConfig should follow the same pattern.

### How to show composite names like "Оса + Смоки"

A helper function:

```ts
function getCompositeUnitName(bodyId: string, weaponId: string): string {
  return `${getBodyDisplayName(bodyId)} + ${getWeaponDisplayName(weaponId)}`;
}
```

This helper uses the localization system to resolve each part independently, then joins with " + ". This keeps the pattern consistent and avoids creating a 7×10=70 entry name table.

### Which labels need Denis confirmation

- Body Russian names (are these the accepted names or placeholders?)
- Weapon Russian names (especially: "Рельса" vs "Рельсотрон" vs something else?)
- Role descriptions (are the English role labels in blockoutBodyData.ts the basis for Russian role labels?)
- Faction display names (already exist but may need review)

---

## 8. Track C Audit — Systemic Asset Profiles

### What current per-hull profile system does

`GeneratedHullVisualProfile` in `generatedHullAssets.ts` defines per-hull: `scale`, `originX`, `originY`, `offsetX`, `offsetY`, `uiOffsetY`. These 6 values are hardcoded as a constant Record mapping each hull ID to its profile. The renderer reads these profiles via `getGeneratedHullVisualProfile(hull)` and applies them when positioning the sprite, setting scale, and lifting UI elements.

### What is still manual

1. **Profile values themselves** — determined by visual QA, hardcoded as constants.
2. **Turret profiles** — only global constants exist (`GENERATED_TURRET_SCALE`, `GENERATED_TURRET_ORIGIN_X`, `GENERATED_TURRET_ORIGIN_Y`). No per-turret profile system.
3. **artBounds computation** — the actual pixel bounds of the art within the 512×512 canvas are not computed or stored. Profiles are tuned by eye.
4. **groundAnchor and mountPoint** — where the tank's ground contact point and turret mount point are within the sprite are not formally defined. The renderer uses the body's `mountOffsetNormalized` from `blockoutBodyData.ts` which is approximate.

### Whether index.json/metadata should be introduced now or later

**Later.** The current per-hull profile system works for MVP. An index.json metadata system (containing computed artBounds, groundAnchor, mountPoint per hull/turret/faction/mod) is valuable for:
- Automated validation (artBounds match expected ranges)
- Computed positioning (mountPoint derived from art data, not manual tuning)
- Rerender pipeline integration (when assets change, metadata regenerates)

But introducing it now adds complexity without immediate payoff. The MVP can work with manually tuned profiles. Metadata should be introduced when:
- The number of profiles grows beyond manual maintenance (e.g., per-faction or per-mod profile differences)
- A rerender pipeline is set up that can automatically compute metadata
- Visual QA reveals that manual tuning is producing inconsistent results

### How to compute/validate artBounds, groundAnchor, mountPoint

**artBounds:** Run a script that reads each 512×512 PNG, scans for non-transparent pixels, and computes the bounding rectangle. This is a Codex/local analysis task — no runtime pixel reading needed.

**groundAnchor:** Within the artBounds, the ground contact point is typically at the bottom-center of the hull art. Can be computed as (artBounds.centerX, artBounds.bottom) in sprite-local coordinates.

**mountPoint:** The turret mount point depends on the hull's body design. For the MVP, this can remain as `mountOffsetNormalized` in the body config. For a more systemic approach, the mount point can be computed from the hull art by finding the center of the top surface.

### Whether this requires Codex/local PNG analysis or Blender scripts

**Codex/local PNG analysis** is recommended for computing artBounds and groundAnchor from existing sprites. This is a one-time offline task that produces metadata values.

**Blender scripts** would be needed only if sprites are re-rendered with different parameters. For the current sprite set (already rendered and in the repo), PNG analysis is sufficient.

### What can be done without rerendering

All profile tuning (scale, origin, offset, uiOffsetY) can be done without rerendering. These are render-time parameters applied to the existing 512×512 sprites. The current per-hull profile system already does this.

### What should be deferred

- Per-faction profile differences (if any) — defer until visual QA reveals a need.
- Per-mod profile differences — defer. M1/M2/M3 hulls look similar enough at small scale that m0 profiles likely work.
- index.json metadata — defer until the profile system becomes hard to maintain manually.
- Automated artBounds/mountPoint computation — defer until manual tuning proves insufficient.

---

## 9. Track D Audit — Body/Weapon Production Config

### Current body/weapon config structure

**Blockout (Arena) configs:**
- `blockoutBodyData.ts`: `BodyProfile` with `id`, `displayName` (English), `roleLabel` (English), `referenceM3` (hp, maxSpeed, turnSpeedDeg, massKg, enginePower), `mountCategory`, `mountOffsetNormalized`, `blockoutShape`
- `blockoutWeaponData.ts`: `WeaponProfile` with `id`, `displayName` (English), `behavior`, `recoilProfile`, `vfxProfile`, `damageModel`, `blockoutBarrelLength`, `blockoutBarrelWidth`, `blockoutTurretTurnSpeedDeg`, `blockoutCooldownMs`, `blockoutRangePx`

**Production configs:**
- `weaponData.ts`: `WeaponConfig` with `id`, `displayNameKey`, `fireType`, `rangeClass`, min/ideal/max/stop range, damage with M0-M3, cooldown M0-M3, turretTurnSpeed M0-M3, fire-type-specific models (canister, overheat, magazine, drum, windUp), `vfxProfileKey`
- `coreMechanicsTypes.ts`: `BodyConfig` interface defined but **no data file populates it yet**

### What config fields must be added

**BodyConfig data file needs:**
- `hp: MLevelData<number>` — M0-M3 HP values
- `mass: number` — fixed mass
- `armor: MLevelData<number>` — M0-M3 armor
- `minDamagePercent: number` — damage floor
- `maxSpeed: MLevelData<number>` — M0-M3 speed
- `acceleration: MLevelData<number>` — M0-M3 acceleration
- `braking: MLevelData<number>` — M0-M3 braking
- `bodyTurnSpeed: MLevelData<number>` — M0-M3 turn speed
- `footprintClass: BodyFootprintClass` — light/medium/heavy

**New fields for both body and weapon configs:**
- `tier: 1 | 2 | 3` — tech tier for unlocking
- `productionCost: { matter: number; elements: number }` — production cost
- `productionDurationMs: number` — time to produce
- `displayNameKey: string` — already in WeaponConfig, needs adding to BodyConfig

**Body-weapon compatibility:**
- Either a whitelist (which bodies can mount which weapons) or a blacklist
- MVP approach: all bodies can mount all 10 weapons (full matrix), restrict later based on balance testing

### Where balance data should live

Balance data (HP, armor, speed, damage, cooldown, costs, tier assignments) should live in the production config files (`bodyData.ts`, `weaponData.ts`), not in the blockout data files. The blockout files remain Arena-only reference data. Production configs are the source of truth for gameplay.

### T1/T2/T3 model

Proposed tier assignment (needs Denis confirmation):

| Tier | Bodies | Description |
|---|---|---|
| T1 | Wasp, Hornet | Light scout and raider — available from game start |
| T2 | Hunter, Viking, Dictator | Medium universal and assault — require T2 tech |
| T3 | Titan, Mammoth | Heavy frontline and fortress — require T3 tech |

Tech tier unlocking requires buildings (e.g., a Tech Lab or upgraded Factory). The specific building requirements need Denis decision.

### Body/weapon compatibility approach

For MVP: **full compatibility** — all 7 bodies × 10 weapons = 70 combinations are valid. This avoids a complex compatibility matrix and allows maximum player choice. Restrictions can be added later based on balance testing and design decisions.

### How not to hardcode balance in UI/state

Balance values must only be read from config files. UI and state code must use lookup functions like `getBodyConfig(id)` and `getWeaponConfig(id)` rather than duplicating values. The existing pattern in `weaponData.ts` with `getWeaponConfig()` and `getWeaponMLevelValue()` is the correct model.

### Which values need Denis decisions

- Exact HP, armor, speed, acceleration values for all 7 bodies at M0-M3
- Exact damage, cooldown, range values for all 10 weapons at M0-M3 (current values are "reference placeholders")
- Tier assignment table (which bodies at T1/T2/T3)
- Production costs (matter + elements) for each body and weapon
- Production duration for each body and weapon
- Starter tank composition (Wasp + Smoky is assumed but needs confirmation)
- Whether body-weapon compatibility has any restrictions

---

## 10. Track E Audit — Unit Factory Tank Production

### Current production/economy/factory flow

1. Player builds a `units-factory` building via PlaytestHud build button
2. Factory appears in `state.production.factories` as `UnitFactoryRuntimeState`
3. Player clicks production button (builder or harvester) in PlaytestHud
4. `startUnitProduction()` checks factory exists, queue not full (limit 2), resources sufficient, unit cap not reached
5. Costs deducted immediately from `state.economy.matter` and `state.economy.elements[faction]`
6. Queue item created with `unitType`, `elapsedMs`, `durationMs`, `progress`, `completed`
7. `allocatePowerAndProcess()` in `updateGameState.ts` advances the first unfinished queue item
8. When completed, unit spawns (builder or harvester appears on map)

### How tank production should extend it

Tank production extends the existing system by:
1. Adding `'tank'` to `ProducibleUnitType` (or using a new type like `'combat_unit'`)
2. Adding a `TankProductionSpec` with `bodyId` and `weaponId` to the queue item
3. Adding tank-specific cost lookup (body cost + weapon cost)
4. Adding tank-specific spawn logic (create a production vehicle, not a civil unit)

### Body+weapon composer state model

```ts
interface TankProductionSpec {
  bodyId: AcceptedBodyId;
  weaponId: AcceptedWeaponId;
}

interface TankProductionQueueItem extends ProductionQueueItem {
  unitType: 'tank';
  spec: TankProductionSpec;
}
```

The factory queue can hold both civil and tank items. The first unfinished item progresses regardless of type. Costs are computed from `bodyCost + weaponCost` at enqueue time.

### Queue item model

The existing `ProductionQueueItem` needs extension:

```ts
type ProductionQueueItem =
  | CivilProductionQueueItem  // builder or harvester
  | TankProductionQueueItem;  // body + weapon
```

Or, simpler: add an optional `spec` field to the existing `ProductionQueueItem`:

```ts
interface ProductionQueueItem {
  unitType: ProducibleUnitType; // 'builder' | 'harvester' | 'tank'
  spec?: TankProductionSpec;    // only when unitType === 'tank'
  elapsedMs: number;
  durationMs: number;
  progress: number;
  completed: boolean;
}
```

### Spawn logic

When a tank queue item completes:
1. Find the factory building's position (tx, ty)
2. Find an adjacent passable tile for the spawn point
3. Create a production vehicle state (not `BlockoutVehicleState` — that's arena-only)
4. Set bodyId, weaponId, faction from the spec and factory
5. Set modificationLevel = 0 (M0 default)
6. Add the vehicle to `state.combatUnits` (new array in GameState) or equivalent
7. The renderer picks up the new vehicle and renders it with generated sprites

### M0 default

All newly produced tanks start at M0. This is consistent with the existing `modificationLevelToMod()` function and the M0-M3 scaling model.

### Tier locking

Before enqueueing a tank, check:
1. Factory exists and is complete
2. Required tech tier is unlocked (e.g., T2 requires a specific building)
3. Resources are sufficient
4. Unit cap not reached (combat unit cap may differ from civil unit cap)

If the tech tier is not unlocked, return a rejection reason like `'tier-locked'`.

### Starter Wasp + Smoky

On new game creation, the player should start with one starter tank:
- Body: Wasp (T1, always available)
- Weapon: Smoky (T1, always available)
- Faction: player's chosen faction
- Modification: M0
- Position: near HQ

This tank is created in `createInitialState()` and added to the combat units array.

### Risks to economy/production save-load if any

**Save format change:** Adding tank production queue items changes the `ProductionState` serialization format. The `unitType` field expands from `'builder' | 'harvester'` to include `'tank'`, and `spec` is new. Old saves without tank items are backward compatible (no `spec` field = civil unit). New saves with tank items require the deserializer to handle the `spec` field.

**Economy balance risk:** Tank costs must be calibrated against the existing economy (raw → matter → elements pipeline). If tanks are too expensive, the economy loop stagnates. If too cheap, the game becomes a tank rush. This is a Denis decision, not an implementation risk.

---

## 11. Track F Audit — Movement Feel / Visual Smoothing

**Important framing:** Movement, acceleration, speed, and pathfinding already exist and work. The problem this track addresses is visual micro-stutter / tile-step feel — the rendering layer snaps between tile positions instead of interpolating smoothly. This is a renderer-state smoothing problem, not a pathfinding or occupancy problem. No pathfinding or occupancy rewrite is needed or implied.

### Where movement logical state lives

Movement logical state is in `BlockoutVehicleState`:
- `tx`, `ty` — current tile position
- `ftx`, `fty` — fractional tile position (interpolated during movement)
- `worldX`, `worldY` — screen-space position (derived from ftx/fty + offset)
- `speed` — current movement speed
- `bodyAngle` — current facing direction in radians
- `hasMoveTarget` — whether the unit is moving
- `targetWorldX`, `targetWorldY` — move target in screen space
- `path` — array of tile waypoints

### Where rendering position is derived

In `BlockoutVehicleRenderer.renderVehicle()`:
```ts
const cx = vehicle.worldX + this.offset.x + bodyImpulseX;
const cy = vehicle.worldY + this.offset.y + bodyImpulseY;
```

`worldX`/`worldY` are updated each frame by the movement system. The renderer reads them directly.

### How to add visual interpolation without changing occupancy/pathfinding

The key insight from four-elements-next's `movement.js` is the `moveProgress` (0..1) field. When a unit moves from tile A to tile B:
1. **Logical state** changes immediately: the unit occupies tile B (occupancy updates, pathfinding sees the unit at B).
2. **Visual position** interpolates: the rendered sprite smoothly moves from A's screen position to B's screen position over a short duration (e.g., 200ms).

Implementation approach:
- Add `visualX`, `visualY` (or `moveProgress`) fields to the vehicle state for rendering only.
- In the renderer, use `visualX`/`visualY` instead of `worldX`/`worldY` for sprite positioning.
- The movement system updates `worldX`/`worldY` immediately on tile change but sets `moveProgress = 0`.
- Each frame, `moveProgress` increases toward 1.0, and `visualX`/`visualY` lerp between the previous and current tile positions.

This does not change occupancy or pathfinding — those systems continue to use the logical tile position.

### How to add acceleration/braking visual easing

Add an easing function to the movement start and end:
- **Acceleration:** When movement starts, `moveProgress` advances slowly at first, then speeds up (ease-in).
- **Braking:** When approaching the final waypoint, `moveProgress` decelerates (ease-out).
- **Easing function:** `easeInOutCubic(t) = t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2, 3) / 2`

Apply the easing to `moveProgress` before computing the visual position. The logical movement speed (tiles/second) is unchanged — only the visual interpolation curve changes.

### Dust MVP

A simple dust emitter:
- Spawn 3-5 small circle particles at the vehicle's ground contact point when movement starts.
- Particles have random velocity (spread from the vehicle's direction), fade alpha over 500ms, scale up slightly.
- Re-emit every N tiles during movement.
- Implementation: a `DustEmitter` class in `src/phaser/render/dustEmitter.ts` using Phaser's Graphics objects (no sprite assets needed).

Reference: `four-elements-next/src/render-phaser/vfx/dust-emitter.ts` has a working pattern.

### Inertia MVP

Inertia (visual overshoot) means the sprite continues moving slightly past the target tile when stopping, then settles back:
- When movement ends (`hasMoveTarget` becomes false), set an `inertiaVelocity` based on the last movement direction and speed.
- Each frame, apply `inertiaVelocity` to the visual position and dampen it (multiply by 0.85 or similar).
- When `inertiaVelocity` falls below a threshold, snap to the logical position.

Reference: `four-elements-next/src/render-phaser/vfx/inertia.ts` has this exact pattern.

### Direction smoothing options

1. **Easing only:** When `bodyAngle` changes, visually interpolate to the new angle over 200ms using easing. Simple, works with existing 8-dir sprites (8-dir snap → smooth angle transition → re-snap to nearest 8-dir).

2. **Crossfade:** When direction changes, briefly crossfade between the old and new direction sprites. Requires loading adjacent direction sprites. More visually smooth but requires texture management.

3. **More directions (32-dir):** Render 32 directions instead of 16. Reduces the visual snap between directions. But this requires re-rendering all assets, which is out of scope.

### Why 32-dir expansion should not be default

32-direction rendering would multiply the asset matrix: 7 hulls × 4 factions × 4 mods × 32 directions = 3584 hull PNGs (vs current 1792 at 16-dir). This doubles the asset count, doubles the download size, and requires re-rendering all assets in Blender. The visual improvement over 16-dir is marginal at the game's typical zoom level. 16-dir with smooth easing is sufficient for MVP. 32-dir can be considered as a future polish step after the core game loop works.

---

## 12. Track G Audit — RTS HUD MVP

### Current HUD/UI files

| File | Purpose |
|---|---|
| `src/phaser/ui/PlaytestHud.ts` | Civil economy HUD: economy readout, build buttons, production buttons, harvester/separator/factory status |
| `src/phaser/ui/ArenaMenu.ts` | Arena mode UI: unit composer, roster, actions |
| `src/phaser/ui/ArenaUnitComposer.ts` | Arena body/weapon/team selector |
| `src/phaser/ui/TooltipManager.ts` | Tooltip system for HUD buttons |

### Whether DOM overlay remains correct

Yes. The project architecture explicitly states: "DOM HUD / UI" is a separate layer from Phaser rendering. PlaytestHud and ArenaMenu are both DOM overlays (`position: fixed` divs). The RTS HUD should follow the same pattern — DOM overlay, no Phaser dependency, reads state from `GameState`.

This is architecturally correct because:
- DOM overlays are resolution-independent and easy to style.
- They don't compete with Phaser's WebGL rendering.
- They support text layout, buttons, and responsive design natively.
- The existing HUDs prove this pattern works.

### Layout approach inspired by SC2 but not copying assets

SC2's HUD layout (bottom bar):
- **Bottom-left:** Minimap
- **Bottom-center:** Selected unit/building info panel
- **Bottom-right:** Command grid (abilities, actions)

Adapted for Four Elements:
- **Bottom-left:** Minimap (rectangle, not square — matches isometric map shape)
- **Bottom-center:** Selected unit info (composite name, HP/armor bars, M-level, weapon status)
- **Bottom-center-right:** Factory panel (when factory selected: body/weapon selector, queue, cost)
- **Bottom-right:** Command grid (Move, Attack, Stop, Patrol, Hold position)
- **Top-right:** Economy readout (raw/matter/elements/power) — compact version of PlaytestHud economy

This layout must use the existing industrial sci-fi theme (HUD_THEME colors from PlaytestHud) for visual consistency.

### Selected unit/building/resource info

When a unit is selected:
- **Unit info panel** shows: composite name ("Оса + Смоки"), HP bar + numbers, armor value, M-level indicator, weapon resource bar (canister/overheat/magazine/drum), speed, faction icon.
- When a building is selected: building name, HP, production queue (if factory), processing status (if separator).

### Command grid

A 3×3 or 4×3 grid of command buttons:
- Row 1: Move, Attack, Stop, Patrol
- Row 2: Hold Position, Cancel, (weapon-specific ability), (empty)
- Disabled buttons grayed out with reason tooltips.
- Hotkey labels on each button (M, A, S, P, H, etc.)

### Factory integration

When a factory is selected:
- Command grid shows production options instead of movement commands.
- Body selector (7 bodies, tier-locked) + Weapon selector (10 weapons, tier-locked).
- Cost display (matter + elements + time).
- Queue display (up to 2 items, progress bars, cancel buttons).
- "Produce" button (enqueue body+weapon combination).

### Multi-select MVP

When multiple units are selected:
- Info panel shows: unit count, average HP, composition summary ("3× Оса + Смоки, 1× Титан + Гром").
- Command grid shows: Move, Attack, Stop (applied to all selected units).
- Individual unit info collapses to a compact list.

### Hotkeys

| Key | Command |
|---|---|
| LMB | Select unit/building |
| RMB | Move/attack command |
| S | Stop |
| A | Attack-move |
| P | Patrol |
| H | Hold position |
| Ctrl+1-9 | Create control group |
| 1-9 | Select control group |
| Tab | Cycle selected units |
| Esc | Deselect / open menu |

### Risks to existing PlaytestHud

The RTS HUD will coexist with PlaytestHud initially. PlaytestHud remains the civil economy HUD. The RTS HUD handles combat unit interaction. They share screen space:
- PlaytestHud: top-right corner (economy readout) — can be merged into RTS HUD top-right section.
- RTS HUD: bottom bar (minimap + info + commands).

Risk: overlapping DOM elements and event handling. Mitigation: clearly define which HUD handles which interaction. Civil building interactions → PlaytestHud. Combat unit interactions → RTS HUD. Eventually, PlaytestHud's economy readout should merge into the RTS HUD's top-right section, and PlaytestHud's build/production buttons should move to the RTS HUD's command grid when a factory is selected.

---

## 13. Track H Audit — M-Level Progression

### Current M0-M3 scaling implementation

M0-M3 scaling is implemented in the production config data model:
- `WeaponConfig` has M0-M3 tuples for: `damage.directDamage`, `cooldown`, `turretTurnSpeed`, and fire-type-specific values (canister capacity/drain/regen, overheat heat/cooling, magazine stock/regen, drum delay/reload, windUp time).
- `BodyConfig` (type defined, data not yet) has M0-M3 tuples for: `hp`, `armor`, `maxSpeed`, `acceleration`, `braking`, `bodyTurnSpeed`.

The scaling is applied at runtime via `getWeaponMLevelValue(data, level)` which indexes into the M0-M3 tuple.

### How to track kills + damage dealt

Add a `CombatContribution` state to each combat unit:

```ts
interface CombatContribution {
  killsAccumulated: number;
  damageDealt: number;
  damageReceived: number;  // optional, for defensive M-level consideration
}
```

This state is updated in the combat system when:
- A unit's target is destroyed → `killsAccumulated++` on the killer
- A unit deals damage → `damageDealt += actualDamage` on the attacker
- (Optional) A unit receives damage → `damageReceived += actualDamage` on the defender

### Upgrade availability state

Add `MLevelProgress` to each combat unit:

```ts
interface MLevelProgress {
  modificationLevel: ModificationLevel; // 0-3
  contribution: CombatContribution;
  canUpgrade: boolean; // computed: contribution exceeds threshold for next level
}
```

Upgrade thresholds are configurable:
- M0 → M1: 3 kills OR 500 damage dealt
- M1 → M2: 8 kills OR 1500 damage dealt
- M2 → M3: 15 kills OR 3000 damage dealt

(Values are placeholders — need Denis confirmation.)

### Upgrade UI

In the RTS HUD info panel (when a unit is selected):
- Show current M-level (M0/M1/M2/M3) with colored badge.
- Show progress bar toward next M-level.
- Show "Upgrade available" button when `canUpgrade` is true.
- Clicking upgrade applies the next M-level's stats and updates `modificationLevel`.

### Body upgrade vs turret upgrade

**MVP approach: unified M-level.** Body and turret upgrade together. When a unit upgrades from M0 to M1, both body stats (HP, armor, speed) and weapon stats (damage, cooldown, turn speed) improve simultaneously.

This is simpler than separate body/turret M-levels and matches the existing M0-M3 scaling model where both body and weapon configs have M0-M3 data for the same unit.

Separate body/turret M-levels can be a future enhancement if Denis wants more granular progression.

### T3 direct M1+ production as design-only or implementation

**Design-only for MVP.** The idea that T3 factories can produce tanks starting at M1 instead of M0 is a design concept that should be documented but not implemented in the first pass. Reason: M-level progression is tied to combat contribution tracking. Producing a tank at M1 without combat history breaks the "earned through combat" progression model. If Denis confirms this feature, it would need:
- A new production cost multiplier for M1 production
- A special flag on the produced unit indicating "factory M1" vs "combat M1"
- Different stat scaling implications

### What should be deferred

- Separate body/turret M-levels
- T3 direct M1+ production implementation
- Visual M-level indicators on the hull sprite (different hull mods m0/m1/m2/m3 already exist as assets but loading them per M-level change adds complexity)
- M-level downgrade (never — M-level only goes up)

---

## 14. Track I Audit — Fog / Territory / Minimap

### Pure TS visibility model

The fog model should be a pure TypeScript state system with no Phaser dependencies:

```ts
enum FogState { UNEXPLORED, EXPLORED_NOT_VISIBLE, VISIBLE }

interface FogModelState {
  width: number;
  height: number;
  cells: FogState[][];  // [y][x]
  visionSources: VisionSource[];
}

interface VisionSource {
  tx: number;
  ty: number;
  radius: number;  // in tile units
  sourceType: 'unit' | 'building';
}
```

Update algorithm:
1. Each frame, compute all vision sources (unit positions + building positions with their vision radii).
2. Reset all cells from VISIBLE to EXPLORED_NOT_VISIBLE (they were visible last frame but may not be now).
3. For each vision source, mark cells within radius as VISIBLE (and if they were UNEXPLORED, mark as VISIBLE which implicitly makes them explored).
4. UNEXPLORED cells remain UNEXPLORED until a vision source reveals them.

Performance optimization: only recompute when a vision source moves (not every frame). Use a dirty flag per cell.

### Fog render strategy

Render fog as a DOM overlay or as Phaser Graphics on a dedicated depth layer above terrain but below units:

**Option A: Phaser Graphics overlay (recommended)**
- Create a full-screen Graphics object at depth above terrain, below units.
- For UNEXPLORED cells: draw a dark rectangle (e.g., rgba(0,0,0,0.9)).
- For EXPLORED_NOT_VISIBLE cells: draw a semi-transparent rectangle (e.g., rgba(0,0,0,0.5)).
- For VISIBLE cells: draw nothing (transparent).
- Use the projection contract to draw isometric parallelograms, not axis-aligned rectangles.

**Option B: DOM Canvas overlay**
- Create a separate canvas element overlaid on the game.
- Draw fog using standard 2D canvas operations.
- Must apply the same isometric projection as the game.

Option A is better because it integrates with Phaser's depth sorting and respects the projection contract naturally.

### Territory ownership/spread strategy

Borrow from four-elements-next's territory model:
- `TerritoryCell { owner: Faction | null }` grid matching the map dimensions.
- When a building is placed, cells within a radius become owned by that faction.
- Territory spreads outward from buildings over time (configurable speed).
- Units in owned territory may have advantages (vision bonus, repair, etc. — future).

For MVP, territory is building-based only (no unit-based territory expansion). Territory is visual (colored cells on the ground plane) and strategic (vision bonus within owned territory).

### Minimap architecture

The minimap should be a DOM canvas element in the bottom-left of the RTS HUD:
- **Canvas size:** proportional to map size (e.g., 200×100px for a 60×60 map at isometric aspect ratio).
- **Content:** terrain (colored by type), buildings (colored squares by faction), units (colored dots by faction), fog (dark overlay on unexplored/explored-not-visible areas), territory (faint faction color overlay).
- **Interaction:** click to move camera to that position; current camera viewport shown as a rectangle.
- **Update frequency:** every 500ms (not every frame) for performance.

### Performance risks

- **Fog recomputation:** O(W×H×S) where W=map width, H=map height, S=number of vision sources. For a 60×60 map with 20 units and 10 buildings, this is 60×60×30 = 108,000 operations per frame. Acceptable if done only when vision sources move.
- **Fog rendering:** Drawing 3600 isometric parallelograms per frame is expensive. Optimization: only redraw cells that changed state since last frame.
- **Minimap rendering:** Redrawing the minimap canvas every 500ms is lightweight.
- **Territory spread:** Can be computed incrementally (only cells at the boundary of owned territory need checking each tick).

### Projection compliance

All fog and territory rendering must follow CAMERA_PROJECTION_CONTRACT.md:
- Fog cells are isometric parallelograms, not axis-aligned rectangles.
- Territory boundaries are projected ground-plane shapes.
- Minimap uses the same isometric orientation as the main view.
- No top-down circles for vision radii — use projected ground-plane circles.

### What can be borrowed conceptually from sandbox/next

- Two-layer fog model (unexplored / explored-not-visible / visible) — from glm-game-sandbox.
- Territory cell grid with building-based spread — from four-elements-next's `territory.ts`.
- Minimap concept (canvas, click-to-move, viewport rectangle) — from four-elements-next's HUD notes.

### Why this comes after core player loop

Fog, territory, and minimap are strategic layer features. They enhance gameplay but are not required for the core player tank loop (see tank, produce tank, select tank, move tank, fight). Implementing fog/territory first would block the core loop without adding player-facing value. The core loop must work first so that fog/territory has something to reveal and restrict.

---

## 15. Track J Audit — Combat VFX

### Current combat feedback

Current combat feedback is minimal:
- **Damage flash:** White overlay on the body for 150ms when hit.
- **HP bar change:** HP bar visually updates when damage is taken.
- **Target-lock indicator:** Yellow dot above the turret when targeting an enemy.
- **Recoil body impulse:** Vehicle shifts backward briefly on fire.
- **Track animation:** Moving track indicators on blockout body.

What's missing: no projectile visuals, no muzzle flash, no hit effects, no weapon-specific visual feedback, no explosion effects.

### Weapon VFX profile design

Each weapon should have a `VfxProfile` that defines its visual behavior:

```ts
interface VfxProfile {
  muzzleFlash: { durationMs: number; color: number; size: number };
  projectile?: { speed: number; color: number; size: number; trailLength: number };
  beam?: { color: number; width: number; glowColor: number };
  hitEffect: { durationMs: number; color: number; size: number };
  splashEffect?: { radius: number; color: number; durationMs: number };
}
```

### Muzzle flash / projectile / beam / hit effects

| Weapon | Muzzle Flash | Projectile/Beam | Hit Effect |
|---|---|---|---|
| Smoky | Brief orange flash | Fast small projectile | Small spark |
| Thunder | Large orange flash | Fast medium projectile | Medium explosion + splash ring |
| Railgun | Blue-white flash | Instant beam line | Blue spark + penetration line |
| Flamethrower | Orange glow (continuous) | Cone stream particles | Fire particles on target |
| Freeze | Blue-white glow (continuous) | Cone stream particles | Ice crystals on target |
| Isida | Green glow (continuous) | Green beam line | Green healing glow |
| Vulcan | Rapid small flashes | Fast small tracers | Small spark |
| Twins | Alternating flashes | Paired plasma orbs | Plasma impact |
| Ricochet | Brief flash | Bouncing projectile | Spark on each bounce + final impact |
| Hammer | Large flash | Spread pellet lines | Multiple small impacts |

### Which VFX need assets and which can be procedural

**Procedural (Phaser Graphics, no assets needed):**
- Muzzle flash (colored circle, fade-out)
- Projectile trails (line with fade)
- Hit sparks (expanding circles with fade)
- Splash rings (projected ground-plane circle)
- Beam lines (Phaser line with glow effect)
- Cone stream particles (small circles in a cone pattern)

**Asset-based (need Blender or artist work):**
- High-quality explosion sprites
- Detailed fire/ice particle sprites
- Smoke trails

For MVP, all VFX should be procedural. Asset-based VFX can be added later as a visual polish step.

### Why this is late slice

Combat VFX is a visual polish layer. It does not affect gameplay mechanics (damage, hit detection, weapon behavior all work without VFX). Implementing VFX before the core tank loop works would mean:
- VFX has no units to render on if the tank production system doesn't exist.
- VFX testing requires Arena mode (which already has VFX placeholders), not the Standard game flow.
- VFX iteration (tuning particle counts, colors, durations) is best done after all weapon mechanics are finalized.

VFX is important for game feel but not for functional completeness. It should come after the player can produce, select, move, and fight with tanks.

### Whether Blender is needed

No, for MVP. All combat VFX can be implemented procedurally using Phaser Graphics objects (circles, lines, rectangles with alpha). Blender would be needed for:
- Pre-rendered explosion sprite sheets
- Particle texture sprites
- Any 3D VFX elements rendered to 2D

These are polish items that can be added after the procedural VFX system is in place and working.

---

## 16. High / High+ Validation

All 9 implementation steps are confirmed High or High+ priority (Track C is parallel docs/design):

| Step | Track | Risk | Priority Justification |
|---|---|---|---|
| 1 | A — Asset visibility / loading / rendering | High+ | Without this, no generated sprites appear in Standard mode — entire visual identity broken |
| 2 | B — Russian labels | High | Player-facing identity is critical for Russian-speaking target audience |
| 3 | F — Movement feel | High | Visual micro-stutter / tile-step feel is the primary differentiator from a boring grid game; critical for player retention |
| 4 | D — Production config | High | Config foundation required for tank production; no tank data = no tank game |
| 5 | E — Tank production | High+ | Core game loop — without tank production, there is no game |
| 6 | G — RTS HUD | High+ | Without HUD, player cannot interact with the game at all in Standard mode |
| 7 | H — M-level progression | High | Progression is the long-term engagement driver; game feels flat without it |
| 8 | I — Fog/territory/minimap | High | Strategic layer; map feels empty without fog; minimap essential for orientation. Kept High per roadmap — not escalated to High+ |
| 9 | J — Combat VFX | High | Visual feedback makes combat readable; without it, combat feels flat |
| — | C — Asset profiles | High | Systemic profile contract runs in parallel as docs/design; does not block Track E |

No steps are Medium or Low priority. All steps directly contribute to the PLAYER_INTEGRATION_MVP goal of creating a playable tank game with progression and strategic depth. Track I risk is classified as High (not High+) per the accepted roadmap — this classification is maintained unless explicitly justified otherwise.

---

## 17. Tooling and Ownership Plan

| Step | GLM-only | Codex recommended | Blender/local asset analysis needed | Denis decision needed |
|---|---|---|---|---|
| 1 — Asset visibility | Yes | — | — | — |
| 2 — Russian labels | Yes | — | — | Yes (confirm names) |
| 3 — Movement feel | Yes | — | — | — |
| 4 — Production config | Yes | — | — | Yes (costs, tiers, starter comp) |
| 5 — Tank production | Yes | — | — | Yes (queue model, tier locking) |
| 6 — RTS HUD | Yes | — | — | Yes (HUD layout priorities) |
| 7 — M-level progression | Yes | — | — | Yes (upgrade formula, thresholds) |
| 8 — Fog/territory | Yes | — | — | Yes (territory spread model) |
| 9 — Combat VFX | Yes | — | — (procedural only) | — |
| C — Asset profiles (parallel) | Yes | Yes (compute artBounds from PNGs) | Yes (optional, for mountPoint computation) | — |

---

## 18. Open Decisions for Denis

1. **Russian body names:** Оса, Шершень, Охотник, Викинг, Диктатор, Титан, Мамонт — confirmed or need changes?

2. **Russian weapon names:** Смоки, Гром, Рельса, Огнемёт, Фриз, Изида, Вулкан, Твинс, Рикошет, Молот — confirmed or need changes?

3. **T1/T2/T3 unlock table:** Which bodies are T1/T2/T3? Which building unlocks each tier?

4. **Starter unit composition:** Wasp + Smoky confirmed? One tank at game start?

5. **Production costs:** Matter + elements cost for each body and each weapon?

6. **Upgrade formula:** M0→M1/M1→M2/M2→M3 thresholds — kills only, damage only, or both? Specific numbers?

7. **Body-weapon compatibility:** Any restrictions (e.g., Titan can't mount Smoky) or full 7×10 matrix?

8. **Territory spread model:** Building-based only, or do units also spread territory? Spread radius? Spread speed?

9. **HUD priorities:** Which HUD panels are most important for first playable version? Economy readout? Unit info? Command grid? Minimap?

10. **Tank queue model:** Body+weapon as single composed item (one slot in queue) or separate body and weapon items (two slots)?

11. **T3 direct M1+ production:** Design-only documentation for MVP, or should it be implemented?

12. **Civil + combat unit cap:** Separate caps (10 civil + 20 combat) or unified cap (30 total)?

---

## 19. Final Recommended Step 1 / Step 2 / Step 3

### Step 1: PIM-STEP-01 — Asset visibility / loading / rendering across player modes

**Implementation-ready.** This step:
- Extends PreloadScene to load starter-only hull+turret set (Wasp + Smoky, m0, 32 PNG) in Standard mode — no 272-PNG faction preload, no 1792+2560 full matrix.
- Makes BlockoutVehicleRenderer work outside arena/devtools mode by removing the instantiation gate.
- **Does NOT include** production vehicle state adapter, factory production, or starter tank creation — those belong in Track E (Step 5).
- Track A may define how Standard mode will render already-existing/loaded combat vehicle state, but must not create a production/state model.
- Preserves full Arena/Debug backward compatibility.
- No Denis decisions required — technical implementation only.

### Step 2: PIM-STEP-02 — Russian unit identity and player-facing labels

**Implementation-ready after Denis confirms Russian names.** This step:
- Adds `displayNameKey` fields to body profiles in `blockoutBodyData.ts`.
- Creates `unitLabels.ts` with composite name helper.
- Updates ArenaMenu and ArenaUnitComposer to use localized names.
- Updates BlockoutVehicleRenderer debug labels to show Russian names for player visibility.
- Internal IDs remain stable English.
- Requires Denis confirmation of body and weapon Russian names.

### Step 3: PIM-STEP-03 — Movement feel / visual smoothing MVP

**Implementation-ready.** This step:
- Adds visual interpolation between tile positions to eliminate micro-stutter / tile-step feel.
- Does NOT change pathfinding, occupancy, or game logic speed — purely renderer-state smoothing.
- Adds acceleration/braking easing overlays, dust particles, inertia overshoot, direction smoothing.
- Only requires Step 1 (sprites visible — interpolation needs sprites to smooth).
- Does NOT require Step 5 (tank production) — visual smoothing works on any vehicle with sprites, including Arena vehicles.
- No Denis decisions required — technical implementation only.

**Why Step 3 is Movement feel (Track F) instead of Asset profiles (Track C):** Track F is pulled forward because visual smoothing is the most impactful player-facing improvement after seeing and naming the tank. It is renderer-only, requires only Track A, and does not depend on production config or tank production. Track C (asset profiles) runs in parallel as docs/design and does not block Track E.

---

## 20. Final Out-of-Scope

The following are explicitly out of scope for this implementation audit and for the PLAYER_INTEGRATION_MVP implementation sequence:

- **No bot / strategic AI** — enemy bot, enemy base-building AI, attack-wave AI, economy AI are hard-blocked.
- **No full preload** — never load all 1792 hull + 2560 turret PNGs at startup.
- **No mass rerender** — existing sprites are used as-is; no re-rendering in Blender.
- **No copying old Canvas code** — glm-game-sandbox and four-elements-next are spec/design sources only.
- **No broad renderer rewrite** — BlockoutVehicleRenderer is sufficient; no new rendering architecture.
- **No combat VFX before foundation** — VFX is Track J (Step 10), after the core tank loop works.
- **No fog/territory before core player-facing tank loop** — fog/territory is Track I (Step 9), after production + HUD + movement.

---

Аудит завершён. Готово для проверки GPT.
