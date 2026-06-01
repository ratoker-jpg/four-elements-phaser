# BLOCKOUT_MVP_ROADMAP.md

Status: active roadmap draft / docs-only planning  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Date: 2026-06-01  
Roadmap: BLOCKOUT-MVP — Vehicle / Combat / Upgrade Skeleton

---

## 1. Purpose

This roadmap defines the next project direction after the closed VISUAL/UI roadmap.

The key decision:

```text
Build the gameplay skeleton first.
Use Phaser/blockout placeholders first.
Add final art only after the behavior, geometry, mount points, physics, and contracts are validated.
```

This roadmap exists because polishing final visuals too early produced a mismatch between expected gameplay effect and implementation output.

The new working model is:

```text
reference → contract → blockout → audit → scoped implementation → validation → final assets later
```

---

## 2. Core principle

```text
Do not make it beautiful before it is clear what exactly must become beautiful.
```

For vehicles, that means validating first:

```text
- body size and role
- turret mount point
- body movement feel
- body turn behavior
- independent turret rotation
- weapon origin / barrel origin
- recoil
- shot type
- projectile / beam / cone / splash / penetration behavior
- obstacle blocking rules
- upgrade effect rules
```

Only after this is validated should final PNG/sprite/3D-render assets be integrated.

---

## 3. Current baseline before this roadmap

The previous VISUAL/UI roadmap is closed.

Closure document:

```text
docs/project/ROADMAP_CLOSURE_2026_06_01_VISUAL_UI.md
```

Current game baseline:

```text
- industrial generated map is default
- approved industrial resource assets render by default on industrial mapStyle
- main menu / New Game / ESC menu / Save-Continue / Playtest HUD are visually polished
- production small map is still 32x32
- old VISUAL queue is not active
```

This roadmap starts from that baseline.

---

## 4. Non-goals

This roadmap does **not** immediately implement final art or full combat.

Explicit non-goals:

```text
- no final tank PNG integration as first step
- no mass asset generation
- no deletion of current/legacy tank assets in the first step
- no full enemy AI
- no attack waves
- no full economy expansion
- no full upgrade shop UI
- no save schema rewrite
- no map size migration
- no fog-of-war system
- no broad renderer refactor
- no copying StarCraft or ProTanki assets directly
```

The current tank/legacy unit visuals should be treated as reference/fallback until the blockout path is validated.

---

## 5. Reference sources collected

### 5.1 Body references

Reference compact dumps were collected for standard hulls:

```text
Wasp / Васп
Hornet / Хорнет
Hunter / Хантер
Viking / Викинг
Dictator / Диктатор
Titan / Титан
Mammoth / Мамонт
```

Each body reference contains:

```text
- description / intended role
- M0-M3 table
- HP / armor
- max speed
- anti-inertia acceleration
- turn speed
- turn acceleration
- anti-inertia turn acceleration
- lateral acceleration
- mass
- engine power
- image links for M0-M3
```

### 5.2 Weapon references

Reference compact dumps were collected for primary weapons:

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

Each weapon reference contains:

```text
- description / intended behavior
- M0-M3 table
- damage / DPS / reload / range where available
- turn speed / turn acceleration where available
- special effects and mechanics
- media links for shot effects where available
```

---

## 6. Body contract v1

### 6.1 Body profile type

The blockout body profile should be treated as a contract, not as final game balance.

```ts
type BodyProfile = {
  id:
    | 'wasp'
    | 'hornet'
    | 'hunter'
    | 'viking'
    | 'dictator'
    | 'titan'
    | 'mammoth';

  displayName: string;
  roleLabel: string;

  referenceM3: {
    hp: number;
    maxSpeed: number;
    turnSpeedDeg: number;
    massKg: number;
    enginePower: number;
  };

  mountCategory:
    | 'front'
    | 'front_center'
    | 'center'
    | 'center_rear'
    | 'rear';

  mountOffsetNormalized?: {
    x: number;
    y: number;
  };

  blockoutShape:
    | 'small_fast'
    | 'light_fast'
    | 'medium'
    | 'large_fast'
    | 'heavy'
    | 'super_heavy';
};
```

### 6.2 M3 reference matrix

M3 values are used as the first blockout reference because they show the most complete version of each hull.

| Body | HP M3 | Max speed M3 | Turn speed M3 | Mass M3 | Power M3 | Mount category | Blockout role |
|---|---:|---:|---:|---:|---:|---|---|
| Wasp | 180 | 13.0 | 150 | 2200 | 1300 | rear | light fast scout / hit-and-run |
| Hornet | 210 | 12.0 | 130 | 2400 | 1400 | center_rear | fast light-medium raider |
| Hunter | 285 | 10.0 | 140 | 3000 | 1400 | center | universal medium |
| Viking | 315 | 9.0 | 110 | 3000 | 1500 | center | reinforced universal medium |
| Dictator | 345 | 8.0 | 130 | 3300 | 1500 | rear | large fast assault body |
| Titan | 420 | 6.0 | 90 | 5000 | 1600 | front_center | heavy frontline |
| Mammoth | 500 | 5.0 | 80 | 5500 | 1500 | front_center | super-heavy fortress |

### 6.3 Mount point rule

Turret mount is a property of the specific body, not of light/medium/heavy class.

Do not infer mount point from weight class.

Known mount reference from owner-provided hull screenshot:

```ts
const bodyMountCategory = {
  wasp: 'rear',
  hornet: 'center_rear',
  hunter: 'center',
  dictator: 'rear',
  viking: 'center',
  titan: 'front_center',
  mammoth: 'front_center',
};
```

Exact normalized `x/y` offsets are intentionally not fixed yet.

They should be tuned later inside a blockout preview/debug scene or mode.

---

## 7. Weapon contract v1

### 7.1 Weapon profile type

```ts
type WeaponProfile = {
  id:
    | 'flamethrower'
    | 'freeze'
    | 'isida'
    | 'ricochet'
    | 'twins'
    | 'hammer'
    | 'smoky'
    | 'vulcan'
    | 'thunder'
    | 'railgun'
    | 'shaft';

  displayName: string;

  behavior:
    | 'instant_projectile'
    | 'instant_splash'
    | 'line_pierce'
    | 'charge_sniper'
    | 'cone_stream'
    | 'beam_support'
    | 'rapid_fire'
    | 'plasma_projectile'
    | 'ricochet_projectile'
    | 'shotgun_cone';

  recoilProfile: string;
  vfxProfile: string;

  damageModel: {
    directDamage?: number;
    damagePerSecond?: number;
    splashRadius?: number;
    splashFalloff?: boolean;
    penetration?: boolean;
    maxPenetrationTargets?: number;
    statusEffect?: 'burn' | 'freeze' | 'heal' | 'overheat';
    selfDamageScale?: number;
  };
};
```

### 7.2 Weapon behavior matrix

| Weapon | Behavior | Blockout expectation |
|---|---|---|
| Smoky | `instant_projectile` | short muzzle flash, single shot, impact dot, recoil, optional crit marker |
| Thunder | `instant_splash` | instant hit, explosion circle, splash radius, optional self-damage debug |
| Railgun | `line_pierce` | bright line through target, penetration through multiple targets, strong recoil |
| Shaft | `charge_sniper` | charge/aim line, stronger final shot line, long-range readable shot |
| Flamethrower | `cone_stream` | cone sector from barrel, continuous tick damage, burn status marker, blocked by obstacles/tanks |
| Freeze | `cone_stream` | cone sector from barrel, slow/freeze status marker, blocked by obstacles/tanks |
| Isida | `beam_support` | lock beam line, damage/heal mode color, target tether |
| Vulcan | `rapid_fire` | rapid short lines/projectiles, spin-up feel, overheat meter |
| Twins | `plasma_projectile` | repeated plasma projectiles/dots, fast rhythm |
| Ricochet | `ricochet_projectile` | projectile path with bounce markers from walls/obstacles |
| Hammer | `shotgun_cone` | spread rays, short range, charge/ammo count placeholder |

---

## 8. Vehicle composition contract

A vehicle is a combination of one body and one weapon.

```ts
type VehicleProfile = {
  id: string;
  bodyId: BodyProfile['id'];
  weaponId: WeaponProfile['id'];
  roleLabel: string;
  blockoutEnabled: boolean;
};
```

Example combinations for blockout testing:

```text
Wasp + Smoky       → fast light single-shot unit
Dictator + Railgun → large fast rear-mounted linear pierce unit
Hunter + Twins     → medium projectile spam unit
Mammoth + Thunder  → heavy splash/frontline unit
Viking + Isida     → support beam test unit
Hornet + Ricochet  → fast bounce projectile unit
Titan + Vulcan     → heavy rapid-fire/overheat unit
```

These are not final balance decisions. They are readability and systems tests.

---

## 9. Physics blockout contract

The movement model should be semi-physics, not full simulation.

Target feel:

```text
- vehicles do not instantly rotate like sprites
- body movement has acceleration/braking
- body turn speed is visible
- heavier bodies feel heavier
- turret can rotate separately from the hull
- recoil can affect barrel/turret/body softly
```

Initial movement profile:

```ts
type MovementProfile = {
  maxSpeed: number;
  acceleration: number;
  braking: number;
  turnSpeedDeg: number;
  turnAccelerationDeg: number;
  lateralAcceleration: number;
  massKg: number;
  enginePower: number;
  bodyRotationLag: number;
};
```

Do not implement complex track simulation, terrain friction, slipping, or physics engine migration in the first blockout sequence.

---

## 10. Recoil blockout contract

Recoil is part of weapon readability.

```ts
type RecoilProfile = {
  barrelKickback: number;
  turretKickback: number;
  bodyImpulse: number;
  recoveryMs: number;
  cameraShake: false;
};
```

Expected first-pass recoil differences:

```text
Smoky: short medium recoil
Thunder: medium recoil + explosion impact
Railgun: strong linear recoil
Shaft: charge + strong final impulse
Vulcan: weak frequent impulses
Flamethrower/Freeze: near-zero recoil, continuous stream instead
Hammer: shotgun kick
Twins/Ricochet: light projectile recoil
```

Camera shake should stay disabled in MVP blockout to avoid noise.

---

## 11. VFX placeholder contract

VFX placeholders should be readable primitives, not final art.

Expected primitive types:

```text
line
ray
cone sector
circle
projectile dot
impact dot
status badge
radius ring
bounce marker
beam tether
```

Expected behavior by weapon:

```text
Smoky:
- muzzle flash
- short ray/trail
- impact dot

Thunder:
- impact circle
- splash radius ring
- optional self-damage debug ring

Railgun:
- thin bright line
- line continues through target when penetration is enabled
- impact flashes on each pierced target

Shaft:
- aim/charge line
- final long shot line

Flamethrower:
- cone sector
- tick markers
- burn badge

Freeze:
- cone sector
- slow/freeze badge

Isida:
- beam tether
- heal/damage color mode

Vulcan:
- rapid short rays/projectiles
- overheat meter

Twins:
- repeated plasma dots/projectiles

Ricochet:
- projectile path
- bounce markers

Hammer:
- spread rays / pellets
```

---

## 12. Damage placeholder contract

The first damage model should be parameterized enough to test readability, not final balance.

```ts
type DamageProfile = {
  directDamage?: number;
  damagePerSecond?: number;
  fireRateMs?: number;
  range?: number;
  splashRadius?: number;
  splashFalloff?: boolean;
  penetration?: boolean;
  maxPenetrationTargets?: number;
  statusEffect?: 'burn' | 'freeze' | 'heal' | 'overheat';
  statusDurationMs?: number;
  selfDamageScale?: number;
};
```

Readability targets:

```text
- Thunder shows splash radius clearly
- Railgun shows penetration clearly
- Flamethrower/Freeze show cone/stream clearly
- Isida shows beam lock clearly
- Vulcan shows overheat clearly
```

---

## 13. Obstacle blockout contract

Obstacles should be simple gameplay geometry first.

```ts
type ObstacleProfile = {
  id: string;
  footprint: [number, number];
  blocksMovement: boolean;
  blocksProjectiles: boolean;
  blocksBeam: boolean;
  blocksCone: boolean;
  blocksVision: false;
};
```

First blockout obstacle set:

```text
blocker_1x1
blocker_2x1
blocker_2x2
wall_segment
wreck_placeholder
industrial_crate
```

Expected behavior:

```text
- vehicles cannot drive through blockers
- cone/beam weapons can be blocked by blockers
- ricochet can bounce from wall/blocker surfaces if scoped
- vision blocking is deferred
```

---

## 14. Upgrade skeleton contract

Upgrades should exist first as config/debug skeleton, not as a full production upgrade shop.

Categories:

```text
body:
- armor
- speed
- turn
- mass/weight feel

turret:
- turn speed
- stabilization

weapon:
- damage
- range
- reload
- recoil
- penetration
- splash

utility:
- vision
- repair
- energy capacity
```

Placeholder visuals:

```text
armor upgrade      → thicker body outline / armor badge
speed upgrade      → speed badge
range upgrade      → longer aim line
reload upgrade     → faster shot cadence display
damage upgrade     → brighter muzzle/impact
penetration upgrade→ different rail line color/style
splash upgrade     → bigger radius ring
```

Full upgrade UI is deferred.

---

## 15. High+ PR sequence

### BLOCKOUT-00 — Define BLOCKOUT-MVP roadmap

Type: docs-only  
Risk: low  
Goal: establish this roadmap as the active direction.

Allowed files:

```text
docs/project/BLOCKOUT_MVP_ROADMAP.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/PROJECT_STATE.md
```

No code/assets/tests/runtime changes.

### BLOCKOUT-01 — Huge roadmap audit

Type: audit-only  
Risk: high+  
Goal: inspect current repo architecture before implementation.

The audit must answer:

```text
- where current unit rendering lives
- where current tank/unit data lives
- how to add blockout renderer behind a flag
- whether a separate scene/dev route is safer
- how to avoid save/load breakage
- how to avoid economy/mapgen/resource changes
- exact files/functions to touch
- forbidden files/functions
- test plan
- rollback plan
- smallest safe first code PR
```

No code changes in the audit.

### BLOCKOUT-02 — Config skeleton only

Type: implementation  
Risk: medium  
Goal: add typed body/weapon/vehicle config without runtime consumption.

Expected outcome:

```text
- bodyProfiles exist
- weaponProfiles exist
- vehicleProfiles exist
- tests verify ids/mount categories/behavior categories
- game output unchanged
```

### BLOCKOUT-03 — Dev-only blockout vehicle renderer

Type: implementation  
Risk: high  
Goal: render bodies/turrets/barrels as Phaser primitives behind a flag/dev mode.

Expected outcome:

```text
- Wasp/Hunter/Dictator/Titan/Mammoth are readable as different placeholder bodies
- mount points are visible
- turret and barrel are separate from body
- production/default game is unchanged when flag is off
```

### BLOCKOUT-04 — Turret mount/rotation skeleton

Type: implementation  
Risk: high  
Goal: independent turret rotation from body.

Expected outcome:

```text
- body can face one direction
- turret can aim elsewhere
- turret starts at body-specific mount point
- turret turn speed is configurable
```

### BLOCKOUT-05 — Vehicle movement feel

Type: implementation  
Risk: high+  
Goal: semi-physics movement feel for blockout vehicles.

Expected outcome:

```text
- Wasp feels fastest/lightest
- Mammoth feels slowest/heaviest
- turn speed differences are visible
- acceleration/braking are visible but controllable
```

### BLOCKOUT-06 — Recoil skeleton

Type: implementation  
Risk: high  
Goal: recoil visible by weapon type.

Expected outcome:

```text
- Smoky kicks once
- Railgun kicks hard
- Vulcan has small repeated impulses
- cone/beam weapons have minimal recoil
```

### BLOCKOUT-07 — Weapon VFX placeholders

Type: implementation  
Risk: high+  
Goal: primitive VFX for all weapon behavior families.

Expected outcome:

```text
- projectile / splash / line pierce / cone / beam / rapid fire / ricochet / shotgun are visually distinct
```

### BLOCKOUT-08 — Damage behavior placeholders

Type: implementation  
Risk: high+  
Goal: parameterized direct/splash/penetration/status behavior.

Expected outcome:

```text
- Thunder shows splash
- Railgun shows penetration
- Flamethrower/Freeze show cone damage/status
- Isida shows beam lock
```

### BLOCKOUT-09 — Obstacle blockout

Type: implementation  
Risk: high  
Goal: blockers for movement/projectiles/cones/beams.

Expected outcome:

```text
- movement blockers work
- projectile/cone/beam blocker behavior is testable
- no final obstacle art required
```

### BLOCKOUT-10 — Upgrade skeleton

Type: docs + implementation  
Risk: high  
Goal: debug/config upgrade model.

Expected outcome:

```text
- upgrades can be applied through debug controls/dev hotkeys
- upgrade effects are visible via placeholder badges/outlines/parameter changes
- no full upgrade shop UI yet
```

### BLOCKOUT-11 — Combat readability sandbox

Type: implementation  
Risk: high+  
Goal: integrated test sandbox for vehicle/weapon/obstacle/upgrade readability.

Expected outcome:

```text
- multiple blockout vehicles visible
- different bodies readable
- different weapon families readable
- recoil readable
- splash/penetration/cone/beam readable
- obstacles affect behavior
- upgrades visibly modify behavior
```

---

## 16. Required huge-audit prompt after BLOCKOUT-00

After this roadmap PR merges, the next step is **not code**.

Next step:

```text
BLOCKOUT-01 — Huge Roadmap Audit / Phase 1 Audit Only
```

The audit must be explicit, high+, and read-only.

It must end with:

```text
Жду Делай
```

It must not edit code, docs, assets, tests, package files, or generated files.

---

## 17. Acceptance criteria for BLOCKOUT-00

This roadmap step is complete when:

```text
- BLOCKOUT_MVP_ROADMAP.md exists
- CURRENT_NEXT_STEP.md points to BLOCKOUT-01 Huge Roadmap Audit
- PROJECT_STATE.md says BLOCKOUT-MVP is active planning direction
- docs clearly state no implementation before huge audit
- old VISUAL/UI queue remains closed
- changed files are docs-only
```

---

## 18. Short handoff

```text
We are working in ratoker-jpg/four-elements-phaser.
The VISUAL/UI roadmap is closed after PR #144-#162.
The new active planning direction is BLOCKOUT-MVP: vehicle/combat/upgrade skeleton before final art.
Do not implement runtime code yet.
Next step is BLOCKOUT-01 Huge Roadmap Audit, audit-only, no code.
Read docs/project/BLOCKOUT_MVP_ROADMAP.md, PROJECT_STATE.md, CURRENT_NEXT_STEP.md, GPT_WORKFLOW.md, and GLM_EXECUTOR_RULES.md before doing anything.
```
