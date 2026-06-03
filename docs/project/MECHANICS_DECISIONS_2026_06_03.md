# MECHANICS_DECISIONS_2026_06_03.md

Status: accepted mechanics decisions / pre-roadmap source  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Owner: Denis  
Captured by: GPT  
Date: 2026-06-03

---

## 1. Purpose

This document freezes the mechanics decisions accepted after reviewing:

```text
docs/project/MECHANICS_INTAKE_2026_06_03.md
docs/project/MECHANICS_EXPLORATORY_AUDIT_2026_06_03.md
```

This file is **not** an implementation roadmap.

This file is **not** an implementation audit.

This file is the accepted mechanics baseline used to create the next roadmap.

Target process after this file:

```text
accepted mechanics decisions
-> roadmap
-> standard huge implementation/system audit
-> High+/High implementation PR sequence
```

---

## 2. Current strategic boundary

The next roadmap should polish and deepen the current playable baseline.

Primary focus:

```text
- Russian player-facing UX
- Industrial Platform only normal game flow
- factions with identity
- resources and map anchors
- buildings / core economy loop
- unified RTS controls
- grid-based movement with physical feel
- occupancy / collision / depth sorting
- target-lock combat
- weapon mechanics
- body mechanics
- animation / feel layer
```

Explicitly not the current focus:

```text
- production bot roadmap
- strategic enemy AI
- attack waves
- enemy economy AI
- enemy base building
- final art generation
- mass asset production
```

---

## 3. UI / localization / start flow

### Accepted

```text
- All player-facing UI must be Russian.
- Internal code ids may remain English.
- Four Elements may remain in English as the game title.
- A localization/config layer is required.
- New UI strings should come from the localization layer, not scattered hardcoded text.
- English can remain as fallback/dev reference.
- Player-facing UI uses Russian displayName for factions, weapons, bodies, buildings and resources.
```

### Normal game start flow

```text
New Game -> mode -> map size -> faction -> start
```

Player-facing Russian labels:

```text
New Game  -> Новая игра
Continue  -> Продолжить
Settings  -> Настройки
Game Mode -> Режим игры
Standard  -> Стандартный
Debug     -> Отладка
Arena     -> Арена
Generated -> Сгенерированная
Small     -> Маленькая
Large     -> Большая
```

### Industrial-only normal UX

```text
- Normal player flow uses Industrial Platform.
- Normal player flow uses Generated map.
- Sand Classic is hidden from normal UX.
- Map 1 is hidden from normal UX.
- mapStyle selector is hidden from normal UX.
- Sand Classic / Map 1 can remain available for dev/debug reference only.
```

### UI style

Accepted direction:

```text
industrial / bronze / sand
```

Rules:

```text
- one coherent panel/button style
- dark panels
- warm industrial metal/bronze accents
- readable hover/active/disabled states
- no random green/yellow button mix
- Debug UI is visually and functionally separate from player UI
- Arena has ArenaMenu
- Normal Game has normal player UX
- DevTools remain dev-only / Debug mode / hotkey / dev flag
```

### Tooltips and descriptions

Player UI should explain:

```text
- faction bonus
- weapon role
- body role
- resource deposit class
- building purpose
- disabled button reason
```

---

## 4. Controls

### Accepted control model

```text
LMB = selection / inspect
RMB = command
S   = stop selected units
Esc = cancel active mode / close overlay / deselect / pause depending context
MMB drag = camera pan
Arrow keys = camera movement
```

### LMB

```text
- select own unit
- select building
- inspect object
- inspect enemy without control transfer
- future drag selection
- does NOT move camera
- does NOT issue move command
- does NOT issue attack command
```

### RMB

```text
- on ground = move command for selected units
- on enemy = attack command for selected units
- on resource = harvest command if selected unit can harvest
- on building = context command if applicable
- no selected unit = no-op
- does NOT move camera
```

### S

```text
- stop selected units
- clear current movement/attack command
- clear target-lock if selected unit was attacking
```

### Esc

```text
- deselect
- exit placement/active mode
- close overlay
- open pause menu only when no active mode consumes Esc
```

### Rejected

```text
- LMB move/attack
- pure LMB-only command model
- RMB as camera pan
- LMB camera pan
- mixing selection and command on the same mouse button
```

---

## 5. Movement model

### Accepted

```text
- All ground units use grid/tile pathing.
- Path is tile-based and goes through tile centers.
- Free arcade movement is not the production model.
- No diagonal corner cutting as the primary movement model.
- Units reserve the next tile/corridor before moving.
- Units cannot enter occupied cells.
- Units cannot pass through other units.
- Units cannot pass through obstacle/building footprints.
- Territory does not block movement.
```

### Physical feel

```text
- Movement has acceleration and braking.
- Body direction does not snap instantly.
- Unit turns physically toward the next segment.
- Waypoint smoothing is accepted from the start.
- Smoothing must remain inside a safe tile corridor.
- If a smooth arc would violate occupancy/pathing, fallback is turn-in-place.
```

### Movement state model

```text
idle
path_requested
turning_to_segment
moving_segment
braking
next_segment
attacking
stopping
blocked
repathing
target_chase
```

### Rejected

```text
- screen-space direct movement to click
- instant body direction snap
- unit overlap
- diagonal chaos
- visual smoothing that breaks pathfinding/occupancy
- implementing a temporary strict grid model that must be rewritten later
```

---

## 6. Occupancy, collision, attack distance and depth sorting

### Occupancy

```text
- Every ground unit has a logical footprint / collision profile.
- Body size affects footprint/collision class.
- Unit cannot enter occupied cells.
- Unit reserves the next tile/corridor before movement.
- If next cell is occupied, unit waits briefly, then repaths, then stops with feedback if no path exists.
- Building and obstacle footprints block movement.
```

### Body footprint classes

```text
Light:
- Wasp
- Hornet

Medium:
- Hunter
- Viking
- Dictator

Heavy:
- Titan
- Mammoth
```

Exact tile size/collision radius is not final in this document.

### Attack distance

Every weapon should define:

```text
minRange
idealRange
maxRange
stopDistance
```

Rules:

```text
- Attack command does not move a unit to the enemy center.
- Unit moves to weapon-appropriate stop/ideal distance.
- Short-range weapons do not require direct overlap.
- If target is too close, unit can reposition or weapon uses point-blank assist.
- If target is outside range, unit pathfinds toward target.
- If target is inside range, unit stops, turret aims, weapon fires.
```

### Hit model

Accepted:

```text
- Hits are not based only on a thin pixel-perfect screen-space line.
- Targets have projected hit footprint.
- Weapons have hit tolerance / aim forgiveness.
- Short-range weapons can use point-blank assist.
- Railgun/beam/direct weapons should hit projected target footprint with tolerance.
- Shotgun/cone weapons use cone + target footprint.
- Splash uses ground-plane projected radius.
- No full 3D turret pitch simulation now.
- Use practical 2.5D forgiveness for low/high bodies.
```

### Depth sorting / visual occlusion

Accepted:

```text
- Correct isometric depth sorting is part of mechanics readability, not optional polish.
- Units behind buildings render behind them.
- Units in front of buildings render above them.
- Units beside buildings must not look like buildings are driving over them.
- Building depth should be based on footprint/front-bottom edge on the ground plane.
- Unit depth should be based on ground contact point / logical tile position / projected bottom point.
- Large buildings must consider footprint, not sprite center.
```

Separate systems:

```text
Collision = can the unit go there?
Depth sorting = which object renders above another?
Occlusion = should a unit be visually hidden behind a building?
```

Rejected:

```text
- all buildings always above units
- all units always above buildings
- building depth by sprite center or top point
- manual per-building z-index hacks
```

---

## 7. Weapon model

### Display names

```text
Smoky        -> Смоки
Thunder      -> Гром
Railgun      -> Рельса
Shaft        -> Шафт
Flamethrower -> Огнемёт
Freeze       -> Фриз
Isida        -> Изида
Vulcan       -> Вулкан
Twins        -> Твинс
Ricochet     -> Рикошет
Hammer       -> Молот
```

Internal code ids may remain English.

### Weapon categories

```text
Cooldown weapons:
- Смоки
- Гром

Wind-up weapon:
- Рельса

Deferred weapon:
- Шафт

Canister / stream weapons:
- Огнемёт
- Фриз
- Изида

Overheat / spin-up weapon:
- Вулкан

Near-continuous fire:
- Твинс

Charge/magazine/bounce weapon:
- Рикошет

Drum / shotgun weapon:
- Молот
```

### Global weapon fields

Every weapon should define:

```text
displayName
rangeClass
minRange
idealRange
maxRange
stopDistance
fireType
cooldown / windUp / canister / overheat / magazine / drum model
damage model
VFX profile
turretTurnSpeed
M0-M3 scaling
```

### Global M0-M3 rules

Accepted:

```text
- M0-M3 always increase damage.
- M0-M3 increase turret turn speed.
- M0-M3 improve each weapon's profile-specific parameter.
- VFX becomes more readable, denser, more contrast-heavy from M0 to M3.
- VFX does not always become brighter; Smoky can become darker/denser.
- Modification improves weakness but does not erase weapon identity.
```

Example:

```text
Railgun M3 turns faster than Railgun M0, but still does not turn like Freeze or Flamethrower.
```

---

## 8. Accepted weapon mechanics by weapon

### Смоки

```text
- Medium range basic cannon.
- Single projectile.
- Cooldown/reload based.
- No critical shot in our version.
- M0-M3 improve damage, cooldown, turret turn speed.
- VFX is smoky/dense impact.
- M0 = pale weak puff.
- M3 = denser/darker/more readable impact.
```

### Гром

```text
- Medium range explosive shell.
- Single shot with splash damage.
- Splash radius does NOT increase from M0 to M3.
- Close combat is risky because explosion happens near the shooter.
- M0-M3 improve damage, cooldown, turret turn speed, impact readability.
```

### Рельса

```text
- Medium-long / long-range weapon.
- High single-shot damage.
- Has wind-up / mini energy charge before shot.
- Visual sequence: barrel glow / charge -> shot -> cooldown.
- Long cooldown.
- Slow turret turn speed.
- Can include penetration / shooting through units as important identity.
- M0-M3 improve damage, wind-up speed, cooldown, turret turn speed.
- VFX shifts from pale cyan toward denser/darker/stronger colors.
```

### Шафт

```text
DEFERRED.
```

Reason:

```text
- sniper mode
- special aim mode
- very long range
- separate UI/camera/aiming model
- possible immobility while aiming
- separate canister/charge behavior
```

Shaft should not be included in the nearest weapon roadmap.

### Огнемёт

```text
- Short range stream weapon.
- Fuel canister.
- Fires cone stream while attack is held/active.
- Does not pierce through tanks.
- Applies ignite buildup.
- M0 makes it hard to ignite enemies quickly.
- M3 ignites enemies quickly.
- Can reduce/clear freeze on allies if that mechanic is implemented.
- M0-M3 improve damage, ignite buildup, canister size, drain, regeneration, turret turn speed and stream VFX density.
```

### Фриз

```text
- Short range stream/support-control weapon.
- Freon canister.
- Fires cone stream while attack is held/active.
- Does not pierce through tanks.
- Applies freeze/slow buildup to enemies.
- Slows enemies, does not necessarily fully stop them.
- Cools/extinguishes burning allies.
- Accelerates cooling of allied overheated Vulcan.
- High turret turn speed is important to role.
- M0 weakly slows/cools.
- M3 quickly slows, extinguishes and cools.
- M0-M3 improve effectiveness, freeze buildup, slow strength, cooling power, canister, drain, regeneration and turret turn speed.
```

### Изида

```text
- Short range support beam.
- Energy canister.
- Beam reaches target instantly.
- Auto-targets nearest allied tank within attack cone / valid target area.
- Heal-only in nearest scope.
- Damage mode is rejected for now.
- M0-M3 improve heal rate, canister size, drain, regeneration, turret turn speed and beam readability.
```

### Вулкан

```text
- Medium range minigun / machine gun.
- Requires barrel spin-up before sustained fire.
- Builds heat while firing.
- Overheat can jam weapon or apply penalty/damage.
- Cools when not firing.
- Turret turn speed is reduced while firing due to gyroscopic/spin effect.
- Gyroscopic effect can help the gun hold direction while body moves.
- Allied Freeze can accelerate cooling.
- M0-M3 improve damage, heat build-up, cooling, overheat penalty, spin-up stability and turret turn speed.
```

### Твинс

```text
- Short/medium range twin plasma weapon.
- Alternates shots from two barrels.
- High fire rate.
- Projectile/plasma balls travel to target.
- Small splash can exist.
- No canister and no overheat in base accepted model.
- Near-continuous reliable fire.
- M0-M3 improve damage, fire tempo, projectile speed/readability and turret turn speed.
```

### Рикошет

```text
- Short/medium range charge/magazine weapon.
- Limited stock of charges/projectiles.
- Charges regenerate while not firing.
- Can fire with partial stock.
- Projectiles bounce from surfaces.
- Can hit targets outside direct line if bounce path exists.
- Self-hit risk can be deferred.
- M0-M3 improve damage, charge regeneration, magazine/stock quality, bounce behavior, turret turn speed and VFX density.
```

### Молот

```text
- Short range shotgun.
- Drum / magazine like revolver.
- Base identity: 3 fast volleys, then long reload.
- Can fire one volley at a time or quickly empty the drum.
- Short delay between volleys.
- Long reload after drum is empty.
- Partial magazine is not reloaded until normal reload cycle.
- Pellets spread in a cone.
- Damage depends on pellet hits.
- One pellet ricochet can be deferred.
- M0-M3 improve damage, drum, reload, delay between volleys, turret turn speed and shotgun VFX density.
```

---

## 9. Body model

### Display names

```text
Wasp     -> Васп
Hornet   -> Хорнет
Hunter   -> Хантер
Viking   -> Викинг
Dictator -> Диктатор
Titan    -> Титан
Mammoth  -> Мамонт
```

Internal code ids may remain English.

### Global body fields

Every body should define:

```text
displayName
role
HP
armor
mass
speed
acceleration
braking
bodyTurnSpeed
footprint/collision class
```

### Armor model

Accepted:

```text
flat armor reduction + minimum damage floor
```

Example formula:

```text
finalDamage = max(rawDamage - armor, rawDamage * minDamagePercent)
```

Meaning:

```text
- armor reduces small frequent hits
- no weapon should deal 0 damage forever
- Vulcan is weak against Mammoth but still deals some damage
- Railgun remains useful against heavy bodies
```

### Mass and recoil

Accepted:

```text
- Body mass is fixed per body.
- Recoil resistance is fixed per body through mass.
- M0-M3 body upgrades do NOT increase mass.
- M0-M3 body upgrades do NOT increase recoil resistance.
- Light bodies always remain light.
- Heavy bodies always remain heavy.
```

Recoil principle:

```text
visual recoil = weaponRecoil / bodyMass
```

Visual recoil must not break tile occupancy.

### Body M0-M3

Accepted body modification improvements:

```text
- HP
- armor
- speed
- acceleration
- braking
- body turn speed
```

Rejected body modification improvements:

```text
- mass increase
- recoil resistance increase
- footprint change
- role change
```

### Body roles

```text
Васп:
- fast scout / flanker / hit-and-run
- low HP, low armor, high speed, strong recoil impact

Хорнет:
- light raider / mobile fighter
- faster than medium, tougher than Wasp, still fragile

Хантер:
- universal medium / baseline body
- default test and balance reference

Викинг:
- medium-heavy brawler
- more HP/armor than Hunter, slower

Диктатор:
- high medium-heavy support/control platform
- stable platform for support and mid/long weapons
- visual height must not break hit model

Титан:
- heavy frontline / stable firing platform
- high HP/armor/mass, slow movement and turn

Мамонт:
- super-heavy fortress
- maximum HP/armor/mass, very slow, very vulnerable to flanking
```

Rejected:

```text
- bodies differ only by HP
- same speed for all bodies
- same recoil response for all bodies
- Wasp handles Railgun like Mammoth
- Mammoth moves like Hunter
- body height causes missed shots
```

---

## 10. Factions

### Accepted faction identity

```text
Поток
Циановая фракция
Бонус: мобильность и быстрый темп

Росток
Зелёная фракция
Бонус: строительство и экономика

Искра
Жёлтая фракция
Бонус: боевое производство

Око
Фиолетовая фракция
Бонус: обзор и контроль территории
```

Internal ids remain:

```text
cyan
green
yellow
purple
```

### Rules

```text
- Factions must not be just colors.
- Each faction has a passive mechanic.
- Active abilities are not included now.
- Bonuses must be config-driven.
- Bonuses must be visible in faction selection UI.
- Random, if kept, must reveal selected faction and bonus.
```

### Direction by faction

```text
Поток:
- mobility
- fast tempo
- civil/light unit production or movement tempo
- no big universal speed bonus to all units
- no direct damage bonus

Росток:
- construction
- economy
- processing/storage efficiency
- avoid overpowered snowball

Искра:
- combat production
- combat readiness/tempo
- no large direct damage bonus at start

Око:
- vision
- territory
- map control
- future tech/upgrade angle
- vision must create real advantage but not reveal everything
```

Rejected:

```text
- purely color-named factions
- hidden bonuses
- active abilities now
- unique tech tree per faction now
- huge direct +damage bonus
```

---

## 11. Resources and map layout

### Normal map model

```text
- Normal game uses Industrial Platform.
- Normal game uses Generated maps.
- Sand Classic and Map 1 hidden from normal UX.
- Map 1 may be used as reference for resource anchors.
- Generation should be controlled and testable, not chaotic.
```

### Accepted resource classes

There are 6 deposit classes, aligned to existing industrial assets:

```text
very_poor
UI: Очень бедная залежь
asset: resource_industrial_very_poor_01

poor
UI: Бедная залежь
asset: resource_industrial_poor_01

medium
UI: Средняя залежь
asset: resource_industrial_medium_01

rich
UI: Богатая залежь
asset: resource_industrial_rich_01

very_rich
UI: Очень богатая залежь
asset: resource_industrial_very_rich_01

infinite
UI: Бесконечная залежь
asset: resource_industrial_infinite_center_2x2_01
```

### Placement model

```text
- Starter zone uses very_poor / poor / medium.
- Side / intermediate zones use medium / rich.
- Contested zones use rich / very_rich.
- Center uses infinite 2x2 deposit.
- Key resource points use fixed anchors.
- Small controlled variation around anchors is allowed.
- Exact amounts live in config, not hardcode.
```

Preliminary amount model, not final balance:

```text
Очень бедная: 150-250
Бедная: 300-500
Средняя: 800-1200
Богатая: 1800-2500
Очень богатая: 3500-5000
Бесконечная: infinite or 50000+
```

Rejected:

```text
- 4 deposit classes
- equal amount for every deposit asset
- very_poor/very_rich as visual-only classes
- infinite deposit outside center
- chaotic generation with no readable anchor logic
```

---

## 12. Buildings

### Principle

Buildings are gameplay/economy/progression objects, not random decor.

Next repo may be used only as reference/specification:

```text
- building names
- roles
- asset references
- mechanic ideas
```

Rejected:

```text
- copying Next code
```

### Building readiness classes

```text
Gameplay-ready:
- has mechanics immediately

Visual-ready / mechanic later:
- can be placed/seen but clearly marked as planned/decorative

Deferred:
- not added until mechanics exist
```

### Accepted building model

Core gameplay-ready first:

```text
- Главное здание
- Сепаратор
- Хранилище сырья
- Хранилище энергии
- Хранилище элементов
- Фабрика юнитов
```

Gameplay later:

```text
- Ремонтный центр
- Оборонная башня
- Энергостанция / Энергореактор
```

Planned / later:

```text
- Командный узел / Радар / Ретранслятор
- стены / оборонные блоки
- tech buildings
```

### Notes by building

```text
Главное здание:
- start base
- drop-off point
- base vision
- starting storage
- defeat condition later

Сепаратор:
- raw minerals -> energy + faction element
- needs clear statuses: no raw, output full, working

Хранилища:
- raise limits
- no passive production

Фабрика юнитов:
- produces units
- queue/progress
- production cost based on accepted economy

Энергостанция/Энергореактор:
- should not replace Separator
- should improve energy infrastructure / processing / limits

Ремонтный центр:
- stationary repair
- consumes energy
- does not replace Isida

Оборонная башня:
- base defense later
- not priority until enemy attacks/bot/waves exist

Командный узел / Радар:
- vision/territory/control
- good future fit for Око

Стены:
- not random obstacles
- can later be buildable defense
- only after pathing/occupancy is solid
```

Rejected:

```text
- adding all buildings at once
- unclear visual-only buildings
- random obstacles returning as buildings
- walls before pathfinding/occupancy is ready
- unique faction buildings now
- buildings without Russian UI names
```

---

## 13. Animation and physical feel

### Accepted

```text
- Hybrid animation API.
- Procedural/blockout animation is allowed now.
- API must be designed so procedural can later be replaced by spritesheets/final assets.
- No one-off implementation tied only to current rectangles/PNGs.
```

### Movement feel

```text
- Units accelerate.
- Units brake.
- Body turns through turn rate.
- Heavy bodies turn slower.
- Light bodies turn faster.
- Visual smoothing must not break tile logic.
```

### Tracks / wheels

```text
- Tracks/wheels animate only while moving or turning.
- Standing unit does not animate tracks/wheels.
- During turn-in-place, tracks can move in opposite directions.
- Animation speed depends on unit movement speed.
```

### Recoil

```text
- Recoil is visual/body impulse.
- Recoil depends on weaponRecoil and bodyMass.
- Recoil does not move logical tile occupancy.
```

### Turret animation

```text
- Body and turret rotate separately.
- Turret has turretTurnSpeed.
- TurretTurnSpeed depends on weapon and M0-M3.
- Turret does not snap instantly to target.
- Barrel/turret can have visual recoil.
```

### Idle rule

```text
- Standing unit must not jump, bob or shake.
- Dust does not appear when unit is standing.
- Tracks/wheels do not animate when standing.
- Turret may turn only if target/command exists.
```

### Dust / track FX

```text
- Effects only while moving/turning.
- Heavier bodies can produce stronger industrial dust/track marks.
- Effects must not clutter screen.
```

Rejected:

```text
- instant body snap
- instant turret snap
- idle bobbing/shaking
- dust from standing units
- recoil that breaks tile occupancy
- animation system hardwired to one asset
```

---

## 14. AI boundary

### Accepted

```text
- Production bot is not included in the nearest roadmap.
- Arena enemy behavior modes remain as test tools.
- Strategic AI / waves / economy AI / enemy base building are deferred.
- Future bot needs separate intake/audit/roadmap.
```

Current Arena modes can remain:

```text
passive
stationary_shooter
chaser
hold_position
```

Rejected now:

```text
- full bot
- enemy economy
- enemy base
- strategic decisions
- attack waves
- enemy build orders
- scouting AI
- faction AI
- complex combat micro AI
```

Reason:

```text
Core movement, combat, economy, buildings, UI and collision must be stable before strategic AI makes sense.
```

---

## 15. Suggested next roadmap groups

This section is not the final roadmap. It is a recommended grouping for roadmap drafting.

### Group 1 — UI / Start Flow / Localization

```text
Russian UI, Industrial-only normal flow, remove Sand/Map1 from normal UX, unified style, faction display.
```

### Group 2 — Config / Data Model Foundation

```text
displayName, localization, weapon/body/faction/resource/building configs.
```

### Group 3 — Map / Resources / Industrial-only Generation

```text
6 deposit classes, fixed anchors, controlled variation, start/side/center resources, amounts in config.
```

### Group 4 — Buildings / Core Economy Loop

```text
HQ, Separator, storages, Units Factory, asset mapping, Russian descriptions.
```

### Group 5 — Unified Unit Control

```text
LMB selection, RMB command, S stop, Esc, MMB/arrow camera. All unit types aligned.
```

### Group 6 — Movement / Occupancy / Depth

```text
grid pathing, waypoint smoothing, physical turn, reservation, no overlap, correct isometric depth/occlusion.
```

### Group 7 — Combat Core

```text
target-lock, attack command, min/ideal/max range, stopDistance, hit footprint, aim forgiveness, point-blank assist.
```

### Group 8 — Weapon Mechanics

```text
All accepted weapons except Shaft: cooldown/wind-up/canister/overheat/magazine/drum/status/turretTurnSpeed/M0-M3/VFX.
```

### Group 9 — Body Mechanics

```text
7 bodies, roles, HP, armor, mass, speed, acceleration, braking, turn speed, footprint, fixed recoil response, M0-M3 without mass changes.
```

### Group 10 — Animation / Physical Feel

```text
hybrid animation API, procedural now, spritesheet-ready later, tracks/wheels, recoil VFX, no idle shaking.
```

---

## 16. Backlog / later

```text
- Shaft
- production bot
- attack waves
- strategic AI
- economy AI
- enemy base
- Arena save/load setups
- Arena JSON import/export
- unique faction tech trees
- active faction abilities
- final animation asset pipeline
- mass asset generation
- buildable walls/barriers
- faction-specific buildings
- minimap/fog expansion
- full 3D turret pitch / ballistics
```

---

## 17. Roadmap drafting rule

Next roadmap should be based on this decision document, not directly on the raw exploratory audit.

Roadmap should not accept every idea from the exploratory audit.

Roadmap should include only accepted mechanics from this file.
