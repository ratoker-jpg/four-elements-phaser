# MODULAR-RUNTIME-03A: Live Modular Vehicle Adapter Report

**Date:** 2026-06-15
**PR:** #291 (rebuilt)
**Baseline:** `cb1870763129472d0c33813adea327673ecce7af` (merge of PR #290)

## Summary

MODULAR-RUNTIME-03A adds a calibration-free live modular vehicle adapter for Arena devtools/demo rendering. When the `ENABLE_MODULAR_VEHICLE_RENDER` feature flag is toggled on, vehicles are rendered using the accepted `modular_hull_*` / `generated_turret_*` namespace and the `composeModularVehicle()` composition API from PRs #286/#287/#288.

## Baseline Reconciliation

### Problem Found
GitHub main was force-pushed backward from `cb1870763129` (merge of PR #290) to `a352ef0e372b` (PR #221) at 2026-06-15T08:41:23Z, removing all PRs #284-#290 from main.

### Resolution
Main was restored to the accepted baseline `cb1870763129472d0c33813adea327673ecce7af` (merge of PR #290) which includes:
- PR #286: ASSET-IMPORT-02A (modular all-factions vehicle assets)
- PR #287: MODULAR-ALL-FACTIONS-01B (all factions + Dictator scale)
- PR #288: MODULAR-ALL-FACTIONS-01C (preview calibration)
- PR #289: ROADMAP-03 (full game integration plan)
- PR #290: OPUS-AUDIT-RUNTIME-03 (modular runtime audit)

### Current Main SHA
`cb1870763129472d0c33813adea327673ecce7af`

## Changed Files (03A-only)

| File | Change | Purpose |
|------|--------|---------|
| `src/modular/blockoutToModularVisual.ts` | NEW | BlockoutVehicleState → ModularVehicleVisual mapper |
| `src/phaser/render/ModularVehicleLiveAdapter.ts` | NEW | Live adapter using composeModularVehicle() |
| `src/phaser/render/BlockoutVehicleRenderer.ts` | MODIFIED | Integration with modular adapter + feature flag |
| `src/phaser/dev/ModularVehicleDevtoolsPanel.ts` | MODIFIED | Added Live Render (03A) toggle button |
| `src/__tests__/modularLiveAdapter03a.test.ts` | NEW | 24 tests covering mapping, composition, namespace |

## Architecture

### blockoutToModularVisual.ts
Maps `BlockoutVehicleState` fields to `ModularVehicleVisual`:
- `bodyId` → `hullId` (identity: wasp→wasp, etc.)
- `weaponId` → `turretId` (vulcan→vulcan_b, flamethrower→firebird, shaft→railgun fallback)
- `faction` → `faction` (identity)
- `modificationLevel` → `hullMod`/`turretMod` via `modLevelToModularMod()`
- `bodyAngle`/`turretAngle` → `hullDir16`/`turretDir16` via `runtimeAngleToDir16()`

### ModularVehicleLiveAdapter.ts
Bridges `BlockoutVehicleState` → `composeModularVehicle()` → world-space Phaser sprite placement:
- Feature flag `ENABLE_MODULAR_VEHICLE_RENDER` (default: false)
- `syncVehicle()` — per-frame: maps, loads, composes, positions sprites
- `setDepth()` — post-sort modular sprite depth resync
- `removeVehicle()` / `destroy()` — lifecycle management
- Calibration-free: uses metadata-driven composition math only

### BlockoutVehicleRenderer.ts Integration
- When flag is on AND adapter returns `usedModular: true`:
  - Legacy hull sprite is destroyed
  - Legacy turret sprite is destroyed
  - Procedural turret box is skipped
  - Modular adapter handles hull+turret positioning
- Overlays (shadow, HP, selection, labels, weapon bars) remain in renderVehicle() — outside the modular guard
- Normal runtime is completely untouched when flag is off

### Devtools Toggle
Added "Live Render (03A)" section to `ModularVehicleDevtoolsPanel` with ON/OFF toggle button.

## Key Namespace Verification

The `modular_hull_*` namespace is confirmed in the accepted baseline:
- `getGeneratedHullTextureKey()` in `generatedModularVehicleAssets.generated.ts` produces `modular_hull_${hull}_${faction}_${mod}_dir${NN}`
- `getGeneratedTurretTextureKey()` produces `generated_turret_${turret}_${faction}_${mod}_dir${NN}`
- These are used by `composeModularVehicle()` in `modularVehicleComposition.ts`
- The 03A adapter uses ONLY these functions — NO `generatedHullAssets.ts` imports

## Validation

| Check | Status |
|-------|--------|
| TypeScript typecheck | PASS |
| Unit tests (4593 total) | PASS |
| 03A-specific tests (24) | PASS |
| Modular tests (137) | PASS |
| Build | FAIL (disk space: 4.6GB assets, 3.7GB free — environment issue) |
| qa:smoke | SKIPPED (requires build) |

## Dictator Visual Scale Compensation

Confirmed: `composeModularVehicle()` applies `getHullVisualScaleMultiplier('dictator') = 1.09` to hull scale only. Turret does NOT inherit this multiplier. This is handled correctly by the composition module — no additional compensation needed in the adapter.
