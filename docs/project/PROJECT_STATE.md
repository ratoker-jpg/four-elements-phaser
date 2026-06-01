# PROJECT_STATE.md

Status: operational project state
Project: Four Elements Phaser
Repo: `ratoker-jpg/four-elements-phaser`
Current phase: BLOCKOUT-MVP — BLOCKOUT-06H+ implemented, BLOCKOUT-07H+ next

---

## Current mode

```text
BLOCKOUT-06H+ implemented. All 11 blockout weapon families have visual-only VFX placeholders.
Next: BLOCKOUT-07H+ — Damage placeholders.
```

The completed VISUAL/UI roadmap slice ended after PR #162.

The new active planning direction is:

```text
BLOCKOUT-MVP — Vehicle / Combat / Upgrade Skeleton
```

Owner decision: no standalone low-risk implementation PRs. Only high/high+ steps that produce visible gameplay/blockout progress.

Next action:

```text
BLOCKOUT-07H+ — Damage placeholders
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
- MOVING BLOCKOUT VEHICLES with semi-physics feel (BLOCKOUT-04H+)
  - RMB click sets movement target for selected vehicle
  - vehicle accelerates gradually toward target
  - vehicle brakes/stops near target instead of snapping
  - body rotates gradually toward movement direction
  - body rotation independent from turret rotation
  - turret can continue aiming at mouse while body turns/moves
  - Wasp fastest/lightest, Mammoth slowest/heaviest
  - movement target marker (green crosshair) and line visible
  - speed shown in debug label when moving
  - production/default game unchanged when devtools is off
- FIRING BLOCKOUT VEHICLES with visual-only weapon VFX — ALL 11 WEAPONS (BLOCKOUT-05H+ + BLOCKOUT-06H+)
  - Press Space or F to fire selected blockout vehicle
  - Hold Space/F for continuous-fire weapons (Flamethrower/Freeze/Isida/Vulcan/Twins)
  - Smoky: muzzle flash + short tracer + impact dot + medium recoil
  - Railgun: long bright line + pierce ticks + strong recoil
  - Thunder: short tracer + explosion circle + splash radius ring + medium-heavy recoil
  - Shaft: charge pulse + focused long sniper line + crosshair
  - Flamethrower: orange cone with flicker + inner yellow cone
  - Freeze: cyan cone + inner blue cone + frost circles
  - Isida: green pulsing beam + glow line + tether dots
  - Vulcan: rapid short tracers + visual overheat indicator
  - Twins: moving plasma dots with glow + trail
  - Ricochet: segmented path with deterministic bounces + bounce markers
  - Hammer: fan of pellet tracers in cone + impact dots
  - barrel kickback visible on firing
  - turret kickback deflects turret angle temporarily during recoil
  - body impulse shifts vehicle backward visually during recoil
  - recoil recovers smoothly over time
  - cooldown prevents uncontrolled VFX spam
  - VFX origin uses actual barrel/mount origin (not body center)
  - rear-mounted and front_center vehicles fire from correct origin
  - all timing uses consistent Phaser scene time basis
  - production/default game unchanged when devtools is off
```

This is the expected baseline for BLOCKOUT-06H+.

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
BLOCKOUT-07H+ — Damage placeholders
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
- save sanitization strips blockoutVehicles before writing
- 48 unit tests for profiles, state, and spawn
```

### BLOCKOUT-03H — Selection/control + turret aiming

```text
Type: implementation
Risk: HIGH
Status: DONE

Implemented:
- angle math helpers (normalizeAngle, shortestAngleDelta, rotateTowardAngle, angleFromTo, degPerSecToRadPerMs)
- turret targeting fields on BlockoutVehicleState (turretTargetAngle, turretTurnSpeedDeg)
- weapon-specific turret turn speeds (blockoutTurretTurnSpeedDeg on WeaponProfile)
- BlockoutVehicleInputController for dev-only selection and turret aiming
- LMB click selects/deselects blockout vehicles (hit-test by distance)
- mouse position updates selected vehicle turret target each frame
- rate-limited turret rotation using rotateTowardAngle
- selection highlight: gold pulsing ring on selected vehicle
- hover marker: subtle white ring on hovered vehicle
- aim line: dashed red line from barrel toward cursor for selected vehicle
- selected vehicle label shows [SEL] marker
- all selection/aim state is transient and not persisted in saves
- 39 unit tests for angle math, hit-test, turret rotation, and save isolation
```

### BLOCKOUT-04H+ — Semi-physics movement

```text
Type: implementation
Risk: HIGH+
Status: DONE

Implemented:
- movement profile pixel-speed fields (maxSpeedPxPerSec, accelerationPxPerSec2, brakingPxPerSec2, arrivalRadiusPx)
- body-specific movement feel: Wasp fastest/lightest, Mammoth slowest/heaviest
- BlockoutVehicleState movement fields (worldX/worldY, vx/vy, speed, targetWorldX/Y, hasMoveTarget)
- pure movement update helper (blockoutMovement.ts) — accelerate, brake, turn, arrive
- vehicle accelerates gradually toward movement target
- vehicle brakes/stops near target instead of snapping
- body rotates gradually toward movement direction (rate-limited by turnSpeedDeg)
- body rotation independent from turret rotation
- RMB click sets movement target for selected vehicle
- RMB drag does NOT set target (avoids conflict with camera pan)
- movement target marker (green crosshair) and line visible for selected vehicle
- speed shown in debug label when moving
- BlockoutVehicleRenderer uses continuous worldX/worldY for smooth position
- blockoutVehicleGeometry uses worldX/worldY instead of tileToScreen
- all movement state is transient and not persisted in saves
- 22 unit tests for movement, profiles, acceleration, braking, body angle, turret independence
```

### BLOCKOUT-05H+ — Recoil + first weapon VFX set

```text
Type: implementation
Risk: HIGH+
Status: DONE

Implemented:
- recoil profiles with pixel kickback fields (barrelKickbackPx, turretKickbackRad, bodyImpulsePx)
- Railgun recoil > Smoky recoil on all visible dimensions
- weapon VFX config with rendering parameters (muzzleFlashRadiusPx, impactRadiusPx, effectLengthPx)
- weapon cooldown config (blockoutCooldownMs) prevents uncontrolled VFX spam
- weapon range config (blockoutRangePx) for VFX length
- BlockoutVehicleState recoil/firing fields (lastFiredAt, recoilActive, recoilStartedAt, recoilDurationMs, recoilBarrelOffset, recoilTurretOffset, recoilBodyOffset)
- VFX event system (blockoutWeaponVfx.ts) — fire, cooldown, expire, recoil update
- fire input (Space or F key) for selected blockout vehicle
- Smoky VFX: muzzle flash + short tracer + impact dot + medium recoil
- Railgun VFX: long bright line + pierce ticks + strong recoil
- Thunder VFX: short tracer + explosion circle + splash radius ring + medium-heavy recoil
- barrel kickback visible on firing (shortened barrel during recoil)
- turret kickback deflects turret angle temporarily during recoil
- body impulse shifts vehicle backward visually during recoil
- recoil recovers smoothly over time (ease-out decay)
- VFX origin uses actual barrel/mount origin (not body center)
- rear-mounted and front_center vehicles fire from correct origin
- movement from BLOCKOUT-04H+ keeps working while firing
- turret aiming from BLOCKOUT-03H keeps working while firing
- all firing/recoil/VFX state is transient and not persisted in saves
- 41 unit tests for recoil, VFX, cooldown, geometry, save stripping
- non-implemented weapons (Flamethrower, Freeze, etc.) return null from fire — no VFX
```

### BLOCKOUT-06H+ — Remaining weapon VFX families

```text
Type: implementation
Risk: HIGH+
Status: DONE

Implemented:
- All 11 blockout weapon families now produce distinct visual-only VFX
- Shaft VFX: charge pulse circle + thin bright sniper line + crosshair at end
- Flamethrower VFX: orange cone with flicker + inner yellow cone + muzzle glow
- Freeze VFX: cyan cone + inner blue cone + frost circles + muzzle glow
- Isida VFX: green pulsing beam + glow line + tether dots at both ends
- Vulcan VFX: rapid short tracers + small muzzle flash + visual overheat indicator
- Twins VFX: moving plasma dots with glow and trail
- Ricochet VFX: segmented path with deterministic bounces + bounce markers
- Hammer VFX: fan of pellet tracers in cone + impact dots at ends
- Continuous-fire support for Flamethrower/Freeze/Isida/Vulcan/Twins (hold Space/F)
- startFiring()/stopFiring() manage continuous fire state
- tickContinuousFire() creates VFX at weapon-specific streamCadenceMs rate
- VfxProfile extended with coneAngleDeg, bounceCount, pelletCount, streamCadenceMs, overheatDurationMs, chargePulseMs
- BlockoutVehicleState extended with fireHeld, isFiring, lastStreamTickAt, visualOverheat fields
- Key-up event handling stops continuous fire properly
- Vulcan vfxProfile bug fixed: was 'rapid_fire', corrected to 'rapid_fire_overheat'
- All timing uses consistent Phaser scene time basis (no Date.now())
- Recoil profiles active for all 11 weapons
- Existing Smoky/Railgun/Thunder VFX unchanged
- all state is transient and not persisted in saves
- 100 unit tests for VFX, recoil, cooldown, continuous fire, save stripping, timing consistency
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

Do not start these as immediate implementation without BLOCKOUT-04H+ approval:

```text
- blockout vehicle movement physics (part of BLOCKOUT-04H+)
- body rotation in movement direction (BLOCKOUT-04H+)
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
7. BLOCKOUT-03H selection/control + turret aiming — DONE
8. BLOCKOUT-04H+ semi-physics movement — DONE
9. BLOCKOUT-05H+ recoil + first weapon VFX set — DONE
10. BLOCKOUT-06H+ remaining weapon VFX families — DONE
11. BLOCKOUT-07H+ damage placeholders — NEXT
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
