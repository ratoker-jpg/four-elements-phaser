# MECHANICS_INTAKE_2026_06_03.md

Status: owner mechanics intake / pre-roadmap source  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Author: Denis, captured by GPT  
Date: 2026-06-03

---

## 1. Purpose

This document captures the mechanics, UX concerns, visual expectations and gameplay direction Denis wants to investigate next.

This is **not** a roadmap.  
This is **not** an implementation audit.  
This is **not** a task list for code implementation.

This is a product/mechanics intake document for a later **exploratory mechanics/design audit**.

Target process:

```text
owner mechanics intake
-> GLM exploratory mechanics/design audit with alternatives
-> Denis + GPT discussion
-> accepted mechanics set
-> roadmap
-> implementation/system audit
-> High+/High PR sequence
```

Important:

```text
Do not create implementation tasks directly from this file.
Do not make a roadmap before the exploratory mechanics audit is reviewed.
Do not implement code from this file without accepted roadmap/audit.
```

---

## 2. Process change

Previous process:

```text
roadmap -> huge audit -> High+/High implementation PR sequence
```

New preferred process for this phase:

```text
1. Owner describes desired mechanics and problems.
2. GPT captures them in a mechanics intake document.
3. GLM performs a huge exploratory mechanics/design audit.
4. Audit proposes better/different mechanics, not only implementation steps.
5. Audit may propose mechanics beyond the owner list.
6. Denis + GPT discuss what to accept/reject.
7. GPT creates a roadmap from accepted mechanics.
8. GLM/GPT create a system implementation audit if needed.
9. Only then implementation PRs start.
```

---

## 3. Creative audit expectation

GLM must **not** limit itself to the mechanics explicitly listed by Denis.

GLM should actively propose:

```text
- better mechanics
- alternative mechanics
- original mechanics suitable for Four Elements
- cleaner RTS control models
- more interesting faction identities
- weapon mechanics not explicitly requested
- body/weapon synergy models
- map/economy pacing ideas
- Phaser 4-friendly animation/rendering options
- UI/UX improvements based on RTS best practices
- risk-based tradeoffs
```

Allowed inspiration sources:

```text
- StarCraft / StarCraft II
- Warcraft III
- Command & Conquer
- Red Alert
- Supreme Commander
- Total Annihilation
- Company of Heroes
- classic RTS command UX
- arena/tank games similar in spirit to Tanki-like weapon/body mechanics
```

Restrictions:

```text
Use these as design inspiration only.
Do not copy assets, names, UI, exact balance, exact faction identities or copyrighted content.
Do not propose direct StarCraft cloning.
Translate useful RTS principles into original Four Elements mechanics.
```

---

## 4. Current high-level goal

Polish and deepen the current playable baseline instead of jumping to a bot/opponent roadmap.

Focus:

```text
- Russian UX/localization
- clean Industrial Platform-only game start flow
- better menu/UI style consistency
- faction mechanics
- tank movement and combat behavior
- weapon mechanics and upgrade progression
- body mechanics and body/weapon interaction
- building set expansion from existing assets/reference
- resource layout and mineral amounts
- animation/physics feel
```

Explicit non-goal for now:

```text
Do not make a bot/opponent roadmap now.
Bot/enemy strategy is a later stage.
Current goal is to polish and systematize what exists and what the player directly uses.
```

---

## 5. UX and localization

### 5.1 Russian language

Current issue:

```text
Main menu and in-game UI are mostly English:
New Game, Continue, Settings, Debug Panel, Game Mode, Map Style, etc.
```

Desired direction:

```text
Translate all user-facing UI to Russian.
```

Examples:

```text
New Game -> Новая игра
Continue -> Продолжить
Settings -> Настройки
Game Mode -> Режим игры
Standard -> Стандартный
Debug -> Отладка
Arena -> Арена
Generated -> Сгенерированная
Small / Standard / Large -> Маленькая / Стандартная / Большая
Debug Panel -> Отладочная панель
```

The title Four Elements may remain English if it fits branding.

### 5.2 Remove or hide obsolete options

Current issue:

```text
The game still offers Sand Classic and Map 1.
Denis does not plan to return to them.
```

Desired direction:

```text
Move fully to Industrial Platform as the primary/only map style.
Remove Sand Classic from normal UX.
Remove Map 1 from normal UX.
Keep Generated as the normal map flow.
```

Audit should decide:

```text
Should Map Style be removed entirely?
Should legacy Sand Classic and Map 1 remain only behind debug/dev flags?
```

### 5.3 Game mode selection

Current state is acceptable:

```text
Game Mode: Standard / Debug / Arena
```

Desired direction:

```text
Keep Standard / Debug / Arena for now.
Translate labels to Russian.
Make mode purpose clearer.
```

### 5.4 Map size values

Current visible values:

```text
Small = 32x32
Standard = 48x48
Large = 64x64
```

Denis suspects previous target values may differ.

Audit should check:

```text
- current code values
- previous docs/decisions
- what sizes make sense for Industrial Platform
- performance implications
- whether size names should be changed
```

### 5.5 UI style consistency

Current issue:

```text
Some buttons are yellow, some green, some inconsistent.
```

Desired direction:

```text
Bring menus/buttons/panels to one consistent visual style.
Use sandy/industrial menu references Denis liked as visual direction.
```

Audit should propose:

```text
- one UI palette/system
- button states
- panel style
- Russian text layout rules
- whether debug UI should look different from player-facing UI
```

---

## 6. Faction naming and mechanics

Factions:

```text
cyan
green
yellow
purple
```

Desired direction:

```text
Translate faction names to Russian for user-facing UI.
Define meaningful mechanics for every faction.
```

Need cover:

```text
- Russian faction name
- gameplay identity
- starting bonus or passive effect
- economy bonus
- combat bonus
- visual/UI identity
- risk of imbalance
- config-driven implementation model
```

Important:

```text
Do not just translate colors.
Each faction should eventually have a mechanic.
GLM should propose multiple faction design packs, not one conservative variant.
```

Possible starting point, not approved balance:

```text
Cyan    -> speed / production / control identity
Green   -> building / economy / growth identity
Yellow  -> attack / weapon / production identity
Purple  -> vision / territory / tech identity
```

Creative audit expectation:

```text
Propose at least 2-3 alternative faction identity models:
- simple passive bonuses
- active faction abilities
- tech-tree differences
- territory/economy/combat asymmetry
- risk assessment for each
```

---

## 7. Tank/unit control model

### 7.1 Desired control model

Owner preference:

```text
Select tank/unit with LMB.
Move selected tank/unit with LMB on ground.
Click enemy with LMB to attack/target that enemy.
```

Current concern:

```text
Arena/blockout movement currently uses RMB in some places.
Normal harvester/builder flow differs.
```

Audit should compare and recommend:

```text
- classic RTS: LMB select, RMB command
- owner preferred: LMB select + LMB move/attack
- hybrid model
- mobile-like one-button command model
```

Need decide:

```text
- should all unit movement use LMB
- should RMB be cancel/context/alternative command
- how this affects harvester/builder controls
- how to avoid conflicts with camera pan and UI
```

### 7.2 Attack command

Desired behavior:

```text
If selected tank clicks enemy, selected tank receives attack order.
Turret turns toward target.
Hull moves if target is out of weapon range.
Tank stops at sensible attack distance.
Tank fires when weapon can hit.
```

---

## 8. Tank movement model

### 8.1 Grid-based movement

Current issue:

```text
Blockout tanks move along chaotic/free lines.
```

Desired direction:

```text
Tanks should move like harvesters/builders: by map cells / through tile centers.
No free diagonal sliding as the primary model.
```

Expected behavior:

```text
- Unit moves through cell centers.
- Movement path is tile/grid-based.
- Unit should not cut through other units.
- Diagonal movement should not be primary unless explicitly approved.
```

Audit should inspect:

```text
- current harvester/builder movement model
- current blockout tank movement model
- current pathfinding/passability/occupancy capabilities
- how to adapt tank movement without breaking arena tests
```

### 8.2 Turn physics / no instant direction teleport

Current issue:

```text
Harvester/builder PNG direction can instantly flip when command changes.
This looks like teleporting direction.
```

Desired direction:

```text
Units should physically rotate/turn before driving in the new direction.
```

Audit should propose:

```text
- grid-compatible turn model
- turn radius / turn time / turn animation logic
- how this applies to PNG units with directional frames
- how this applies to procedural/blockout tanks
- whether turning should be separate state: turning_in_place / turning_arc / moving
```

### 8.3 Unit-to-unit collision / no overlap

Current issue:

```text
Tanks can drive into each other or too close.
Short-range weapons may fail if unit overlaps target and shot passes through.
```

Desired direction:

```text
Units should not enter each other's occupied space.
Tanks should stop at a proper attack distance.
```

Audit should propose:

```text
- occupancy model
- collision radius vs tile footprint
- stopping distance by weapon class
- how to avoid deadlocks
- whether blocked movement should repath or stop
```

---

## 9. Turret aiming, fire line and hit model

### 9.1 Turret aiming

Current issue:

```text
Procedural tank turret/barrel sometimes does not point toward enemy.
Visual line/aim and turret can disagree.
```

Desired direction:

```text
When target is assigned, turret visually points at the target.
Visual turret/barrel direction and logical fire/damage direction must match.
```

Audit should check:

```text
- target-lock implementation from Arena
- shared projected vehicle geometry helpers
- visual barrel tip vs damage origin
- angle basis mismatch
- coordinate system mismatch
- body angle / turret angle interaction
```

### 9.2 Hit model for different body heights/sizes

Current concern:

```text
Some shots may miss because body/turret height/geometry is too literal.
Example: weapon line may miss a lower/higher body.
```

Desired direction:

```text
Railgun should hit an enemy even if target body is visually lower/higher.
The player should not see obvious misses caused by missing vertical tilt simulation.
```

Important:

```text
Do not necessarily implement real turret pitch/up-down mechanics.
Propose a practical 2.5D hit model that feels correct.
```

Audit should propose:

```text
- 2.5D hit volumes
- body hit capsules/boxes
- target assist / aim forgiveness
- per-weapon hit tolerance
- raycast against target body footprint/volume instead of a single line
- how to keep visual and logic consistent
```

---

## 10. Weapon range classes and attack behavior

Weapons:

```text
Smoky
Thunder
Railgun
Shaft
Flamethrower
Freeze
Isida
Vulcan
Twins
Ricochet
Hammer
```

Audit should propose for each:

```text
- short / medium / long / special range class
- ideal attack distance
- minimum stop distance
- whether it needs line of sight
- whether it is continuous, burst, projectile, beam, shotgun/cone, splash, ricochet, charge/sniper
- whether it has ammo/energy/canister resource
- upgrade/modification effects M0-M3
```

Owner concerns:

```text
- Railgun currently fires too fast.
- Isida can damage continuously without meaningful resource limit.
- Flamethrower / Freeze / Ricochet / Isida should have canister/charge mechanics.
- Some weapons should not fire infinitely without limitation.
- Twins may be one of the weapons that can fire almost continuously.
```

Creative audit expectation:

```text
Propose weapon mechanics as a coherent arsenal:
- roles
- counters
- range bands
- micro requirements
- readable VFX
- upgrade identity
- risk of dominant strategies
```

---

## 11. Weapon resource / canister mechanics

Affected weapons explicitly mentioned:

```text
Flamethrower
Freeze
Ricochet
Isida
```

Maybe affected or to inspect:

```text
Vulcan
Shaft
Twins
```

Design idea:

```text
- Weapon has a canister/charge pool.
- Firing spends charge.
- Charge regenerates over time.
- Higher modification levels regenerate faster and/or spend less.
```

Audit should propose:

```text
- per-weapon canister/energy model
- UI indication for charge/ammo
- cooldown vs charge relationship
- M0/M1/M2/M3 scaling
- how to test this in Arena before final production combat
```

---

## 12. Weapon upgrade / modification VFX

Examples from owner:

```text
Railgun:
M0 -> very light / pale cyan shot
M1 -> stronger blue shot
M2 -> purple shot
M3 -> red shot

Isida:
M0 -> near white beam
M1 -> light blue
M2 -> stronger blue
M3 -> deep/strong blue
```

General pattern:

```text
M0 = pale/desaturated/weak visual
M3 = strong saturated/distinct visual
```

Audit should propose:

```text
- VFX color progression for every weapon
- how to represent M0-M3 in config
- how to keep VFX readable without final assets
- whether upgrade levels should affect damage, cooldown, range, charge, recoil, status effects
```

---

## 13. Body mechanics and body/weapon interaction

Current issue:

```text
Bodies feel too similar. Mammoth, Titan, Dictator, Wasp etc. should not feel the same.
```

Desired direction:

Each body should have meaningful mechanics.

Need define per body:

```text
- HP / armor
- mass
- speed
- turn speed
- acceleration/braking
- turret mount category
- recoil resistance
- collision footprint
- role identity
```

Body/weapon interaction:

```text
Weapon recoil should depend on body mass/weight.
Railgun on Wasp should create stronger recoil/impulse.
Railgun on Mammoth/Titan should create weaker recoil/impulse.
Same principle can apply to Smoky and other weapons.
```

Creative audit expectation:

```text
Propose body roles like scout, light skirmisher, medium brawler, heavy siege, anchor/tank.
Propose tradeoffs, not just stat scaling.
```

---

## 14. Buildings and asset reuse

Current issue:

```text
Only a small building set is currently used.
Existing building assets from the project / Next reference are not fully reused.
```

Desired direction:

```text
Define a fuller building set and reuse available approved assets where possible.
Use four-elements-next as reference/specification, not direct implementation source.
```

Audit should inspect:

```text
- current Phaser building types/configs/assets
- available assets in repo
- relevant building set in four-elements-next
- which buildings can be reused now
- which buildings need mechanics later
```

Need propose:

```text
- building list
- purpose of every building
- unlock/production relationship
- asset availability
- implementation risk
- whether to split visual reuse and gameplay mechanics
```

Creative audit expectation:

```text
Propose building roles beyond current list if useful:
- tech/research
- scouting/radar
- repair
- defense
- economy
- storage
- unit production
- faction-specific buildings
- neutral map structures
```

---

## 15. Resource layout and mineral amounts

### 15.1 Static starting resource layout

Desired direction:

```text
Starting resource placement should be predictable/static enough.
Use Map 1 as a reference for resource positions if useful.
```

Expected resource layout direction:

```text
- central infinite mineral/resource node
- additional minerals on sides/edges
- good starting resources near player
- resource positions should support predictable gameplay testing
```

Audit should propose:

```text
- static vs generated resource layout
- how to combine Industrial Platform generated map with fixed resource anchors
- how to scale layout for map sizes
- what should be deterministic
```

### 15.2 Mineral richness / amounts

Past concepts:

```text
poor / medium / rich / infinite
```

Audit should propose:

```text
- exact amounts per resource class
- naming in Russian
- how amounts affect harvester loop and economy pacing
- whether infinite center should be truly infinite or very large
```

---

## 16. Animation and movement feel

Desired direction:

```text
Add stronger physical feel to movement and combat.
```

Needed areas:

```text
- tank track animation
- turn animation
- body rotation/turn physics
- recoil animation based on body mass
- weapon fire VFX by modification level
```

Audit should propose Phaser-friendly options:

```text
- spritesheets / frame animation
- procedural track animation with Phaser Graphics
- shader/texture offset style animation if feasible
- separate body/turret sprites
- animation state per unit
- fallback for blockout/procedural vehicles
```

Creative audit expectation:

```text
Propose multiple animation tiers:
- no-new-assets procedural feel pass
- minimal spritesheet pass
- full asset pipeline pass
- what each tier costs and unlocks
```

---

## 17. Phaser-specific exploration topics

The exploratory audit should analyze how Phaser can support:

```text
- sprite lists / spritesheets / atlases for bodies, turrets, tracks
- separate body and turret containers/sprites
- animation state per unit
- projected world-space rendering
- DOM UI localization
- input command routing
- movement/path commands by tile
- debug tools for combat tuning
- VFX layering
- performance implications
```

Audit should cite current repo files and Phaser-friendly implementation paths.

---

## 18. Historical project notes to consider

Older Four Elements notes already fixed several important principles:

```text
- territory should spread slowly, one cell at a time
- 2x2 building territory should paint gradually over 45-60 seconds
- minerals and energy should not collapse into one resource
- idle animation should be off when a unit is standing still
- RTS click feedback should show accepted/blocked commands
- harvester should move slower and gather small/medium/large/infinite deposits differently
```

These older decisions are useful historical context, but the current Phaser repo and current docs are the implementation source of truth.

---

## 19. Explicit non-goals for the next audit

Do not focus on:

```text
- bot roadmap
- full strategic enemy AI
- economy AI
- attack waves as the main plan
- final production combat implementation
- final art generation
- massive asset generation
- save/load for Arena unless proposed as later optional
```

The priority is to polish and systematize existing mechanics and near-term player-facing behavior.

---

## 20. Expected GLM exploratory audit output

The audit should produce a large Markdown document, roughly 1000-1500+ lines if needed.

It should include:

```text
1. current code reality
2. owner mechanics grouped by domain
3. contradictions / risks / missing decisions
4. proposed improved mechanics
5. creative mechanics not mentioned by Denis
6. 2-3 design options for major systems
7. recommended direction
8. what to defer
9. what to remove from UX
10. Phaser-specific feasibility notes
11. likely PR groups, but not final roadmap
12. questions for Denis
```

Important:

```text
The audit should not be only "how to implement".
It must challenge and improve the mechanics.
It can propose alternatives that Denis did not explicitly mention.
It can propose RTS-inspired mechanics from StarCraft and other strategies.
It should explain which ideas are risky, inefficient or too expensive.
It should not become a final roadmap yet.
```

---

## 21. Raw owner intent summary

Short version:

```text
Translate the game to Russian.
Remove obsolete map options and standardize Industrial Platform flow.
Make UI/menu style consistent.
Define faction mechanics.
Make tanks controllable and readable like real units, not debug squares.
Make tank movement grid/path based with physical turning.
Make targeting/turret/fire behavior reliable.
Prevent unit overlap and too-close attack failures.
Define all weapon mechanics, ranges, ammo/charge/canister rules and M0-M3 VFX changes.
Differentiate all bodies and make recoil depend on body mass.
Expand building set using approved assets / Next as reference.
Define static resource layout and mineral richness amounts.
Explore Phaser-friendly animation options for tracks, turning, recoil and VFX.
Allow GLM to propose additional original mechanics based on RTS best practices and Phaser 4 capabilities.
Do not start bot roadmap yet.
```
