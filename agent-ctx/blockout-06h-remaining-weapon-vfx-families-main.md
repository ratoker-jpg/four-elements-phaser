# BLOCKOUT-06H+ — Remaining weapon VFX families

## Task Summary
Implemented visual-only VFX for 8 remaining weapon families (Shaft, Flamethrower, Freeze, Isida, Vulcan, Twins, Ricochet, Hammer) on top of existing Smoky/Railgun/Thunder implementation.

## Files Modified

### 1. `src/config/blockoutProfiles.ts`
- Added 6 optional fields to `VfxProfile` interface: `coneAngleDeg`, `bounceCount`, `pelletCount`, `streamCadenceMs`, `overheatDurationMs`, `chargePulseMs`

### 2. `src/config/blockoutVfxData.ts`
- Added BLOCKOUT-06H+ fields to all 7 weapon behavior VFX profiles:
  - `charge_sniper`: coneAngleDeg:0, chargePulseMs:150, muzzleFlashRadiusPx:4
  - `cone_stream`: coneAngleDeg:25, streamCadenceMs:50
  - `beam_support`: streamCadenceMs:50
  - `rapid_fire_overheat`: streamCadenceMs:60, overheatDurationMs:3000
  - `plasma_projectile`: muzzleFlashRadiusPx:3
  - `ricochet_projectile`: bounceCount:2
  - `shotgun_cone`: coneAngleDeg:30, pelletCount:5

### 3. `src/config/blockoutWeaponData.ts`
- Fixed pre-existing bug: Vulcan's `vfxProfile` was `'rapid_fire'` but the key in VFX_PROFILES is `'rapid_fire_overheat'`

### 4. `src/state/blockoutVehicleState.ts`
- Added 4 new fields to `BlockoutVehicleState`: `fireHeld`, `isFiring`, `lastStreamTickAt`, `visualOverheat`
- Updated `createBlockoutVehicle()` to initialize these fields

### 5. `src/state/types.ts`
- Added the 4 new BLOCKOUT-06H+ fields to the inline `blockoutVehicles` type in `GameState`

### 6. `src/state/blockoutWeaponVfx.ts`
- Extended `VfxEventType` to include all 11 weapon event types
- Extended `BlockoutWeaponVfxEvent` with `coneAngleDeg`, `bounceCount`, `pelletCount` fields
- Updated `getVfxEventType()` to map all 11 weapons (removed `default: return null`)
- Updated `fireBlockoutWeapon()` to include new fields in events
- Added `isContinuousWeapon()`, `startFiring()`, `stopFiring()`, `tickContinuousFire()` functions

### 7. `src/phaser/input/BlockoutVehicleInputController.ts`
- Added `boundKeyup` handler with `onKeyup` method
- Modified `onKeydown` to call `startFiring(selected)` after firing
- Added `onKeyup` to call `stopFiring(selected)` on key release
- Added public `mouseWorldX`/`mouseWorldY` accessors
- Updated `destroy()` to unregister keyup listener

### 8. `src/phaser/GameScene.ts`
- Added `TURRET_SIZE_W` constant
- Imported `tickContinuousFire`, `computeTurretWorldOrigin`, `getWeaponProfile`
- Added continuous fire tick loop in `update()` for stream weapons

### 9. `src/phaser/render/BlockoutWeaponVfxRenderer.ts`
- Added 8 new render methods with distinct visual effects:
  - **shaftLine**: Charge pulse circle + thin bright line + crosshair at end
  - **flamethrowerCone**: Orange cone with flicker + inner yellow cone + muzzle glow
  - **freezeCone**: Cyan cone + inner blue cone + frost circles + muzzle glow
  - **isidaBeam**: Green pulsing beam + glow line + tether dots at origin/end
  - **vulcanTracer**: Short rapid tracer line + small muzzle flash
  - **twinsPlasma**: Moving plasma dot with glow + trail
  - **ricochetBounce**: Segmented path with deterministic bounces + bounce point markers
  - **hammerShotgun**: Fan of pellet tracers within cone + impact dots + muzzle flash

### 10. `src/__tests__/blockoutWeaponVfx.test.ts`
- Completely rewritten with BLOCKOUT-06H+ tests (100 tests total)
- Tests for all 11 weapons: VFX config, event type creation, recoil, cooldown
- Tests for continuous weapon identification
- Tests for startFiring/stopFiring state management
- Tests for tickContinuousFire cadence, cooldown, and scene-time
- Tests for BLOCKOUT-06H+ event fields (coneAngleDeg, bounceCount, pelletCount)
- Tests for vehicle state initialization with new fields
- Tests for movement not erasing firing state

## Verification
- `npm run typecheck` ✅
- `npm run test` ✅ (1238 tests, all pass including 100 in blockoutWeaponVfx.test.ts)
- `npm run build` ✅
