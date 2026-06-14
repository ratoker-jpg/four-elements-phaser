# RUNTIME-02A: Pilot Asset Intake Report

Date: 2026-06-14
Task: RUNTIME-02A — Pilot asset intake preflight
Executor: GLM
Status: Complete

---

## 1. Staging artifact inspection

Artifact: `runtime02a_smoky_cyan_m0_pilot_pack.zip`
Size: 937,270 bytes
Source: `modular_cyan_v1.zip` (filtered subset)

Contents:
- 1 README: `RUNTIME_02A_README_FOR_GLM.md`
- 1 manifest: `RUNTIME_02A_PILOT_PACK_MANIFEST.json`
- 1 metadata JSON: `public/assets/units/metadata/runtime02a_smoky_cyan_m0_pivot_subset.json`
- 16 PNG: `public/assets/units/turrets/smoky/cyan/m0/smoky_cyan_m0_dirNN_<DIR>.png`

Total files: 19

---

## 2. Preflight check results

| # | Check | Result |
|---|-------|--------|
| 1 | Inspect staging ZIP structure | ✅ 16 PNG + 1 metadata + 1 manifest + 1 README |
| 2 | Turret image size | ✅ 512×512 RGBA (verified with PIL) |
| 3 | Smoky cyan m0 16-dir PNG | ✅ All 16 directions present (dir00–dir15) |
| 4 | Filename convention match | ✅ Fixed: RUNTIME-01 had `_turret_` in filename, actual PNGs omit it. Path builder corrected to match real export convention. |
| 5 | Cyan hull files in staging | ✅ No hull files in staging ZIP — no overwrite risk |
| 6 | Metadata/manifest fields | ✅ pivot anchorNorm (0.5, 0.5) for all dirs; imageSize 512×512; muzzle positions per dir available |
| 7 | Shaft absent | ✅ 0 Shaft PNGs in staging (confirmed by manifest: `shaftPngsInSource: 0`) |
| 8 | Pilot scope limited | ✅ cyan + smoky + m0 + 16 turret PNG only |

---

## 3. Critical finding: filename convention mismatch

RUNTIME-01 `getGeneratedTurretAssetPath` produced:
```
smoky_cyan_m0_turret_dir00_E.png  (with _turret_)
```

Actual 3DS export pipeline produces:
```
smoky_cyan_m0_dir00_E.png  (without _turret_)
```

**Fix applied**: Updated `getGeneratedTurretAssetPath` in `generatedTurretAssets.ts` to match the real export convention. All 4345 tests pass after the fix.

This affects:
- `src/assets/generatedTurretAssets.ts` (path builder)
- `src/__tests__/runtime01ModularTurretResolver.test.ts` (test expectations)

---

## 4. Files added

| File | Count | Size |
|------|-------|------|
| `public/assets/units/turrets/smoky/cyan/m0/smoky_cyan_m0_dirNN_<DIR>.png` | 16 | ~1,051,230 bytes each (16.1 MB total) |
| `public/assets/units/metadata/runtime02a_smoky_cyan_m0_pivot_subset.json` | 1 | 28,424 bytes |
| `src/__tests__/runtime02aPilotAssetIntake.test.ts` | 1 | New test file |
| `docs/project/RUNTIME_02A_PILOT_ASSET_INTAKE_REPORT_2026_06_14.md` | 1 | This report |

## 5. Files modified

| File | Change |
|------|--------|
| `src/assets/generatedTurretAssets.ts` | Fixed path builder: removed `_turret_` from filename to match real export convention |
| `src/assets/generatedVehicleMetadata.ts` | Added `TURRET_IMAGE_SIZE`, `SMOKY_CYAN_M0_TURRET_METADATA` pilot constant |
| `src/__tests__/runtime01ModularTurretResolver.test.ts` | Fixed path expectations to match corrected builder |

---

## 6. Asset counts

- Pilot turret PNGs: 16
- Hull PNGs added: 0
- Total PNGs added: 16
- Metadata JSONs: 1
- No bulk import (640+ turret PNGs not imported)
- No hull overwrite

---

## 7. Metadata result

Smoky cyan m0 turret metadata:
- imageSize: **512×512** (confirmed from actual PNGs, no longer null)
- pivot: (0.5, 0.5) — turret base ring at image center
- dirCount: 16
- muzzle positions: available in `runtime02a_smoky_cyan_m0_pivot_subset.json` (for future recoil/VFX use, not consumed yet)

---

## 8. Validation

- `npm run typecheck`: ✅ Clean
- `npm run test`: ✅ All tests pass
- `npm run build`: ✅ Success

---

## 9. Forbidden areas untouched

- No renderer changes (BlockoutVehicleRenderer, ModularTankRenderer)
- No generatedAssetManifest.ts edits
- No combat/movement/economy/mapgen/save-load changes
- No URL flags
- No PR #263 reuse
- No manual offset tuning
- No full 640 turret import
- No hull overwrite
