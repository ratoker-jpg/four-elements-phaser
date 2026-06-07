# MECHANICS_EXPLORATORY_AUDIT_2026_06_03.md

Status: exploratory mechanics/design audit — pre-roadmap  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Author: GLM, for Denis + GPT review  
Date: 2026-06-03

---

## 1. Executive summary

### What Denis wants

Denis wants to polish and deepen the current playable baseline rather than rush into a bot/opponent roadmap. His priorities, as captured in `MECHANICS_INTAKE_2026_06_03.md`, are:

- Full Russian-language UI for all player-facing menus, HUD, labels and status messages.
- A clean Industrial Platform–only game start flow, removing Sand Classic and Map 1 from normal UX.
- Consistent UI/menu visual style — one coherent palette and button language, not a patchwork of yellow/green/industrial.
- Meaningful faction mechanics for cyan, green, yellow, purple — not just color translations, but real gameplay identities with passive bonuses, possible active abilities, and config-driven implementation.
- Tank units that move like real RTS units: grid-based pathing, physical turning, no instant direction flips, no overlap, sensible stopping distances.
- Reliable targeting/turret/fire behavior — turret points at target, visual aim matches logical damage, no angle mismatches.
- Complete weapon mechanics for all 11 weapons: range classes, fire types, ammo/charge/canister resources, cooldowns, M0–M3 upgrade progression with VFX color shifts.
- Differentiated body mechanics: each of the 7 bodies should have a distinct role, HP/armor/mass/speed/turn profile, recoil interaction with weapons, and collision footprint.
- Expanded building set using approved assets and the four-elements-next reference, with clear purpose, unlock relationships, and implementation risk.
- Static resource layout with mineral richness classes (poor/medium/rich/infinite), center infinite deposit, side/edge deposits, and scaling across map sizes.
- Phaser-friendly animation and physics feel: track animation, turn animation, recoil, weapon VFX by modification level.

### What the current project can support

The current codebase already has substantial infrastructure:

- A working isometric 2.5D renderer with a solid camera projection contract, ground-plane projection helpers, and projected selection rings / shadows / footprints.
- 11 weapons with full blockout configs (damage, range, cooldown, fire type, VFX, recoil) and a working damage system supporting 9 hit kinds (direct, splash, penetration, cone, beam, shotgun, ricochet, rapid, plasma).
- 7 bodies with HP, speed, turn speed, mass, engine power, movement profiles (acceleration, braking, arrival radius), and shape sizes.
- An Arena sandbox with AI modes (passive, stationary_shooter, chaser, hold_position), target-lock turret behavior, and real VFX/damage for both player and AI-fired weapons.
- BFS pathfinding for civil units, screen-space arcade movement for blockout tanks.
- DOM-based UI system with industrial sci-fi theming, though all labels are English.
- 6 building types (3 with configs, 3 without), asset sprites for all 4 factions.
- Resource generation with small/medium/large/infinite types, deterministic placement, and central infinite deposit.

### What must be decided before roadmap

Before any implementation roadmap can be created, Denis and GPT must decide:

1. **Control scheme**: LMB-only or classic RTS LMB-select/RMB-command — this determines the entire input architecture.
2. **Movement model**: Tile-center pathing with turn states vs. smooth grid-aligned movement vs. hybrid — this determines pathfinding, animation, and collision design.
3. **Hit model**: Simplified 2.5D aim forgiveness vs. projected geometry hit volumes — this determines turret pitch logic, weapon balance, and visual consistency.
4. **Faction identity depth**: Passive stat bonuses only vs. active abilities vs. asymmetric tech — this determines economy, building, and unit production architecture.
5. **Weapon resource model**: Which weapons get canister/charge, which stay unlimited, how M0–M3 scales — this determines combat pacing, UI needs, and testing surface.
6. **Building set scope**: Visual-only expansion first vs. gameplay-ready buildings with mechanics — this determines asset workload and economy integration.
7. **Resource layout**: Fully static anchors vs. generated-with-anchors vs. fully generated — this determines map generation architecture and testing predictability.
8. **Animation tier**: Procedural-only pass vs. minimal spritesheets vs. full asset pipeline — this determines asset workload and visual ceiling.

---

## 2. Current code reality

### What systems already exist

**Renderer**: A mature isometric 2.5D renderer built on Phaser 4.1.0 WebGL. The camera projection contract (`src/config/cameraProjectionContract.ts`) provides `projectGroundPoint`, `projectGroundCircleToPolyline`, `projectGroundRect`, `unprojectScreenToGround`, and renderer-side helpers (`drawProjectedGroundRing`, `drawProjectedGroundDiamond`, `drawProjectedShadow`, `drawProjectedBox`, `drawProjectedCrosshair`). Ground markers are properly projected — no top-down screen circles. This is a real architectural asset.

**Combat vehicles**: A dual rendering system. `BlockoutVehicleRenderer` draws all 77 body×weapon combos using Phaser `Graphics` primitives — pseudo-isometric boxes for body/turret, lines for barrels, projected HP bars, damage flash, destroyed markers, selection/hover rings, aim lines, move markers, and direction arrows. `ModularTankRenderer` supports one production combo (Wasp+Smoky) using pre-rendered PNG sprites with 8 directional frames per faction. The blockout system is surprisingly complete for a prototype — every weapon fires, every damage kind resolves, status effects (burn, freeze, overheat) apply.

**Damage system**: `blockoutDamage.ts` implements hit detection for direct, splash, penetration (3 targets), cone (25°), beam, shotgun (5 pellets), ricochet (2 bounces), rapid-fire, and plasma. Obstacle line-of-fire checks exist for most types. Damage events expire after 800ms. Continuous damage ticking works for cone_tick, beam_tick, rapid_tick, and plasma. This is more sophisticated than many prototypes achieve.

**AI system**: `blockoutAi.ts` provides 4 behavior modes for Arena enemies. Target selection, turret aiming, and firing are implemented for both continuous and single-shot weapons. AI tick rate is 200ms. The `fireWeapon` callback routes AI single-shot fire through the same `fireBlockoutWeapon()` + `applyBlockoutWeaponDamage()` path as player input. This means AI damage is real, not simulated.

**Civil economy**: Harvester BFS pathfinding to resources and back to HQ, gathering (small/medium/large/infinite deposits), unloading, and matter accumulation. Builder pathfinding to construction sites and building phases. Economy HUD shows resources, unit counts, and build/produce actions. Separator converts raw to matter + elements. Power plant provides energy. Units factory produces civil units.

**Map generation**: Deterministic PRNG (mulberry32), sand-style patch clustering and industrial flat fill, HQ placement at lower-left, starter resource cluster near HQ, central infinite deposit, mid/far resource clusters scaling with map size. Validation checks starter resources, HQ clearance, and central deposit existence.

**UI system**: All menus and HUD are DOM overlays — MainMenu, NewGameSetup, PauseMenu, PlaytestHud, ArenaMenu, ArenaUnitComposer, DevtoolsPanel. Industrial sci-fi theme with bronze/gold (#d4a574) primary and teal (#80cbc4) secondary accents. Panels are collapsible and have proper lifecycle.

**Upgrade system**: 5 upgrade tracks (Mobility Boost, Armor Plating, Weapon Tuning, Range Extender, Cooling System), each with 3 levels and visual markers (arcs, brackets, glow, dots). Upgrades apply percentage modifiers to speed, HP, damage, cooldown, range, and tick rates.

### What is blockout / prototype

- **All combat vehicles** are blockout — procedural `Graphics` boxes, not production sprites. Only Wasp+Smoky has pre-rendered directional PNGs.
- **All weapon VFX** are procedural — rays, circles, cones, dots, lines drawn with `Graphics`. No sprite-based effects, no particles, no shaders.
- **All body differentiation** is stat-based only — the visual shape difference is modest (16×10 to 32×22 pixel boxes). No role-specific silhouettes, animations, or visual personality.
- **All combat AI** is simple test behavior — no flanking, no retreat, no target prioritization, no group coordination. Adequate for Arena testing, not for production opponents.
- **Building mechanics** are partial — separator/power-plant/units-factory work; raw-storage/matter-storage/command-relay have no config and are unplaceable.
- **Resource layout** is generated, not static — Denis wants predictable anchors, but the current generator places resources semi-randomly within distance bands.
- **Map obstacles and decor** are deferred — empty arrays in generated maps. Arena has 4 obstacle types with a default layout, but normal game has none.

### What is production-ish

- **Camera projection contract** — accepted, implemented, and enforced across all visual systems. This is a real architectural commitment that constrains all future visual work in a good way.
- **MainMenu/NewGameSetup flow** — polished DOM overlays with proper theming. Functional save/load slots. The flow is complete if labels were in Russian.
- **Economy loop** — HQ → harvester → resource → separator → matter → builder → building. This works end-to-end for the 3 configured building types.
- **ArenaMenu** — functional unit composer with body/weapon/team/AI-mode selection, roster with selection/targeting, and cleanup actions. This is usable as a combat sandbox.

### What is missing

- **Russian localization** — zero Russian strings in the entire codebase.
- **Faction mechanics** — factions are color labels only, with zero gameplay differentiation.
- **Grid-based tank movement** — blockout tanks use screen-space arcade movement, not tile-center pathing.
- **Turn physics** — no turning-in-place state, no turn animation, no arc movement. Body angle snaps toward desired direction at a rate-limited speed, but there is no separate "turning" state that blocks other actions.
- **Unit collision/occupancy** — civil units avoid obstacles via BFS; blockout tanks have obstacle collision but no unit-to-unit collision enforcement. Tanks can overlap.
- **Hit model sophistication** — damage hits are screen-distance-based, not volume-based. No aim forgiveness, no hit capsules, no vertical tolerance. Short-range weapons can miss if the target is too close (shot passes through).
- **Weapon charge/canister** — no weapon has a limited resource pool. Flamethrower, Freeze, Isida, Vulcan fire continuously with no depletion mechanic. Shaft has no charge time.
- **Building gameplay for 3/6 types** — raw-storage, matter-storage, and command-relay exist as assets but have no construction config.
- **Static resource anchors** — resource placement is generated, not designer-controlled.
- **Track animation** — no visual track movement for any vehicle.
- **Recoil-body interaction** — recoil data exists per weapon (barrel kick, turret kick, body impulse), but body impulse does not scale with body mass. Railgun recoil feels the same on Wasp and Mammoth.

### Current risks by domain

**Menu**: English-only labels will confuse the Russian-speaking target audience. Map 1 and Sand Classic options pollute the UX. Debug/Devtools panel is exposed alongside player-facing controls.

**Map**: No obstacles or decor in generated maps makes the battlefield empty and visually flat. Arena obstacles are present but not integrated with normal-game pathfinding.

**Units**: Dual movement models (BFS for civil, arcade for combat) will diverge further if not unified. Blockout tanks driving through each other breaks combat readability.

**Combat**: No hit volume model means short-range and melee-adjacent weapons (Flamethrower, Freeze, Hammer) can fail at point-blank range. Turret/body angle mismatch in some edge cases. Shaft charge and Vulcan overheat are visual-only, not gameplay-enforced.

**UI**: Inconsistent button colors (some yellow, some green, some teal). Debug and player-facing UI share the same visual language. No Russian text layout consideration (Russian words are typically longer than English equivalents).

**Buildings**: 3 of 6 building types are non-functional. No tech tree, no building prerequisites, no faction-specific buildings.

**Resources**: Generated placement makes testing and balance iteration harder. Mineral amounts (20/60/120/999999) are not tuned for pacing. No "poor" or "very rich" class exists in code despite being discussed.

---

## 3. Owner mechanics grouped by domain

### Localization / UX

Denis wants full Russian translation for all player-facing UI. This is straightforward but touches every DOM overlay component: MainMenuScene, NewGameSetupScene, PauseMenu, PlaytestHud, ArenaMenu, ArenaUnitComposer, DevtoolsPanel, and all status/help messages.

Key consideration: Russian text is typically 20-40% longer than English. Button labels like "Continue" → "Продолжить", "Settings" → "Настройки", "New Game" → "Новая игра" will need wider buttons or flexible layout. The current DOM overlay system uses CSS flexbox and should handle this, but every panel needs visual verification after translation.

Proposed approach: Create a `src/config/localization.ts` string map with `ru` and `en` keys. All DOM UI reads strings from this map. Language selection stored in game config. This is config-driven, not hardcoded, and allows adding more languages later.

Risk: Low. This is a text replacement pass with layout testing. The only risk is text overflow in tight button layouts, which is a CSS fix.

### Game start flow

Denis wants Industrial Platform as the only normal map style. Sand Classic and Map 1 should be removed from normal UX. The current NewGameSetupScene offers both map modes (fixed/generated), both map styles (sand/industrial), and Map 1 as a fixed map option.

Proposed approach: Default to `generated` + `industrial`. Remove `fixed` map mode and `sand` style from the normal UX. Keep them behind a debug/dev flag for testing. Simplify the New Game setup to: faction selection, map size, seed. Game mode (Standard/Debug/Arena) can remain.

Risk: Low. This is a UI simplification. The underlying map generation code remains intact.

### Factions

Denis wants meaningful faction mechanics, not just color names. Four factions (cyan, green, yellow, purple) need Russian names, gameplay identities, and config-driven bonuses.

This is a high-impact, medium-risk design decision. See Section 10 for detailed faction proposals.

### Unit control

Denis prefers LMB select + LMB move/attack. Current Arena uses LMB select + RMB move. Normal game uses click-to-select for harvesters/builders.

This is one of the most consequential decisions. See Section 5 for detailed control scheme proposals and Section 6 for recommendation.

### Grid movement

Denis wants tanks to move through cell centers, like harvesters/builders, not along free diagonal lines. Current blockout tanks use screen-space arcade movement with rate-limited turning.

This is a major architectural change. The current `blockoutMovement.ts` implements semi-physics arcade movement. Changing to tile-center pathing would require:
1. BFS pathfinding for combat vehicles (reuse `pathfinding.ts`).
2. A movement state machine: idle → turning_in_place → moving_to_next_tile → arrived.
3. Visual interpolation between tile centers for smooth appearance.
4. Turn-before-move logic: rotate to face the next tile before driving.

See Section 5 for movement model proposals.

### Turn physics

Denis wants units to physically rotate before driving in a new direction, not instantly flip. Current system rate-limits body angle rotation (80-150 °/s) but has no separate turning state.

Proposed states: `idle`, `turning_in_place`, `moving`, `braking`, `arrived`. When a move command arrives:
1. If body angle does not face the first path tile direction → enter `turning_in_place`.
2. When angle matches within tolerance → enter `moving`, drive forward.
3. At each path waypoint → check if next segment requires turn. If so, briefly enter `turning_in_place`.

For PNG directional units (harvesters/builders), the 8-direction sprite system already supports this — the frame just needs to transition through intermediate directions during the turn.

Risk: Medium. The state machine is well-understood RTS architecture, but integrating it with the existing arcade movement and ensuring Arena tests still pass requires careful implementation.

### Collision / occupancy

Denis wants tanks to not overlap. Current blockout tanks have obstacle collision but no unit-to-unit collision.

Proposed approach: Tile occupancy map. Each unit reserves its current tile and (for large bodies) adjacent tiles. When a unit tries to move to a tile, it checks occupancy first. If occupied, it either waits or repaths.

Key decision: Should collision be tile-based (simpler, grid-aligned) or circle-based (smoother, more physical)? Tile-based is more compatible with grid movement. Circle-based is more compatible with the current arcade model.

Recommendation: Tile-based occupancy for grid movement, with a minimum separation radius for visual non-overlap. This avoids the "two tanks on one tile" visual problem while keeping the system simple.

Risk: Medium. Tile occupancy is simple to implement but can cause pathfinding deadlocks (two units trying to swap tiles, or a unit blocking a corridor). Need deadlock detection or time-based repathing.

### Targeting / fire / hit model

Denis wants turret to visually point at target, visual aim to match logical damage, and reliable hit detection at all ranges including point-blank.

Current issues:
1. Turret angle uses `angleFromTo()` from body screen position to target screen position — this is correct for ground-plane targets but does not account for height differences.
2. Damage uses screen-distance checks, not projected hit volumes.
3. Short-range weapons can miss at point-blank range because the damage ray passes through the target.

Proposed 2.5D hit model:
- Each vehicle has a **hit volume**: a projected ground rectangle (footprint) + a height range.
- For hit detection, cast a ray from barrel tip to target. Check if the ray intersects the target's projected footprint within its height range.
- Add **aim forgiveness**: if the ray misses the exact target but passes within a tolerance radius (weapon-dependent), count as a hit. Tolerance is larger for shotguns and flamethrowers, smaller for railguns and shaft.
- For point-blank: minimum range check. If target is closer than `minStopDistance`, auto-hit (the weapon is literally touching the target).

See Section 6 for recommended hit model.

### Weapon mechanics

See Section 8 for complete weapon-by-weapon proposals.

### Weapon charge / canisters

See Section 8 for per-weapon canister/energy models.

### Body mechanics

See Section 9 for complete body-by-body proposals.

### Body / weapon interaction

Denis wants weapon recoil to depend on body mass. Railgun on Wasp should create strong recoil; Railgun on Mammoth should barely nudge it.

Current state: Recoil data is per-weapon only (`bodyImpulse` in `blockoutRecoilData.ts`). The impulse is applied uniformly regardless of body mass.

Proposed formula: `effectiveImpulse = weapon.bodyImpulse * (baseMass / body.mass)` where `baseMass` is a reference mass (e.g., 3000 kg, roughly Hunter-class). This means:
- Wasp (2200 kg): receives ~1.36× base impulse (more knockback).
- Mammoth (5500 kg): receives ~0.55× base impulse (less knockback).

This also applies to speed penalty during firing: heavier bodies lose less speed from recoil.

Risk: Low. This is a config-driven multiplier. The only risk is tuning the baseMass reference point.

### Buildings

See Section 11 for building set proposals.

### Resources / map layout

See Section 12 for resource and map layout proposals.

### Animation / physics feel

See Section 13 for Phaser 4 animation feasibility and Section 5 for animation tier proposals.

---

## 4. Contradictions and open decisions

### LMB move/attack vs classic RTS RMB command

**Contradiction**: Denis prefers LMB for both select and command. Classic RTS uses LMB select + RMB command (StarCraft, Warcraft III, C&C). The current Arena uses LMB select + RMB move, which matches the classic RTS convention.

**LMB-only (Denis preference)**:
- Pros: Simpler for casual players. Fewer buttons. Works on touch screens. One-finger gameplay is possible.
- Cons: No way to deselect without clicking empty space. No way to give a move command vs. an attack command without context (clicking ground = move, clicking enemy = attack). Camera pan must use a different trigger (middle mouse, edge scroll, or drag). Accidental commands are more likely. Multi-select becomes ambiguous — does clicking another unit select it or command the current unit to move there?

**Classic RTS LMB/RMB**:
- Pros: Industry standard for 20+ years. Players already know it. Clear semantic separation: left = select/inform, right = command. Supports move, attack-move, patrol, and other context commands. No accidental move commands during selection.
- Cons: Two-button paradigm. Slightly more complex to learn. Touch screens need an on-screen modifier.

**Hybrid option**: LMB select + LMB move/attack by default, with an option to enable RMB command mode. Or: LMB select + LMB move, but RMB gives "smart command" (attack-move to clicked position, or context-sensitive).

**Recommendation**: Classic RTS LMB/RMB. The industry convention exists for a reason — it eliminates ambiguity. Denis's concern about simplicity can be addressed with good visual feedback (move cursor, attack cursor, command confirmation ring). The target audience (RTS players) expects RMB command. However, if Denis insists on LMB-only, it can work with careful context detection and good feedback.

### Grid movement vs physical turning

**Contradiction**: Denis wants grid-based movement (through cell centers) AND physical turning (no instant direction changes). But classic grid movement often implies instant direction changes at tile boundaries.

The resolution is a **turn-before-move** model:
1. When a move command arrives, the unit turns to face the direction of the first path segment.
2. Only after the turn completes does the unit start moving.
3. At each path waypoint, if the next segment requires a direction change, the unit briefly turns before continuing.

This is how Warcraft III and StarCraft handle unit movement on grids — the path is grid-based, but the visual movement is smooth with turn arcs.

### Cell occupancy vs smooth tank motion

**Contradiction**: Tile occupancy (one unit per cell) prevents overlap but creates jerky stop/start movement. Smooth motion with collision circles allows fluid movement but can create overlap.

Resolution: **Logical tile occupancy + visual interpolation**. The game logic uses tile-based occupancy for pathfinding and collision. The renderer interpolates smoothly between tile positions. A unit "reserves" its next tile before moving, preventing other units from pathing through it.

### Simple hit model vs projected 2.5D geometry

**Contradiction**: Screen-distance hit detection is simple but can miss at point-blank range. Projected 2.5D hit volumes are more correct but more complex.

Resolution: **Projected footprint hit test with aim forgiveness**. Use the existing `projectGroundRect` to create a projected hit rectangle on the ground plane. Cast a ray from barrel tip through the target area. Apply a tolerance radius based on weapon type. This is not full 3D collision — it is 2.5D ground-plane hit detection with vertical forgiveness. It avoids the need for real 3D volumes while solving the point-blank miss problem.

### Industrial-only UX vs debug legacy modes

**Contradiction**: Denis wants Industrial Platform only for normal UX, but the codebase has sand terrain, Map 1, and debug/devtools that are still used for testing.

Resolution: **Player-facing = Industrial only. Debug-facing = all options behind dev flag.** The New Game setup defaults to Industrial/Generated. Sand Classic and Map 1 only appear when `?devtools=1` or a developer settings toggle is active. DevtoolsPanel remains available in Debug and Arena modes but is hidden in Standard mode.

### Current arena blockout vs production combat

**Contradiction**: Arena uses procedural blockout vehicles with `Graphics` primitives. Production combat would use sprite-based vehicles with proper animations. But the arena is the current testing ground for combat mechanics.

Resolution: **Arena is the mechanics test bed, not the visual target.** Continue developing combat mechanics in Arena with blockout vehicles. When sprite-based vehicles are ready, swap the renderer without changing the mechanics. The separation of `BlockoutVehicleRenderer` and `ModularTankRenderer` already supports this — they share the same state/logic layer.

---

## 5. Creative mechanics proposals

### Faction design packs

#### Pack A: Passive Stat Bonuses (Simple)

Each faction gets fixed percentage bonuses to specific stats. No active abilities. Config-driven, easy to balance.

| Faction | Russian name | Passive |
|---------|-------------|---------|
| Cyan | Стрим (Stream) | +10% speed, +5% turn speed, -5% HP |
| Green | Корень (Root) | +15% building speed, +10% resource yield, -5% combat damage |
| Yellow | Искра (Spark) | +10% weapon damage, +5% fire rate, -10% armor |
| Purple | Око (Eye) | +20% vision range, +10% turret turn speed, -5% speed |

Pros: Trivial to implement, easy to understand, easy to balance.
Cons: Boring. Feels like a difficulty modifier, not a faction identity. No strategic depth.

#### Pack B: Passive + Economy Identity (Medium)

Factions have economy asymmetry that shapes playstyle without active abilities.

| Faction | Russian name | Economy bonus | Combat bonus | Penalty |
|---------|-------------|---------------|--------------|---------|
| Cyan | Поток (Flow) | Harvesters move 20% faster | Units accelerate 15% faster | Building costs +10% |
| Green | Росток (Sprout) | Buildings cost 15% less matter | Separators produce 20% faster | Unit speed -5% |
| Yellow | Горн (Furnace) | Weapons deal 12% more damage | Factory produces 15% faster | Harvester capacity -15% |
| Purple | Зонд (Probe) | Start with extra scout vision | Turrets turn 20% faster | Starting resources -20% |

Pros: Creates different opening strategies. Economy asymmetry is proven in RTS (StarCraft Zerg cheap expansion vs. Terran expensive defense). Config-driven.
Cons: Balancing economy penalties is tricky. "Starting resources -20%" could be punishing on small maps.

#### Pack C: Passive + Active Ability + Tech Fork (Complex)

Each faction has a passive bonus, one active ability (cooldown-based), and a unique tech fork that unlocks faction-specific units or building upgrades.

| Faction | Russian name | Passive | Active ability | Tech fork |
|---------|-------------|---------|----------------|-----------|
| Cyan | Волна (Wave) | +8% unit speed | Rush: selected unit gets +30% speed for 5s (60s cooldown) | Fast strike units: light bodies get weapon upgrade discounts |
| Green | Ствол (Trunk) | +10% building HP | Overgrow: target building heals 30% HP (45s cooldown) | Fortification: buildings can be upgraded to armored variants |
| Yellow | Пламя (Flame) | +8% weapon damage | Salvo: selected unit fires 3 instant shots (90s cooldown) | Heavy weapons: high-tier weapons unlock earlier |
| Purple | Вихрь (Vortex) | +12% vision range | Scan: reveal area for 8s (50s cooldown) | Intelligence: radar buildings reveal more, enemy unit types shown |

Pros: Deep strategic identity. Active abilities create micro moments. Tech forks create long-term strategic choices.
Cons: High implementation cost. Balance is very hard. Active abilities need UI, VFX, sound, and testing. Tech forks need new configs, possibly new unit types.

**Recommendation**: Start with Pack B for initial implementation. It creates meaningful playstyle differences without the complexity of active abilities. Pack C can be a later roadmap goal. Pack A is too shallow.

### Control scheme options

#### Option 1: Classic RTS (LMB select, RMB command)

- LMB click unit = select.
- LMB click ground = deselect.
- RMB click ground = move command.
- RMB click enemy = attack command.
- RMB click friendly building = right-click action (enter factory, harvest resource).
- Shift+RMB = queue command.
- Ctrl+LMB = add to selection.

This is the industry standard. Every RTS player knows it. It cleanly separates "information" actions (select, inspect) from "command" actions (move, attack). It supports attack-move, patrol, and other command modes via modifier keys.

The main downside is the two-button requirement, which makes touch-screen support harder. However, touch-screen RTS is a secondary concern for a desktop browser game.

#### Option 2: LMB-Only (Denis preference)

- LMB click own unit = select.
- LMB click ground = move selected unit.
- LMB click enemy = attack command for selected unit.
- LMB click empty space with no selection = nothing (or camera pan if dragging).
- ESC = deselect.

The key challenge is disambiguation: when the player clicks, the game must determine whether this is a selection, a move, or an attack. The context depends on what is under the cursor and what is currently selected. This works for simple cases but breaks down with:
- Multi-unit selection (clicking a second unit to add vs. commanding the first unit).
- Overlapping clickable areas (unit near a resource, building near a unit).
- Canceling commands (no right-click cancel).

#### Option 3: Hybrid — LMB primary, RMB context

- LMB click unit = select.
- LMB click ground = move selected unit.
- LMB click enemy = attack selected unit.
- RMB = cancel current action / stop unit / context menu.
- RMB drag = camera pan.

This keeps Denis's preferred LMB-command model while giving RMB a meaningful role. The right-click-as-cancel is intuitive — it is the universal "undo" button. Camera pan on RMB drag is standard in many RTS games (StarCraft II uses edge scroll + MMB drag, but C&C uses RMB drag).

**Recommendation**: Option 3 (Hybrid). It respects Denis's LMB preference while providing a cancel/panic button and camera pan. It is simpler than full classic RTS while avoiding the ambiguity problems of pure LMB-only.

### Movement / turning models

#### Model 1: Pure Grid (tile-center pathing)

Units move through tile centers, like harvesters. Path is a list of tile coordinates. Unit turns to face the next tile, drives to its center, turns to face the next tile, and so on.

- Turn is a separate state: `turning_in_place`.
- Movement between tiles is a straight line at constant speed.
- Visual position interpolates smoothly between tile centers.

Pros: Simple, predictable, easy to debug. Works with BFS pathfinding. Collision is tile-based.
Cons: Can look robotic — 90° turns at every tile corner. No diagonal movement option. Feels less fluid than arcade movement.

#### Model 2: Waypoint Smoothing (grid path + arc turns)

Same grid-based pathing, but at each waypoint where the direction changes, the unit traces an arc instead of stopping and turning. The arc radius depends on the unit's turn speed and current speed.

Pros: Looks much smoother than pure grid. Still uses grid-based pathfinding. Arc turns feel physical.
Cons: More complex state machine. Arc calculation must account for unit speed and turn speed. Can clip obstacles if the arc goes outside the tile.

#### Model 3: Hybrid — Grid Pathfinding, Free Movement

Unit uses BFS to find a tile path, but moves freely (like current arcade model) along a smoothed version of that path. The movement system uses the tile path as a series of waypoints but does not constrain the unit to tile centers.

Pros: Most natural-looking movement. Combines grid pathfinding with fluid motion. Closest to the current blockout model.
Cons: Collision becomes harder (free movement + tile occupancy requires continuous overlap detection). Departure from Denis's explicit request for "through cell centers."

**Recommendation**: Model 2 (Waypoint Smoothing). It respects Denis's grid-pathing requirement while providing visual fluidity through arc turns. It is the best compromise between grid discipline and physical feel.

### Weapon system models

#### Model 1: Unlimited Fire + Cooldown Only (current)

All weapons fire as long as the cooldown timer allows. No resource depletion. Continuous weapons (Flamethrower, Freeze, Isida) fire indefinitely.

Pros: Simple. No UI needed for ammo/charge. Easy to balance.
Cons: Some weapons (Flamethrower, Isida) become dominant in sustained fights. No tactical resource management. Denis explicitly wants canister mechanics for some weapons.

#### Model 2: Two-Tier — Cooldown + Canister

Single-shot weapons (Smoky, Thunder, Railgun, Shaft, Twins, Ricochet, Hammer) use cooldown only. Continuous/sustained weapons (Flamethrower, Freeze, Isida, Vulcan) use a canister/charge pool that depletes during firing and regenerates when not firing.

Pros: Solves the infinite-fire problem for continuous weapons. Creates tactical depth — players must manage charge. M0–M3 can improve charge capacity and regeneration.
Cons: Two different resource models increases UI complexity. Balancing charge rates vs. cooldowns is non-trivial.

#### Model 3: Universal Energy System

All weapons share a single energy pool. Firing drains energy. Energy regenerates over time. Different weapons drain at different rates. Heavier weapons drain more.

Pros: Unified system. Easy to understand. Creates interesting trade-offs (firing Railgun leaves less energy for Isida healing). Inspired by Supreme Commander's energy system.
Cons: Restricts combined-arms play. Player cannot use heavy weapon and support weapon simultaneously. Feels less like Tanki-style individual tank combat and more like macro RTS.

**Recommendation**: Model 2 (Two-Tier). It respects Denis's request for canister mechanics on specific weapons while keeping single-shot weapons simple. It is the least disruptive change from the current system.

### Resource / map pacing models

#### Model 1: Fully Static Layout

Resource positions are hardcoded per map size. No randomness. Like Map 1 but for Industrial maps.

Pros: Perfectly testable. Balance is deterministic. Good for competitive play.
Cons: Every game on the same map size looks identical. Reduces replayability. Requires manual layout design for each map size.

#### Model 2: Generated with Fixed Anchors (recommended)

Central infinite deposit is always at map center. Starter cluster is always NE of HQ. Side/edge deposits use fixed anchor positions. Density and exact type within each anchor zone has slight randomness.

Pros: Predictable strategic structure (center contest, near-HQ safe income, side expansion). Still has variety. Testable because anchor positions are known.
Cons: Slightly more complex generation. Must define anchor positions per map size.

#### Model 3: Fully Generated with Constraints

Current model — resources are placed within distance bands with randomness, subject to validation constraints.

Pros: Maximum variety. No manual design needed.
Cons: Hard to test balance. Some seeds may produce unfair layouts. Denis explicitly wants more predictability.

**Recommendation**: Model 2 (Generated with Fixed Anchors). It balances predictability with variety, and it matches Denis's request for static starting positions with generated terrain.

### Building / tech progression models

#### Model 1: Linear Chain (current extension)

HQ → Separator → Power Plant → Units Factory → (future buildings in a linear chain). Each building unlocks the next.

Pros: Simple. Easy to understand. Current system is close to this.
Cons: No player choice. Everyone builds the same sequence. No strategic depth.

#### Model 2: Tech Tree with Forks

After basic economy (Separator + Power Plant), the player chooses between military and economy branches. Military branch unlocks combat unit production, weapon upgrades, and defense buildings. Economy branch unlocks advanced resource processing, storage, and faster building.

Pros: Strategic choice. Different factions may prefer different branches. Creates asymmetric gameplay.
Cons: More buildings to design, implement, and balance. Requires clear visual communication of the tech tree.

#### Model 3: Modular Add-Ons

Base buildings accept add-on modules that modify their function. A Separator can be upgraded with a Purifier add-on (faster conversion) or a Stockpile add-on (more storage). A Factory can be upgraded with a Weapons Bay (combat unit production) or a Repair Bay (unit healing).

Pros: Fewer base buildings to design. Player customization. Add-ons are smaller assets.
Cons: Add-on placement logic is complex. Visual clarity — player must see what add-ons are attached. Implementation cost is significant.

**Recommendation**: Model 2 (Tech Tree with Forks). It is the most RTS-authentic approach and creates meaningful strategic decisions. Implementation can be phased: start with the basic linear chain, then add fork buildings in a later pass.

### Animation implementation tiers

#### Tier 0: Procedural Feel Pass (no new assets)

- Add `turning_in_place` state with visible body rotation rate.
- Add recoil visual that scales with body mass (already have recoil data, just need mass-dependent scaling).
- Add track marks on the ground (projected lines behind the unit).
- Add slight body tilt when turning (shift the body sprite/box by a few pixels in the turn direction).
- Add smooth start/stop easing to movement (already have acceleration/braking, just need visual easing on the body).

Cost: Minimal. Code-only changes. No new assets.

#### Tier 1: Minimal Spritesheets

- Create 8-direction body sprites for each of the 7 bodies (2 frame states: idle, moving). That is 7 bodies × 8 dirs × 2 states = 112 frames. Plus track animation: 2-3 frame loop per direction = 7 × 8 × 3 = 168 frames.
- Create 8-direction turret sprites for each of the 11 weapons (1 frame per direction). That is 11 × 8 = 88 frames.
- Total: ~368 sprite frames. This is manageable for AI-assisted generation.

Cost: Medium. Asset generation + integration + testing.

#### Tier 2: Full Asset Pipeline

- Production-quality body sprites with track animation loops (4-8 frames per direction).
- Turret sprites with firing animation (2-3 frames: idle, recoil, recovery).
- M0-M3 visual upgrade overlays (color shifts, additional detail).
- Destruction animation sequence (5-8 frames).
- Faction color tinting system.

Cost: High. Significant asset generation and integration effort.

**Recommendation**: Start with Tier 0 (procedural feel pass) to immediately improve the visual feel without blocking on assets. Plan Tier 1 as the next visual milestone. Tier 2 is a later production goal.

---

## 6. Recommended direction

### Control scheme: Hybrid LMB/RMB (Option 3)

Why it fits Four Elements: The game is an RTS with tank-style combat. RTS players expect right-click commands. Denis's LMB preference is valid for simplicity, but the hybrid model preserves simplicity while adding the cancel/panic button that makes the game feel responsive.

Why it is feasible in Phaser 4: Phaser's input system supports per-button event handling. LMB and RMB can have independent handlers. The DOM UI already captures clicks before they reach Phaser, so UI clicks never accidentally command units.

Why it is better than alternatives: Pure LMB-only creates disambiguation problems at selection boundaries. Pure classic RTS may feel overly complex for Denis's vision. The hybrid is the Goldilocks solution.

Risk level: Low. This is an input routing change in GameScene. The Arena input controller already handles LMB/RMB separately.

What to test first: In Arena, swap RMB move to LMB move and add RMB cancel. Verify that selection, movement, and attack commands work without ambiguity. Verify that camera pan (RMB drag) does not conflict with unit commands.

### Movement model: Waypoint Smoothing with Grid Pathing (Model 2)

Why it fits Four Elements: Denis wants grid-based movement with physical turning. Waypoint smoothing is the standard way to make grid pathing look natural. It is used in Warcraft III, StarCraft, and most tile-based RTS games.

Why it is feasible in Phaser 4: The path is a list of tile coordinates from BFS. The movement system interpolates between waypoints with arc turns. Phaser's game loop provides frame-by-frame position updates. No physics engine needed.

Why it is better than alternatives: Pure grid looks robotic. Free movement ignores Denis's cell-center requirement. Waypoint smoothing satisfies both the grid discipline and the visual quality.

Risk level: Medium. The arc turn calculation is the main risk — if the arc radius is too large, the unit clips through obstacles. Need to clamp arc radius to stay within the tile corridor.

What to test first: Take an existing Arena chaser enemy and replace its arcade movement with BFS pathfinding + waypoint smoothing. Verify that the unit reaches its target, avoids obstacles, and looks smooth.

### Hit model: Projected Footprint with Aim Forgiveness

Why it fits Four Elements: The camera projection contract already provides `projectGroundRect` for vehicle footprints. Extending this to a hit volume is a natural progression. Aim forgiveness is proven in every FPS and RTS — players expect their shots to hit if the reticle is on the target.

Why it is feasible in Phaser 4: All hit detection is pure TypeScript math (no Phaser dependency). The projection helpers already exist. Adding a tolerance radius to hit checks is a few lines of code.

Why it is better than alternatives: Screen-distance checks miss at point-blank. Full 3D collision is overkill for a 2.5D game. Projected footprint + forgiveness is the right level of abstraction.

Risk level: Low. This is a damage system refinement, not a rewrite. The current hit detection functions can be modified to use projected footprints instead of screen distance.

What to test first: In Arena, place a Wasp next to an enemy and fire Hammer. Verify that the shotgun pellets hit at point-blank range. Then test Railgun at maximum range with slight angle offset.

### Faction model: Pack B — Passive + Economy Identity

Why it fits Four Elements: The game is early enough that faction mechanics should be simple and config-driven. Pack B creates meaningful playstyle differences (fast economy vs. combat focus vs. vision control) without the implementation cost of active abilities.

Why it is feasible in Phaser 4: Faction bonuses are pure config changes (percentage modifiers to existing stats). No new systems needed. The faction selector already exists in NewGameSetup.

Why it is better than alternatives: Pack A is too shallow (feels like a difficulty setting). Pack C is too complex for the current project state (active abilities need UI, VFX, and balance). Pack B is the sweet spot.

Risk level: Low-Medium. Economy penalties can create snowball effects. Need playtesting to verify that no faction is strictly dominant on all map sizes.

What to test first: Implement faction bonuses as config multipliers. Run Arena tests with different factions and compare damage output, movement speed, and economy throughput.

### Weapon resource model: Two-Tier Cooldown + Canister (Model 2)

Why it fits Four Elements: Denis explicitly requested canister mechanics for continuous weapons. Single-shot weapons do not need them. The two-tier model keeps the system simple where it can be and adds depth where it matters.

Why it is feasible in Phaser 4: Canister/charge is a state variable on the weapon. Depletion and regeneration are timer-based. The HUD shows a charge bar. All of this is pure TypeScript with DOM UI rendering.

Why it is better than alternatives: Universal energy (Model 3) restricts combined-arms play. Unlimited fire (Model 1) makes continuous weapons dominant. The two-tier model is the right compromise.

Risk level: Medium. Balancing charge rates, depletion rates, and M0–M3 scaling requires playtesting. The UI for charge bars adds complexity.

What to test first: Add a canister pool to Isida. Set it to 100 units, draining at 10/s while firing, regenerating at 5/s while not firing. Test in Arena and verify that Isida cannot heal infinitely without pause.

### Animation tier: Tier 0 — Procedural Feel Pass

Why it fits Four Elements: The blockout vehicles are procedural. Adding procedural feel improvements (mass-dependent recoil, turning states, track marks, body tilt) enhances them without requiring new assets. This unblocks the feel improvement immediately.

Why it is feasible in Phaser 4: All proposed changes use Phaser `Graphics` (already used for blockout vehicles) and the existing camera projection contract. No spritesheets, no texture loading, no animation frame management.

Why it is better than alternatives: Tier 1 requires asset generation (blocking). Tier 2 is a far future goal. Tier 0 delivers value now.

Risk level: Very Low. Code-only changes. No asset dependency. Can be implemented and tested in a single PR.

What to test first: Add mass-dependent recoil scaling. Fire Railgun on Wasp vs. Mammoth and verify that the knockback feels noticeably different.

---

## 7. What to remove from UX

### Sand Classic map style

**Current state**: NewGameSetupScene offers "Sand / Classic" as a map style option alongside "Industrial Platform." Selecting Sand generates sand-terrain maps with legacy mineral sprites.

**Action**: Remove "Sand / Classic" from the normal game setup. Default to Industrial Platform. Keep the sand map style code and assets in the repo for testing behind a `?devtools=1` or `?mapStyle=sand` flag.

**Rationale**: Denis explicitly does not plan to return to sand terrain. It confuses new players and adds a choice that should not exist. The code and assets are not deleted — they are just hidden from normal UX.

**Risk**: Very low. This is a UI removal, not a code deletion. Sand terrain generation remains functional for developer testing.

### Map 1 (fixed map)

**Current state**: NewGameSetupScene offers "Map 1" as a fixed map option alongside "Generated."

**Action**: Remove "Map 1" from the normal game setup. Default to Generated. Keep `customMap1.ts` in the repo for reference and developer testing.

**Rationale**: Denis does not plan to maintain fixed maps. Generated maps with Industrial Platform are the standard. Map 1 was a debugging tool, not a production feature.

**Risk**: Very low. Same as Sand Classic — UI removal, not code deletion.

### mapStyle selector (from normal UX)

**Current state**: The map style selector appears in NewGameSetupScene as a visible option for all players.

**Action**: Hide the selector when not in developer mode. In standard mode, always use Industrial Platform. In debug mode, show the selector for testing.

**Rationale**: The map style selector exposes an implementation detail to players. Normal players should never need to choose map style — Industrial Platform is the game.

**Risk**: Very low.

### English labels

**Current state**: All UI labels are English — "New Game," "Continue," "Settings," "Game Mode," "Map Style," "Small," "Standard," "Large," etc.

**Action**: Translate all player-facing labels to Russian. Create a localization string map. Keep English as a developer/debug option.

**Rationale**: The target audience is Russian-speaking. English labels are a barrier.

**Risk**: Low. Text replacement with layout verification. Russian text is typically 20-40% longer, so some buttons may need width adjustments.

### Inconsistent button styles

**Current state**: Some buttons use yellow, some green, some teal. The visual language is not unified.

**Action**: Define one button style system:
- **Primary actions**: Warm bronze/gold (#d4a574) — New Game, Place, Fire, Confirm.
- **Secondary actions**: Muted teal (#80cbc4) — Continue, Cancel, Settings.
- **Danger actions**: Muted red (#c0756b) — Delete, Reset, Main Menu.
- **Disabled**: Gray with low opacity.

**Rationale**: A consistent button language makes the UI predictable and professional. The industrial sci-fi theme already defines bronze and teal — extending it to all buttons unifies the visual.

**Risk**: Very low. CSS changes only.

### Debug options exposed to normal player

**Current state**: DevtoolsPanel, Debug game mode, and various developer options are visible in the normal game flow. A player selecting "Debug" mode gets a technical panel with resource editing, spawn controls, and diagnostics.

**Action**: In Standard mode, hide all debug/devtools. Only show them in Debug and Arena modes. Add a visual indicator when debug mode is active (e.g., a small "ОТЛАДКА" badge in the corner).

**Rationale**: Debug tools are for developers. Exposing them to players creates confusion and undermines the game feel. Arena mode is a testing sandbox and should keep its tools visible.

**Risk**: Very low. Conditional rendering of DOM elements.

---

## 8. Weapon mechanics proposal

### Smoky

| Property | Value |
|----------|-------|
| Range class | Short-medium |
| Ideal attack distance | 180–220 px |
| Minimum stop distance | 60 px |
| Fire type | Instant projectile (single shot) |
| Line-of-sight rule | Required — blocked by obstacles |
| Ammo/charge rule | Unlimited, cooldown only |
| Cooldown | 800 ms |
| Reload | N/A |
| M0 → M3 upgrade direction | Damage +10%/level, cooldown -5%/level, VFX: pale yellow → bright orange |
| VFX color progression | M0: #CCCC44 → M1: #DDAA33 → M2: #FF8822 → M3: #FF6600 |
| Risk notes | Reliable starter weapon. Low risk of dominant strategy. Boring at high level without additional mechanics. Consider adding critical hit chance at M2+ (5%/10%) for excitement. |

### Thunder

| Property | Value |
|----------|-------|
| Range class | Short |
| Ideal attack distance | 140–180 px |
| Minimum stop distance | 80 px (splash self-damage risk at closer range) |
| Fire type | Instant splash |
| Line-of-sight rule | Required for center hit; splash can clip around low cover |
| Ammo/charge rule | Unlimited, cooldown only |
| Cooldown | 1200 ms |
| Reload | N/A |
| Splash radius | 60 px with linear falloff; self-damage at 0.3× |
| M0 → M3 upgrade direction | Splash radius +10%/level, damage +8%/level, VFX: orange → deep red |
| VFX color progression | M0: #FF6600 → M1: #FF4400 → M2: #FF2200 → M3: #CC0000 |
| Risk notes | Splash self-damage creates interesting risk/reward near allies. Needs clear self-damage VFX so players understand why they took damage. Area denial is strong in chokepoints. |

### Railgun

| Property | Value |
|----------|-------|
| Range class | Long |
| Ideal attack distance | 300–380 px |
| Minimum stop distance | 120 px |
| Fire type | Line pierce (penetration through up to 3 targets) |
| Line-of-sight rule | Required; pierces through low cover (pierceable obstacles) |
| Ammo/charge rule | Unlimited, cooldown only |
| Cooldown | 2500 ms |
| Reload | N/A |
| Pierce limit | 3 targets (full damage to each) |
| M0 → M3 upgrade direction | Damage +12%/level, cooldown -8%/level, VFX: pale cyan → deep red |
| VFX color progression | M0: #88FFFF → M1: #4488FF → M2: #8844FF → M3: #FF2244 |
| Risk notes | High alpha damage on a fast-firing platform (Wasp) could be dominant. Consider reducing pierce count to 2 at M0, increasing to 3 at M2. Long range + pierce makes it oppressive in corridors. Recoil impulse on light bodies should be dramatic — this is part of the balance (Railgun-Wasp knocks itself backward significantly). |

### Shaft

| Property | Value |
|----------|-------|
| Range class | Very long (sniper) |
| Ideal attack distance | 380–430 px |
| Minimum stop distance | 150 px |
| Fire type | Charge-sniper (hold to charge, release to fire) |
| Line-of-sight rule | Required; no obstacle piercing |
| Ammo/charge rule | Charge mechanic: 0–1500 ms charge time. Damage scales with charge: 20 at 0ms → 60 at 1500ms. If not fully charged, fires at partial damage. |
| Cooldown | 3000 ms after shot (includes charge time window) |
| Reload | N/A |
| M0 → M3 upgrade direction | Max charge damage +10%/level, charge time -10%/level, VFX: pale magenta → deep violet |
| VFX color progression | M0: #DD88FF → M1: #BB44FF → M2: #8822DD → M3: #5500AA |
| Risk notes | Currently the charge mechanic is not implemented in damage — it is treated as direct damage. Implementation requires a hold-fire input mode (hold LMB to charge, release to fire). This is a significant input system change. Consider making charge automatic (unit charges while aiming at target) to simplify the UX. |

### Flamethrower

| Property | Value |
|----------|-------|
| Range class | Very short |
| Ideal attack distance | 60–100 px |
| Minimum stop distance | 30 px |
| Fire type | Cone stream (continuous) |
| Line-of-sight rule | Partial — flame clips around low cover but reduced damage |
| Ammo/charge rule | Canister: 100 units. Drains at 15 units/s while firing. Regenerates at 8 units/s while not firing. Empty canister = cannot fire until minimum 20 units regenerated. |
| Cooldown | 50 ms tick rate |
| Reload | N/A (canister regeneration) |
| Cone angle | 25° |
| Status effect | Burn: 3 seconds, 5 DPS after flame ends |
| M0 → M3 upgrade direction | Canister capacity +15%/level, drain rate -10%/level, burn duration +0.5s/level, VFX: dim orange → bright white-orange |
| VFX color progression | M0: #AA4400 → M1: #CC6600 → M2: #FF8800 → M3: #FFCC44 |
| Risk notes | Very short range means the unit must close to dangerous distance. Canister prevents infinite area denial. Burn DoT adds value even when the flame is not directly on target. Risk: with no canister, Flamethrower is oppressive in sustained fights; with canister, it may feel underpowered if the charge drains too fast. Test the balance carefully. |

### Freeze

| Property | Value |
|----------|-------|
| Range class | Very short |
| Ideal attack distance | 60–100 px |
| Minimum stop distance | 30 px |
| Fire type | Cone stream (continuous) |
| Line-of-sight rule | Partial — freeze clips around low cover but reduced duration |
| Ammo/charge rule | Canister: 80 units. Drains at 12 units/s while firing. Regenerates at 6 units/s while not firing. Empty canister = cannot fire until minimum 15 units regenerated. |
| Cooldown | 50 ms tick rate |
| Reload | N/A (canister regeneration) |
| Cone angle | 25° |
| Status effect | Freeze: 2 seconds, target speed -50%, turn speed -50%. Stacks duration but not intensity (re-applying extends the timer). |
| M0 → M3 upgrade direction | Freeze duration +0.3s/level, canister capacity +15%/level, drain rate -8%/level, VFX: pale blue → deep blue |
| VFX color progression | M0: #AADDFF → M1: #66BBFF → M2: #3388FF → M3: #1144DD |
| Risk notes | Freeze is a crowd-control weapon, not a damage weapon. Its value is tactical (slow an escaping enemy, stop a chasing enemy). Risk: if freeze duration is too long, it becomes perma-CC. The stacking-but-not-intensifying model prevents perma-slow. Consider adding freeze break (target takes 20% more damage while frozen) for team synergy. |

### Isida

| Property | Value |
|----------|-------|
| Range class | Short |
| Ideal attack distance | 80–130 px |
| Minimum stop distance | 40 px |
| Fire type | Beam support (continuous heal) |
| Line-of-sight rule | Required — beam is interrupted by obstacles |
| Ammo/charge rule | Canister: 120 units. Drains at 10 units/s while healing. Regenerates at 7 units/s while not healing. Empty canister = cannot heal until minimum 25 units regenerated. Isida does NOT deal damage — it only heals allies. |
| Cooldown | 50 ms tick rate |
| Reload | N/A (canister regeneration) |
| Heal rate | 25 HP/s |
| M0 → M3 upgrade direction | Heal rate +10%/level, canister capacity +15%/level, drain rate -8%/level, VFX: near-white → deep blue |
| VFX color progression | M0: #CCFFEE → M1: #88DDCC → M2: #44BBAA → M3: #2288AA |
| Risk notes | Isida without canister can heal infinitely, making it the most powerful sustain tool. With canister, it must manage energy — heal in bursts, then retreat to recharge. This creates interesting tactical decisions. Risk: Isida-heal + Heavy body (Mammoth) is a very durable combo. Consider making Isida drain faster when healing higher-HP targets (diminishing efficiency). |

### Vulcan

| Property | Value |
|----------|-------|
| Range class | Short-medium |
| Ideal attack distance | 150–190 px |
| Minimum stop distance | 60 px |
| Fire type | Rapid-fire overheat (continuous) |
| Line-of-sight rule | Required — individual shots blocked by obstacles |
| Ammo/charge rule | Overheat: 0–100% gauge. Each shot adds 4%. Gauge cools at 15%/s while firing, 30%/s while not firing. At 100%, weapon jams for 3 seconds (cannot fire). |
| Cooldown | 100 ms between shots |
| Reload | N/A (overheat gauge) |
| Damage per shot | 5 |
| Effective DPS | 50 (sustained), but limited by overheat: ~15 shots in 1.5s then 3s jam = ~75 damage per 4.5s cycle = ~16.7 sustained DPS after overheat |
| M0 → M3 upgrade direction | Overheat threshold +10%/level (can fire longer before jamming), cooldown rate +10%/level, damage +5%/level, VFX: amber → white-hot |
| VFX color progression | M0: #FFAA44 → M1: #FFCC66 → M2: #FFEE88 → M3: #FFFFFF |
| Risk notes | Currently the overheat gauge is visual-only — the weapon never actually jams. Implementing the jam mechanic is essential for balance. Without it, Vulcan is a constant DPS hose. Risk: if the jam is too punishing (3s is a long time), players will avoid Vulcan. Consider M0 jam = 3s, M3 jam = 1.5s, so upgrading actually reduces jam duration. |

### Twins

| Property | Value |
|----------|-------|
| Range class | Medium |
| Ideal attack distance | 170–210 px |
| Minimum stop distance | 50 px |
| Fire type | Plasma projectile (alternating twin shots) |
| Line-of-sight rule | Required — projectiles travel in a straight line |
| Ammo/charge rule | Unlimited, cooldown only. Twins are explicitly the "can fire almost continuously" weapon per Denis's request. |
| Cooldown | 600 ms between shots (alternating left/right barrel) |
| Reload | N/A |
| Damage per shot | 12 |
| M0 → M3 upgrade direction | Damage +8%/level, projectile speed +15%/level, cooldown -5%/level, VFX: yellow-green → cyan-green |
| VFX color progression | M0: #88FF44 → M1: #66EE66 → M2: #44DDAA → M3: #22CCDD |
| Risk notes | Twins are the "reliable mid-range spam" weapon. No canister, no overheat, just consistent damage. This is by design — they are the bread-and-butter weapon. Risk: without resource management, Twins may become the default choice for every situation. Differentiate them by giving them lower per-shot damage but higher consistency — players choose Twins for reliability, not burst. |

### Ricochet

| Property | Value |
|----------|-------|
| Range class | Medium |
| Ideal attack distance | 140–180 px |
| Minimum stop distance | 50 px |
| Fire type | Ricochet projectile (bounces off walls/obstacles up to 2 times) |
| Line-of-sight rule | Not required — projectile bounces around corners. Initial shot requires clear aim, but bounces can hit targets behind cover. |
| Ammo/charge rule | Canister: 60 units. Each shot costs 20 units. Regenerates at 8 units/s. This means Ricochet can fire 3 shots before emptying, then must wait ~2.5s for one more shot, or ~7.5s for full canister. |
| Cooldown | 700 ms between shots |
| Reload | N/A (canister regeneration) |
| Damage per shot | 18 (full damage on each bounce hit) |
| Bounce count | 2 bounces per projectile |
| M0 → M3 upgrade direction | Canister capacity +15%/level, cost per shot -10%/level, bounce count +0/0/+1/+1 (M2 gets 3 bounces), VFX: magenta → white-magenta |
| VFX color progression | M0: #FF4488 → M1: #FF66AA → M2: #FF88CC → M3: #FFAAEE |
| Risk notes | Ricochet is a skill weapon — hitting indirect shots requires map knowledge and positioning. Canister prevents spam. The bounce mechanic is currently a placeholder in obstacle checking — it needs proper segment-by-segment wall reflection for production. Risk: if bounces are too hard to aim, the weapon feels useless; if too easy, it dominates in enclosed spaces. The M2 bounce upgrade is a significant power spike. |

### Hammer

| Property | Value |
|----------|-------|
| Range class | Very short (shotgun) |
| Ideal attack distance | 50–100 px |
| Minimum stop distance | 20 px |
| Fire type | Shotgun cone (5 pellets per shot) |
| Line-of-sight rule | Each pellet checks line-of-fire independently |
| Ammo/charge rule | Unlimited, cooldown only. Hammer is a burst weapon — high alpha, long cooldown. No canister needed because the cooldown is the limiting factor. |
| Cooldown | 1500 ms |
| Reload | N/A |
| Damage per pellet | 35 / 5 = 7 per pellet |
| Cone angle | 30° |
| Pellet spread | 5 pellets evenly distributed across the cone |
| M0 → M3 upgrade direction | Damage per pellet +10%/level, pellet count +0/+0/+1/+1 (M2 gets 6 pellets, M3 gets 7), cooldown -5%/level, VFX: gold → white-gold |
| VFX color progression | M0: #DDAA44 → M1: #EEBB55 → M2: #FFCC66 → M3: #FFEEAA |
| Risk notes | Hammer is the ultimate close-range weapon — devastating if all pellets hit, weak at range. The point-blank hit detection fix (projected footprint model) is critical for Hammer. Risk: if hit detection does not fix the close-range miss problem, Hammer is unplayable. Consider adding a minimum range auto-hit guarantee (if target is within 30px, all pellets hit). |

---

## 9. Body mechanics proposal

### Wasp

| Property | Value |
|----------|-------|
| Role | Light fast scout / hit-and-run / flanker |
| HP | 180 |
| Armor | 0 (no damage reduction) |
| Mass | 2200 kg |
| Speed | 13.0 tiles/s (200 px/s) |
| Turn speed | 150 °/s |
| Acceleration | 240 px/s² |
| Braking | 180 px/s² |
| Recoil resistance | Very low — Railgun recoil on Wasp is ~1.36× base impulse |
| Footprint/collision | 16×10 px (small_fast), ~0.8 tile radius |
| Role identity | The fastest unit on the field. Used for scouting, harassment, and flanking. Cannot stand in a firefight — must hit and run. Pairs well with Railgun (alpha strike + retreat) or Smoky (consistent poke). Weak against sustained damage and area denial. |
| Interaction with weapon recoil | Strong recoil impulse. Railgun-Wasp gets pushed back ~5.4 px per shot. This is a feature, not a bug — the knockback creates a natural "fire and reposition" rhythm. |

### Hornet

| Property | Value |
|----------|-------|
| Role | Fast light-medium raider / skirmisher |
| HP | 210 |
| Armor | 2 (flat damage reduction per hit) |
| Mass | 2400 kg |
| Speed | 12.0 tiles/s (180 px/s) |
| Turn speed | 130 °/s |
| Acceleration | 210 px/s² |
| Braking | 165 px/s² |
| Recoil resistance | Low |
| Footprint/collision | 18×12 px (light_fast), ~0.9 tile radius |
| Role identity | Slightly tougher than Wasp but still fragile. The raider — quick enough to chase, tough enough to survive a brief exchange. Pairs well with Ricochet (indirect harassment) or Twins (consistent mid-range pressure). |
| Interaction with weapon recoil | Noticeable but manageable. Ricochet on Hornet has a slight push that can be used for micro-positioning. |

### Hunter

| Property | Value |
|----------|-------|
| Role | Universal medium / all-rounder |
| HP | 285 |
| Armor | 5 (flat damage reduction per hit) |
| Mass | 3000 kg |
| Speed | 10.0 tiles/s (150 px/s) |
| Turn speed | 140 °/s |
| Acceleration | 165 px/s² |
| Braking | 135 px/s² |
| Recoil resistance | Medium (reference body for recoil scaling) |
| Footprint/collision | 22×14 px (medium), ~1.0 tile radius |
| Role identity | The workhorse. No glaring weakness, no extreme strength. Good with any weapon. The default choice for new players. Hunter-Smoky is the standard Arena test loadout for a reason. |
| Interaction with weapon recoil | Baseline recoil. This is the 1.0× reference point for the recoil-mass scaling formula. |

### Viking

| Property | Value |
|----------|-------|
| Role | Reinforced universal medium / brawler |
| HP | 315 |
| Armor | 8 (flat damage reduction per hit) |
| Mass | 3000 kg (same as Hunter, but slower due to heavier armor) |
| Speed | 9.0 tiles/s (135 px/s) |
| Turn speed | 110 °/s |
| Acceleration | 150 px/s² |
| Braking | 120 px/s² |
| Recoil resistance | Medium (same mass as Hunter, same recoil) |
| Footprint/collision | 22×14 px (medium), ~1.0 tile radius |
| Role identity | The brawler — trades speed for durability. Higher armor means it wins sustained fights against Hunters. Pairs well with Isida (sustain + healing = unkillable front line) or Vulcan (close-range DPS while tanking). |
| Interaction with weapon recoil | Same as Hunter — the heavier armor plating does not increase mass, so recoil impulse is identical. The visual difference is that Viking is slower to reposition after recoil. |

### Dictator

| Property | Value |
|----------|-------|
| Role | Large fast assault / glass cannon platform |
| HP | 345 |
| Armor | 6 (flat damage reduction per hit) |
| Mass | 3300 kg |
| Speed | 8.0 tiles/s (120 px/s) — fast for its size |
| Turn speed | 130 °/s — surprisingly nimble |
| Acceleration | 135 px/s² |
| Braking | 105 px/s² |
| Recoil resistance | Medium-high |
| Footprint/collision | 24×14 px (large_fast), ~1.1 tile radius |
| Role identity | The glass cannon platform. Large HP pool but only medium armor. Fast for its size. Rear-mounted turret means it must expose its body to fire, creating a risk/reward dynamic. Pairs well with Railgun (drive-by alpha strikes) or Thunder (drive into range, splash, retreat). The rear turret is a defining feature — it changes the engagement geometry. |
| Interaction with weapon recoil | Noticeable on rear-mounted weapons. Railgun-Dictator gets a forward push when firing backward, which can actually help with retreats. |

### Titan

| Property | Value |
|----------|-------|
| Role | Heavy frontline / anchor |
| HP | 420 |
| Armor | 12 (flat damage reduction per hit — significant) |
| Mass | 5000 kg |
| Speed | 6.0 tiles/s (90 px/s) |
| Turn speed | 90 °/s |
| Acceleration | 90 px/s² |
| Braking | 75 px/s² |
| Recoil resistance | High (Railgun recoil is ~0.6× base impulse) |
| Footprint/collision | 28×18 px (heavy), ~1.3 tile radius |
| Role identity | The anchor. Slow, tough, and hard to dislodge. Front-mounted turret means it fires while advancing — no need to expose the flank. Pairs well with Vulcan (sustained close-range DPS while tanking) or Shaft (snipe from behind the front line). The armor value makes it resistant to chip damage from Twins and Smoky. |
| Interaction with weapon recoil | Minimal. Railgun on Titan barely moves. This makes Titan-Shaft a stable sniper platform — the charge aim is not disrupted by recoil. |

### Mammoth

| Property | Value |
|----------|-------|
| Role | Super-heavy fortress / siege platform |
| HP | 500 |
| Armor | 15 (flat damage reduction per hit — very significant) |
| Mass | 5500 kg |
| Speed | 5.0 tiles/s (75 px/s) — slowest unit |
| Turn speed | 80 °/s — slowest turn |
| Acceleration | 75 px/s² |
| Braking | 60 px/s² |
| Recoil resistance | Very high (Railgun recoil is ~0.55× base impulse) |
| Footprint/collision | 32×22 px (super_heavy), ~1.5 tile radius |
| Role identity | The fortress. Maximum HP, maximum armor, minimum speed. It controls territory by being there — enemies must go around or focus fire. Pairs well with Thunder (splash from behind the front line) or Railgun (long-range siege with no recoil disruption). The 15 armor means light weapons (Vulcan 5 damage) deal negligible damage — dedicated anti-armor is needed. |
| Interaction with weapon recoil | Almost imperceptible. This is the stable firing platform for any weapon. The trade-off is that Mammoth cannot reposition quickly — once committed, it stays. |

### Armor vs HP tradeoff

The proposed flat damage reduction (armor) creates an important design space:

- Low-damage/high-rate weapons (Vulcan, Twins) are weak against armor because each hit is reduced.
- High-damage/single-shot weapons (Railgun, Shaft, Hammer) are strong against armor because the reduction is a smaller fraction.
- This creates natural counters: Mammoth shrugs off Vulcan but fears Railgun. Wasp dies to everything but is fast enough to avoid most shots.

Armor values are intentionally flat (not percentage) because:
1. Flat reduction is easier to understand (minus X per hit).
2. It creates a natural DPS floor — weapons below the armor value deal zero damage, which makes light weapons useless against heavy armor. This is desirable — a Vulcan should not be able to kill a Mammoth alone.
3. Percentage reduction would require different balancing and makes low-damage weapons relatively stronger, which is counter-intuitive.

---

## 10. Faction mechanics proposal

### Cyan — Поток (Flow)

| Property | Value |
|----------|-------|
| Russian name options | Поток, Стрим, Волна |
| Identity | Speed and momentum. The faction that moves faster, reacts faster, and controls the tempo of the game. |
| Passive bonus options | +10% unit speed, +8% acceleration, +5% turn speed. Harvesters move 15% faster. |
| Active ability option (future) | Rush: selected unit gets +25% speed for 5s. 60s cooldown. Visual: cyan energy burst around the unit. |
| Economy mechanics | Faster economy cycle: harvesters deliver more frequently (speed bonus), but no yield bonus. The advantage is throughput, not efficiency. |
| Combat mechanics | Faster flanking, faster retreat, faster repositioning. Cyan players can attack and disengage before the enemy can respond. Weak in sustained fights because units have standard HP and no armor bonus. |
| Territory/vision mechanics | Standard vision. Speed advantage allows faster scouting. |
| Implementation complexity | Low. Config-driven speed multipliers. No new systems. |
| Balance risk | Medium. Speed is a multiplicative advantage — it helps in every situation. May need a compensating penalty (e.g., -5% HP or -5% damage) to prevent Cyan from being the default best faction. |

### Green — Росток (Sprout)

| Property | Value |
|----------|-------|
| Russian name options | Росток, Корень, Ствол |
| Identity | Growth and economy. The faction that builds faster, produces more, and wins through economic superiority. |
| Passive bonus options | +15% building construction speed, +10% harvester yield, -10% building matter cost. |
| Active ability option (future) | Overgrow: target building heals 25% HP over 5s. 45s cooldown. Visual: green pulse around the building. |
| Economy mechanics | Cheaper buildings and faster construction mean Green expands faster. Higher harvester yield means more income per trip. The economic snowball is Green's win condition. |
| Combat mechanics | Standard combat stats. Green wins by having more units and better economy, not by having better units. |
| Territory/vision mechanics | Territory grows slightly faster (if territory mechanic is implemented). Buildings have +10% HP as a side effect of the growth theme. |
| Implementation complexity | Low. Config-driven cost and speed multipliers. |
| Balance risk | Medium-High. Economic advantages snowball. On large maps, Green may be dominant because the economic advantage compounds over time. On small maps, the advantage is less relevant because games are shorter. |

### Yellow — Искра (Spark)

| Property | Value |
|----------|-------|
| Russian name options | Искра, Горн, Пламя |
| Identity | Fire and production. The faction that hits harder and produces combat units faster. |
| Passive bonus options | +10% weapon damage, +8% turret turn speed, +12% factory production speed. |
| Active ability option (future) | Salvo: selected unit fires 2 additional instant shots at reduced damage (50% each). 90s cooldown. Visual: yellow flash on the barrel. |
| Economy mechanics | Standard economy. The factory production speed bonus means Yellow gets combat units faster once the factory is built. No raw resource advantage. |
| Combat mechanics | Higher damage output. Yellow units win in even fights because they deal more damage. Weak in economy and defense — if the opponent out-economizes or out-tanks Yellow, the damage bonus is not enough. |
| Territory/vision mechanics | Standard. No vision advantage. |
| Implementation complexity | Low. Config-driven damage and production multipliers. |
| Balance risk | Medium. Damage bonuses are easy to understand and easy to balance. The risk is that +10% damage across all weapons makes Yellow the "easy mode" faction — just pick Yellow and do more damage. Consider making the bonus weapon-specific (e.g., +15% for single-shot weapons, +5% for continuous) to add nuance. |

### Purple — Око (Eye)

| Property | Value |
|----------|-------|
| Russian name options | Око, Зонд, Вихрь |
| Identity | Vision and intelligence. The faction that sees more, knows more, and makes better decisions because of it. |
| Passive bonus options | +25% vision range, +15% turret turn speed, units detect enemy type/HP when targeted. |
| Active ability option (future) | Scan: reveal a circular area (10-tile radius) for 8s, showing all enemy units including their type and HP. 50s cooldown. Visual: purple ripple expanding from the scan point. |
| Economy mechanics | Standard economy. No economic bonus. The advantage is informational — Purple players know where the enemy is and can make better decisions. |
| Combat mechanics | Standard damage and HP. The turret turn speed bonus means Purple units can track fast-moving targets better. The detection bonus means Purple players can see enemy HP bars and make informed targeting decisions. |
| Territory/vision mechanics | Larger vision radius means earlier warning of enemy movements. In a fog-of-war system, Purple would have a significant advantage. Without fog of war, the advantage is mainly turret tracking and target info. |
| Implementation complexity | Medium. Vision range is config-driven. Unit detection/HP display needs HUD changes. Scan ability needs a new system. |
| Balance risk | Medium-High. Vision advantages are hard to quantify. In games with fog of war, vision is extremely powerful. In games without fog of war (current state), the advantage is marginal. If fog of war is ever added, Purple becomes significantly stronger. Balance depends heavily on whether fog of war exists. |

### Faction balance summary

| Faction | Economy | Combat | Defense | Speed | Vision | Overall risk |
|---------|---------|--------|---------|-------|--------|-------------|
| Cyan (Поток) | + | - | - | +++ | Standard | Medium |
| Green (Росток) | +++ | - | + | - | Standard | Medium-High |
| Yellow (Искра) | - | +++ | - | Standard | Standard | Medium |
| Purple (Око) | Standard | + | - | + | +++ | Medium-High |

The key balance concern is that economy bonuses (Green) and speed bonuses (Cyan) tend to be multiplicative advantages that compound over time, while damage bonuses (Yellow) are linear. Vision (Purple) is context-dependent. This means Green and Cyan may need slightly weaker passive values to prevent snowballing.

---

## 11. Building set proposal

### Current buildings (3 functional, 3 asset-only)

| Building | Status | Current purpose |
|----------|--------|----------------|
| HQ | Functional | Starting building, harvester unloading, builder spawn |
| Separator | Functional | Converts raw → matter + elements |
| Power Plant | Functional | Provides power for buildings |
| Units Factory | Functional | Produces harvesters and builders |
| Raw Storage | Asset only, no config | +200 raw capacity (defined in economy constants but not placeable) |
| Matter Storage | Asset only, no config | +200 matter + elements capacity (defined but not placeable) |
| Command Relay | Asset only, no config | No defined mechanic |

### Proposed building set

| Building | Purpose | Required asset availability | Mechanic | Unlock relationship | Visual-only first? | Risk |
|----------|---------|----------------------------|----------|---------------------|--------------------|----|
| HQ | Starting building, resource unloading, builder spawn | Already exists | Current HQ mechanic | Starting building | No — gameplay-ready | Low |
| Separator | Raw → matter + element conversion | Already exists | Current separator mechanic | Unlocked from start | No — gameplay-ready | Low |
| Power Plant | Power supply for buildings | Already exists | Current power mechanic | Unlocked from start | No — gameplay-ready | Low |
| Units Factory | Produces civil units | Already exists | Current factory mechanic | Requires Power Plant | No — gameplay-ready | Low |
| Raw Storage | Increases raw resource cap | Asset exists | +200 raw capacity, passive | Requires Separator | No — gameplay-ready (simple config addition) | Low |
| Matter Storage | Increases matter + element cap | Asset exists | +200 matter + 200 element cap, passive | Requires Separator | No — gameplay-ready (simple config addition) | Low |
| Command Relay | Extends territory and vision range | Asset exists | Territory radius +5 tiles, vision radius +8 tiles. Consumes power. | Requires Power Plant + Matter Storage | No — gameplay-ready | Medium (territory/vision system needed) |
| Repair Bay | Heals nearby vehicles over time | Asset does not exist | Heals vehicles within 3-tile radius at 10 HP/s. Costs matter per HP healed. | Requires Units Factory | Yes first — place as visual prop, add mechanic later | Medium |
| Weapon Bay | Upgrades weapons on vehicles | Asset does not exist | Vehicle enters bay, selects weapon upgrade (M0→M1 etc.), costs matter + elements + time. | Requires Units Factory + Power Plant | Yes first — place as visual prop | High (upgrade UI needed) |
| Radar Tower | Reveals large area of the map | Asset does not exist | Reveals 12-tile radius. Detects enemy movement. Costs power. | Requires Command Relay | Yes first — place as visual prop | Medium (vision system needed) |
| Defense Turret | Auto-attacks nearby enemies | Asset does not exist | Fires at nearest enemy within range. Uses Smoky-like stats. Costs power + ammo. | Requires Weapon Bay | Yes first — place as visual prop | High (combat AI integration) |
| Wall Segment | Blocks movement and line of fire | Asset does not exist | Blocks pathing and projectiles. High HP, no power. | Requires Separator | Yes first — place as visual prop | Low (obstacle system exists) |

### Implementation phasing

**Phase 1 (immediate)**: Fix Raw Storage and Matter Storage configs. Both have assets and defined mechanics. This is a simple config addition — add them to `BUILDING_CONFIG` in `construction.ts` with appropriate costs and build times.

**Phase 2 (with faction mechanics)**: Implement Command Relay with territory/vision extension. This requires the territory system to exist (or be stubbed).

**Phase 3 (visual-only first)**: Place Repair Bay, Weapon Bay, Radar Tower, Defense Turret, and Wall Segment as visual-only buildings. They exist on the map, have footprints and sprites, but have no gameplay mechanic. This allows the building set to feel complete visually while deferring complex mechanics.

**Phase 4 (mechanics pass)**: Add gameplay mechanics to visual-only buildings one at a time, starting with the simplest (Wall Segment — obstacle system exists) and progressing to the most complex (Defense Turret — needs combat AI integration).

### Unlock/tech tree diagram

```
HQ (starting)
├── Separator (starting)
│   ├── Raw Storage
│   ├── Matter Storage
│   └── Wall Segment
├── Power Plant (starting)
│   ├── Units Factory
│   │   ├── Repair Bay
│   │   └── Weapon Bay
│   └── Command Relay
│       └── Radar Tower
│           └── Defense Turret
```

This tree ensures:
- Basic economy (Separator + Power Plant + Factory) is available immediately.
- Storage buildings are early investments that support economy.
- Military buildings (Repair, Weapon Bay) require Factory first.
- Intelligence buildings (Command Relay → Radar → Defense) are a separate branch that requires investment.

---

## 12. Resource and map layout proposal

### Industrial Platform-only flow

All normal game maps use Industrial Platform terrain. The map generation pipeline:
1. User selects map size (Small/Standard/Large) and optionally a seed.
2. Generator fills the map with `industrial` terrain type.
3. TerrainRenderer adds visual variation (WeightedTilePicker).
4. Resource anchors are placed at fixed positions.
5. HQ is placed at the lower-left start zone.

No sand terrain, no fixed Map 1, no map style selection in normal UX.

### Generated-only normal flow

All normal game maps are generated. Fixed maps are available only behind developer flags. The generation is deterministic (seeded PRNG), so the same seed always produces the same map.

### Static/fixed resource anchors

Resource positions should use a **fixed anchor** system. For each map size, define a set of anchor positions where resources are guaranteed to appear. The type and exact position within each anchor zone may have slight variation.

**Small (32×32) anchors**:
- Start cluster: 6 tiles NE of HQ (always present).
- Central infinite: map center (always present).
- Side deposits: 4 anchors at cardinal directions, ~12 tiles from center.

**Standard (48×48) anchors**:
- Start cluster: 6 tiles NE of HQ (always present).
- Central infinite: map center (always present).
- Near ring: 6 anchors at 10-15 tiles from HQ, biased toward center.
- Side deposits: 8 anchors at cardinal and diagonal directions, ~16 tiles from center.

**Large (64×64) anchors**:
- Start cluster: 6 tiles NE of HQ (always present).
- Central infinite: map center (always present).
- Near ring: 8 anchors at 10-18 tiles from HQ.
- Mid ring: 10 anchors at 18-28 tiles from HQ.
- Far ring: 6 anchors at 28-36 tiles from HQ.

### Center infinite deposit

The center deposit is always a 2×2 or 3×3 infinite resource. It is the strategic focal point of the map — controlling the center means infinite income. All players start equidistant from the center.

For 2-player maps (current state), both players start at the lower-left. The center deposit is contestable. For future multi-player maps, players start at different corners.

### Side/edge deposits

Side deposits are medium or large resources placed at fixed positions along the map edges and at intermediate distances. They provide secondary income for players who expand away from the center.

Side deposits are slightly randomized in type (medium vs. large) but always exist at their anchor positions. This ensures that every game has the same strategic structure while allowing slight economic variation.

### Poor/medium/rich/infinite amounts

Proposed resource classes and amounts:

| Class | Russian name | Raw amount | Harvester trips to deplete | Visual |
|-------|-------------|-----------|---------------------------|--------|
| Poor | Бедное | 15 | ~3 trips | Small, dim crystal |
| Small (current) | Малое | 30 | ~6 trips | Small crystal |
| Medium | Среднее | 80 | ~16 trips | Medium crystal |
| Large | Богатое | 200 | ~40 trips | Large crystal |
| Rich | Очень богатое | 500 | ~100 trips | Extra-large crystal |
| Infinite | Бесконечное | 999,999 | Never | 2×2 glowing crystal formation |

The "Poor" class is new — it represents exhausted or marginal deposits that are not worth long-term investment but provide quick early income. "Rich" is also new — it represents premium deposits that are worth defending.

Current code uses: small=20, medium=60, large=120, infinite=999999. The proposed values increase the gap between classes, making resource quality more meaningful. A "medium" deposit is now clearly better than a "small" one (80 vs 30, was 60 vs 20), and "large" deposits are genuinely valuable (200 vs 120).

### Map size scaling

| Size | Dimensions | Tile count | Anchor count | Expected game duration |
|------|-----------|------------|-------------|----------------------|
| Small | 32×32 | 1024 | ~12 | 10-15 min |
| Standard | 48×48 | 2304 | ~18 | 15-25 min |
| Large | 64×64 | 4096 | ~28 | 25-40 min |

Performance consideration: 64×64 maps have 4096 tiles. Each tile is rendered as an isometric diamond. With 76×38 pixel tiles, a 64×64 map spans approximately 4864×2432 pixels of terrain. This is well within Phaser's rendering capability for WebGL tilemaps.

### Testability

The fixed anchor system makes testing predictable:
1. Every game on the same seed has the same anchor positions.
2. Balance testing can use the same seed repeatedly.
3. The center deposit is always contested, so balance tests can focus on center fights.
4. Starting resources are always sufficient for early economy (validated by map generator).

Automated test: create a test that generates maps for each size with 10 different seeds and verifies that all anchor positions are filled, no anchors overlap, and the start cluster is accessible from HQ.

---

## 13. Phaser 4 feasibility

### Spritesheets / atlases

Phaser 4 supports spritesheet loading via `this.load.spritesheet()` and texture atlas via `this.load.atlas()`. For vehicle sprites:
- **Body sprites**: 8 directions × N animation frames per body. Each frame is a separate sprite in the sheet. A 7-body spritesheet with 8 directions × 4 frames = 224 frames.
- **Turret sprites**: 8 directions × 1 frame per weapon (turrets do not animate). 11 weapons × 8 directions = 88 frames.
- **Total**: ~312 frames. At approximately 64×48 pixels per frame (isometric vehicle), this is ~312 × 64 × 48 × 4 bytes ≈ 3.8 MB of texture data. Well within browser memory limits.

Phaser 4 supports texture atlases (packed sprites) which reduce draw calls by batching sprites from the same atlas. This is the recommended approach for production sprites.

**Risk**: Low. Spritesheets are a well-supported Phaser feature.

### Separate body/turret sprites

The current `ModularTankRenderer` already implements this pattern — a hull sprite and a turret sprite rendered in a Phaser Container. The turret rotates independently of the hull.

For production, each vehicle is a Container with:
- Hull sprite (direction-based frame selection).
- Turret sprite (angle-based rotation, not frame-based, for smooth aiming).
- Optional track animation sprite layer.

**Risk**: Low. The pattern is already proven in the codebase.

### Track animation options

**Option A: Procedural track marks**. Draw lines behind the vehicle on the ground plane using Phaser `Graphics`. The tracks fade over 2-3 seconds. This requires no new assets.

**Option B: Frame-based track animation**. The hull spritesheet includes a track animation layer — a few frames of track position cycling. The animation speed is proportional to the vehicle's movement speed.

**Option C: Texture-offset track animation**. Use a repeating track texture and shift the UV offset over time. This creates a smooth, continuous track movement effect. Phaser 4 supports tileSprite with frame-based offset, but UV offset on a sprite requires a shader or a custom render pipeline.

**Recommendation**: Start with Option A (procedural) for Tier 0. Plan Option B for Tier 1. Option C is a Tier 2 optimization.

**Risk**: Low for A, Medium for B, High for C (requires custom rendering pipeline).

### Phaser Graphics procedural VFX

The current blockout VFX system uses Phaser `Graphics` for all visual effects — rays, circles, cones, lines, dots. This works well for blockout but has limitations:
- `Graphics` objects are redrawn every frame, which is CPU-intensive for many simultaneous effects.
- No particle system integration.
- No blur/glow/blend mode support without custom shaders.

For production VFX:
- Simple effects (rays, circles) can remain as `Graphics`.
- Complex effects (explosions, smoke trails, fire) should use Phaser's particle system or sprite-based animation.
- Glow effects can use Phaser's `postFX` pipeline (Phaser 4 supports WebGL post-processing).

**Risk**: Medium. Phaser 4's particle system API may differ from Phaser 3. Need to verify the current API before designing sprite-based VFX.

### DOM UI localization

All UI is DOM-based. Localization is straightforward:
1. Create a `src/config/localization.ts` map with `ru` and `en` string keys.
2. All DOM UI components read from this map instead of hardcoded English.
3. Language is stored in game config and persisted in localStorage.
4. CSS must handle longer Russian text (20-40% wider on average).

The DOM approach is ideal for localization because:
- DOM elements resize automatically with CSS `flex`/`grid`.
- Font rendering is handled by the browser (no Phaser font loading).
- RTL is not needed for Russian (same direction as English).

**Risk**: Very Low. This is a string replacement pass with CSS verification.

### Projected ground-space rendering

The camera projection contract is already implemented and enforced. All ground-plane visuals (selection rings, shadows, footprints, range indicators, move markers) use `projectGroundCircleToPolyline`, `projectGroundRect`, and `projectGroundPoint`.

For new ground-space features:
- **Building footprints**: Use `projectGroundRect` (already exists).
- **Weapon range circles**: Use `projectGroundCircleToPolyline` (already exists).
- **Explosion radius**: Use `projectGroundCircleToPolyline` (already exists).
- **Movement path preview**: Project each tile center along the BFS path and draw projected ground markers.

**Risk**: Very Low. The infrastructure exists and is proven.

### Camera/projection constraints

The fixed isometric camera is a hard constraint that affects:
- **Sprite design**: All sprites must be designed for the fixed 2.5D angle. Top-down sprites will not work.
- **VFX design**: All ground-plane effects must use projection, not screen-space circles.
- **UI design**: HUD elements are screen-space (DOM overlays), so they are not affected by the projection.

The constraint is well-defined and already enforced in the codebase. New features must follow the same rules.

**Risk**: Low. The constraint reduces ambiguity rather than creating risk.

### Performance risks

- **Tile count**: 64×64 = 4096 tiles. Each tile is one draw call in the worst case. Phaser's tilemap system batches tiles, so actual draw calls should be much lower. Performance should be fine.
- **Vehicle count**: Current tests handle ~10-20 vehicles without issues. For production, 50-100 vehicles should be manageable. More than 100 may require spatial partitioning for damage checks.
- **VFX count**: Each active VFX is a `Graphics` object that redraws every frame. With many simultaneous effects (e.g., 5 Flamethrowers × 50 ticks/s), the CPU load increases. For production, consider a VFX object pool and batch rendering.
- **DOM UI**: All UI is DOM, so Phaser rendering is not affected by UI complexity. The browser handles DOM layout independently.

**Risk**: Low for current scope. Medium if vehicle count exceeds 50 simultaneous units.

### Testing strategy

- **Unit tests**: Pure TypeScript modules (damage, pathfinding, economy) have Vitest tests. Current count: 1700+.
- **Integration tests**: Arena mode serves as a manual integration test. Automated Playwright tests cover smoke tests.
- **Visual tests**: No automated visual regression tests. Changes to rendering are validated by typecheck + build + manual preview.
- **Balance tests**: No automated balance tests. Balance is validated by manual Arena playtesting.

For the proposed mechanics, the testing strategy should be:
1. Add unit tests for new config values (faction bonuses, canister mechanics, armor reduction).
2. Add Arena integration tests for grid movement, turn states, and hit detection changes.
3. Manual QA for visual changes (animation tiers, UI localization).

---

## 14. What to defer

### Bot roadmap

The bot/opponent AI roadmap is explicitly deferred. The current Arena AI modes (passive, stationary_shooter, chaser, hold_position) are sufficient for testing combat mechanics. A production bot AI requires target prioritization, path planning, economy management, and strategic decision-making — all of which are complex systems that should not be started until the core mechanics are stable.

### Strategic enemy AI

Related to the bot roadmap. Strategic AI that builds bases, manages economy, and coordinates attacks is a later stage. The current AI is reactive (respond to nearby threats) and does not need to become proactive yet.

### Attack waves

Attack waves (timed enemy assaults) are a game mode, not a core mechanic. They depend on having a functional bot AI and economy system. Defer until both are ready.

### Economy AI

AI that manages resource gathering, building construction, and unit production is part of the bot roadmap. Defer.

### Final production combat

The current blockout combat system is functional for mechanics testing. Production combat (with sprite-based vehicles, particle VFX, sound effects, and balanced damage numbers) requires final assets and extensive tuning. Defer until core mechanics (movement, hit detection, weapon resources) are locked.

### Final art generation

All current vehicle and building art is either blockout (procedural) or asset-generation-assisted. Final art requires a dedicated art pipeline with visual review. Defer until mechanics are stable so that art is not wasted on designs that change.

### Save/load arena setups

Arena save/load is explicitly deferred in the Arena closure report. It is a quality-of-life feature for testing, not a gameplay feature. If needed later, it can be added without affecting core mechanics.

### Massive asset generation

Generating sprites for all 7 bodies × 11 weapons × 8 directions × 4 factions would be 2,464 body sprites + 352 turret sprites = 2,816 sprite frames. This is a significant asset generation effort. Defer until the visual style is locked and the animation tier decision is made.

---

## 15. Suggested future roadmap groups

These are **not** the final roadmap. They are likely groupings for discussion. The actual roadmap will be created after Denis and GPT accept/reject/modify the mechanics proposed in this audit.

### Group 1: Localization and UX Cleanup

| Property | Value |
|----------|-------|
| Purpose | Translate all UI to Russian, remove obsolete options, unify button styles, hide debug from normal players |
| Risk | Very Low |
| Why first | Unblocks Russian-speaking testers. Cleans the UX before adding new features. Does not depend on any other group. |
| Estimated scope | ~5-8 PRs: localization system, string replacement, layout fixes, UX cleanup, button system, debug hiding |

### Group 2: Movement and Collision

| Property | Value |
|----------|-------|
| Purpose | Grid-based tank movement with turn states, tile occupancy, unit collision, waypoint smoothing |
| Risk | Medium |
| Why after Group 1 | Movement is a core mechanic that affects every other system. Must be stable before combat and AI can be properly tested. Depends on Group 1 only for Russian status messages. |
| Estimated scope | ~6-10 PRs: BFS for combat vehicles, turn state machine, waypoint smoothing, tile occupancy, collision resolution, movement tests, Arena integration |

### Group 3: Hit Model and Combat Polish

| Property | Value |
|----------|-------|
| Purpose | Projected footprint hit detection, aim forgiveness, point-blank fix, mass-dependent recoil |
| Risk | Medium |
| Why after Group 2 | Hit detection depends on accurate vehicle positions (grid movement). Recoil scaling depends on body mass (already known). Must come after movement is stable. |
| Estimated scope | ~4-6 PRs: hit volume model, aim forgiveness, point-blank auto-hit, recoil-mass scaling, combat tests |

### Group 4: Weapon Resources and Balance

| Property | Value |
|----------|-------|
| Purpose | Canister/charge mechanics for continuous weapons, overheat jam for Vulcan, charge mechanic for Shaft, M0-M3 VFX color progression |
| Risk | Medium-High |
| Why after Group 3 | Weapon balance depends on accurate hit detection. Canister/charge UI depends on combat being functional. VFX progression is independent but best done with the full weapon system. |
| Estimated scope | ~6-8 PRs: canister system, per-weapon canister config, overheat jam, Shaft charge, charge bars UI, VFX color progression, balance tuning |

### Group 5: Faction Mechanics and Economy

| Property | Value |
|----------|-------|
| Purpose | Faction passive bonuses, faction identity in UI, economy balance adjustments for faction differences |
| Risk | Medium |
| Why after Group 4 | Faction bonuses modify weapon damage and economy rates. Must be balanced against the final weapon values. Economy adjustments depend on resource layout (Group 6). |
| Estimated scope | ~4-6 PRs: faction config system, passive bonus multipliers, faction UI, balance testing, economy tuning |

### Group 6: Resource Layout and Building Expansion

| Property | Value |
|----------|-------|
| Purpose | Fixed resource anchors, mineral richness classes, building config fixes (Raw/Matter Storage), visual-only buildings, territory/vision system |
| Risk | Medium-High |
| Why after Group 5 | Resource layout and building mechanics depend on faction economy balance. Territory system is needed for Command Relay. |
| Estimated scope | ~6-8 PRs: fixed anchor system, mineral richness, building config fixes, visual-only buildings, territory/vision stub, Command Relay mechanic |

### Group 7: Animation and Feel Pass

| Property | Value |
|----------|-------|
| Purpose | Procedural feel improvements (Tier 0), track marks, body tilt, smooth easing, turn animation, mass-dependent recoil visuals |
| Risk | Low |
| Why after Group 2 | Animation depends on the movement state machine. Can be done in parallel with Groups 3-6 but benefits from having movement stable first. |
| Estimated scope | ~4-6 PRs: turn state visuals, track marks, body tilt, smooth easing, recoil scaling visuals, Arena feel testing |

### Group 8: Control Scheme and Input

| Property | Value |
|----------|-------|
| Purpose | Implement hybrid LMB/RMB control scheme, attack-move, command feedback, cursor changes |
| Risk | Low-Medium |
| Why early or parallel | Can be done in parallel with Group 2. Input routing is independent of movement logic. But both should be stable before combat testing. |
| Estimated scope | ~3-5 PRs: LMB move/attack, RMB cancel/pan, cursor feedback, command confirmation, multi-unit selection (if scoped) |

---

## 16. Questions for Denis

### Control scheme

1. **Are you willing to accept the hybrid LMB/RMB model (LMB select + command, RMB cancel + camera pan)?** This preserves your LMB preference while adding a cancel button. Pure LMB-only has disambiguation problems that will become worse as the game gets more complex.

2. **Should multi-unit selection be supported?** If yes, what model — drag-select box, shift-click add, or ctrl-click add? Multi-selection significantly changes the input architecture.

3. **Should attack-move be a distinct command?** Attack-move (move to location, attack anything encountered) is a standard RTS feature. It requires a modifier key or a separate button.

### Movement

4. **Should combat vehicles use the same pathfinding as harvesters/builders (BFS through tile centers)?** This is the grid-movement model you described. It means tanks follow tile corridors and cannot take diagonal shortcuts.

5. **Should tanks be able to move while turning, or must they stop and turn first?** Stop-and-turn is more realistic (tank-like) but feels slower. Move-and-turn is faster but less physical.

6. **What should happen when a tank's path is blocked by another friendly unit?** Wait, repath, or push? Waiting is simplest but can cause traffic jams. Repathing avoids jams but is more complex. Pushing is not realistic for tanks.

### Combat

7. **Should armor be flat damage reduction (proposed) or percentage reduction?** Flat reduction makes light weapons useless against heavy armor, which creates natural counters. Percentage reduction scales uniformly and is easier to balance but less interesting.

8. **Should Isida be heal-only, or should it have a damage mode?** Currently Isida is heal-only. A damage mode (switch to drain enemy HP) would make it more versatile but harder to balance.

9. **What is the target time-to-kill for a same-tier engagement?** For example, how long should a Hunter-Smoky take to kill another Hunter-Smoky? This drives all damage/HP balance decisions.

### Factions

10. **Which faction name style do you prefer?** The audit proposes Russian names (Поток, Росток, Искра, Око). Should the names be element-themed (Water, Earth, Fire, Air) or industrial-themed (Flow, Growth, Spark, Eye)?

11. **Should factions have visible color-coded differences beyond the current team color?** For example, should Cyan units have a slightly different silhouette or accent color?

12. **Is the Pack B (Passive + Economy Identity) faction model acceptable as a starting point?** Or do you want active abilities from the start?

### Buildings

13. **Should new buildings be placed as visual-only props first (Phase 3 approach), or should they only appear when their mechanic is implemented?** Visual props make the base feel more complete but may confuse players who expect functionality.

14. **Should the Wall Segment be a building or an obstacle?** Walls are traditionally obstacles in RTS, but if they require construction and matter cost, they are buildings. The distinction affects how they are placed, destroyed, and interact with pathfinding.

### Resources

15. **Should the center infinite deposit be truly infinite or very large (e.g., 50,000)?** Truly infinite means it never depletes, which makes center control always valuable. Very large means it eventually depletes, which changes late-game dynamics.

16. **Should resource positions be identical across all games on the same map size, or should there be slight variation within anchor zones?** Identical positions are better for competitive balance. Slight variation is better for replayability.

### Visual / Animation

17. **Should the procedural feel pass (Tier 0) be done before or after the movement system change?** If done before, the visual improvements will be immediately visible on the current arcade movement. If done after, they can be designed for the new grid movement from the start.

18. **What is the visual priority — weapon VFX color progression or body animation?** Both add visual richness. Weapon VFX is more visible in combat. Body animation is more visible during movement.

### Scope

19. **Should this audit cycle focus only on Groups 1-4 (localization, movement, combat, weapons), or should it include Groups 5-6 (factions, resources) as well?** Groups 1-4 are the core mechanics foundation. Groups 5-6 add strategic depth but depend on 1-4 being stable.

20. **Is there a target date or milestone for having a playable demo?** This would help prioritize which groups to implement first.

---

*End of MECHANICS_EXPLORATORY_AUDIT_2026_06_03.md*
