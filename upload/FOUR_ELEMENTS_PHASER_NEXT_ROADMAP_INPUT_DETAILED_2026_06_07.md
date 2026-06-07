# FOUR ELEMENTS PHASER — NEXT ROADMAP SYSTEM AUDIT

**Mode:** PHASE 1 HUGE SYSTEM AUDIT ONLY — REPORT ONLY  
**Date:** 2026-06-07  
**Project:** Four Elements Phaser  
**Repo:** `ratoker-jpg/four-elements-phaser`  
**Reference repos:** `glm-game-sandbox`, `four-elements-next`  
**Author:** GLM Agent (audit, no code changes)

---

## 1. Executive Summary

Four Elements Phaser has completed three major implementation cycles — Visual/UI, Blockout MVP, and Core Mechanics (8 steps, PRs #193–#207). The Arena Sandbox cycle delivered a standalone combat testbed (PRs #178–#184). A unit asset pipeline has been started (RUNTIME-TURRET-01/02, PRs #226/#228) with generated 16-direction turret sprites now rendering in Arena, and a per-hull visual profile system in progress (PR #230, HULL-VISUAL-FIXUP-02).

However, the project has a critical **product gap**: generated tank assets are only visible through obscure developer query strings (`?devtools=1&arena=1`). There is no Standard-mode or Debug-mode integration. There is no Russian-facing unit nomenclature. There is no Unit Factory that lets players compose and produce tanks. There is no fog of war, no territory system, no minimap, no RTS HUD. Movement feels tile-steppy and mechanical. Body/turret rotation snaps between 8/16 directions with visible slideshow artifacts. Body/weapon configs exist as raw data but have no production UI or progression system.

This audit identifies 16 product gaps, proposes a unified architecture for them, sequences them into 7 roadmap tracks with 28 PR steps, classifies risk levels, and delivers a validation/QA strategy. The central thesis: **the next cycle must be a "Player-Facing Integration" cycle** that takes the working engine and makes it a playable RTS, not a larger engine.

---

## 2. Current Phaser Repo State

### 2.1 Framework and Tooling

- Phaser 4.1.0, Vite, TypeScript strict, Vitest, WebGL-only renderer
- Fixed isometric/axonometric 2.5D camera (no rotation, pan+zoom allowed)
- Tile basis: 76×38, projection contract in `cameraProjectionContract.ts`
- 3838+ tests passing at Core Mechanics closure
- Art asset pipeline: TankViewer 3DS → Blender → 16-dir PNG sprites

### 2.2 Implemented Systems

| System | Status | Key Files |
|--------|--------|-----------|
| Camera projection contract | ✅ Accepted | `cameraProjectionContract.ts` |
| Terrain / map generation | ✅ Industrial default | `GameScene.ts`, mapgen |
| Buildings / economy loop | ✅ 10 buildings, 6 resource classes | `buildingData.ts`, `production.ts` |
| Movement / occupancy / pathfinding | ✅ Grid/tile, depth sorting | `blockoutVehicleGeometry.ts` |
| Combat / targeting / hit model | ✅ Target-lock, 10 weapons | `weaponData.ts`, combat state |
| Body/weapon M0-M3 scaling | ✅ Config-driven | `coreMechanicsTypes.ts` |
| Arena mode | ✅ Standalone sandbox | `devArena.ts`, `ArenaMenu.ts` |
| Generated turret sprites (Arena) | ✅ PR #228 merged | `generatedTurretAssets.ts` |
| Generated hull sprites (Arena) | 🔧 PR #230 pending | `generatedHullAssets.ts` |
| Russian UI labels | ✅ Core mechanics pass | Various UI files |
| Playtest HUD | ✅ Economy/production display | `PlaytestHud.ts` |

### 2.3 Critical Missing Systems

| System | Status | Impact |
|--------|--------|--------|
| Generated assets in Standard/Debug | ❌ Not wired | Assets invisible to normal play |
| Russian unit names (player-facing) | ❌ English IDs in UI | Breaks player immersion |
| Systemic asset profile (not per-PNG hacks) | ❌ Manual constants | Doesn't scale to new bodies/turrets |
| Body/weapon production config model | ❌ No cost/tier data in body/weapon configs | Can't build factory UI |
| T1/T2/T3 tech progression | ❌ Only config placeholders | No game progression |
| Unit Factory production flow | ❌ Only builder/harvester in production.ts | No tank production |
| Starting unit composition for tanks | ❌ Only civil units | No starter combat unit |
| M0-M3 upgrade by combat contribution | ❌ Config-only, no trigger | No upgrade path |
| Smooth movement interpolation | ❌ Tile-step visible | Breaks movement feel |
| Dust / inertia / movement VFX | ❌ Not implemented | Movement feels lifeless |
| Body/turret turn smoothing | ❌ 8/16-dir snapping | Slideshow rotation |
| Fog of war | ❌ No implementation | No strategic information warfare |
| Territory coloring | ❌ Only config placeholder | No map control visualization |
| RTS HUD (SC2-style layout) | ❌ PlaytestHud is economy-only | No unit info/command panel |
| Minimap | ❌ No implementation | No tactical overview |
| Combat VFX (muzzle, projectile, hit) | ❌ Not implemented | Combat lacks feedback |

### 2.4 Architecture Layers (Current)

```
Pure TS State/Logic Layer  ← No Phaser imports
Phaser Rendering Layer     ← Reads state, renders visuals
DOM HUD/UI Layer           ← Separate from Phaser
```

This three-layer architecture is solid and must be preserved. The fog, territory, minimap, and HUD additions all fit naturally into this structure.

---

## 3. Reference Repo Findings

### 3.1 glm-game-sandbox

**Architecture:** Vanilla Canvas 2D monolith (`src/main.js`, 15000+ lines) with a modular extraction in progress (`fe-next/` systems).

**Key reusable concepts:**

- **Fog of War**: Two-layer system (`fogVisible[][]` + `fogExplored[][]`). Vision sources: units (range 4–7), buildings (range 6), territory (range 1). Ghost positions ("Призраки") planned for 15-second afterimage when enemy leaves fog.
- **Territory**: `territory[][]` array, spread from buildings at 1 cell/15 seconds, radius 5, faction-colored overlay PNGs, provides vision. Purple faction gets +2 territory vision bonus.
- **Movement**: Waypoint-based linear interpolation (`moveProgress` 0→1), stuck detection (`_stuckTimer > 0.75`), state machine (idle, manual_move, moving_to_attack, harvesting, etc.).
- **Dust**: `spawnDust()` / `updateDust()` / `drawDustParticles()` for tracked/wheeled units.
- **Command System**: `COMMAND_TYPES` = { MOVE, ATTACK, ATTACK_APPROACH, ATTACK_MOVE, STOP, HARVEST } as pure data objects — decouples intent from execution.
- **Economy**: Raw → Separator → Energy + Element. Building costs, unit costs, harvester state machine, builder spiral-search auto-placement.
- **GLM_FUTURE_VISION document** (670+ lines): THE single most valuable design doc. Covers units, economy, AI, factions, UI, animations with design rationale and complexity estimates.

**What NOT to copy:** The monolith architecture, browser globals (IIFE + `window.FE_*`), Canvas 2D rendering code, enemy bot AI code.

### 3.2 four-elements-next

**Architecture:** TypeScript strict + Vite + Canvas 2D + HTML overlay UI. Civil sandbox baseline functional, combat explicitly deferred.

**Key reusable concepts:**

- **Economy model**: Rejected old `Raw→Energy+Element`. New model: Raw, Matter, Element, Power, Control. Separator: 15 Raw → 10 Matter + 1 Element. Power is building upkeep, not currency. Control is unit cap.
- **Production system**: `QUEUE_LIMIT = 2`, cost deduction at enqueue, control reserved at enqueue, offline factories pause (don't reset), spawn at adjacent free tile.
- **Territory implementation** (`src/systems/territory.ts`): HQ footprint starts owned, buildings claim tiles sequentially (15s/tile), then outward wave spread at `45 * 2^(radius-1)` seconds per ring, max 5 rings. Semi-transparent faction-colored diamond overlays (opacity 0.15–0.35).
- **Inertia VFX** (`src/render-phaser/vfx/inertia.ts`): `MAX_OFFSET_PX = 3`, `MAX_ROTATION_DEG = 2.5`, impulse burst on start/stop, sustained offset while moving, lerp decay to 0 when idle. **No idle bobbing.**
- **Dust VFX** (`src/render-phaser/vfx/dust-emitter.ts`): Phaser 3.90+ particle system. Start burst (5 particles), sustained (100ms frequency), speed 5–20 px/s, lifespan 300–600ms, sandy color.
- **Visual asset pipeline** (`VISUAL_ASSET_PIPELINE.md`): 8-layer tank model spec (shadow, body, turret, muzzle, projectile, trail, impact, dust, UI). `TankVisualState` interface with bodyAngle, turretAngle, turnRate, visualState.
- **T1/T2/T3**: Documented as intent, HQ tier assets exist (hq_t1/t2/t3.png), but no runtime tech tree or tier-gating implementation.
- **Russian UI**: Economy HUD uses Russian labels (Сырьё, Материя, Энергия, Контроль). Production panel uses "Производство", build menu uses "Строительство (B)".

**What NOT to copy:** Canvas 2D renderer code, old unit sprites (light_tank, heavy_tank — explicitly rejected in ASSET_POLICY D006), monolithic state approach.

---

## 4. Main Product Gaps

### Gap 1: Generated Assets Are Invisible to Normal Players

Generated hull/turret sprites only render when `?devtools=1&arena=1` is in the URL. The `PreloadScene.ts` explicitly gates loading behind `devtools` flag. `BlockoutVehicleRenderer` (the primary renderer for all modes) uses per-hull profiles but only when the texture key resolves. Standard and Debug modes never load generated assets, so players always see colored blockout cubes instead of tank sprites.

### Gap 2: English IDs in Player-Facing UI

Arena roster, debug labels, and all unit references use internal English IDs (wasp, hornet, smoky, railgun). Russian players need "Оса", "Шершень", "Смоки", "Рельса". The localization infrastructure exists (`src/phaser/ui/TooltipManager.ts` supports i18n) but combat unit names have not been localized.

### Gap 3: Manual Per-Hull Calibration as Production Design

HULL-VISUAL-FIXUP-02 (PR #230) introduces per-hull visual profiles with hardcoded `scale`, `originX/Y`, `offsetX/Y`, `uiOffsetY` values. This works for 7 hulls but doesn't scale. Adding a new hull means manually measuring transparent padding, computing origin offsets, and tweaking HP bar lifts by trial and error. The GPT_WORKFLOW explicitly bans "manual per-PNG tuning as production system."

### Gap 4: No Body/Weapon Production Config

`blockoutBodyData.ts` has HP/armor/mount/shape data but no cost, production time, tech tier, or movement profile. `weaponData.ts` has damage/range/cooldown but no cost or tech tier. `production.ts` only handles builder/harvester production — no tank production flow exists.

### Gap 5: No T1/T2/T3 Progression

`coreMechanicsTypes.ts` has a `FactionBonusKind = 'vision_territory'` and faction data has bonus placeholders, but there is no tech tree, no tier-gating, no HQ upgrade flow, and no progression system. The game starts and stays at T1 forever.

### Gap 6: No Tank Production in Unit Factory

The `units_factory` building exists and can produce builder/harvester, but there is no body/weapon composer, no cost display, no production queue for tanks, and no "choose hull → choose turret → confirm" flow.

### Gap 7: No Starter Combat Unit

Normal game starts with 2 harvesters and 1 builder. No combat unit. The player has no way to defend or attack until they build a factory and produce a tank — but there's no tank production flow (see Gap 6).

### Gap 8: No M0→M3 Upgrade by Combat

M-level scaling exists in configs (M0-M3 stat tuples) but no trigger mechanism. Units don't gain experience from kills or damage. There's no upgrade UI, no upgrade interaction, and no progression from M0 to M1/M2/M3.

### Gap 9: Jerky Tile-Step Movement

Current movement uses grid/tile occupancy with pathfinding, but the visual interpolation between tiles is not smooth. Tanks appear to make micro-efforts at each cell boundary. The underlying movement state updates discretely, and the renderer doesn't interpolate between positions.

### Gap 10: No Movement VFX (Dust/Inertia)

No dust particles, no acceleration/braking impulse, no inertia. Tanks start and stop instantly with no visual feedback. The `trackAnimationState` hook exists but only draws simple track lines — no particle system.

### Gap 11: 8/16-Direction Rotation Snapping

Body rotation snaps between 8 directions (legacy modular system) or 16 directions (generated sprite system). This produces visible "slideshow" rotation, especially for turrets tracking moving targets. No crossfade, no easing, no interpolation between sprite directions.

### Gap 12: No Fog of War

Zero implementation. Config placeholders exist (building `visionRadius`, faction `vision_territory` bonus) but no runtime fog system, no visibility calculation, no fog rendering. Standard mode has full omniscient vision.

### Gap 13: No Territory Coloring

Config placeholder only. `territoryVisionRadiusBonus: 1` for Purple faction exists but no runtime territory system, no tile ownership, no spread mechanics, no rendering.

### Gap 14: No RTS HUD

`PlaytestHud.ts` shows economy (Raw/Matter/Element/Power) and production buttons for builder/harvester. It does NOT show: selected unit info (name, HP, kills, M-levels, stats), command panel (stop/attack/hold/upgrade), minimap, or factory body/weapon composer. No SC2-style layout.

### Gap 15: No Minimap

No implementation. No terrain overview, no unit dots, no fog overlay, no camera viewport indicator, no click-to-move-camera.

### Gap 16: No Combat VFX

No muzzle flashes, no projectiles, no beams, no hit effects, no explosions. Weapons deal damage instantly through the hit model with no visual feedback. This is a late-roadmap item but combat feels abstract without it.

---

## 5. Proposed Architecture

### 5.1 Unified Asset Rendering Contract

All three modes (Standard, Debug, Arena) must use the same rendering pipeline. The current split (BlockoutVehicleRenderer for Standard/Arena with fallback, ModularTankRenderer for legacy debug) must converge.

**Proposal: Single `ProductionTankRenderer`** that:
1. Accepts a `TankVisualState` (body angle, turret angle, movement state, faction, hull, weapon, M-level)
2. Resolves sprite keys through `generatedHullAssets.ts` / `generatedTurretAssets.ts`
3. Uses systemic asset profiles from an `index.json` per hull/turret (generated by the Blender pipeline), not hardcoded constants
4. Falls back to blockout primitives when generated sprites aren't loaded
5. Renders in the correct depth order: shadow → hull → turret → overlay (HP/resource bars)

**Asset profile contract** (per hull/turret, generated by Blender pipeline):
```typescript
interface AssetProfile {
  canvasSize: number;        // e.g. 512
  artBounds: { x: number; y: number; w: number; h: number }; // actual art region
  groundAnchor: { x: number; y: number }; // pixel where ground contact is
  mountPoint: { x: number; y: number };   // pixel where turret mounts
  scale: number;             // derived from artBounds + canvasSize + tile footprint
  originX: number;           // derived from groundAnchor / canvasSize
  originY: number;
  offsetX: number;           // computed, not manual
  offsetY: number;
  uiOffsetY: number;         // derived from art height
}
```

This profile is **generated offline** by the Blender render script, not hand-tuned per PNG. Adding a new hull = render it + auto-generate profile. No manual calibration.

### 5.2 Body/Weapon Production Config Model

Extend existing config types with production-relevant fields:

```typescript
interface BodyProductionConfig {
  bodyId: string;
  russianName: string;        // "Оса", "Шершень", etc.
  techTier: 1 | 2 | 3;
  costMatter: number;
  costElement: number;        // in elementUnits
  controlCost: number;
  productionTimeSeconds: number;
  movementProfile: 'light_tracked' | 'medium_tracked' | 'heavy_tracked';
  dustProfile: 'light' | 'medium' | 'heavy';
  acceleration: number;
  braking: number;
  turnSpeed: number;          // degrees/second
}

interface WeaponProductionConfig {
  weaponId: string;
  russianName: string;        // "Смоки", "Рельса", etc.
  techTier: 1 | 2 | 3;
  costMatter: number;
  costElement: number;
  turretTurnSpeed: number;    // degrees/second
  vfxProfile: string;         // muzzle/projectile/hit effect key
}
```

### 5.3 T1/T2/T3 Progression Model

| Tier | Unlocked At | Hulls | Weapons |
|------|-------------|-------|---------|
| T1 | Game start | Wasp, Hornet, Hunter | Smoky, Railgun |
| T2 | HQ upgrade to T2 | +Viking, Dictator | +Thunder, Twins, Freeze |
| T3 | HQ upgrade to T3 | +Titan, Mammoth | +Flamethrower, Isida, Ricochet, Vulcan, Hammer |

HQ tier upgrade costs and requirements (proposal):
- T1→T2: 200 Matter + 10 Element, requires Power Plant online
- T2→T3: 500 Matter + 30 Element, requires Energy Reactor online

### 5.4 Upgrade System Design

- Units start at M0
- Each unit tracks `combatContribution` = kills × 1.0 + damageDealt × 0.01
- Upgrade thresholds: M1 at 5 contribution, M2 at 15, M3 at 30
- Player selects unit → clicks "Upgrade" button → if threshold met, advance M-level
- Visual: M-level indicator on unit info panel, M-specific sprite texture swap
- At T3, factory may produce M1 units at +50% cost

### 5.5 Fog/Territory/Minimap Architecture

```
src/systems/vision.ts    — Pure TS: calculate visible tiles from unit/building/territory sources
src/systems/territory.ts — Pure TS: tile ownership, spread mechanics, faction coloring
src/phaser/render/FogRenderer.ts        — Phaser: render fog overlay (RenderTexture + tilemap alpha)
src/phaser/render/TerritoryRenderer.ts   — Phaser: render faction-colored tile overlays
src/phaser/render/MinimapRenderer.ts     — Phaser/DOM: minimap canvas with fog/units/buildings
```

Fog state is pure TS (no Phaser imports). FogRenderer reads it. Territory is pure TS. TerritoryRenderer reads it. MinimapRenderer reads both + camera viewport.

### 5.6 RTS HUD Architecture (SC2 Layout Logic)

```
┌─────────────────────────────────────────────────────┐
│                    GAME VIEWPORT                      │
│                                                       │
│  ┌──────┐                               ┌──────────┐ │
│  │MINI- │                               │ CONTEXT  │ │
│  │ MAP  │                               │  PANEL   │ │
│  └──────┘                               └──────────┘ │
│  ┌──────────────────────────────────────────────────┐ │
│  │           SELECTED UNIT INFO PANEL                │ │
│  │  Оса + Смоки  │  HP: 180  │  M0  │  Kills: 3   │ │
│  │  Damage: 14   │  Range: 8 │  Speed: 3.5         │ │
│  ├──────────────────────────────────────────────────┤ │
│  │           COMMAND / ACTION GRID                   │ │
│  │  [S] Stop  [A] Attack  [H] Hold  [U] Upgrade    │ │
│  └──────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

Implementation: DOM overlay (not Phaser game objects), CSS Grid layout, Russian labels throughout.

---

## 6. Proposed Roadmap Tracks

### Track 1: Asset Integration Across All Modes (FOUNDATION)

Make generated assets visible in Standard, Debug, and Arena without query strings. Remove the `devtools` gate from PreloadScene. Unify the rendering pipeline.

**Priority: CRITICAL — blocks almost everything else**

### Track 2: Russian Player-Facing Labels (LOCALIZATION)

Replace all English body/weapon IDs in player-visible UI with Russian names. Keep internal IDs in code.

**Priority: HIGH — low effort, high player impact**

### Track 3: Systemic Asset Profiles (PIPELINE)

Replace per-hull hardcoded constants with auto-generated profiles from the Blender pipeline. Make adding new hulls/turrets a pipeline operation, not a manual calibration task.

**Priority: HIGH — unblocks future asset expansion**

### Track 4: Body/Weapon Config + Production + Factory (DATA MODEL)

Extend body/weapon configs with production data. Build the Unit Factory body/weapon composer. Add tank production flow. Define T1/T2/T3 progression. Add starter combat unit.

**Priority: HIGH — makes the game playable as an RTS**

### Track 5: Movement Feel + Rotation Smoothing (FEEL)

Smooth movement interpolation, acceleration/braking, dust particles, inertia impulse, body/turret turn smoothing with crossfade between directions.

**Priority: MEDIUM-HIGH — transforms the feel of the game**

### Track 6: Fog/Territory/Minimap (STRATEGIC LAYER)

Two-layer fog of war, territory coloring with spread mechanics, minimap with fog/units/viewport. This is the strategic information warfare layer.

**Priority: MEDIUM-HIGH — enables RTS depth**

### Track 7: RTS HUD + Combat VFX (POLISH)

SC2-style HUD layout with unit info panel, command grid, context actions. Combat VFX: muzzle flash, projectile, hit effect, explosion. This is the polish/feedback layer.

**Priority: MEDIUM — important for feel but not blocking**

---

## 7. Detailed PR Sequence

### Track 1: Asset Integration Across All Modes

| PR | ID | Title | Scope |
|----|-----|-------|-------|
| 1 | ASSET-UNIFY-01 | Remove devtools gate from PreloadScene for generated assets | `PreloadScene.ts` — always load generated hull/turret sets for current faction |
| 2 | ASSET-UNIFY-02 | Wire BlockoutVehicleRenderer to use generated sprites in Standard mode | `BlockoutVehicleRenderer.ts` — remove arena-only guard on hull/turret sprite creation |
| 3 | ASSET-UNIFY-03 | Add generated asset loading to Debug mode entry point | `GameScene.ts` — ensure Debug mode also triggers preload |
| 4 | ASSET-UNIFY-04 | Validate generated assets render correctly in all 3 modes | Manual QA pass + typecheck/test/build |

### Track 2: Russian Player-Facing Labels

| PR | ID | Title | Scope |
|----|-----|-------|-------|
| 5 | L10N-COMBAT-01 | Add Russian name map for all 7 bodies and 10 weapons | New file `src/config/unitLocalization.ts` |
| 6 | L10N-COMBAT-02 | Replace English IDs in Arena roster, debug labels, and tooltips | `ArenaMenu.ts`, `BlockoutVehicleRenderer.ts`, `TooltipManager.ts` |

### Track 3: Systemic Asset Profiles

| PR | ID | Title | Scope |
|----|-----|-------|-------|
| 7 | ASSET-PROFILE-01 | Define AssetProfile interface and auto-generation spec | `src/assets/assetProfileTypes.ts` + docs update |
| 8 | ASSET-PROFILE-02 | Blender pipeline outputs index.json with computed profile per hull/turret | `tools/blender/` scripts |
| 9 | ASSET-PROFILE-03 | Runtime AssetProfile loader replaces hardcoded constants | `generatedHullAssets.ts`, `generatedTurretAssets.ts` |
| 10 | ASSET-PROFILE-04 | Body/turret compatibility matrix (which turrets fit which hulls) | `src/config/bodyWeaponCompatibility.ts` |

### Track 4: Body/Weapon Config + Production + Factory

| PR | ID | Title | Scope |
|----|-----|-------|-------|
| 11 | PROD-CONFIG-01 | Extend body configs with production data (cost, tier, movement/dust profile) | `blockoutBodyData.ts` → `bodyProductionData.ts` |
| 12 | PROD-CONFIG-02 | Extend weapon configs with production data (cost, tier, VFX profile) | `weaponData.ts` → `weaponProductionData.ts` |
| 13 | PROD-CONFIG-03 | Define T1/T2/T3 tier model and HQ upgrade flow | `src/config/techTree.ts` + `src/state/hqUpgrade.ts` |
| 14 | PROD-FACTORY-01 | Unit Factory tank production: body/weapon composer state | `src/state/tankProduction.ts` |
| 15 | PROD-FACTORY-02 | Unit Factory body/weapon composer UI panel | DOM panel in `src/phaser/ui/FactoryPanel.ts` |
| 16 | PROD-FACTORY-03 | Tank production queue + spawn logic | `src/state/production.ts` extension |
| 17 | PROD-STARTER-01 | Add starter combat unit (1× Wasp + Smoky) to game start | `src/state/gameInit.ts` |
| 18 | PROD-UPGRADE-01 | Combat contribution tracking and M-level upgrade trigger | `src/state/unitExperience.ts` |
| 19 | PROD-UPGRADE-02 | Upgrade UI: select unit → show upgrade button → advance M-level | DOM panel integration |

### Track 5: Movement Feel + Rotation Smoothing

| PR | ID | Title | Scope |
|----|-----|-------|-------|
| 20 | FEEL-MOVE-01 | Smooth visual interpolation between tile positions | `BlockoutVehicleRenderer.ts` — lerp between logical and visual position |
| 21 | FEEL-MOVE-02 | Acceleration/braking curves for movement start/stop | `src/state/movementFeel.ts` + renderer integration |
| 22 | FEEL-DUST-01 | Dust particle system for moving units | `src/phaser/vfx/DustEmitter.ts` — Phaser particle emitter |
| 23 | FEEL-INERTIA-01 | Inertia impulse: start burst, braking dip, sustained offset | `src/phaser/vfx/InertiaOffset.ts` — visual-only offset system |
| 24 | FEEL-TURN-01 | Body/turret turn smoothing with crossfade between sprite directions | `BlockoutVehicleRenderer.ts` — easing between dir changes |

### Track 6: Fog/Territory/Minimap

| PR | ID | Title | Scope |
|----|-----|-------|-------|
| 25 | FOG-ARCH-01 | Vision system: tile visibility calculation from units/buildings | `src/systems/vision.ts` — pure TS, no Phaser |
| 26 | FOG-RENDER-01 | Fog of war renderer: unexplored/explored/visible overlay | `src/phaser/render/FogRenderer.ts` — RenderTexture approach |
| 27 | TERRITORY-01 | Territory ownership, spread mechanics, tile claim system | `src/systems/territory.ts` — pure TS |
| 28 | TERRITORY-RENDER-01 | Territory coloring renderer: faction-colored tile overlays | `src/phaser/render/TerritoryRenderer.ts` |
| 29 | MINIMAP-01 | Minimap: terrain, fog, units, buildings, camera viewport | `src/phaser/render/MinimapRenderer.ts` or DOM canvas |

### Track 7: RTS HUD + Combat VFX

| PR | ID | Title | Scope |
|----|-----|-------|-------|
| 30 | HUD-ARCH-01 | SC2-style HUD shell: layout grid, panel containers, hotkey system | DOM structure + CSS Grid |
| 31 | HUD-INFO-01 | Selected unit info panel: name, HP, kills, M-level, stats | DOM panel with live state binding |
| 32 | HUD-CMD-01 | Command panel: context actions (stop/attack/hold/upgrade/build) | DOM buttons with hotkey bindings |
| 33 | HUD-FACTORY-01 | Factory production panel integration with body/weapon composer | DOM panel, connects to PROD-FACTORY state |
| 34 | VFX-MUZZLE-01 | Muzzle flash effect on weapon fire | `src/phaser/vfx/MuzzleFlash.ts` |
| 35 | VFX-PROJECTILE-01 | Projectile rendering (shell, beam, rocket per weapon type) | `src/phaser/vfx/ProjectileRenderer.ts` |
| 36 | VFX-HIT-01 | Hit effects and explosions | `src/phaser/vfx/HitEffect.ts` |

---

## 8. High / High+ Classification

### High+ (Must-Do, Blocks Other Work)

| PR | Why |
|----|-----|
| ASSET-UNIFY-01/02/03 | Without this, no other visual work matters — players never see generated assets |
| ASSET-PROFILE-01/03 | Without systemic profiles, every new hull requires manual calibration — violates project rules |
| PROD-CONFIG-01/02 | Without production data, no factory UI can be built |
| PROD-FACTORY-01/02/03 | Without tank production, the game is not an RTS |
| FEEL-MOVE-01 | Without smooth interpolation, movement remains jerky regardless of other improvements |

### High (Must-Do, Important but Not Blocking)

| PR | Why |
|----|-----|
| L10N-COMBAT-01/02 | Russian labels are required for player-facing product but don't block engineering |
| PROD-CONFIG-03 | T1/T2/T3 progression is needed for gameplay depth but T1 works first |
| PROD-STARTER-01 | Starter combat unit is needed but factory can produce tanks without it |
| PROD-UPGRADE-01/02 | M-level upgrade is important for progression but M0 works first |
| FEEL-DUST-01/INERTIA-01 | VFX transforms feel but game is playable without them |
| FOG-ARCH-01/RENDER-01 | Fog enables strategic depth but game is playable without it |
| TERRITORY-01/RENDER-01 | Territory ties to fog and minimap but can ship later |

### Medium (Should-Do, Polish)

| PR | Why |
|----|-----|
| FEEL-TURN-01 | Turn smoothing is visible but not game-breaking |
| MINIMAP-01 | Minimap is important for RTS but not blocking |
| HUD-ARCH-01/INFO-01/CMD-01 | HUD panels are important for UX but PlaytestHud works as fallback |
| VFX-MUZZLE/PROJECTILE/HIT | Combat VFX is important for feel but damage model works without it |

---

## 9. Risks and Blockers

### Risk 1: Asset Pipeline Bottleneck (HIGH)

The Blender pipeline must produce consistent `index.json` profiles for all 7 hulls and 10+ turrets. If the pipeline breaks or produces inconsistent metadata, every downstream system (renderer, factory, compatibility) breaks. **Mitigation:** Validate index.json schema in CI. Add schema tests.

### Risk 2: PreloadScene Performance (MEDIUM)

Loading generated assets for all hulls/turrets/factions/mods/directions is 1792+ hull PNGs + similar turret count. Loading all of these at startup is unacceptable. **Mitigation:** On-demand loading (already implemented for Arena). Extend to Standard/Debug with faction-specific lazy loading — only load current faction's set initially.

### Risk 3: Movement Interpolation vs. Pathfinding (HIGH)

Smooth visual interpolation must not break grid occupancy, pathfinding, or collision. The renderer must interpolate visual position while the logical position snaps to tiles. If these diverge, units will appear to occupy wrong tiles. **Mitigation:** Strict separation of `logicalPosition` (tile-snapped) and `visualPosition` (interpolated). Render layer uses visualPosition only. State/logic layer uses logicalPosition only.

### Risk 4: Fog Performance (MEDIUM)

Per-tile fog calculation on a large map every frame could be expensive. **Mitigation:** Use dirty-flag system — only recalculate when units/buildings move. Cache visibility state. Render fog overlay to a RenderTexture updated only when visibility changes.

### Risk 5: HUD Complexity Explosion (MEDIUM)

SC2-style HUD with context panels, command grids, and factory composers is a large UI surface. Building it all at once risks a fragile monolith. **Mitigation:** Incremental PRs. Shell first (layout + panels), then fill each panel. Each panel is a self-contained DOM component.

### Risk 6: T1/T2/T3 Balance (LOW)

Tier unlock costs and unit availability are game design decisions that may need iteration. **Mitigation:** Make all tier constants config-driven (not hardcoded). Easy to adjust without code changes.

### Blocker: No Combat VFX Pipeline

The current hit model is instant-projectile with no visual feedback loop. Adding projectile rendering requires a new `ProjectileManager` that tracks active projectiles per frame. This is non-trivial but not blocking — it can be deferred to Track 7.

---

## 10. What Not to Do

1. **Do not build enemy bot / strategic AI** — explicitly excluded by the user's hard roadmap block.
2. **Do not copy old Canvas 2D rendering code from glm-game-sandbox** — use concepts only, implement fresh in Phaser.
3. **Do not copy old Next.js/Canvas implementation from four-elements-next** — reference only.
4. **Do not use hardcoded per-hull constants as the production system** — ASSET-PROFILE track replaces this.
5. **Do not add 32+ sprite directions** — 16 is sufficient; crossfade smoothing is cheaper than doubling sprite count.
6. **Do not build fog as a full tilemap layer** — RenderTexture with alpha masking is more performant.
7. **Do not build HUD as Phaser game objects** — DOM overlay is the project standard and easier to style/localize.
8. **Do not make combat VFX Track 1** — it's polish, not foundation. Get assets visible and factory working first.
9. **Do not start territory before fog** — territory provides vision, so fog must exist first for territory vision to work.
10. **Do not implement M-level upgrade by kills-only** — damage dealt must also count, per user requirement.

---

## 11. Open Decisions for Denis

1. **HQ upgrade flow**: Should HQ T1→T2→T3 be a building upgrade (click HQ, click "Upgrade") or automatic when prerequisites are met? Proposal: click-to-upgrade, costs deducted, build timer.

2. **Starting unit composition**: User specified "2 harvesters + 1 builder + 1 wasp + smoky." Confirm this is correct for T1 start. The wasp+smoky should be M0.

3. **Upgrade trigger**: User said "not only kills; damage dealt should matter too." Confirm the contribution formula: `combatContribution = kills × 1.0 + damageDealt × 0.01`. Should healing done (Isida) also count?

4. **M-level upgrade UX**: Should upgrade be automatic when threshold is met, or require player action (click unit → click Upgrade)? Proposal: player action — gives strategic choice of timing.

5. **Fog of war in Arena**: Should Arena have fog? Proposal: No — Arena is a sandbox, fog would hinder testing. Fog is Standard-mode only.

6. **Minimap click-to-move**: Should clicking the minimap move the camera? Proposal: Yes, but this can be deferred to MINIMAP-02.

7. **Territory spread rate**: glm-game-sandbox uses 1 cell/15 seconds, four-elements-next uses exponential `45 × 2^(radius-1)` seconds. Which model? Proposal: exponential from Next — slower outer rings feel more strategic.

8. **Body/weapon compatibility**: Should every turret fit every hull? Or are there restrictions (e.g., heavy weapons can't fit light hulls)? Proposal: All combinations allowed at T3, but some are inefficient (light hull + heavy weapon = slow turn, low HP).

9. **T3 direct M1 production**: User mentioned "maybe allow producing higher-mod units directly at T3 with extra cost." Confirm: T3 factory can produce M1 units at +50% cost? Or should this be deferred?

10. **Russian weapon names**: Confirm naming: Смоки, Гром, Рельса, Шафт, Огнемёт, Фриз, Изида, Вулкан, Близнецы, Рикошет, Молот. Are these the canonical Russian names?

---

## 12. Validation Strategy

### Automated Validation (Every PR)

```bash
npm run typecheck    # TypeScript strict mode
npm run test         # Vitest unit tests
npm run build        # Vite production build
npm run qa:smoke     # Smoke test suite
```

### Asset Integration Validation

For each mode (Standard, Debug, Arena):
1. Launch game without `?devtools=1&arena=1` query strings (where applicable)
2. Confirm generated hull/turret sprites render (not blockout cubes)
3. Confirm sprites align with selection rings and ground markers
4. Confirm HP/resource bars don't overlap sprite body
5. Confirm direction switching works for all 16 directions

### Production Validation

1. Build Units Factory
2. Select body → select weapon → confirm cost display → confirm production
3. Confirm produced unit spawns at factory with correct hull/turret sprites
4. Confirm M0 stats match config
5. Confirm upgrade trigger (kill/damage) works
6. Confirm M1/M2/M3 stat scaling matches existing config tuples

### Movement Feel Validation

1. Move unit across 10+ tiles — no visible tile-step stutter
2. Start movement — acceleration ramp visible
3. Stop movement — braking deceleration visible, no instant stop
4. Dust particles visible during movement, stop when stationary
5. Inertia offset: slight forward lean on start, slight rear dip on stop
6. Body rotation: smooth easing between directions, no snap

### Fog/Territory Validation

1. Start Standard game — fog covers unexplored area
2. Move unit — fog reveals around unit, stays revealed as "explored"
3. Enemy in fog — not visible; in explored area — terrain visible but no enemy
4. Build building — territory spreads from building
5. Territory colored with faction color
6. Minimap shows fog/territory/units/camera viewport

---

## 13. Manual QA Strategy

### Per-Track QA Passes

**Track 1 QA**: Open Standard, Debug, and Arena modes. In each, spawn or start with a unit that has generated assets. Confirm sprites render, align, and animate. No blockout cubes.

**Track 2 QA**: Open Arena. Place Wasp+Smoky. Roster shows "Оса + Смоки", not "wasp + smoky". Debug label shows "Оса+Смоки". Tooltip shows Russian name.

**Track 3 QA**: Add a new hull through the pipeline (hypothetical). Run Blender script. Confirm `index.json` is generated. Confirm runtime loads profile without manual tuning. Confirm sprite renders correctly.

**Track 4 QA**: Build Units Factory. Open factory panel. Select Викинг (Viking). Select Гром (Thunder). See cost (Matter + Element + Control). Confirm production. Unit spawns with correct sprites and stats at M0. Kill enemies. Confirm contribution tracking. Click upgrade. Confirm M1 stats.

**Track 5 QA**: Move Wasp across map. Observe smooth interpolation, acceleration from standstill, braking on stop. Dust behind tracks. Slight forward lean on start. Turret smoothly rotates toward target — no direction snapping.

**Track 6 QA**: Start Standard game. Zoom out. See fog. Move unit into fog. See fog reveal. Move unit away — explored area stays partially visible. Build building — territory grows. Minimap reflects fog/territory.

**Track 7 QA**: Select unit. See info panel at bottom center with Russian name, HP bar, kills, M-level, stats. See command buttons (Стоп, Атака, Держать, Улучшить). Fire weapon — see muzzle flash, projectile travel, hit effect.

---

## 14. Suggested Docs to Create/Update

### New Docs

| Doc | Purpose |
|-----|---------|
| `docs/project/PLAYER_INTEGRATION_ROADMAP_2026_06_07.md` | This audit + roadmap |
| `docs/project/ASSET_PROFILE_CONTRACT.md` | Auto-generated profile spec for hull/turret assets |
| `docs/project/BODY_WEAPON_PRODUCTION_MODEL.md` | Production config schema, costs, tiers |
| `docs/project/TIER_PROGRESSION_MODEL.md` | T1/T2/T3 unlock table, HQ upgrade flow |
| `docs/project/FOG_TERRITORY_ARCH.md` | Fog/territory/minimap architecture |
| `docs/project/RTS_HUD_LAYOUT.md` | HUD panel layout, content, hotkey map |
| `docs/project/MOVEMENT_FEEL_SPEC.md` | Interpolation, dust, inertia, turn smoothing constants |
| `docs/project/UNIT_LOCALIZATION_MAP.md` | English ID → Russian name mapping table |
| `docs/project/COMBAT_VFX_SPEC.md` | Weapon VFX profiles, muzzle/projectile/hit per weapon type |

### Docs to Update

| Doc | Change |
|-----|--------|
| `PROJECT_STATE.md` | Add "Player Integration" as active cycle direction |
| `CURRENT_NEXT_STEP.md` | Update to reflect Track 1 as current work |
| `UNIT_ASSET_PIPELINE_ROADMAP_2026_06_04.md` | Add ASSET-PROFILE integration step |
| `CAMERA_PROJECTION_CONTRACT.md` | Add section on fog/territory projection compliance |

---

## 15. Final Recommendation

**Start with Track 1 (Asset Integration) immediately.** It is the smallest, highest-impact track: 3–4 PRs that make the game look like a tank game instead of a colored-cube prototype. This is the foundation everything else builds on.

**Sequence: Track 1 → Track 2 → Track 3 → Track 4 → Track 5 → Track 6 → Track 7**

Tracks 1 and 2 can partially overlap (different files, no merge conflict risk). Track 3 can start as soon as Track 1 confirms the rendering pipeline is stable. Track 4 is the biggest track (9 PRs) and should start after Track 3 delivers systemic profiles. Track 5 (movement feel) is independent enough to parallelize with Track 4 if the agent bandwidth allows. Track 6 (fog/territory/minimap) depends on building/unit vision radii being defined in Track 4 configs. Track 7 (HUD + VFX) is polish that can start after Track 4 delivers the production data model.

The entire cycle is estimated at 36 PRs across 7 tracks. At the project's historical pace (roughly 2–3 PRs per day when active), this represents approximately 3–4 weeks of focused implementation work.

The biggest risk is not technical — it's scope creep. Each track must close before the next starts. Do not add features mid-track. Do not expand PR scope. The game needs to be a playable RTS with tanks, not a bigger engine.

**Жду Делай**
