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

This is a product/mechanics intake document for a later exploratory audit.

Target process:

```text
owner mechanics intake -> exploratory mechanics audit with alternatives -> discussion -> roadmap -> implementation/system audit -> High+/High PR sequence
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

New preferred process:

```text
1. Owner describes desired mechanics and problems.
2. GPT captures them in a mechanics intake document.
3. GLM performs a huge exploratory mechanics audit.
4. Audit proposes better/different mechanics, not only implementation paths.
5. Denis + GPT discuss what to accept/reject.
6. GPT creates a roadmap from accepted mechanics.
7. GLM/GPT creates a system implementation audit if needed.
8. Only then implementation PRs start.
```

Audit goal:

```text
Not only “how to implement this”.
Also: “how could this be better?”, “what alternatives exist?”, “what mechanics should be added or removed?”, “what would a strong RTS do here?”.
```

---

## 3. Creative audit requirement

GLM must not limit itself only to mechanics explicitly listed by Denis.

The exploratory audit should also propose its own variants, using:

```text
- current Four Elements Phaser code reality
- Denis's owner intent in this document
- StarCraft / Warcraft / Command & Conquer / Dune-style RTS patterns
- Tanki-like body+weapon mechanics where relevant
- browser RTS usability patterns
- Phaser 4 rendering, input, animation and scene capabilities
- fixed isometric / axonometric 2.5D camera constraints
```

GLM may suggest:

```text
- alternative faction mechanics
- alternative weapon mechanics
- better range/attack behavior
- better unit control model
- movement/turning models
- UI/UX improvements
- resource/map rules
- building roles
- animation/VFX approaches
- tuning/debug tools
- what to reject or defer
```

But GLM must clearly separate:

```text
A. Owner-stated requirement
B. GLM-proposed alternative
C. GLM recommendation
D. Risk / cost
E. What should be deferred
```

Do not blindly copy StarCraft or any other game. Use RTS references as design inspiration, not as assets/code/IP.

---

## 4. Current high-level goal

Polish and deepen the current playable baseline instead of jumping to a bot/opponent roadmap.

Focus:

```text
- Russian UX/localization
- clean Industrial Platform-only game start flow
- menu/UI consistency
- faction mechanics
- tank movement and combat behavior
- weapon mechanics and upgrade progression
- body mechanics and body/weapon interaction
- building set expansion from existing assets/reference
- resource layout and mineral amounts
- animation/physics feel
```

Explicit non-goal:

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

The title `Four Elements` can remain in English if it fits branding.

### 5.2 Remove obsolete map options

Current issue:

```text
The game still offers Sand Classic and Map 1.
Denis does not plan to return to Sand Classic.
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
- remove Map Style entirely vs keep hidden/debug-only
- whether legacy Sand/Map 1 should remain behind dev flags
- migration impact for saves/tests
```

### 5.3 Game modes and map sizes

Current Game Mode is acceptable:

```text
Standard / Debug / Arena
```

Translate and clarify mode names.

Current map sizes shown:

```text
Small = 32x32
Standard = 48x48
Large = 64x64
```

Audit should check previous decisions and propose better Industrial Platform sizes.

### 5.4 UI style consistency

Current issue:

```text
Some buttons are yellow, some green, style is inconsistent.
```

Desired direction:

```text
Bring menus/buttons/panels to one consistent style.
Use the sandy/industrial menu references Denis liked.
```

Audit should propose:

```text
- one UI palette/system
- button states
- panel style
- Russian text layout rules
- debug UI vs player-facing UI separation
```

---

## 6. Factions

Factions:

```text
cyan
green
yellow
purple
```

Desired direction:

```text
Translate faction names to Russian.
Define meaningful mechanics for every faction.
```

Audit should propose 2-3 alternative faction identity models.

Need cover per faction:

```text
- Russian user-facing name
- gameplay identity
- passive/start bonus
- economy bonus, if any
- combat bonus, if any
- visual/UI identity
- balance risks
- config-driven implementation path
```

Starting hypothesis only, not final balance:

```text
Cyan    -> speed / production / control identity
Green   -> building / economy / growth identity
Yellow  -> attack / weapon / production identity
Purple  -> vision / territory / tech identity
```

---

## 7. Unit control model

Desired control direction:

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

Audit should propose a unified RTS control model:

```text
- all unit movement on LMB vs RMB/context command
- camera pan conflict handling
- attack command behavior
- selection vs command mode
- how harvesters/builders/tanks should share controls
```

Attack command expected behavior:

```text
Click enemy -> assign attack target.
Turret turns toward target.
Hull moves if target is out of range.
Tank stops at sensible distance, not on top of target.
Tank fires when weapon can hit.
```

---

## 8. Tank movement model

### 8.1 Grid movement

Current issue:

```text
Blockout tanks move along chaotic/free lines.
```

Desired direction:

```text
Tanks should move more like harvesters/builders: by map cells / through tile centers.
No free diagonal sliding as primary movement model.
```

Expected behavior:

```text
- move through cell centers
- path is tile/grid-based
- no diagonal corner cutting unless explicitly approved
- no driving through other units
```

Audit should inspect current harvester/builder movement and current tank movement, then propose a shared model.

### 8.2 Turn physics

Current issue:

```text
Unit direction can snap/teleport when command changes.
```

Desired direction:

```text
Units should physically rotate/turn before driving in the new direction.
```

Possible mechanics to explore:

```text
- turning_in_place state
- turn_arc state
- tank-specific turn radius
- track/brake visual feedback
- direction frame interpolation for PNG units
- bodyAngle rotation for procedural/blockout units
```

### 8.3 Unit collision / no overlap

Current issue:

```text
Tanks can drive into each other or too close.
Short-range weapons may fail when units overlap.
```

Desired direction:

```text
Units should not enter each other's occupied space.
Tanks should stop at a proper attack distance.
```

Audit should propose:

```text
- tile occupancy vs collision radius
- stopping distance by weapon class
- soft collision / pushback vs hard blocking
- repath vs stop behavior
- deadlock risks
```

---

## 9. Turret aiming and hit model

Current issue:

```text
Procedural turret/barrel sometimes does not visually point toward enemy.
Visual aim line and actual barrel direction may feel inconsistent.
```

Desired direction:

```text
When target is assigned, turret visually points at target.
Visual turret/barrel direction and logical fire/damage direction must match.
```

Audit should check:

```text
- Arena target-lock implementation
- shared projected vehicle geometry helpers
- body angle / turret angle interaction
- visual barrel tip vs damage origin
- coordinate/projection mismatches
```

Hit model concern:

```text
Some shots may miss because body/turret height/geometry is too literal or because a line misses a lower/higher body.
```

Desired design direction:

```text
Do not necessarily implement real turret pitch.
Use a practical 2.5D hit model that feels correct.
```

Audit should propose:

```text
- 2.5D hit volumes
- body hit capsules/boxes
- target assist / aim forgiveness
- per-weapon hit tolerance
- raycast against body footprint/volume rather than one thin line
```

---

## 10. Weapon mechanics

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

Audit should classify each weapon by:

```text
- short / medium / long / special range class
- ideal attack distance
- minimum stop distance
- line of sight requirement
- firing model: continuous / burst / projectile / beam / shotgun / splash / ricochet / charge
- cooldown
- ammo/energy/canister system
- M0-M3 upgrade effects
- VFX progression
- balance risks
```

Owner concerns:

```text
Railgun currently fires too fast.
Isida can damage continuously without meaningful limit.
Flamethrower / Freeze / Ricochet / Isida should have canister/charge mechanics.
Some weapons should not fire infinitely without limitation.
Twins may be close to a weapon that can fire almost continuously.
```

---

## 11. Weapon charge/canister mechanics

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
- weapon has internal charge/canister pool
- firing spends charge
- charge regenerates over time
- higher modification levels regenerate faster and/or spend less
```

Audit should propose:

```text
- per-weapon charge model
- UI indication for charge/ammo
- cooldown vs charge relationship
- M0/M1/M2/M3 scaling
- Arena testability before final production combat
```

---

## 12. Weapon upgrade / modification VFX

Desired direction:

```text
Weapon VFX should change by modification level M0-M3.
```

Examples:

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
M3 = strong/saturated/distinct visual
```

Audit should propose VFX color/progression for every weapon.

---

## 13. Body mechanics and body/weapon interaction

Current issue:

```text
Bodies feel too similar. Mammoth, Titan, Dictator, Wasp etc. should not feel the same.
```

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

Audit should propose a formula/model.

---

## 14. Buildings and asset reuse

Current issue:

```text
Only a small building set is used.
Existing building assets and Next reference building concepts are not fully reused.
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
- which need mechanics later
- whether visual reuse and gameplay mechanics should be split
```

Do not copy old Next code directly.

---

## 15. Resources and map layout

Desired resource layout direction:

```text
- predictable/static enough starting resources
- central infinite mineral/resource node
- additional minerals on sides/edges
- good starting resources near player
- Map 1 can be used as reference for resource positions if useful
```

Audit should propose:

```text
- static vs generated resource layout
- Industrial Platform generated map with fixed resource anchors
- scaling layout for map sizes
- deterministic generation
- exact mineral amounts per class
```

Past concepts:

```text
poor / medium / rich / infinite
```

Need define exact amounts and Russian names.

---

## 16. Animation and movement feel

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
- texture atlases
- separate body and turret sprites
- procedural track animation with Phaser Graphics
- texture offset / shader-like approaches if feasible
- animation state machine
- blockout/procedural fallback
```

Need a realistic path that can actually be built in Phaser 4 / TypeScript.

---

## 17. Phaser-specific exploration topics

Audit should analyze how Phaser can support:

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

---

## 18. Explicit non-goals for the next audit

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

Priority is to polish and systematize existing mechanics and near-term player-facing behavior.

---

## 19. Expected GLM exploratory audit output

The audit should produce a large Markdown document, roughly 1000-1500+ lines if needed.

It should include:

```text
1. current code reality
2. owner mechanics grouped by domain
3. contradictions / risks / missing decisions
4. proposed improved mechanics
5. 2-3 design options for major systems
6. RTS-inspired alternatives and why they may/may not fit
7. Phaser 4 feasibility notes
8. recommended direction
9. what to defer
10. what to remove from UX
11. likely PR groups, but not final roadmap
12. questions for Denis
```

Important:

```text
The audit should not be only “how to implement”.
It must challenge and improve the mechanics.
It can propose alternatives that Denis did not explicitly mention.
It should use imagination, but stay implementable in Phaser 4.
It should clearly mark what is owner requirement vs GLM suggestion.
```

---

## 20. Raw owner intent summary

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
Let GLM propose its own RTS-inspired mechanics and alternatives.
Do not start bot roadmap yet.
```
