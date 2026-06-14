# RUNTIME-03: Pilot Modular Turret Sprite Composition Report

**Date:** 2026-06-14
**Task:** RUNTIME-03 — Compose pilot modular hull and turret sprites
**Branch:** `runtime-03-pilot-turret-composition`
**Base:** `main` (retargeted from `runtime-02b-pilot-lazy-load-diagnostics`)
**Status:** Complete (fixup v3 — visual direction remap + GENERATED_TURRET_SCALE)

## Summary

Composed the first modular turret sprite (Smoky cyan m0) with the existing generated hull sprite (Wasp cyan m0) in the Arena/dev BlockoutVehicleRenderer using the proper pivot-on-socket attachment formula with visual direction remap from existing profile modules. The turret sprite replaces the procedural turret box when generated textures are available, while the barrel line and aim line remain as Graphics primitives for gameplay feedback.

## Changed Files

| File | Change |
|------|--------|
| `src/assets/pilotTurretComposition.ts` | NEW — Pure composition resolver (no Phaser imports, visual dir remap, GENERATED_TURRET_SCALE) |
| `src/phaser/render/BlockoutVehicleRenderer.ts` | MODIFIED — Turret sprite lifecycle, procedural guard, depth sort, cleanup |
| `src/__tests__/runtime03PilotTurretComposition.test.ts` | NEW — 37 tests across 12 sections |
| `docs/project/RUNTIME_03_PILOT_RENDERER_COMPOSITION_REPORT_2026_06_14.md` | This report |

## Partial Opus Work Resumed

No partial Opus changes were found in the repo. All RUNTIME-03 code was implemented from scratch. The initial version used same-center placement, which was rejected in PR review. Fixup v2 replaced it with pivot-on-socket composition. Fixup v3 adds visual direction remap and replaces legacy `turretProfile.textureScale` with `GENERATED_TURRET_SCALE`.

## Renderer Hook Location

The turret composition is hooked into `BlockoutVehicleRenderer.syncFromState()`, immediately after the hull sprite lifecycle block and before the selection/hover state determination. The resolver is called per vehicle per frame, with the renderer providing `scene.textures.exists` as the `textureExists` callback.

## Composition Formula (Pivot-on-Socket with Visual Direction Remap)

The turret sprite is positioned so its **pivot point** lands exactly on the **hull socket point**. This follows the PR-E1/PR-B attachment contract exactly. The Phaser sprite origin is always (0.5, 0.5); the attachment math produces a pixel offset applied to the centered sprite position.

### Step-by-step computation:

1. **Resolve hull visual profile** (`hullTurretVisualProfiles.ts`): provides hull texture scale, origin, placement offset, and socket definitions.

2. **Resolve hull socket metadata**: The socket `turret_main` on the Wasp hull has normalized position `{ nx: 0.5, ny: 0.5 }` (hull center).

3. **Resolve turret visual profile** (`hullTurretVisualProfiles.ts`): provides turret direction metadata (`{ dirCount, facingOffset }`) and `mountSocketId`. The turret has its own direction profile, NOT borrowed from the hull (closing audit RC-3).

4. **Compute visual direction remap**: The turret's authored sprite directions do not start at logical direction 0. The profile's `facingOffset` describes the rotation between logical and visual direction indices:
   ```
   logicalDir16 = turretAngleToDir16(turretAngle)
   dir16Offset = facingOffset * (16 / dirCount)
   visualDir16 = (logicalDir16 + dir16Offset) mod 16
   ```
   For Smoky: `dirCount = 8`, `facingOffset = 2` → `dir16Offset = 2 * (16/8) = 4`. So logical dir16 0 (E) → visual dir16 4 (S). This is equivalent to the hull's +4 offset in dir16 space (the hull profile has `dirCount = 16`, `facingOffset = 4`).

5. **Resolve directional turret pivot for visualDir16** (`directionalTurretProfiles.ts`): The pivot is resolved using the visual direction, ensuring the pivot data corresponds to the same sprite that will be displayed. For Smoky M0 visual dir16 4 (S): `{ x: 0.39428, y: 0.314321 }`.

6. **Compute hull socket screen point** from hull sprite position:
   ```
   socketFromSpritePos.x = (socket.nx - hullOrigin.x) * hullDisplayWidthPx
   socketFromSpritePos.y = (socket.ny - hullOrigin.y) * hullDisplayHeightPx
   ```

7. **Compute turret center-to-pivot offset** using `GENERATED_TURRET_SCALE` (0.12) for display size:
   ```
   pivotFromCenter.x = (pivot.x - 0.5) * turretDisplayWidthPx
   pivotFromCenter.y = (pivot.y - 0.5) * turretDisplayHeightPx
   ```

8. **Place turret sprite center so turret pivot lands on hull socket**:
   ```
   turretOffsetPx.x = socketFromSpritePos.x - pivotFromCenter.x
   turretOffsetPx.y = socketFromSpritePos.y - pivotFromCenter.y
   turretSpritePos = hullSpritePos + turretOffsetPx
   ```

### Visual direction remap details:

The visual direction remap is critical for correct sprite selection. Without it, the resolver would use raw `logicalDir16` for both texture lookup and pivot resolution, producing a mismatch between the displayed sprite and its attachment data. For example, Smoky angle 0 (logical dir16 0) would show the dir00 (E) sprite but compute attachment using the dir00 pivot — but the actual sprite content at dir00 shows the turret facing a different direction than the hull is pointing, because the authored sprite family has a facing offset of 2 in dir8 space.

The remap converts the turret profile's dir8-facing offset into dir16 space using `facingOffset * (16 / dirCount)`, then applies it to the logical direction. This produces a `visualDir16` that is used for BOTH the texture key lookup AND the pivot resolution, guaranteeing that the displayed sprite and its attachment data correspond to the same authored direction.

### Key properties:

- The turret sprite origin is always (0.5, 0.5) — the offset math does NOT re-originate the sprite.
- The offset changes per direction because the pivot position varies per visualDir16.
- `visualDir16` is used for both texture key and pivot resolution — never `logicalDir16` alone.
- No manual per-PNG offset tuning — all offsets are derived from projection-recovered profile data.
- The formula is identical to `computeTurretSpriteCenterOffsetForSocket` in `turretAttachmentMath.ts`, adapted for the renderer's hull-sprite-relative coordinate system.
- Display sizes use `HULL_IMAGE_SIZE` and `TURRET_IMAGE_SIZE` from `generatedVehicleMetadata.ts` (both 512×512), not local constants.

### Modules consumed:

| Module | What it provides |
|--------|-----------------|
| `hullTurretVisualProfiles.ts` | Hull visual profile, socket metadata, turret visual profile (with direction metadata) |
| `directionalTurretProfiles.ts` | Per-dir16 turret pivot positions (projection-recovered), `normalizeDir16` |
| `turretAttachmentMath.ts` | PixelOffset type (shared) |
| `generatedVehicleMetadata.ts` | `HULL_IMAGE_SIZE`, `TURRET_IMAGE_SIZE` (512×512) |
| `generatedTurretAssets.ts` | Texture key builder, turret angle quantization, `GENERATED_TURRET_SCALE` |
| `generatedHullAssets.ts` | Hull ID resolver, mod level converter |

### Generated turret scale:

Generated turret sprites use `GENERATED_TURRET_SCALE` (0.12) from `generatedTurretAssets.ts`, NOT the legacy `turretProfile.textureScale` (0.24 = `MODULAR_RENDER_SCALE`). The legacy scale is for old-style procedural/texture-atlas turrets. Generated sprites are 512×512 at 0.12, the same scale regime as hulls. Using the legacy scale would double the turret display size, causing severe visual misplacement.

**Procedural turret guard:** When a generated turret sprite is active (`hasGenTurret === true`), the procedural turret box (side faces, top face, outline) is skipped. The barrel line and aim line are always drawn because they provide essential gameplay feedback.

## Fallback Behavior

| Condition | Result |
|-----------|--------|
| Weapon has no generated turret assets (e.g. shaft) | `hasGeneratedTurret = false`, `turretOffsetPx = null`, procedural turret drawn |
| Body is not a supported hull (e.g. unsupported_body) | `hasGeneratedTurret = false`, `turretOffsetPx = null`, procedural turret drawn |
| Hull has no visual profile (e.g. mammoth) | `hasGeneratedTurret = false`, `turretOffsetPx = null`, procedural turret drawn |
| Hull profile exists but socket metadata missing | `hasGeneratedTurret = false`, `turretOffsetPx = null`, procedural turret drawn |
| Directional pivot metadata missing for weapon | `hasGeneratedTurret = false`, `turretOffsetPx = null`, procedural turret drawn |
| Turret texture for resolved visual direction does not exist | `hasGeneratedTurret = false`, offset still computed (for diagnostics) |
| Standard (non-Arena) mode | No turret textures loaded, always falls back to procedural |

## socket.zHeight Status

**Deferred as visual QA risk.** The socket's `zHeight` field (0.30 on Wasp's `turret_main`) is NOT used for sprite Y placement. The turret sprite is placed at ground-plane screen Y (same as hull center) with the X/Y offset computed from the pivot-on-socket formula. This means the turret may appear to sit at ground level rather than elevated to the hull top. When zHeight-based turret placement is validated, this can be upgraded to use `projectWorldPoint` with `BLOCKOUT_VEHICLE_BODY_Z`. No magic Y offsets were invented.

## Turret Sprite Lifecycle

1. **Created** when `resolvePilotTurretComposition` returns `hasGeneratedTurret = true` and no sprite exists for the vehicle ID
2. **Updated** (texture swapped + position recalculated) when the turret direction changes (every frame during rotation)
3. **Destroyed** when:
   - The vehicle becomes unsupported (bodyId or weaponId no longer maps to generated assets)
   - The turret texture for the current visual direction is missing
   - The socket or pivot metadata becomes unavailable
   - The vehicle is stale (removed from active vehicles)
   - The renderer's `destroy()` method is called (full cleanup)

## Tests Added

37 tests in `src/__tests__/runtime03PilotTurretComposition.test.ts`:

| Section | Tests | What's verified |
|---------|-------|----------------|
| Visual direction remap | 7 | Smoky angle 0→visualDir16 4, PI/2→8, PI→12; texture key uses visual dir16; textureExists probes visual-dir16 key; dir00-only miss; pivot resolved for visual dir16 |
| Pivot lands on socket | 4 | Non-null offset, not same-center, varies per dir, matches manual math |
| Texture missing → null | 3 | No texture, partial texture (visual dir missing), offset still computed |
| Socket metadata missing | 2 | Unsupported hull, empty bodyId |
| Directional pivot missing | 2 | Unsupported weapon, unknown weapon |
| Exactly one textureExists probe | 5 | Once on hit, once on miss, zero for unsupported, visual-dir16 key received |
| Unsupported weapon/body fallback | 4 | mammoth no profile, thunder no pivot, flamethrower no pivot |
| Pure placement math | 2 | dir16 quantization, negative angles |
| Generated turret scale | 3 | scale = GENERATED_TURRET_SCALE, fallback uses same, manual math uses 512*0.12 |
| Result structure | 3 | Correct keys/visualDir16, origin always centered, mod level |
| Standard mode safety | 2 | No side effects, fallback |
| No accidental path strings | 1 | No absolute paths in turretKey |

## Validation Results

| Check | Result |
|-------|--------|
| `npm run typecheck` | PASS — Clean |
| `npm run test` | PASS — all tests, 0 failures |
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
- Display size from `GENERATED_TURRET_SCALE` × `TURRET_IMAGE_SIZE` (0.12 × 512×512)
- Visual direction remap from turret profile `{ dirCount, facingOffset }`

No manual per-direction or per-PNG offset values were created or tuned. The profile data is the single source of truth. No legacy `turretProfile.textureScale` (0.24) is used for generated turret sprites — only `GENERATED_TURRET_SCALE` (0.12).

## Known Visual QA Risks

1. **socket.zHeight not used:** The turret sprite is placed at ground-plane Y. The turret may appear to sit at ground level rather than elevated to the hull top. This is deferred to visual QA.

2. **Barrel line visibility:** The barrel line is always drawn on top of the turret sprite. For some turret types, this may look redundant (the sprite already shows a barrel). Visual QA needed to determine if the barrel line should be hidden when a generated turret is active.

3. **Profile data accuracy:** The directional pivot data was projection-recovered from the 3DS source model. If the generated PNG rendering pipeline differs from the projection recovery assumptions, the pivot positions may not align perfectly with the actual sprite content. Visual QA needed.
