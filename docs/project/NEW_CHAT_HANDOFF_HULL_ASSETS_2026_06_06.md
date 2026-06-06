# NEW_CHAT_HANDOFF_HULL_ASSETS_2026_06_06.md

Status: current handoff for GPT after merged hull asset integration  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Date: 2026-06-06

---

## Start here

Before doing anything, read:

```text
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/GLM_EXECUTOR_RULES.md
docs/project/CAMERA_PROJECTION_CONTRACT.md
docs/project/UNIT_ASSET_PIPELINE_ROADMAP_2026_06_04.md
```

If the task touches Arena/core mechanics, also read:

```text
docs/project/ARENA_SANDBOX_CLOSURE_REPORT.md
docs/project/CORE_MECHANICS_CLOSURE_REPORT_2026_06_04.md
```

---

## Current state

Core Mechanics is closed after PR #207.

Generated hull sprite integration is merged:

```text
PR #220 — ASSET: add generated hull sprite matrix
PR #221 — HULL-ASSET-01: integrate generated hull sprite runtime loader
PR #222 — HULL-ASSET-01-FIXUP: show generated hull sprites in Arena
```

The correct immediate next step is:

```text
Manual QA the generated hull sprites in Arena.
```

Open:

```text
http://localhost:5173/?devtools=1&arena=1
```

Check:

```text
- generated hull sprites visible instead of cube bodies
- no 404 for `assets/units/hulls/...`
- scale/origin acceptable
- labels, HP bars, selection rings and turret graphics still render
- no full 1792-PNG preload at startup
```

---

## Hull assets

Committed path:

```text
public/assets/units/hulls
```

Matrix:

```text
7 hulls × 4 factions × 4 mods × 16 directions = 1792 PNG
```

Hulls:

```text
wasp, hornet, hunter, viking, titan, mammoth, dictator
```

Factions:

```text
cyan, green, yellow, purple
```

Mods:

```text
m0, m1, m2, m3
```

Filename pattern:

```text
<hull>_<faction>_<mod>_hull_dirNN_<DIR>.png
```

Example:

```text
public/assets/units/hulls/wasp/cyan/m0/wasp_cyan_m0_hull_dir00_E.png
```

---

## Runtime integration facts

Relevant files:

```text
src/assets/generatedHullAssets.ts
src/phaser/PreloadScene.ts
src/phaser/render/BlockoutVehicleRenderer.ts
src/phaser/render/ModularTankRenderer.ts
```

Important architecture fact:

```text
Arena uses BlockoutVehicleRenderer, not ModularTankRenderer.
```

PR #221 wired `ModularTankRenderer`, but Arena still showed cubes. PR #222 fixed the actual Arena path by adding generated hull sprite support to `BlockoutVehicleRenderer`.

Current loading behavior:

```text
- full matrix is addressable by code
- full matrix is NOT preloaded
- Arena/devtools preloads 7 hulls × 2 factions (cyan, green) × m0 = 224 PNG
- generated hull sprite replaces the blockout body cube if texture exists
- fallback cube remains if generated texture is not loaded
```

Known risk:

```text
Scale/origin are pilot values and may need visual tuning.
Only cyan/green m0 are preloaded in Arena right now.
```

---

## Turret pipeline status

Turret sprites are not generated/integrated yet.

Denis prepared local turret assets under:

```text
C:\Users\Den\Desktop\Модели\Пушки\3ds
C:\Users\Den\Desktop\Модели\Пушки\Мапы
C:\Users\Den\Desktop\Модели\Пушки\blend
```

Known clean example:

```text
C:\Users\Den\Desktop\Модели\Пушки\blend\Огнемет_м3.blend
```

Turrets are more complex than hulls because 3DS files contain helper objects such as Box/FMNT/Muzzle. These should not be blindly deleted; for rendering they should probably be hidden, and for future gameplay they may be useful as muzzle/socket metadata.

Known turret 3DS examples:

```text
Firebird_3.3ds
Firebird_012.3ds
Freeze_0123.3ds
Hammer_0123.3ds
Isida_0123.3ds
Railgun_3.3ds
Railgun_012.3ds
Ricochet_0123.3ds
Smoky_01.3ds
Smoky_23.3ds
Thunder_0123.3ds
Twins_01.3ds
Twins_2.3ds
Twins_3.3ds
Vulcan_B_0123.3ds
```

Correct next turret step:

```text
Audit first. Do not create scripts blindly.
```

The audit should determine:

```text
- which 3DS file maps to which turret/mods
- exact texture filenames per faction/mod
- render objects vs helper objects
- helper hide/manifest policy
- material assignment rule
- recommended universal script/config design
- turret render margin/offset
```

---

## Stop rules

Do not:

```text
- preload all hull/turret assets at startup
- start broad gameplay changes by inertia
- touch combat/pathfinding/economy/mapgen/save-load during asset work
- integrate turret runtime before turret asset audit/render validation
- ignore CAMERA_PROJECTION_CONTRACT.md for visual/world-space work
```

Preferred model:

```text
asset audit -> local render scripts -> local generated PNG audit -> asset-only PR -> runtime integration PR -> docs update
```
