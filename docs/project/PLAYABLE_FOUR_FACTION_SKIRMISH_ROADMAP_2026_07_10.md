# PLAYABLE FOUR-FACTION SKIRMISH ROADMAP

Status: accepted implementation roadmap  
Project: Four Elements Phaser  
Repository: `ratoker-jpg/four-elements-phaser`  
Date: 2026-07-10  
Target release: playable T1 single-player skirmish  

---

## 1. Target product

The target is a complete single-player RTS match with four factions on one deterministic map:

- one human-controlled faction;
- three independently configured AI opponents;
- one faction base in each map corner;
- finite crystal deposits in each starting quadrant;
- a shared infinite crystal deposit in the map center;
- harvesting, processing, construction and unit production;
- modular T1 tanks assembled from a hull and turret;
- combat, destruction, experience and independent hull/turret M0-M3 progression;
- victory after all three enemy headquarters are destroyed;
- defeat after the player's headquarters is destroyed.

The first playable release ends at a complete T1 match. T2 and T3 must be represented in the data model, but their content is deferred until the T1 skirmish is stable and enjoyable.

---

## 2. First-release content

### 2.1 Factions

The playable factions are:

- cyan / Поток;
- green / Росток;
- yellow / Искра;
- purple / Око.

Initial passive identities:

| Faction | Identity | Initial passive |
|---|---|---|
| Cyan | Mobility and tempo | Civil unit production speed +10% |
| Green | Construction and economy | Construction speed +10%, processing speed +5% |
| Yellow | Combat production | Combat unit production speed +10% |
| Purple | Vision and territory | Territory vision radius +1 tile |

Faction bonuses must be config-driven, visible before match start and applied equally to human and AI teams. No faction receives a direct damage bonus in the T1 release.

### 2.2 T1 modular combat roster

Hulls:

- Wasp;
- Hunter.

Turrets:

- Smoky;
- Railgun.

All four legal combinations must be producible:

- Wasp + Smoky;
- Wasp + Railgun;
- Hunter + Smoky;
- Hunter + Railgun.

Hull and turret remain separate assets and separate state fields. A combined hull × turret sprite matrix is forbidden.

### 2.3 T1 buildings

The T1 release includes:

- Headquarters;
- Separator;
- Power Plant;
- Raw Storage;
- Matter Storage;
- Element Storage;
- Units Factory.

`techTier: 1 | 2 | 3` must exist in team state from the beginning, but only tier 1 is playable in this roadmap.

---

## 3. Non-negotiable architecture

### 3.1 One production runtime

Normal Game becomes the canonical match runtime.

Arena remains a combat sandbox and a source of reusable pure systems, but it must not remain a second gameplay implementation. The following Arena systems may be extracted and reused:

- movement state machine;
- grid pathing and tile reservation;
- turret aiming;
- weapon range bands;
- hit detection;
- armor and damage formulas;
- firing cadence;
- combat VFX events;
- low-level unit micro AI.

Do not add a third combat-unit model. `GameState.combatUnits` remains canonical. Render data is derived from state.

### 3.2 Team-owned state

The current single-player fields must evolve into explicit team state:

```ts
interface TeamState {
  faction: Faction;
  controller: 'human' | 'ai';
  difficulty: 'recruit' | 'lieutenant' | 'veteran';
  economy: EconomyState;
  techTier: 1 | 2 | 3;
  hqId: string;
  eliminated: boolean;
  vision: VisionState;
}

interface MatchState {
  teams: Record<Faction, TeamState>;
  playerFaction: Faction;
  status: 'playing' | 'victory' | 'defeat';
  winner: Faction | null;
}
```

`playerFaction` identifies the human team only. It must not imply ownership of every building, unit or economy.

### 3.3 Canonical combat unit

The production combat state must eventually contain at least:

```ts
interface CombatUnitState {
  id: string;
  faction: Faction;
  bodyId: BodyId;
  weaponId: WeaponId;
  hullMod: ModLevel;
  turretMod: ModLevel;
  ftx: number;
  fty: number;
  bodyAngle: number;
  turretAngle: number;
  hp: number;
  maxHp: number;
  order: UnitOrder;
  targetId: string | null;
  weaponCooldownMs: number;
  xp: number;
  isDestroyed: boolean;
  destroyedAt: number | null;
}
```

The exact internal decomposition may differ, but there must be one canonical source for ownership, position, health, orders, experience and destruction lifecycle.

### 3.4 Determinism

- No `Date.now()` IDs.
- Map generation is deterministic by seed.
- AI decisions use game time and seeded randomness where randomness is needed.
- Save/load restores ownership, queues, XP, upgrades and AI state without changing the match outcome arbitrarily.

---

## 4. Match rules

### 4.1 Starting position

Each faction receives a base in one map corner. Starting positions are symmetric around both map axes.

Each team starts with:

- one T1 Headquarters;
- one Builder;
- two Harvesters;
- initial resources sufficient to begin the economy;
- a clear local construction area;
- no more than one optional starter Wasp + Smoky M0, subject to balance testing.

### 4.2 Resources

Each quadrant contains equivalent finite resource value:

- two starter deposits close to the headquarters;
- one medium deposit farther inward;
- one rich contested deposit toward the quadrant interior.

The center contains one shared infinite deposit with four accessible approach sides. The center deposit cannot be covered by construction.

Harvesters must path to a tile adjacent to the resource footprint, gather, return to their own headquarters, unload and repeat. Finite deposits become depleted; the infinite deposit never does.

### 4.3 Construction

The player selects a Builder and chooses a building type. The system automatically finds the nearest legal construction position around that Builder.

Placement rules:

- search outward from the Builder's current tile;
- validate full building footprint;
- validate path access for the assigned Builder;
- reject resources, obstacles, units and out-of-bounds cells;
- preserve one complete empty tile between building footprints;
- do not deduct resources when no legal position is found;
- cap the local search radius and show a clear Russian error if no site exists.

Buildings must not default to placement near Headquarters when the selected Builder is elsewhere.

### 4.4 Production

The Units Factory produces:

- Builder;
- Harvester;
- a modular combat unit selected as one hull plus one turret.

Combat cost is additive:

```text
unit cost = hull cost + turret cost
production time = max(hull time, turret time) + assembly offset
```

Initial draft values:

| Component | Matter | Element units | Time |
|---|---:|---:|---:|
| Wasp | 20 | 5 | 7 s |
| Hunter | 35 | 7 | 12 s |
| Smoky | 25 | 5 | 18 s |
| Railgun | 45 | 8 | 25 s |

Initial resulting combinations:

| Combination | Matter | Element units | Time |
|---|---:|---:|---:|
| Wasp + Smoky | 45 | 10 | 25 s |
| Hunter + Smoky | 60 | 12 | 25 s |
| Wasp + Railgun | 65 | 13 | 32 s |
| Hunter + Railgun | 80 | 15 | 32 s |

These values are balance drafts and must live in configuration, not scattered constants.

### 4.5 Destruction

A destroyed combat unit must:

1. stop moving, targeting and firing immediately;
2. release tile reservations and stop blocking pathing after the destruction transition;
3. play an explosion/destruction effect;
4. optionally display a short-lived wreck state;
5. be removed from canonical state and renderer after a bounded delay.

Destroyed units must not remain forever as crossed-out active objects.

### 4.6 Victory and elimination

- A team is eliminated when its Headquarters reaches zero HP.
- Human Headquarters destroyed: defeat.
- All three enemy Headquarters destroyed: victory.
- Eliminated teams stop production and strategic AI.
- Remaining units of an eliminated team become disabled and are cleaned up after a bounded transition.

---

## 5. Experience and M0-M3 progression

Each combat unit owns one XP pool. Hull and turret are upgraded independently.

Examples:

- Wasp M2 + Smoky M0;
- Hunter M1 + Railgun M3;
- Wasp M3 + Railgun M2.

XP is awarded from actual HP removed, excluding overkill.

Initial damage XP multipliers:

| Target | XP multiplier |
|---|---:|
| Combat unit | 1.00 |
| Builder or Harvester | 1.50 |
| Normal building | 0.40 |
| Headquarters | 0.25 |

Initial kill bonuses:

| Target | Kill bonus |
|---|---:|
| Combat unit | 40 XP |
| Builder or Harvester | 75 XP |
| Normal building | 100 XP |
| Headquarters | 300 XP |

Initial component upgrade costs:

| Upgrade | XP |
|---|---:|
| M0 → M1 | 300 |
| M1 → M2 | 700 |
| M2 → M3 | 1400 |

Rules:

- the damage source receives XP;
- friendly fire grants no XP;
- damage to an already destroyed target grants no XP;
- continuous damage keeps correct source attribution;
- hull upgrades affect hull stats and visuals;
- turret upgrades affect weapon stats and visuals;
- an upgrade must not silently fully heal a damaged hull;
- all values are configurable and subject to match testing.

---

## 6. AI difficulty model

Each of the three enemy teams has an independent difficulty setting:

- Recruit / Рядовой;
- Lieutenant / Лейтенант;
- Veteran / Ветеран.

Difficulty should primarily change decision quality, not grant hidden damage or resource multipliers.

### Recruit

- slow decision cadence;
- simple build order;
- minimal scouting;
- basic attack groups;
- weak retreat and target selection.

### Lieutenant

- maintains economy and unit replacement;
- scouts important zones;
- protects Headquarters;
- estimates visible army strength;
- forms coherent attack and defense groups.

### Veteran

- operates from fog-of-war knowledge rather than omniscience;
- remembers previously observed enemies and structures;
- scouts unknown zones and the center;
- compares approximate army value before committing;
- raids Harvesters and Builders when the opportunity is favorable;
- retreats damaged or outmatched groups;
- rebuilds economy after losses;
- separates scout, defense, raid, attack and reserve squads;
- chooses weak or strategically important targets;
- can complete the entire economy-to-victory loop autonomously.

Strategic AI layers:

1. knowledge and memory;
2. economy planner;
3. construction planner;
4. production planner;
5. scouting planner;
6. threat assessment;
7. squad planner;
8. tactical micro using the shared combat runtime.

Enemy strategic AI must not begin until multi-team state, team economy, Headquarters destruction and the production combat runtime are complete.

---

## 7. Implementation phases

### Phase 0 — Roadmap acceptance and baseline

Deliverables:

- this roadmap merged;
- active project status points to the new implementation sequence;
- existing CI remains green;
- no gameplay changes in the roadmap PR.

Exit gate:

- roadmap merged and implementation Phase 1 active.

### Phase 1 — Combat destruction lifecycle

Goal: remove the current permanent crossed-out destroyed tanks.

Scope:

- bounded destroyed/wreck state;
- immediate stop of movement and firing;
- reservation and occupancy release;
- renderer explosion/wreck transition;
- canonical removal after delay;
- no stale selection or target references;
- tests for destruction, cleanup and renderer removal.

Exit gate:

- destroyed Arena and production combat units no longer remain permanently active or blocking.

### Phase 2 — Production combat runtime in Normal Game

Goal: a produced combat unit can move, stop, attack, take damage and die in Normal Game.

Scope:

- fractional movement state;
- move, stop, attack and attack-move orders;
- HP and armor;
- weapon range and cooldown;
- independent turret aim;
- target acquisition;
- damage attribution;
- collision and tile reservations;
- save/load migration;
- reuse shared pure Arena combat systems rather than copying them.

Exit gate:

- two factory-produced units can fight each other in Normal Game.

### Phase 3 — T1 factory composer

Goal: select Wasp/Hunter and Smoky/Railgun independently.

Scope:

- factory hull column;
- factory turret column;
- modular preview;
- additive cost and production-time calculation;
- queue display;
- Russian tooltips and rejection messages;
- all four T1 combinations;
- Builder and Harvester remain available.

Exit gate:

- all four combinations are produced through structured requests and render correctly.

### Phase 4 — Multi-team match state

Goal: four factions own independent state in one match.

Scope:

- `TeamState` and `MatchState`;
- per-team economy, unit cap, tech tier and vision;
- ownership for buildings, civil units, combat units and HQ;
- controller and difficulty fields;
- save migration;
- remove global assumptions that all economy belongs to `playerFaction`.

Exit gate:

- four teams can coexist with independent resources and ownership.

### Phase 5 — Symmetric four-corner map

Goal: deterministic fair four-side map generation.

Scope:

- generate one quadrant and mirror over X/Y;
- four corner Headquarters placements;
- equivalent finite resource value per quadrant;
- shared center Infinity deposit;
- four valid center approaches;
- construction exclusion around center;
- path and resource fairness validation;
- at least two exits from each starting area.

Exit gate:

- the same seed always creates a validated symmetric four-team map.

### Phase 6 — Four-team civil economy

Goal: all teams can harvest and process resources independently.

Scope:

- Harvester targets and returns to owner HQ;
- finite depletion and Infinity behavior;
- owner-aware processing, storage and power;
- civil unit destruction;
- AI replacement of lost Harvesters and Builders;
- save/load coverage.

Exit gate:

- four economies can operate simultaneously without cross-team resource mutation.

### Phase 7 — Builder-local automatic construction

Goal: selected Builder chooses the nearest legal construction site around itself.

Scope:

- expanding-ring site search;
- one-tile building spacing;
- path validation;
- deterministic tie breaking;
- bounded search radius;
- Russian failure feedback;
- no charge on placement failure.

Exit gate:

- moving a Builder changes where the next building is constructed.

### Phase 8 — Headquarters combat, elimination and match result

Goal: the match can be won and lost.

Scope:

- Headquarters HP, armor and targetability;
- destruction transition;
- team elimination;
- disable eliminated production and AI;
- victory/defeat state;
- result screen and restart with same seed.

Exit gate:

- destroying all three enemy Headquarters wins; losing the player Headquarters defeats the player.

### Phase 9 — Faction bonuses

Goal: existing four faction identities affect live gameplay.

Scope:

- connect `FACTION_CONFIGS` to construction, processing, civil production, combat production and vision;
- display exact effects in setup UI;
- apply the same rules to AI teams;
- no direct T1 damage bonuses.

Exit gate:

- changing faction creates a measurable, tested gameplay difference.

### Phase 10 — XP and independent M0-M3 upgrades

Goal: individual tanks progress during the match.

Scope:

- damage attribution and XP ledger;
- target-type multipliers and kill bonuses;
- independent hull/turret upgrade actions;
- timed or immediate upgrade transaction defined consistently;
- M-level stat and visual application;
- XP and upgrade UI;
- persistence.

Exit gate:

- one unit can independently reach hull M3 and turret M3 through combat-earned XP.

### Phase 11 — Strategic AI

Goal: all three opponents can play a complete RTS match.

Scope sequence:

1. AI knowledge/memory and fog rules;
2. Recruit economy and production;
3. Lieutenant scouting, defense and force comparison;
4. Veteran raids, retreat, recovery and squad planning;
5. per-opponent difficulty setup;
6. deterministic AI-vs-AI simulations.

Exit gate:

- Veteran can autonomously harvest, build, produce, scout, defend, attack and destroy enemy HQs without map omniscience.

### Phase 12 — Match UX and release hardening

Goal: make the complete match understandable and stable.

Scope:

- setup screen for player faction and three AI difficulties;
- team status panel;
- attack and economy alerts;
- selected unit HP, XP, hull/turret and M-level display;
- Victory/Defeat flow;
- save/load compatibility;
- performance with four teams and 80-120 units;
- Playwright skirmish smoke;
- long AI-vs-AI soak tests;
- balance pass.

Exit gate:

- a complete match can be started, saved, loaded, won and replayed without debug controls.

### Phase 13 — T1 closure and next roadmap

Deliverables:

- closure audit;
- final T1 balance snapshot;
- known limitations;
- archived old active roadmaps;
- next roadmap proposal for T2/T3, remaining hulls/turrets, repair and defenses.

---

## 8. Milestones

### Milestone A — Combat Slice

- destroyed units clean up correctly;
- produced tanks move and fight in Normal Game;
- Wasp/Hunter and Smoky/Railgun are producible.

### Milestone B — Four-Side Economy

- four corner bases;
- four economies;
- finite quadrant crystals;
- center Infinity;
- Builder-local construction.

### Milestone C — Playable Match

- Headquarters can be destroyed;
- victory and defeat work;
- faction bonuses work;
- three AI opponents can complete basic matches.

### Milestone D — Progression Release

- independent hull/turret M0-M3;
- Veteran strategic AI;
- save/load and long-run stability;
- final balance and release QA.

---

## 9. Required validation

Every implementation PR must include relevant pure-state tests and must pass:

```text
npm run sync:project-status -- --check
npm run typecheck
npm test
npm audit --audit-level=high
npm run build
npm run qa:smoke
```

Additional required scenarios by closure:

1. start as any faction;
2. verify four bases and four independent economies;
3. verify equivalent quadrant resources and center Infinity;
4. gather, unload, process and spend resources;
5. move a Builder and construct near its new location;
6. verify one-tile building spacing;
7. produce Builder, Harvester and all four T1 combat combinations;
8. attack combat units, civil units, buildings and HQ;
9. verify destroyed units stop blocking and are removed;
10. gain XP and independently upgrade hull and turret;
11. save and reload ownership, queues, AI, XP and upgrades;
12. eliminate three enemies and receive Victory;
13. lose the player HQ and receive Defeat;
14. run four AI teams in a deterministic soak match;
15. maintain acceptable frame time with 80-120 units and bounded VFX.

Manual visual QA must never be claimed by automated checks.

---

## 10. Deferred until after T1 closure

Do not add these before the playable T1 skirmish is complete:

- full T2 and T3 content;
- remaining five hulls;
- remaining eight turrets;
- multiplayer;
- aircraft;
- hero units;
- active faction abilities;
- neural-network or LLM-controlled runtime AI;
- an ECS rewrite;
- an engine migration;
- campaign or narrative content.

The next roadmap may cover T2/T3 Headquarters upgrades, defensive towers, repair, reactors, additional modular equipment and expanded maps only after this roadmap closes.

---

## 11. Immediate implementation order

```text
Phase 1 destruction lifecycle
→ Phase 2 Normal Game combat runtime
→ Phase 3 factory composer
→ Phase 4 multi-team state
→ Phase 5 four-corner map
→ Phase 6 four-team economy
→ Phase 7 Builder-local construction
→ Phase 8 HQ victory/defeat
→ Phase 9 faction bonuses
→ Phase 10 XP and M0-M3
→ Phase 11 strategic AI
→ Phase 12 UX, balance and release QA
```

The first implementation PR after this roadmap is:

> **SKIRMISH-P1 — Combat destruction lifecycle and bounded wreck cleanup**
