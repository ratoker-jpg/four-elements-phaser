# ARENA-VISUAL-COMBAT-FIX-01: Fixes 2, 3, 5, 6 Implementation

## Summary

Implemented fixes 2, 3, 5, and 6 for PR #304 on branch `arena-visual-combat-fix-01-high`.

## Files Modified

### 1. `src/config/debugRenderFlags.ts` (Fix 2)

Added two new debug render flags:
- `targetLockIndicator` (default false) — gates the yellow dot above turret when vehicle has an active target-lock
- `enemyTeamIndicator` (default false) — gates the red diamond above HP bar for enemy-team vehicles

Updated:
- `DebugRenderFlags` interface with two new boolean fields
- `debugRenderFlags` singleton with both defaulting to false
- `resetDebugRenderFlags()` to reset both new flags
- `areAllDebugRenderFlagsOff()` to check both new flags
- Module docstring updated: removed target-lock indicator and enemy team indicator from "Not controlled" list and added ARENA-VISUAL-COMBAT-FIX-01 note

### 2. `src/phaser/render/BlockoutVehicleRenderer.ts` (Fix 2 + Fix 6)

**Fix 2**: Gated two stray pixel indicators behind `debugRenderFlags`:
- Target-lock yellow dot (line ~853): `if (debugRenderFlags.targetLockIndicator && vehicle.targetVehicleId && ...)`
- Enemy team red diamond (line ~862): `if (debugRenderFlags.enemyTeamIndicator && vehicle.team === 'enemy' && ...)`

**Fix 6**: Added public delegation methods:
- `getModularBarrelTip(vehicleId, turretAngle)` — delegates to `modularAdapter.getModularBarrelTip()`
- `isVehicleUsingModularRender(vehicleId)` — delegates to `modularAdapter.isUsingModularRender()`

### 3. `src/phaser/render/ModularVehicleLiveAdapter.ts` (Fix 3 + Fix 6)

**Fix 3**: Added `MODULAR_VISUAL_CENTER_OFFSET` map and helper:
- Per-hull screen-space pixel offsets (e.g., wasp: `{dx: -1, dy: 12}`)
- Default `{dx: 0, dy: 12}` for unknown hulls (isometric hulls have visual center above ground-contact)
- `getModularVisualCenterOffset(hullId)` helper function
- Applied offset in 4 places:
  - `syncVehicle()` — Arena per-frame sync (anchor computation)
  - `placeModularCombat()` — normal-runtime initial placement
  - `retryCleanModular()` — normal-runtime asset-retry
  - `updateDirection()` — normal-runtime direction update

**Fix 6**: Added modular barrel tip computation:
- `MODULAR_BARREL_LENGTH_PX` — per-weapon estimated barrel pixel lengths (smoky: 28, thunder: 32, railgun: 42, etc.)
- `DEFAULT_BARREL_LENGTH_PX = 24`
- `getModularBarrelTip(vehicleId, turretAngle)` — computes barrel tip from turret sprite position + turret angle + weapon barrel length
- `isUsingModularRender(vehicleId)` — checks if a vehicle has active modular sprites

### 4. `src/phaser/GameScene.ts` (Fix 6)

**Fix 6**: Replaced all 3 `computeProjectedBarrelTipScreenAtZ()` calls with `this.computeBarrelTip(vehicle)`:
- AI fire weapon callback (line ~725)
- Target-lock fire weapon callback (line ~759)
- Continuous fire tick (line ~796)

Added `computeBarrelTip()` private helper:
- Tries modular barrel tip first (when modular rendering is active)
- Falls back to blockout geometry barrel tip when modular is not active
- Accesses the modular adapter through `renderManager.getBlockoutVehicleRenderer()`

## Fix 5: No Code Changes

Fix 5 (turret tracking) requires no additional code changes. The primary issue was the visual turret direction being offset by -2 positions due to the missing +π/4 offset, which was already fixed in Fix 4 (committed in a prior PR). The turret tracking mechanism itself works correctly:
1. `updateArenaTurretAiming()` computes desired angle from turret mount to target
2. `rotateTurretToward()` rate-limits `vehicle.turretAngle` toward `vehicle.turretTargetAngle`
3. `blockoutToModularVisual()` correctly uses `vehicle.turretAngle` (not `turretTargetAngle`) for dir16 computation
4. The modular composition updates the turret texture immediately when dir16 changes

## Test Results

- All relevant unit tests pass (461 tests across 13 test files)
- TypeScript error count unchanged from before our changes (32 pre-existing errors from missing modules in sparse checkout)
- Pre-existing test failures in `modularLiveAdapter03a.test.ts` are from Fix 4's dir16 offset change (not introduced by our changes)
