# RUNTIME-02B: Pilot Lazy-Load Lifecycle + Diagnostics Report

Date: 2026-06-14
Task: RUNTIME-02B — Pilot lazy-load lifecycle + diagnostics
Executor: GLM
Status: Complete

---

## 1. Goal

Wire the existing selected-set loader (`preloadVehicleAssetSet`) into Arena/dev lifecycle for the pilot combo: Wasp cyan m0 hull + Smoky cyan m0 turret. Add diagnostics showing loaded/queued/fallback status.

---

## 2. Key design decision: turret-only Arena hook

### Problem: duplicate key queueing in same preload batch

`loadArenaVisualAssets()` loads hull sets for all 4 factions, then needs to load the pilot turret. If we call `preloadVehicleAssetSet()` (which loads both hull + turret), the cyan hull keys would be queued **twice** because:

1. The faction loop queues `generated_hull_wasp_cyan_m0_dirNN` for all 16 directions
2. Then `preloadVehicleAssetSet()` would queue the same 16 hull keys again
3. Phaser's `TextureManager.exists()` only detects **already-loaded** textures, not keys queued in the current preload batch

### Solution: `loadPilotTurretSet()`

Created a separate `loadPilotTurretSet()` function that loads **only the turret** (Smoky cyan m0, 16 PNG). This avoids the duplicate queueing entirely:

```
loadArenaVisualAssets():
  1. For each faction → preloadGeneratedHullSet(wasp, faction, m0)  // 64 hull keys
  2. loadPilotTurretSet()                                           // 16 turret keys
  Total: 80 keys, zero duplicates
```

The full `loadPilotVehicleAssetSet()` (hull + turret) is still available for on-demand loading outside the Arena preload batch.

---

## 3. Files added

| File | Purpose |
|------|---------|
| `src/assets/pilotVehicleLazyLoad.ts` | Pilot request constants, turret-only loader, full-set loader, diagnostics |
| `src/__tests__/runtime02bPilotLazyLoad.test.ts` | 45 tests covering pilot lifecycle, no-broad-preload, no-duplicate-queueing, diagnostics |
| `docs/project/RUNTIME_02B_PILOT_LAZY_LOAD_REPORT_2026_06_14.md` | This report |

## 4. Files modified

| File | Change |
|------|--------|
| `src/assets/runtimeGeneratedAssets.ts` | `loadArenaVisualAssets()` now calls `loadPilotTurretSet()` after hull loop. Added `PILOT_TURRET_PROBE_KEY`. `isArenaVisualAssetsLoaded()` now also checks turret probe key. |
| `src/phaser/PreloadScene.ts` | Added diagnostic log after Arena asset loading (pilot vehicle set diagnostics). |
| `src/__tests__/runtimeGeneratedAssets.test.ts` | Updated test expectations: 64→80 keys (hull+turret), 48→64 with cyan hull cached, added turret probe key to `isArenaVisualAssetsLoaded` test. |

---

## 5. New API surface

### `pilotVehicleLazyLoad.ts`

| Export | Type | Description |
|--------|------|-------------|
| `PILOT_VEHICLE_REQUEST` | `VehicleAssetSetRequest` | Pilot combo: wasp + smoky + cyan + m0 |
| `loadPilotVehicleAssetSet(scene)` | `VehicleAssetSetResult` | Full set loader (hull + turret, max 32 PNG) |
| `loadPilotTurretSet(scene)` | `string[]` | Turret-only loader (16 PNG, Arena-safe) |
| `getPilotVehicleLoadDiagnostics(scene)` | `PilotVehicleLoadDiagnostics` | Read-only diagnostic snapshot |
| `isPilotVehicleSetFullyLoaded(scene)` | `boolean` | Quick check: both hull + turret fully loaded |
| `PILOT_VEHICLE_MAX_PNG` | `32` | Max PNG budget constant |

### `PilotVehicleLoadDiagnostics`

| Field | Type | Description |
|-------|------|-------------|
| `hullSupported` | `boolean` | Whether pilot hull has generated assets |
| `turretSupported` | `boolean` | Whether pilot turret has generated assets |
| `hullLoaded` | `boolean` | All 16 hull textures in TextureManager |
| `turretLoaded` | `boolean` | All 16 turret textures in TextureManager |
| `hullKeysPresent` | `number` | Hull keys found (0–16) |
| `turretKeysPresent` | `number` | Turret keys found (0–16) |
| `maxPngBudget` | `number` | 32 |
| `fullyLoaded` | `boolean` | Both hull and turret fully loaded |

### `runtimeGeneratedAssets.ts` additions

| Export | Type | Description |
|--------|------|-------------|
| `PILOT_TURRET_PROBE_KEY` | `'generated_turret_smoky_cyan_m0_dir00'` | Quick check for pilot turret presence |

---

## 6. Asset counts

- Arena total: 64 hull PNG (4 factions × 16 dirs) + 16 turret PNG = **80 PNG**
- Pilot set alone: max 32 PNG (16 hull + 16 turret)
- No broad preload: only wasp/smoky/cyan/m0, not all 2560 turret PNGs
- No hull overwrite
- No new PNG assets added

---

## 7. Diagnostics in PreloadScene

When devtools/arena mode is active, PreloadScene logs:
```
[PreloadScene] generated hull sets loaded: wasp/<all factions>/m0 (16 dirs each).
[PreloadScene] Pilot vehicle set diagnostics: hullSupported=true hullLoaded=false hullKeysPresent=0/16 turretSupported=true turretLoaded=false turretKeysPresent=0/16 fullyLoaded=false
```

The `false` values are expected during `preload()` — textures are queued but not yet loaded. After the Phaser loader completes, `fullyLoaded` would be `true`.

---

## 8. Validation

- `npx tsc --noEmit`: ✅ Clean
- `npx vitest run`: ✅ All tests pass
- `npx vite build`: ✅ Success

---

## 9. Test coverage

45 new tests in `runtime02bPilotLazyLoad.test.ts`:

- Pilot request constants (7)
- Pilot vehicle support (3)
- Pilot lazy-load behavior (4)
- No broad preload (4)
- No duplicate texture queueing (4)
- Diagnostics (7)
- isPilotVehicleSetFullyLoaded (3)
- loadArenaVisualAssets integration (5)
- Standard mode safety (3)
- Pilot scope limit (4)

---

## 10. Forbidden areas untouched

- No renderer changes (BlockoutVehicleRenderer, ModularTankRenderer)
- No generatedAssetManifest.ts edits
- No combat/movement/economy/mapgen/save-load changes
- No new URL flags
- No PR #263 reuse
- No manual offset tuning
- No full 640/1088/1792 asset preload
- No turret sprite drawing
- No public/assets additions
