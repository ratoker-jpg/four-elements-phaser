# BLOCKOUT_MVP_CLOSURE_REPORT.md

Status: BLOCKOUT-MVP closed
Project: Four Elements Phaser
Repo: `ratoker-jpg/four-elements-phaser`
Date: 2026-06-02

---

## 1. What BLOCKOUT-MVP now supports

BLOCKOUT-MVP delivers a complete dev/arena combat sandbox for validating the full vehicle/weapon/obstacle/upgrade stack using Phaser blockout placeholders. No final art, no production combat, and no economy integration are required to validate gameplay geometry, behavior, and readability.

The sandbox supports:

- **7 body profiles** (Wasp, Hornet, Hunter, Viking, Dictator, Titan, Mammoth) with distinct sizes, mount categories, and movement feel
- **11 weapon families** covering all behavior types (instant projectile, instant splash, line penetration, charge sniper, cone stream x2, beam support, rapid fire, plasma projectile, ricochet projectile, shotgun cone)
- **Selection/deselection** with LMB click, selection ring, and hover marker
- **Independent turret aiming** toward mouse cursor, rate-limited per weapon
- **Semi-physics movement** with acceleration, braking, body rotation, and mass/power feel
- **Visual-only VFX** for all 11 weapons using Phaser Graphics primitives
- **Recoil** (barrel kickback, turret kickback, body impulse) with smooth recovery
- **HP/damage/destroyed state** with HP bars, damage flash, floating damage numbers, hit markers, status tags
- **Continuous damage** for cone/beam/rapid/plasma weapons with separate VFX and damage cadence
- **4 obstacle types** (blocker wall, cover crate, low barrier, dummy rock) with movement collision and line-of-fire blocking
- **5 upgrade types** (mobility boost, armor plating, weapon tuning, range extender, cooling system) with visual indicators and effective profile computation
- **Curated combat sandbox scenario** with 9 vehicles and 6 obstacles in deterministic layout
- **Dev help/legend overlay** (H toggles) explaining all controls
- **Selected vehicle status overlay** showing HP, upgrades, speed, fire readiness
- **Scenario reset** (R key) restoring sandbox to deterministic defaults
- **Vehicle cycling** (T key) for quick multi-vehicle testing

All blockout systems are gated behind the devtools/arena flag. Normal/default game remains completely unchanged.

---

## 2. Merged PR sequence

| Step | PR | Description |
|---|---|---|
| BLOCKOUT-02H | #166 | First visible blockout vehicles (profiles, state, renderer, spawn) |
| BLOCKOUT-03H | #167 | Selection/deselection, independent turret aiming |
| BLOCKOUT-04H+ | #168 | Semi-physics movement (acceleration, braking, body rotation) |
| BLOCKOUT-05H+ | #169 | Recoil + first weapon VFX set (Smoky/Railgun/Thunder) |
| BLOCKOUT-06H+ | #170 | Remaining weapon VFX families (all 11 weapons) |
| BLOCKOUT-07H+ | #171 | Damage placeholders (HP, hit detection, status effects) |
| BLOCKOUT-08H | #172 | Blockout obstacles (movement collision, line-of-fire blocking) |
| BLOCKOUT-09H | #173 | Upgrade skeleton + visual indicators |
| BLOCKOUT-10H+ | #174 | Combat readability sandbox + closure QA |

---

## 3. What is intentionally still not production

The following systems are explicitly **not** implemented in BLOCKOUT-MVP:

- **No production combat** — damage is placeholder, no win/lose conditions
- **No economy costs** — upgrades are free, no resource consumption
- **No production upgrades** — upgrade shop UI does not exist, levels are applied via debug hotkeys
- **No final assets** — all rendering uses Phaser Graphics primitives, no PNG sprites
- **No enemy AI/bots** — no computer-controlled opponents
- **No attack waves** — no scripted enemy encounters
- **No production pathfinding** — vehicles use direct movement, no nav mesh
- **No map generation changes** — arena is deterministic, no procedural maps
- **No save persistence** — blockout state is transient, stripped from saves
- **No fog of war** — all positions are visible
- **No full UI/shop** — no production HUD, no upgrade purchase interface
- **No map size migration** — arena is 20x20, production map is 32x32

---

## 4. Known limitations / acceptable blockout limitations

- Vehicles do not collide with each other (only with obstacles)
- Obstacle blocking for ricochet uses direct-line check only (not segment-by-segment)
- Splash self-damage is configurable per weapon but defaults to off
- Status effects are visual-only placeholders (no actual slow/freeze/heal mechanics)
- Turret turn speed is per-weapon, not per-body (a simplification)
- Movement uses screen-space coordinates, not tile-based pathfinding
- Debug labels and overlays may overlap on very small screens
- Continuous fire timing is approximate (frame-based, not tick-perfect)
- No audio/sound effects for any weapon or action
- No minimap or strategic overview
- No multiplayer or network support

These limitations are acceptable for the blockout validation phase. Each will be addressed in future roadmap steps.

---

## 5. Manual QA checklist

### Normal/default game (devtools OFF)
- [ ] No blockout sandbox visible
- [ ] No blockout help/status overlay
- [ ] No blockout hotkeys active
- [ ] No production gameplay changes
- [ ] No console errors

### Arena/dev mode (devtools ON)
- [ ] Curated sandbox visible with 9 vehicles and 6 obstacles
- [ ] Help/status overlay visible or toggleable (H key)
- [ ] Selection works (LMB click)
- [ ] Movement works (RMB click)
- [ ] Turret aiming works (mouse follows cursor)
- [ ] Firing/VFX works (Space/F key)
- [ ] HP/damage works (vehicles lose HP, damage numbers appear)
- [ ] Obstacles block movement and line-of-fire
- [ ] Upgrades work and markers visible (U/I/O/P/B keys)
- [ ] Scenario reset works (R key restores state)
- [ ] Vehicle cycling works (T key)

### Readability
- [ ] Selected vehicle is clear (gold ring + direction arrow)
- [ ] HP bars readable above upgrade markers
- [ ] Upgrade markers readable
- [ ] Damage numbers readable (not covering HP bars excessively)
- [ ] VFX readable enough for each weapon family
- [ ] Obstacles readable as cover/blockers
- [ ] Destroyed vehicles readable but not noisy (dimmed + red X)

### Scenario reset
- [ ] Damage/destroy/upgrade/move some vehicles
- [ ] Press R
- [ ] Scenario returns to deterministic state
- [ ] No errors

### Forbidden behavior
- [ ] No production combat
- [ ] No production upgrade system
- [ ] No economy/costs
- [ ] No final assets
- [ ] No mapgen changes
- [ ] No save/load errors
- [ ] No persistent blockout state

---

## 6. Recommended next roadmap options

### A. Production integration roadmap
Integrate validated blockout behaviors into production game systems:
- Replace blockout vehicles with final PNG/sprite assets
- Add production upgrade shop UI with economy costs
- Implement win/lose conditions and combat scoring
- Wire blockout movement into production pathfinding
- Add production HUD with minimap and strategic overview

### B. Visual asset replacement roadmap
Replace Phaser Graphics primitives with final art:
- Commission or generate vehicle body/turret sprites for all 7 bodies x 4 factions
- Create weapon VFX sprites/particles for all 11 families
- Design obstacle assets (walls, crates, rocks) with isometric perspective
- Add terrain integration (obstacles placed on terrain, not floating)
- Implement sprite-based turret rotation with directional frames

### C. Combat balance/playtest roadmap
Tune gameplay parameters based on playtest feedback:
- Balance HP/damage/reload values for competitive play
- Add weapon specialization roles and counter-play
- Implement tier-based upgrade progression
- Add respawn mechanics and round-based combat
- Tune obstacle placement for competitive arena layouts

### D. Enemy/AI sandbox roadmap
Add computer-controlled opponents:
- Implement basic AI behaviors (patrol, chase, flee, take cover)
- Add attack wave system for PvE scenarios
- Implement AI targeting and threat assessment
- Add difficulty scaling and AI personality profiles
- Create scripted mission scenarios

---

## 7. Clear recommendation for next GPT planning step

**Start a new roadmap audit before implementation.**

BLOCKOUT-MVP has validated the core gameplay skeleton. The next phase should not jump directly into implementation. Instead:

1. Conduct a full roadmap audit of the production game requirements
2. Evaluate which direction (A, B, C, D, or a combination) is the highest priority
3. Define clear acceptance criteria for the next phase
4. Establish scope boundaries to avoid scope creep
5. Create a new roadmap document with the same discipline as BLOCKOUT-MVP

The blockout validation has answered the core question: "Can the game support readable, distinct vehicle/weapon/obstacle/upgrade interactions using primitive graphics?" The answer is yes. The next question is: "Which production direction should replace the blockout placeholders first?" That question requires a new audit.
