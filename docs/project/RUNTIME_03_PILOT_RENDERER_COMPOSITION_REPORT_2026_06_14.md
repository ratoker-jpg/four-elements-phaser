# RUNTIME-03: Pilot Modular Turret Sprite Composition Report

**Date:** 2026-06-14
**Task:** RUNTIME-03 — Compose pilot modular hull and turret sprites
**Branch:** `runtime-03-pilot-turret-composition`
**Status:** Complete

## Summary

Composed the first modular turret sprite (Smoky cyan m0) with the existing generated hull sprite (Wasp cyan m0) in the Arena/dev BlockoutVehicleRenderer. The turret sprite replaces the procedural turret box when generated textures are available, while the barrel line and aim line remain as Graphics primitives for gameplay feedback.

## Changed Files

| File | Change |
|------|--------|
| `src/assets/pilotTurretComposition.ts` | NEW — Pure composition resolver (no Phaser imports) |
| `src/phaser/render/BlockoutVehicleRenderer.ts` | MODIFIED — Turret sprite lifecycle, procedural guard, depth sort, cleanup |
| `src/__tests__/runtime03PilotTurretComposition.test.ts` | NEW — 31 tests across 9 sections |

## Partial Opus Work Resumed

No partial Opus changes were found in the repo. The branch `runtime-03-pilot-turret-composition` was created from `runtime-02b-pilot-lazy-load-diagnostics` and all RUNTIME-03 code was implemented from scratch following the task specification.

## Renderer Hook Location

The turret composition is hooked into `BlockoutVehicleRenderer.syncFromState()`, immediately after the hull sprite lifecycle block and before the selection/hover state determination. The resolver is called per vehicle per frame, with the renderer providing `scene.textures.exists` as the `textureExists` callback.

## Composition Formula

The turret sprite is placed at the **same screen position as the hull sprite center** (vehicle world position + map offset + body recoil impulse + per-hull placement offset). This works because:

1. Both hull and turret are 512x512 sprites rendered at the same scale (0.12)
2. The turret's visual center within the sprite aligns with the mount point at the default scale
3. The turret direction is independent of hull direction — turrets use the full 16-direction set quantized from `turretAngle`, while hulls use 8 directions doubled to 16 with per-hull visual remap

**Procedural turret guard:** When a generated turret sprite is active (`hasGenTurret === true`), the procedural turret box (side faces, top face, outline) is skipped. The barrel line and aim line are always drawn because they provide essential gameplay feedback.

## Fallback Behavior

| Condition | Result |
|-----------|--------|
| Weapon has no generated turret assets (e.g. shaft) | `hasGeneratedTurret = false`, procedural turret drawn |
| Body is not a supported hull (e.g. unsupported_body) | `hasGeneratedTurret = false`, procedural turret drawn |
| Turret texture for resolved direction does not exist | `hasGeneratedTurret = false`, procedural turret drawn |
| Hull texture missing (no generated hull) | Hull falls back to blockout body, turret also falls back (body check fails) |
| Standard (non-Arena) mode | No turret textures loaded, always falls back to procedural |

## socket.zHeight Status

**Deferred.** The turret sprite is placed at the same screen Y as the hull sprite, which is a flat ground-plane placement. This means the turret may appear to sit at ground level rather than on top of the hull body. When zHeight-based turret placement is validated, this can be upgraded to use `projectWorldPoint` with `BLOCKOUT_VEHICLE_BODY_Z`. No magic Y offsets were invented.

## Turret Sprite Lifecycle

1. **Created** when `resolvePilotTurretComposition` returns `hasGeneratedTurret = true` and no sprite exists for the vehicle ID
2. **Updated** (texture swapped) when the turret direction changes (every frame during rotation)
3. **Destroyed** when:
   - The vehicle becomes unsupported (bodyId or weaponId no longer maps to generated assets)
   - The turret texture for the current direction is missing
   - The vehicle is stale (removed from active vehicles)
   - The renderer's `destroy()` method is called (full cleanup)

## Tests Added

31 tests in `src/__tests__/runtime03PilotTurretComposition.test.ts`:

| Section | Tests | What's verified |
|---------|-------|----------------|
| Pure placement math | 4 | dir16 quantization, negative angles, 2PI wrap |
| Texture missing → null | 3 | No texture, partial texture, diagnostic dir16 |
| Unsupported weapon → null | 2 | shaft, unknown weapon ID |
| Unsupported body → null | 3 | unsupported_body, empty string, mammoth-is-supported |
| Smoky direction remap stable | 3 | All 16 dirs reachable, independent of hull, idempotent |
| Exactly one textureExists probe | 4 | Once on hit, once on miss, zero for unsupported weapon/body |
| Result structure | 4 | Correct keys, params, mod level, faction |
| Standard mode safety | 3 | No side effects, read-only callback, fallback |
| Pilot scope limit | 4 | Pilot combo, other weapons, other hulls, flamethrower→firebird |
| No accidental path strings | 1 | No absolute paths in turretKey |

## Validation Results

| Check | Result |
|-------|--------|
| `npm run typecheck` | PASS — Clean |
| `npm run test` | PASS — 4433 tests (83 files), 0 failures |
| `npm run build` | PASS — Production build succeeds |

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
| Manual Smoky offset tuning | None |
| CAMERA_PROJECTION_CONTRACT changes | None |
| Broad renderer rewrite | None — only targeted additions |

## Known Visual QA Risks

1. **Turret sprite ground-plane placement:** The turret sprite is placed at the same screen position as the hull sprite center. Without zHeight projection, the turret may appear to sit at ground level rather than on top of the hull body. This is a known limitation deferred to visual QA.

2. **Turret origin point:** The turret sprite uses `originX=0.5, originY=0.5` (center). This may not perfectly align with the actual turret visual center in the 512x512 sprite. Per-turret origin tuning may be needed after visual QA.

3. **Turret scale:** The turret uses the same scale as the hull (0.12). Some turrets may appear too large or too small relative to their hull. Per-turret scale tuning may be needed after visual QA.

4. **Barrel line visibility:** The barrel line is always drawn on top of the turret sprite. For some turret types, this may look redundant (the sprite already shows a barrel). Visual QA needed to determine if the barrel line should be hidden when a generated turret is active.
