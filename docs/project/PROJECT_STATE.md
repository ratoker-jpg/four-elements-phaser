# PROJECT_STATE.md

Status: operational project state
Project: Four Elements Phaser
Repo: `ratoker-jpg/four-elements-phaser`
Current phase: BLOCKOUT-MVP — BLOCKOUT-02H implemented, BLOCKOUT-03H next

---

## Current mode

```text
BLOCKOUT-02H implemented. Visible blockout vehicles exist in arena/dev mode.
Next: BLOCKOUT-03H — Selection/control + turret aiming.
```

The completed VISUAL/UI roadmap slice ended after PR #162.

The new active planning direction is:

```text
BLOCKOUT-MVP — Vehicle / Combat / Upgrade Skeleton
```

Owner decision: no standalone low-risk implementation PRs. Only high/high+ steps that produce visible gameplay/blockout progress.

Next action:

```text
BLOCKOUT-03H — Selection/control + turret aiming
```

---

## Current Phaser version

```text
4.1.0
```

Always confirm this in `package.json` before planning Phaser API work.

---

## Current source-of-truth docs

Read these before doing anything:

```text
docs/project/BLOCKOUT_MVP_ROADMAP.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/GLM_EXECUTOR_RULES.md
docs/project/ROADMAP_CLOSURE_2026_06_01_VISUAL_UI.md
```

Historical VISUAL docs remain valid background, but they are not an active implementation queue:

```text
docs/project/VISUAL_ROADMAP.md
docs/project/VISUAL_SYSTEM_AUDIT.md
docs/project/VISUAL_CANDIDATE_SUMMARY.md
docs/project/VISUAL_01B_LAYERED_PLATFORM_FRAME.md
docs/project/VISUAL_05A_PRODUCTION_INDUSTRIAL_MAP_INTEGRATION_PLAN.md
docs/project/VISUAL_06_RESOURCE_FIELD_VISUAL_MODEL.md
```

Important:

```text
Do not continue old VISUAL tasks by inertia.
Do not treat old queue items as active unless the owner explicitly reopens them.
No standalone low-risk implementation PRs — every PR must produce visible gameplay/blockout progress.
```

---

## Current owner-facing state

The project currently has:

```text
- industrial generated map as default for new games
- mapStyle industrial/sand preserved
- sand/fixed/custom map paths preserved as fallback/reference
- production industrial terrain/frame/background layer
- lower-left HQ/start/resource composition
- approved industrial resource crystal assets in repo
- industrial resources preloaded and rendered by default for industrial mapStyle
- legacy minerals preserved for sand/legacy resourceStyle
- polished main menu
- polished New Game setup
- polished ESC menu
- polished Save/Continue flow
- polished Playtest HUD readability
- VISIBLE BLOCKOUT VEHICLES in arena/dev mode (BLOCKOUT-02H)
  - colored rectangle body per body profile
  - separate turret rectangle
  - barrel line per weapon profile
  - mount point circle (debug overlay)
  - body size differentiation (Wasp small, Mammoth large)
  - barrel length differentiation (Railgun long, Smoky medium)
  - rear-mounted turrets on Wasp/Dictator
  - front_center turrets on Titan/Mammoth
  - production/default game unchanged when devtools is off
```

This is the expected baseline for BLOCKOUT-03H.

---

## Current active roadmap

```text
BLOCKOUT-MVP — Vehicle / Combat / Upgrade Skeleton
```

Roadmap document:

```text
docs/project/BLOCKOUT_MVP_ROADMAP.md
```

Purpose:

```text
Build the gameplay skeleton first using Phaser/blockout placeholders.
Validate body geometry, turret mount points, vehicle physics, recoil, weapon behavior, obstacles, and upgrade hooks before final art integration.
```

Working model:

```text
reference → contract → blockout → audit → scoped implementation → validation → final assets later
```

Core rule:

```text
Do not make it beautiful before it is clear what exactly must become beautiful.
```

---

## BLOCKOUT-MVP reference contracts

### Body references

Standard hulls collected and accepted for planning:

```text
Wasp / Васп
Hornet / Хорнет
Hunter / Хантер
Viking / Викинг
Dictator / Диктатор
Titan / Титан
Mammoth / Мамонт
```

Body contract covers:

```text
- HP / armor
- max speed
- anti-inertia acceleration
- turn speed
- turn acceleration
- anti-inertia turn acceleration
- lateral acceleration
- mass
- engine power
- body-specific turret mount category
```

Confirmed owner-visible mount categories:

```text
Wasp     -> rear
Hornet   -> center_rear
Hunter   -> center
Viking   -> center
Dictator -> rear
Titan    -> front_center
Mammoth  -> front_center
```

Exact normalized mount `x/y` is intentionally deferred to a later blockout preview/debug calibration step.

### Weapon references

Weapons collected and accepted for planning:

```text
Flamethrower / Огнемёт
Freeze / Фриз
Isida / Изида
Ricochet / Рикошет
Twins / Твинс
Hammer / Молот
Smoky / Смоки
Vulcan / Вулкан
Thunder / Гром
Railgun / Рельса
Shaft / Шафт
```

Weapon contract covers:

```text
- instant projectile
- instant splash
- line penetration
- charge/sniper line
- cone stream
- beam support
- rapid fire / overheat
- plasma projectile
- ricochet projectile
- shotgun cone
```

---

## Active next work

```text
BLOCKOUT-03H — Selection/control + turret aiming
```

Mode:

```text
HIGH/HIGH+ IMPLEMENTATION
NO STANDALONE LOW-RISK PRS
EVERY PR MUST PRODUCE VISIBLE PROGRESS
```

---

## Completed BLOCKOUT-MVP steps

### BLOCKOUT-00 — Define BLOCKOUT-MVP roadmap

```text
Type: docs-only
Status: DONE
```

### BLOCKOUT-01 — Huge roadmap audit

```text
Type: audit-only
Status: DONE
```

### BLOCKOUT-02H — First visible blockout vehicles

```text
Type: implementation
Risk: HIGH
Status: DONE

Implemented:
- blockout profile types and data (BodyProfile, WeaponProfile, VehicleProfile, MovementProfile, RecoilProfile, DamageProfile, ObstacleProfile)
- blockout vehicle state (BlockoutVehicleState, optional blockoutVehicles on GameState)
- dev-only spawn commands (devSpawnBlockoutVehicle, devSpawnBlockoutVehicleSet, devClearBlockoutVehicles)
- primitive Phaser Graphics renderer (body rectangle, turret rectangle, barrel line, mount point circle)
- visible arena/dev output: different body sizes readable, turret separate from body, barrel visible, mount point visible
- stripModularCombatFromState extended to strip blockout vehicles
- 45 unit tests for profiles, state, and spawn
```

---

## Completed roadmap slice

### VISUAL-05A — Production industrial map integration

```text
PR #144 — VISUAL-05A PR1: Parameterize ?visual04a map preview 96/128/192
PR #145 — VISUAL-05A PR2: Industrial terrain behind mapStyle
PR #146 — VISUAL-05A PR3: Production industrial frame/background layer
PR #147 — VISUAL-05A PR4: Lower-left HQ/start/resources
PR #148 — VISUAL-05A PR5: Industrial generated map default
```

Final state:

```text
- industrial generated map is default for new games
- mapStyle industrial/sand remains available
- sand/fixed/custom map paths remain fallback/reference
- HQ/start/resources are lower-left for industrial generated maps
- frame/background/walls are connected in production for industrial
- save/load compatibility preserved
- current production small map remains 32x32
```

### VISUAL-06 — Resource field visual model and integration

```text
PR #150 — VISUAL-06A: Resource field visual model docs/design
PR #151 — VISUAL-06B: Resource candidate review package
PR #152 — VISUAL-06B1: Resource model pivot
PR #153 — VISUAL-06C: Approved industrial resource assets added
PR #154 — VISUAL-06D: Preload/manifest wiring behind resourceStyle
PR #155 — VISUAL-06E: Render industrial resources behind resourceStyle
PR #156 — VISUAL-06E fixup: Resolve resourceStyle from mapStyle
```

### UI roadmap — menus, setup, pause, save/continue, HUD

```text
PR #157 — UI-01: Main menu visual polish and navigation shell
PR #158 — UI-02: New Game setup polish
PR #159 — UI-03: ESC menu polish
PR #160 — UI-04: Save/Continue flow polish
PR #161 — HUD-01: Playtest HUD readability polish
PR #162 — VISUAL/UI roadmap closure checkpoint
```

---

## Completed foundation from previous Phase 2

These tasks remain useful foundation and should not be re-assigned as pending work:

```text
MENU-01 (#100) — Main menu mode selection via controlled URL launch ✓
MENU-02 (#105) — Mode-aware late-loading / seamless mode switching ✓
LOADING-01 (#101) — Proper loading screen with progress bar ✓
BASE-ANCHOR-01 (#104) — HQ/building grounding and south-vertex placement ✓
HOTKEYS-01 (#111) — Command registry / hotkey system ✓
BUILDER-ID (#109) — Builder stable IDs ✓
RESOURCE-01 (#108) — Depleted resource ghost occupancy fix ✓
HUD-01 (#102) — Legacy HUD removal and consolidation ✓
WEAPON-WORKFLOW-01 (#114) — Weapon VFX / recoil design document ✓
ASSET-WORKFLOW-01 (#106) — Animated unit asset pipeline design ✓
TERRAIN-02A (#119) — 256×128 terrain integration foundation ✓
TERRAIN-FIX-01 (#121) — Grid seam removal foundation ✓
```

---

## Known deferred topics

These are known future candidates, not current tasks:

```text
- production map size migration to 96/128/192
- full RTS bottom-bar HUD with minimap/info/commands
- fog of war
- arena mode
- final unit visual workflow
- final tank asset integration
- enemy/bot/AI systems
- attack waves
- full upgrade shop UI
- deeper economy/resource mechanics
- save schema/migration/autosave/cloud saves
- resource richness gameplay/mapgen beyond small/medium/large/infinite
```

Each needs a new roadmap, audit, or explicit scoped task before implementation.

---

## Paused / superseded

Sand terrain polish as the primary direction is paused. MAPLIFE desert decor is rejected. These must not be continued as-is:

```text
TERRAIN-01 (#103) — Sand visual system — merged, but sand direction paused as primary biome
TERRAIN-02 (#118) — Sand quality audit — merged, pipeline learnings preserved
TERRAIN-FIX-01 (#121) — Sand grid seam removal — merged, code remains as fallback
MAPLIFE-01 (#112) — Desert decor asset readiness — rejected
MAPLIFE #120 — Desert decor PR — visually rejected, not merged
```

Sand assets and code remain in repo as fallback/reference.

---

## Constraints before implementation

Do not start these as immediate implementation without BLOCKOUT-03H approval:

```text
- blockout vehicle selection/control (part of BLOCKOUT-03H)
- turret aiming runtime changes (BLOCKOUT-03H)
- movement physics changes (BLOCKOUT-04H+)
- recoil system (BLOCKOUT-05H+)
- weapon VFX placeholders (BLOCKOUT-05H+, BLOCKOUT-06H+)
- damage behavior placeholders (BLOCKOUT-07H+)
- obstacle blockers (BLOCKOUT-08H)
- upgrade skeleton (BLOCKOUT-09H)
- combat readability sandbox (BLOCKOUT-10H+)
```

---

## Next workflow

Use this sequence:

```text
1. BLOCKOUT-00 roadmap docs PR — DONE
2. BLOCKOUT-01 huge audit — DONE
3. BLOCKOUT-01 fixup (date, Telegram status) — DONE
4. BLOCKOUT roadmap fixup (high/high+ sequence) — DONE
5. owner/GPT review of high/high+ sequence — DONE
6. BLOCKOUT-02H first visible blockout vehicles — DONE
7. BLOCKOUT-03H selection/control + turret aiming — NEXT
8. GPT review before each merge
```

---

## Archived docs

The following documents are archived or historical reference only:

```text
docs/project/PHASE_2_ROADMAP.md → deprecated
docs/project/PHASE_2_ROADMAP_AUDIT.md → deprecated
docs/project/PHASE_2_ROADMAP_AUDIT_PROMPT.md → deprecated
docs/project/TERRAIN_02_QUALITY_AUDIT_AND_PIPELINE.md → paused/superseded
docs/project/MAPLIFE_01_ASSET_READINESS.md → rejected
```
