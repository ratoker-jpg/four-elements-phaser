# MODULAR_CYAN_PACKAGING_REPORT

- version: `MODULAR_ALL_FACTIONS_PACKAGER_V1`
- input root: `D:\Desktop\Модели\tests\modular_all_factions_export_v1`
- output root: `D:\Desktop\Модели\game_asset_staging\modular_all_factions_v1`
- generated at UTC: `2026-06-14T20:31:24.117499+00:00`

## Safety

- no Blender run: `true`
- no render generation: `true`
- no game repo writes: `true`
- no public/assets writes outside staging: `true`
- no production replacement: `true`

## Counts

- expected hull sets: `112`
- hull sets: `112`
- expected hull PNGs: `1792`
- hull PNGs: `1792`
- expected turret sets: `160`
- turret sets: `160`
- expected turret PNGs: `2560`
- turret PNGs: `2560`
- expected total runtime PNGs: `4352`
- total runtime PNGs: `4352`
- missing hull sets: `0`
- missing turret sets: `0`
- warnings: `0`
- skipped non-runtime files: `272`

## Generated files

- manifest: `D:\Desktop\Модели\game_asset_staging\modular_all_factions_v1\public\assets\units\modular_vehicle_asset_manifest_all_factions_v1.json`
- TypeScript draft: `D:\Desktop\Модели\game_asset_staging\modular_all_factions_v1\src\assets\generatedModularVehicleAssets.generated.ts`
- index: `D:\Desktop\Модели\game_asset_staging\modular_all_factions_v1\index.html`
- warnings report: `D:\Desktop\Модели\game_asset_staging\modular_all_factions_v1\MODULAR_ALL_FACTIONS_PACKAGING_WARNINGS_REPORT.md`

## Notes

- This is modular runtime staging: hull sprites and turret sprites are separate.
- Combined hull×turret runtime matrix is not generated.
- Runtime should align turret pivot to hull socket using metadata from `assets/units/metadata/`.