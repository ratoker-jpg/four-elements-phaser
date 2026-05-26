# ROADMAP.md

Status: accepted roadmap after ROADMAP_SYSTEM_AUDIT 01D  
Project: Four Elements Phaser  
Main repo: `ratoker-jpg/four-elements-phaser`  
Reference / donor repo: `ratoker-jpg/four-elements-next`  
Additional art-pipeline reference: `studioigor/ashen-crown`

---

## 0. Roadmap purpose

This roadmap describes what the project should become.

This roadmap was reviewed by ROADMAP_SYSTEM_AUDIT 01D. Future major roadmap changes must update or rerun the relevant audit/design.

Core rule:

```text
roadmap -> system audit/design -> scoped PR sequence -> implementation
```

---

## 1. Global principles

### 1.1 Civil loop before combat

Do not start full combat, enemy AI, faction bonuses, or bot behavior until the civil sandbox is stable.

Civil sandbox means:

- readable map;
- reachable resources;
- harvesting works;
- economy works;
- construction works;
- unit movement/control works;
- building/production status is readable;
- devtools exist for fast QA;
- save/load and shell UX are usable enough for playtesting.

### 1.2 System-first, not manual tuning

Do not build production workflows around manual per-object calibration.

Preferred path:

```text
system model -> metadata/config -> generic implementation -> objects fit into the system
```

Manual offsets/tuners are allowed only as diagnostic tools or rare documented exceptions.

### 1.3 Use reference projects, but do not blindly copy

`four-elements-next` is the main donor/reference project.

It may be used for:

- economy values;
- building costs;
- storage limits;
- resource names;
- mapgen ideas;
- editor/seed flow;
- devtools;
- visual feedback concepts;
- save/load planning;
- UI shell flow.

`studioigor/ashen-crown` is a reference for art/sprite pipeline ideas:

- source sheets;
- generator/processor;
- manifest-enabled runtime assets;
- sample viewer;
- audit images;
- normalized previews;
- unit/building/fx/ui sheet rules.

Reference projects are not source of truth. Every idea must be adapted to the Phaser 4 project architecture.

---

## 2. Accepted economy direction

The economy should use the working economy direction from `four-elements-next`.

Do not redesign economy unless a later explicit roadmap change is accepted.

Baseline concepts:

- raw resource gathering;
- processed matter/elements via separator;
- separator processing cycle;
- power-plant;
- units-factory;
- builder/harvester production;
- storage limits;
- early 5-8 minute civil pacing.

Known Next baseline values to audit/port as starting point:

```text
START_RAW = 30
START_MATTER = 120
SEP_RAW_COST = 12
SEP_CYCLE_SECONDS = 5
SEP_ELEMENT_YIELD = 2
separator costMatter = 60
separator buildTimeSeconds = 20
power-plant costMatter = 100
units-factory costMatter = 120
builder matter = 40 / duration = 15
harvester matter = 50 / duration = 20
```

---

# ARCH-00 — Workflow / project docs

## Goal

Lock the project workflow before more implementation work.

## Scope

- `START_HERE_FOR_GPT.md`
- `GPT_WORKFLOW.md`
- `GLM_EXECUTOR_RULES.md`
- `PROJECT_STATE.md`
- roadmap discipline
- audit-first rule for large systems

## Done when

A new GPT chat can read the workflow docs and understand how to continue without losing context.

---

# ARCH-01 — Economy baseline

## Goal

Port/fix the accepted civil economy baseline from Next into Phaser.

## Adds

- raw resource count;
- matter/energy/elements as accepted by final design;
- separator processing;
- power-plant contribution;
- storage limits;
- building costs;
- builder/harvester production costs;
- early civil pacing.

## Not included

- combat economy;
- faction bonuses;
- trading;
- enemy AI economy.

---

# ARCH-02 — Art / sprite pipeline

## Goal

Create a systemic pipeline for adding and validating sprites/assets.

## Adds

- source sheet folder;
- naming rules;
- sheet layout rules;
- processor/generator;
- generated runtime PNGs;
- manifest / enabled keys;
- sample viewer;
- normalized preview images;
- audit images;
- missing-source report;
- edge/crop warnings;
- QA checklist before runtime integration.

## Asset types

- units;
- modular units;
- buildings;
- projectiles;
- particles/fx;
- UI icons;
- terrain tiles;
- resources;
- decor/obstacles.

## Reference

Use the Ashen Crown art pipeline commits as design reference, not as code to copy blindly.

## Done when

A new unit/building/projectile can be staged, generated, previewed, audited, and only then wired into runtime.

## Implementation status

ARCH-02 asset pipeline migration for current runtime-approved assets is **complete**.

Completed PRs:

- **ARCH-02A** — Asset pipeline strategy (audit/design docs). PR #38, merged.
- **ARCH-02B+C** — Manifest schema, validation script, folder scaffold. PR #45, merged.
- **ARCH-02D** — Buildings/HQ processor MVP. PR #46, merged.
- **ARCH-02E** — Generated asset sample viewer. PR #47, merged.
- **ARCH-02F** — Runtime generated manifest integration for hq + buildings. PR #48, merged.
- **ARCH-02G** — CivilUnits spritesheets from generated manifest. PR #50, merged.
- **ARCH-02H** — ModularUnits images from generated manifest. PR #51, merged.
- **ARCH-02I** — Terrain + resources from generated manifest. PR #53, merged.
- CI helper PR #52 — workflow_dispatch for manual PR preview builds. Merged.

Current generated manifest covers 106 assets across 6 families:
hq(4) + buildings(24) + civilUnits(8) + modularUnits(64) + terrain(3) + resources(3).

PreloadScene loads all six families from `src/assets/generatedAssetManifest.ts`
via `src/assets/runtimeGeneratedAssets.ts`. Legacy loader files remain for
compatibility but are no longer called.

## Possible follow-up

- **ARCH-02J** — Optional legacy cleanup (remove deprecated loader files:
  `buildingAssets.ts`, `civilUnitAssets.ts`, `modularUnitAssets.ts`,
  and terrain/resource entries from `assetManifest.ts`).
- Future decor/fx/ui families only when approved assets are introduced.

Do not invent new implementation roadmap beyond this.

---

# ARCH-03 — Building / asset placement system

## Goal

Make completed building PNGs align correctly with isometric footprints using a generic system.

## Adds

- offline alpha-bounds metadata;
- building placement metadata;
- south-vertex footprint anchoring;
- generic renderer formula;
- missing metadata/texture errors;
- diagnostic markers;
- dev tuner only as diagnostic.

## Not accepted

- manual `displayWidth/origin/offset` tuning as production placement;
- runtime PNG pixel scanning;
- mixing building anchor model with unit anchor model.

---

# ARCH-04 — Civil construction loop

## Goal

Complete the civil construction loop.

## Adds

- automatic build-site selection near existing buildings;
- one-tile building gap;
- builder moves to construction site;
- site waits for builder;
- construction progress;
- no-route handling;
- cancellation/refund;
- status feedback.

## Notes

This follows the proven civil loop direction from Next.

---

# ARCH-05 — Unit movement / control MVP

## Goal

Add RTS-style control for current civil units before combat work.

## Adds

- click selection;
- selection highlight;
- manual move command;
- harvester manual move override;
- return to auto-gather behavior where appropriate;
- builder 8-direction facing fix;
- harvester/builder pathing through passable tiles only;
- no movement through buildings;
- movement centered on tile lanes;
- basic collision/passability rules;
- movement debug markers.

## Why early

Harvester and builder already exist and move. They must become controllable and visually trustworthy before adding more units.

---

# ARCH-06 — Harvesting / separator / production loop

## Goal

Complete the basic civil production loop.

## Adds

- harvester gathers raw;
- harvester unloads to valid dropoff;
- separator processes raw into matter/elements;
- storage caps;
- power/matter/element updates;
- units-factory produces builder/harvester;
- units-factory queue size = 2.

## Not included

- tanks;
- combat units;
- faction bonuses.

---

# ARCH-07 — Building / production visual indicators

## Goal

Make building and production state readable in-world.

## Adds

- separator active processing bar;
- separator idle/blocked visual state;
- warning indicator when a building lacks power/resources;
- construction progress bar;
- units-factory queue indicator;
- factory production progress;
- resource gain/spend feedback.

## Specific accepted idea

Units-factory should show a two-slot queue indicator, for example a yellow two-segment bar near/below the building status area.

---

# ARCH-08 — Map visual / terrain readability

## Goal

Fix the current map looking too empty, grid-heavy, and board-like.

## Adds

- less harsh grid;
- sand tile variation;
- clustered sand patches;
- smoother terrain transitions;
- edge terrain boundary;
- mountains/rocks near map borders;
- decor distribution without clutter;
- better starter area readability.

## Notes

The current map can look like a visible diamond grid on a flat empty board. This must be improved before serious playtesting.

---

# ARCH-09 — Mapgen / resource balance

## Goal

Make generated maps playable and balanced for civil economy.

## Adds

- starter small/medium resource pockets close to HQ;
- symmetric starter economy;
- center resource cluster cleanup;
- central infinite mineral/deposit;
- reachable resources;
- no blocked starts;
- edge obstacle/decor tuning;
- mountain/rock border zones.

## Reference

Use Next mapgen/resource balance direction as reference.

---

# ARCH-10 — Passability / validation / telemetry

## Goal

Make map and path problems diagnosable and testable.

## Adds

- passability grid;
- BFS validation;
- pathfinding telemetry;
- passability cache;
- no-route reasons;
- construction reachability checks;
- resource reachability checks;
- debug overlays;
- clear invalid map reasons.

## Reference

Use Next BFS validation and path telemetry as reference.

---

# ARCH-11 — Devtools / QA sandbox

## Goal

Create fast QA tools for civil systems and visuals.

## Adds

- dev panel;
- grid overlay;
- footprint overlay;
- passability/blocking overlay;
- spawn builder;
- spawn harvester;
- spawn resource/building;
- clear construction sites;
- max/zero resources;
- Builder Test;
- Economy Test;
- sprite debug;
- asset preview/test mode.

## Why

Devtools are not polish. They are required to avoid testing every feature through a full game loop.

---

# ARCH-12 — Dev Test Arena / Unit Sandbox

## Goal

Add a dev-only arena for targeted unit/combat/VFX testing without playing a full match.

## Adds

- spawn player unit;
- spawn enemy unit;
- spawn neutral dummy target;
- spawn enemy tank;
- spawn building target;
- move unit test;
- attack test;
- turret rotation test;
- projectile/muzzle flash/hit impact test;
- death/destroyed state test;
- selection/highlight test;
- pathing around buildings test;
- reset arena;
- pause/resume;
- slow motion;
- show hitboxes/anchors/footprints;
- show direction row / frame index;
- show projectile debug line.

## Expected audit question

Decide whether this should be:

- a separate Phaser Scene;
- a dev-only mode inside GameScene;
- a route/query mode like `?devtools=1&arena=1`;
- a separate isolated sandbox state.

---

# ARCH-13 — Visual motion / animations / VFX

## Goal

Make the game feel grounded and readable.

## Adds

- no idle bobbing for stationary units;
- render-only movement inertia;
- dust only during movement;
- speed/mass-based dust;
- gathering feedback;
- unloading feedback;
- construction feedback;
- separator active VFX;
- factory production feedback;
- projectile / shot animations;
- tank muzzle flash;
- hit impact;
- destroyed/death states.

## Notes

Gameplay state should not be distorted by visual interpolation.

---

# ARCH-14 — UI shell / menus / HUD

## Goal

Build a playable outer shell and readable HUD.

## Adds

- main menu;
- new game flow;
- map size selection;
- seed screen;
- faction select;
- continue;
- save slots;
- Esc menu;
- settings;
- HUD readability;
- UI scale;
- build panel;
- unit/building info panel.

## Reference

Use Next flow as reference:

```text
Main Menu -> Map Size -> Seed Screen -> Faction Select -> Game Screen
```

---

# ARCH-15 — Save / load MVP

## Goal

Allow player to save and resume a game session.

## Adds

- GameState serialization schema;
- versioned save format;
- localStorage save slots;
- Continue screen;
- save metadata;
- Esc menu save;
- dev save/load hooks;
- error handling.

---

# ARCH-16 — Seed / map editor / custom maps

## Goal

Port/adapt the useful map editor and seed flow from Next.

## Adds

- seed input;
- random seed button;
- mapgen presets;
- saved seeds;
- map editor;
- custom map localStorage slots;
- validation panel;
- launch game from custom map;
- map preview pan/zoom;
- place/erase/select tools.

## Not first priority

This comes after civil loop and core devtools unless the roadmap audit recommends moving it earlier.

---

# ARCH-17 — Unit / object addition workflow

## Goal

Create a standard workflow for adding a new unit, building, projectile, resource, or decor object.

## Adds

- source asset requirements;
- sheet naming rules;
- frame layout rules;
- direction rows;
- animation names;
- metadata requirements;
- manifest registration;
- sample viewer check;
- devtools preview check;
- runtime integration checklist;
- QA checklist before merge.

## Example future objects

- Hunter body;
- Hunter rail;
- new turret;
- new projectile;
- new building;
- new decor/resource.

---

# ARCH-18 — Architecture hygiene / scene split

## Goal

Prevent Phaser `GameScene` from becoming a new monolith.

## Adds when needed

- InputController;
- DevController;
- Render adapters;
- TestBridge;
- UI bridge;
- scene/module boundaries.

## Priority

Not a visible gameplay priority, but should happen when file size/coupling starts slowing development.

---

# ARCH-19 — Combat readiness

## Goal

Prepare the foundation for combat after civil systems are stable.

## Adds

- health/damage;
- attack commands;
- attack-move;
- tank body/turret model;
- projectiles;
- muzzle flash;
- hit impact;
- destroyed state;
- targeting rules;
- selection/command interactions.

## Blocked until

- civil loop is stable;
- unit control exists;
- dev test arena exists;
- visual/VFX pipeline exists;
- save/UI/devtools are usable enough.

---

# ARCH-20 — Enemy AI / bot

## Goal

Add enemy behavior only after combat readiness.

## Adds

- scout;
- economy bot;
- attack waves;
- base behavior;
- difficulty levels;
- AI telemetry/debug.

## Not now

Do not start enemy AI before civil/combat foundations are ready.

---

## 3. Roadmap audit status

The system audit has been completed in `docs/ROADMAP_SYSTEM_AUDIT.md`.

Implementation should follow the audit's canonical PR sequence.

Future major roadmap changes require audit/design update before implementation.

The audit answered:

- how each ARCH can be implemented in Phaser 4;
- which Phaser APIs/systems are useful;
- what should stay pure TypeScript;
- what should be Phaser Scene/render logic;
- what should be DOM UI;
- which systems should be ported/adapted from Next;
- which ideas from Ashen Crown art pipeline are useful;
- what PR sequence is safe;
- which ARCH blocks can be bundled;
- which ARCH blocks must be split;
- what should be audited again later;
- what must not be implemented yet.

---

## 4. Immediate next step

ARCH-02 asset pipeline migration for current runtime-approved assets is complete (ARCH-02A through ARCH-02I merged).

ARCH-03 building placement system is complete.

ARCH-01 economy baseline is complete.

Next roadmap workstream should be determined by GPT/planner based on
`docs/project/PROJECT_STATE.md` and `docs/ROADMAP_SYSTEM_AUDIT.md`.
