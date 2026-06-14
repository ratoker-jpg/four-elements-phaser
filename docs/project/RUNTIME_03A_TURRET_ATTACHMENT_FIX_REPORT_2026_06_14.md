# RUNTIME-03A: Fix Pilot Turret Attachment Height and Hull Anchoring

**Date:** 2026-06-14
**Task:** RUNTIME-03A — Fix pilot turret visual attachment after manual QA
**Branch:** `runtime-03a-turret-attachment-fix`
**Base:** `main`
**Status:** Complete

## Summary

Fixed the pilot Wasp+Smoky generated turret attachment so the turret visually sits on the Wasp hull instead of appearing offset/down/front. Two root causes were identified and fixed:

1. **Turret positioned from recomputed hull position instead of actual hullSprite.x/y** — The turret sprite was positioned in `syncFromState()` using `vehicle.worldX + offset + placement + impulse`, but the hull sprite is positioned in `renderVehicle()` with additional offsets (Wasp debug placement, etc.). The turret never saw the actual hull sprite position, causing a persistent offset.

2. **socket.zHeight not applied** — The turret was placed at ground-plane screen Y, but the Wasp hull's `turret_main` socket has `zHeight = 0.30`. This means the turret mount point is 0.30 world units above ground, which projects to approximately -18 pixels upward on screen (via `basisZ.y = -60`). Without this elevation, the turret appeared at ground level.

## Changed Files

| File | Change |
|------|--------|
| `src/assets/pilotTurretComposition.ts` | MODIFIED — Added `socketZHeight` field to result, exposing socket zHeight for renderer projection |
| `src/phaser/render/BlockoutVehicleRenderer.ts` | MODIFIED — Turret positioning moved to `renderVehicle()` after hull sprite placement; uses `hullSprite.x/y` as base; applies zHeight via `projectWorldPoint` |
| `src/__tests__/runtime03PilotTurretComposition.test.ts` | MODIFIED — Added 6 tests for socket zHeight and no manual offset constants |
| `docs/project/RUNTIME_03A_TURRET_ATTACHMENT_FIX_REPORT_2026_06_14.md` | This report |

## Root Cause Fixed

**Root Cause #1 (Primary): Turret positioned from recomputed coordinates, not actual hull sprite position.**

The turret sprite was positioned in `syncFromState()` (lines 422-446) using:
```
hullCx = vehicle.worldX + this.offset.x + bodyImpulseX
hullCy = vehicle.worldY + this.offset.y + bodyImpulseY
// + placement offset
```

But the hull sprite was positioned in `renderVehicle()` (lines 644-660) using the same formula PLUS the Wasp debug placement offset (`getWaspDebugOffsetX/Y`). The turret never received the debug offset or any other future additions to the hull sprite position. This caused the turret to drift from the hull whenever the hull sprite was offset from the "expected" position.

**Fix:** Moved turret positioning into `renderVehicle()`, immediately after `hullSprite.setPosition(...)`. The turret now uses `hullSprite.x` and `hullSprite.y` as its base position, which automatically includes all offsets and adjustments applied to the hull.

**Root Cause #2: socket.zHeight = 0.30 was deferred and not applied.**

The Wasp hull's `turret_main` socket has `zHeight = 0.30`, meaning the mount point is 0.30 world units above ground. In the isometric projection, `basisZ = { x: 0, y: -60 }`, so 0.30 world units of height projects to `0.30 × -60 = -18` pixels upward on screen. Without this elevation, the turret was placed at ground-plane Y, visually "below" where the hull top is.

**Fix:** The pure composition resolver now exposes `socketZHeight` in its result. The renderer applies it through the existing `projectWorldPoint` helper:
```
hullTilePos = unprojectScreenToGround(hullSprite.x, hullSprite.y, offset)
groundProj = projectWorldPoint(hullTilePos.x, hullTilePos.y, 0, offset)
elevatedProj = projectWorldPoint(hullTilePos.x, hullTilePos.y, socketZHeight, offset)
zHeightScreenDeltaY = elevatedProj.y - groundProj.y
```

This is a safe projection path — `projectWorldPoint` is the same helper used for debug labels, selection rings, HP bars, and all other height-projected elements. No magic Y offsets were invented.

## Whether socket.zHeight Is Now Used

**Yes.** `socket.zHeight = 0.30` is now applied through `projectWorldPoint`. The resolver exposes it as `socketZHeight: number | null` in the result. The renderer computes the z-height screen delta and adds it to the turret's Y position.

If `socketZHeight` is `null` (unsupported hull, missing socket metadata), the z-height delta defaults to 0 (ground plane), preserving the existing fallback behavior.

## How Actual HullSprite Position Is Used

The turret positioning now occurs in `renderVehicle()`, immediately after the hull sprite has been positioned:

```typescript
// In renderVehicle(), after hullSprite.setPosition(spriteCx, spriteCy):
const turretSprite = this.vehicleTurretSprites.get(vehicle.id);
const turretComp = this.vehicleTurretComp.get(vehicle.id);
if (turretSprite && turretComp?.turretOffsetPx && hullSprite) {
  const hullSpriteX = hullSprite.x;
  const hullSpriteY = hullSprite.y;

  // zHeight projection via projectWorldPoint
  let zHeightScreenDeltaY = 0;
  if (turretComp.socketZHeight !== null && turretComp.socketZHeight > 0) {
    const hullTilePos = unprojectScreenToGround(hullSpriteX, hullSpriteY, this.offset);
    const groundProj = projectWorldPoint(hullTilePos.x, hullTilePos.y, 0, this.offset);
    const elevatedProj = projectWorldPoint(hullTilePos.x, hullTilePos.y, turretComp.socketZHeight, this.offset);
    zHeightScreenDeltaY = elevatedProj.y - groundProj.y;
  }

  const turretCx = hullSpriteX + turretComp.turretOffsetPx.x;
  const turretCy = hullSpriteY + turretComp.turretOffsetPx.y + zHeightScreenDeltaY;
  turretSprite.setPosition(turretCx, turretCy);
}
```

Key properties:
- Uses `hullSprite.x/y` directly — no recomputation from vehicle.worldX
- Automatically includes all offsets (placement, debug calibration, etc.)
- zHeight projected through `projectWorldPoint` — no manual Y offset
- Still uses the pure resolver's `turretOffsetPx` for pivot-on-socket math

## Tests Added

6 new tests (total: 44 in the file):

| Section | Tests | What's verified |
|---------|-------|----------------|
| Socket zHeight | 5 | Wasp zHeight=0.30 exposed; null for unsupported hull; null for unsupported weapon; exposed even when texture missing; zHeight * basisZ.y matches expected screen delta |
| No manual offset constants | 1 | Turret offset derived from formula, not hardcoded |

## Validation Results

| Check | Result |
|-------|--------|
| `npm run typecheck` | PASS — Clean |
| `npm run test` | PASS — 4446 tests (83 files), 0 failures |
| `npm run build` | PASS — Production build succeeds |
| `npm run qa:smoke` | PASS — 2/2 modes (standard + devtools) |

## Manual QA Notes

**Required:** Open Arena/devtools and verify:
- Wasp+Smoky cyan m0 turret sits on the hull top (elevated by zHeight=0.30)
- Turret rotates without drifting far away from mount
- Selection ring / HP / target-lock visuals still work
- Fallback still works if turret texture missing
- No duplicate procedural turret appears under/over the generated turret

The zHeight projection uses `basisZ.y = -60`, which gives ~18 pixels of upward shift for the Wasp's 0.30 z-height. If this is visually too much or too little, the `zHeight` value in `WASP_HULL_VISUAL_PROFILE.sockets[0].zHeight` should be adjusted — NOT by adding manual pixel offsets to the renderer.

## Forbidden Areas Untouched

| Forbidden Area | Status |
|----------------|--------|
| public/assets changes | Untouched |
| New PNG/assets | None added |
| generatedAssetManifest.ts | Not created/modified |
| Combat changes | None |
| Movement changes | None |
| Economy changes | None |
| Mapgen changes | None |
| Save/load changes | None |
| New URL flags | None |
| PR #263 continuation | None |
| Hand-tuned Smoky/Wasp offset constants | None — zHeight from profile, offset from formula |
| Broad renderer rewrite | None — targeted turret positioning fix only |
| CAMERA_PROJECTION_CONTRACT changes | None — uses existing `projectWorldPoint` |
| Telegram config/tokens/secrets in git | None |
