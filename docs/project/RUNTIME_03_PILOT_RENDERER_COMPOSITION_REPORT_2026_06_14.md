# RUNTIME-03: Pilot Modular Turret Sprite Composition Report

**Date:** 2026-06-14
**Task:** RUNTIME-03 — Compose pilot modular hull and turret sprites
**Branch:** `runtime-03-pilot-turret-composition`
**Base:** `main` (retargeted from `runtime-02b-pilot-lazy-load-diagnostics`)
**Status:** Complete (fixup v2 — pivot-on-socket composition)

## Summary

Composed the first modular turret sprite (Smoky cyan m0) with the existing generated hull sprite (Wasp cyan m0) in the Arena/dev BlockoutVehicleRenderer using the proper pivot-on-socket attachment formula from existing profile modules. The turret sprite replaces the procedural turret box when generated textures are available, while the barrel line and aim line remain as Graphics primitives for gameplay feedback.

## Changed Files

| File | Change |
|------|--------|
| `src/assets/pilotTurretComposition.ts` | NEW — Pure composition resolver (no Phaser imports) |
| `src/phaser/render/BlockoutVehicleRenderer.ts` | MODIFIED — Turret sprite lifecycle, procedural guard, depth sort, cleanup |
| `src/__tests__/runtime03PilotTurretComposition.test.ts` | NEW — 27 tests across 10 sections |

## Partial Opus Work Resumed

No partial Opus changes were found in the repo. All RUNTIME-03 code was implemented from scratch. The initial version used same-center placement, which was rejected in PR review. This fixup (v2) replaces it with the proper pivot-on-socket formula using existing profile modules.

## Renderer Hook Location

The turret composition is hooked into `BlockoutVehicleRenderer.syncFromState()`, immediately after the hull sprite lifecycle block and before the selection/hover state determination. The resolver is called per vehicle per frame, with the renderer providing `scene.textures.exists` as the `textureExists` callback.

## Composition Formula (Pivot-on-Socket)

The turret sprite is positioned so its **pivot point** lands exactly on the **hull socket point**. This follows the PR-E1/PR-B attachment contract exactly. The Phaser sprite origin is always (0.5, 0.5); the attachment math produces a pixel offset applied to the centered sprite position.

### Step-by-step computation:

1. **Resolve hull visual profile** (`hullTurretVisualProfiles.ts`): provides hull texture scale, origin, placement offset, and socket definitions.

2. **Resolve hull socket metadata**: The socket `turret_main` on the Wasp hull has normalized position `{ nx: 0.5, ny: 0.5 }` (hull center).

3. **Resolve turret visual profile** (`hullTurretVisualProfiles.ts`): provides turret texture scale and `mountSocketId`.

4. **Resolve directional turret pivot** (`directionalTurretProfiles.ts`): For each dir16, the Smoky turret has a different pivot position (projection-recovered from the 3DS model). E.g., dir00 (E): `{ x: 0.206668, y: 0.464846 }`.

5. **Compute hull socket screen point** from hull sprite position:
   ```
   socketFromSpritePos.x = (socket.nx - hullOrigin.x) * hullDisplayWidthPx
   socketFromSpritePos.y = (socket.ny - hullOrigin.y) * hullDisplayHeightPx
   ```

6. **Compute turret center-to-pivot offset**:
   ```
   pivotFromCenter.x = (pivot.x - 0.5) * turretDisplayWidthPx
   pivotFromCenter.y = (pivot.y - 0.5) * turretDisplayHeightPx
   ```

7. **Place turret sprite center so turret pivot lands on hull socket**:
   ```
   turretOffsetPx.x = socketFromSpritePos.x - pivotFromCenter.x
   turretOffsetPx.y = socketFromSpritePos.y - pivotFromCenter.y
   turretSpritePos = hullSpritePos + turretOffsetPx
   ```

### Key properties:

- The turret sprite origin is always (0.5, 0.5) — the offset math does NOT re-originate the sprite.
- The offset changes per direction because the pivot position varies per dir16.
- No manual per-PNG offset tuning — all offsets are derived from projection-recovered profile data.
- The formula is identical to `computeTurretSpriteCenterOffsetForSocket` in `turretAttachmentMath.ts`, adapted for the renderer's hull-sprite-relative coordinate system.

### Modules consumed:

| Module | What it provides |
|--------|-----------------|
| `hullTurretVisualProfiles.ts` | Hull visual profile, socket metadata, turret visual profile |
| `directionalTurretProfiles.ts` | Per-dir16 turret pivot positions (projection-recovered) |
| `turretAttachmentMath.ts` | PixelOffset type (shared) |
| `generatedVehicleMetadata.ts` | Image size constants (512×512) |
| `generatedTurretAssets.ts` | Texture key builder, turret angle quantization |
| `generatedHullAssets.ts` | Hull ID resolver, mod level converter |

**Procedural turret guard:** When a generated turret sprite is active (`hasGenTurret === true`), the procedural turret box (side faces, top face, outline) is skipped. The barrel line and aim line are always drawn because they provide essential gameplay feedback.

## Fallback Behavior

| Condition | Result |
|-----------|--------|
| Weapon has no generated turret assets (e.g. shaft) | `hasGeneratedTurret = false`, `turretOffsetPx = null`, procedural turret drawn |
| Body is not a supported hull (e.g. unsupported_body) | `hasGeneratedTurret = false`, `turretOffsetPx = null`, procedural turret drawn |
| Hull has no visual profile (e.g. mammoth) | `hasGeneratedTurret = false`, `turretOffsetPx = null`, procedural turret drawn |
| Hull profile exists but socket metadata missing | `hasGeneratedTurret = false`, `turretOffsetPx = null`, procedural turret drawn |
| Directional pivot metadata missing for weapon | `hasGeneratedTurret = false`, `turretOffsetPx = null`, procedural turret drawn |
| Turret texture for resolved direction does not exist | `hasGeneratedTurret = false`, offset still computed (for diagnostics) |
| Standard (non-Arena) mode | No turret textures loaded, always falls back to procedural |

## socket.zHeight Status

**Deferred.** The socket's `zHeight` field (0.30 on Wasp's `turret_main`) is NOT used for sprite Y placement. The turret sprite is placed at ground-plane screen Y (same as hull center) with the X/Y offset computed from the pivot-on-socket formula. This means the turret may appear to sit at ground level rather than elevated to the hull top. When zHeight-based turret placement is validated, this can be upgraded to use `projectWorldPoint` with `BLOCKOUT_VEHICLE_BODY_Z`. No magic Y offsets were invented.

## Turret Sprite Lifecycle

1. **Created** when `resolvePilotTurretComposition` returns `hasGeneratedTurret = true` and no sprite exists for the vehicle ID
2. **Updated** (texture swapped + position recalculated) when the turret direction changes (every frame during rotation)
3. **Destroyed** when:
   - The vehicle becomes unsupported (bodyId or weaponId no longer maps to generated assets)
   - The turret texture for the current direction is missing
   - The socket or pivot metadata becomes unavailable
   - The vehicle is stale (removed from active vehicles)
   - The renderer's `destroy()` method is called (full cleanup)

## Tests Added

27 tests in `src/__tests__/runtime03PilotTurretComposition.test.ts`:

| Section | Tests | What's verified |
|---------|-------|----------------|
| Pivot lands on socket | 4 | Non-null offset, not same-center, varies per dir, matches manual math |
| Texture missing → null | 3 | No texture, partial texture, offset still computed |
| Socket metadata missing | 2 | Unsupported hull, empty bodyId |
| Directional pivot missing | 2 | Unsupported weapon, unknown weapon |
| Exactly one textureExists probe | 4 | Once on hit, once on miss, zero for unsupported weapon/body |
| Unsupported weapon/body fallback | 4 | mammoth no profile, thunder no pivot, flamethrower no pivot |
| Pure placement math | 2 | dir16 quantization, negative angles |
| Result structure | 3 | Correct keys, origin always centered, mod level |
| Standard mode safety | 2 | No side effects, fallback |
| No accidental path strings | 1 | No absolute paths in turretKey |

## Validation Results

| Check | Result |
|-------|--------|
| `npm run typecheck` | PASS — Clean |
| `npm run test` | PASS — 4429 tests (83 files), 0 failures |
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
| Manual Smoky offset tuning | None — all offsets derived from profile data |
| CAMERA_PROJECTION_CONTRACT changes | None |
| Broad renderer rewrite | None — only targeted additions |

## No Manual Per-PNG Offset Tuning

All turret placement offsets are computed from:
- Hull socket normalized position (from `hullTurretVisualProfiles.ts`)
- Turret directional pivot positions (from `directionalTurretProfiles.ts`, projection-recovered)
- Display size from texture scale × source image size (512×512)

No manual per-direction or per-PNG offset values were created or tuned. The profile data is the single source of truth.

## Known Visual QA Risks

1. **socket.zHeight not used:** The turret sprite is placed at ground-plane Y. The turret may appear to sit at ground level rather than elevated to the hull top. This is deferred to visual QA.

2. **Turret profile textureScale mismatch:** The Smoky turret visual profile stores `textureScale = 0.24` (legacy `MODULAR_RENDER_SCALE`), but generated turret sprites are designed for scale 0.12. The resolver uses the profile's textureScale for display size computation. This may cause the turret to appear at the wrong size relative to the hull. Visual QA needed to confirm whether the turret profile should use 0.12 for generated sprites.

3. **Barrel line visibility:** The barrel line is always drawn on top of the turret sprite. For some turret types, this may look redundant (the sprite already shows a barrel). Visual QA needed to determine if the barrel line should be hidden when a generated turret is active.

4. **Profile data accuracy:** The directional pivot data was projection-recovered from the 3DS source model. If the generated PNG rendering pipeline differs from the projection recovery assumptions, the pivot positions may not align perfectly with the actual sprite content. Visual QA needed.
