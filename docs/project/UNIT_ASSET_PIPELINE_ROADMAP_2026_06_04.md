# UNIT-ASSET-PIPELINE — 3DS TankViewer → Blender → Isometric Sprite Pipeline

Status: hull sprite matrix generated and runtime-connected; turret pipeline pending audit  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Date: 2026-06-06

---

## 1. Purpose

Define the offline pipeline for converting TankViewer-style 3DS models and textures into 2D isometric sprites compatible with the game's CAMERA_PROJECTION_CONTRACT.

The project currently has the generated hull sprite matrix in the repo and a runtime path for Arena hull display. Turret sprites are not generated/integrated yet.

---

## 2. Current merged hull state

Merged PRs:

```text
PR #220 — ASSET: add generated hull sprite matrix
PR #221 — HULL-ASSET-01: integrate generated hull sprite runtime loader
PR #222 — HULL-ASSET-01-FIXUP: show generated hull sprites in arena
```

Runtime asset path:

```text
public/assets/units/hulls/<hull>/<faction>/<mod>/<hull>_<faction>_<mod>_hull_dirNN_<DIR>.png
```

Committed hull matrix:

```text
7 hulls × 4 factions × 4 mods × 16 directions = 1792 PNG
hulls: wasp, hornet, hunter, viking, titan, mammoth, dictator
factions: cyan, green, yellow, purple
mods: m0, m1, m2, m3
directions: dir00_E ... dir15_ENE
```

Runtime code:

```text
src/assets/generatedHullAssets.ts
src/phaser/render/BlockoutVehicleRenderer.ts
src/phaser/PreloadScene.ts
```

Important runtime rule:

```text
Full hull matrix is addressable by code but must NOT be preloaded at startup.
Arena/devtools currently preloads 7 hulls × 2 factions (cyan, green) × m0 = 224 PNG.
```

Manual QA URL:

```text
http://localhost:5173/?devtools=1&arena=1
```

---

## 3. Source archive structure

Source assets remain local/off-repo unless explicitly approved.

Hull source working folders used by Denis:

```text
C:\Users\Den\Desktop\Модели\3ds
C:\Users\Den\Desktop\Модели\Мапы
C:\Users\Den\Desktop\Модели\Blend
```

Turret source working folders currently being prepared by Denis:

```text
C:\Users\Den\Desktop\Модели\Пушки\3ds
C:\Users\Den\Desktop\Модели\Пушки\Мапы
C:\Users\Den\Desktop\Модели\Пушки\blend
```

Known clean turret example:

```text
C:\Users\Den\Desktop\Модели\Пушки\blend\Огнемет_м3.blend
```

---

## 4. M-level mapping

| Suffix | Game M-level | Description |
|--------|-------------|-------------|
| _0 / m0 / м0 | M0 | Base / stock modification |
| _1 / m1 / м1 | M1 | First upgrade |
| _2 / m2 / м2 | M2 | Second upgrade |
| _3 / m3 / м3 | M3 | Maximum upgrade |

Some TankViewer 3DS files cover multiple M-levels by suffix grouping:

```text
_0123 => M0/M1/M2/M3
_012  => M0/M1/M2
_01   => M0/M1
_23   => M2/M3
_2    => M2 only
_3    => M3 only
```

---

## 5. Direction model: 16 directions

The generated asset pipeline uses 16 directions:

| Direction index | Name |
|----------------|------|
| dir00 | E |
| dir01 | ESE |
| dir02 | SE |
| dir03 | SSE |
| dir04 | S |
| dir05 | SSW |
| dir06 | SW |
| dir07 | WSW |
| dir08 | W |
| dir09 | WNW |
| dir10 | NW |
| dir11 | NNW |
| dir12 | N |
| dir13 | NNE |
| dir14 | NE |
| dir15 | ENE |

Current runtime still has 8-dir body logic in places. Hull runtime maps 8-dir body direction to 16-dir generated sprites using even indices:

```text
0 E  -> 00 E
1 SE -> 02 SE
2 S  -> 04 S
3 SW -> 06 SW
4 W  -> 08 W
5 NW -> 10 NW
6 N  -> 12 N
7 NE -> 14 NE
```

---

## 6. Camera / projection constraints

All visual/world-space/rendering/asset work must follow:

```text
docs/project/CAMERA_PROJECTION_CONTRACT.md
```

Non-negotiables:

```text
- fixed isometric / axonometric 2.5D camera
- no camera rotation
- ground markers/rings/shadows/ranges/footprints projected onto ground plane
- no top-down screen circles for ground-space concepts
```

The offline Blender scripts used by Denis for hulls were manually validated visually and then integrated as static PNG assets. Any turret pipeline should keep the same 16-dir naming convention and transparent PNG output.

---

## 7. Runtime output folder structure

Current committed hulls:

```text
public/assets/units/hulls/
  wasp/
    cyan/
      m0/
      m1/
      m2/
      m3/
    green/
    yellow/
    purple/
  hornet/
  hunter/
  viking/
  titan/
  mammoth/
  dictator/
```

Expected future turret path, pending audit/approval:

```text
public/assets/units/turrets/<turret>/<faction>/<mod>/<turret>_<faction>_<mod>_turret_dirNN_<DIR>.png
```

Do not commit generated turret assets until the turret source audit and render validation pass.

---

## 8. Current asset loading policy

```text
- Do not preload the full hull matrix.
- Do not preload future full turret matrix.
- Use set-based loading: one hull/turret + faction + mod = 16 PNG.
- Arena/devtools may preload a limited validation subset.
- Normal game startup should remain conservative.
```

---

## 9. Turret pipeline status

Current status:

```text
Turret source assets are being prepared locally.
No generated turret sprite matrix is committed.
No turret runtime integration exists.
Next correct step: turret sprite pipeline audit before scripts/integration.
```

Known turret source complexity:

```text
- many 3DS files include helper objects such as Box/FMNT/Muzzle
- helper objects should probably be hidden for sprite render, not destructively deleted
- helper coordinates may become useful later for muzzle/socket metadata
- different 3DS files cover different M-level groups
- Firebird source name maps to Flamethrower in game naming
```

Known 3DS examples from local screenshots/context:

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

Before any turret script generation, run a local Codex/GLM audit over:

```text
C:\Users\Den\Desktop\Модели\Пушки\3ds
C:\Users\Den\Desktop\Модели\Пушки\Мапы
C:\Users\Den\Desktop\Модели\Пушки\blend\Огнемет_м3.blend
```

The audit must answer:

```text
- which 3DS files map to which turret/mods
- which texture files exist by faction/mod
- which objects are render meshes vs helper objects
- which helper objects should be hidden and which should be preserved in manifest
- whether one universal Blender script is safe
- recommended render margin/offset for turret sprites
```

---

## 10. Recommended next sequence

```text
1. Manual QA merged hull sprites in Arena.
2. If needed, focused hull fixup: scale/origin/loading only.
3. Run turret sprite pipeline audit.
4. Generate turret Blender batch script(s).
5. Render turret sprite matrix locally and audit counts/layout.
6. Asset-only PR for turret sprites.
7. Runtime integration PR for turret sprites with lazy/set-based loading.
```

---

## 11. Risks

| Risk | Mitigation |
|------|-----------|
| Generated hull scale/origin off in Arena | Manual QA at `?devtools=1&arena=1`, then focused fixup only |
| Too many assets loaded | Never preload full matrix; use set-based loading |
| Turret helper objects rendered accidentally | Audit objects; hide helpers by name/pattern for render |
| Muzzle/helper metadata lost | Preserve helper positions in local manifest/report rather than deleting blindly |
| Turret 3DS group-to-mod mapping inconsistent | Audit each 3DS filename and texture matrix before scripts |
| Firebird naming mismatch | Decide source `firebird` vs game `flamethrower` mapping before runtime path |

---

## 12. Acceptance criteria for current hull state

```text
- `public/assets/units/hulls` contains 1792 PNG
- generated hull path/key builders cover all hull/faction/mod/dir combinations
- Arena displays generated hull sprites instead of cube bodies when loaded
- no full matrix preload
- `npm run typecheck`, `npm run test`, `npm run build`, `npm run qa:smoke` pass for runtime integration PRs
- manual visual QA confirms scale/origin are acceptable or produces a focused fixup task
```
