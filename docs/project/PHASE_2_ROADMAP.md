# PHASE_2_ROADMAP.md

> **DEPRECATED — This roadmap is no longer the active planning direction.**
> It has been superseded by `docs/project/VISUAL_ROADMAP.md` as of VISUAL-ROADMAP-01.
> Archived copy: `docs/project/archive/PHASE_2_ROADMAP.md`
> Read this file only as historical reference. Do not follow it as an active roadmap.

Status: **archived / deprecated**  
Project: Four Elements Phaser  
Phase: Phase 2 — Playability, visual identity, menu flow, animated assets  
Active repo: `ratoker-jpg/four-elements-phaser`  
Reference/donor repo: `ratoker-jpg/four-elements-next` (reference only)  
Date: 2026-05-29
Archived on: 2026-05-30

---

## 1. Purpose

Phase 1 created and stabilized the technical foundation for the Phaser-first Sandbox MVP.

Phase 2 changes the active focus:

```text
From: engine/foundation stabilization
To: making the game feel like an actual RTS prototype
```

This roadmap is intentionally more product/visual/playability-oriented than the previous technical backlog.

The current priority is **not** combat, enemy AI, bot logic, or a deep economy. The priority is:

```text
one game link → playable menu flow → proper loading → clear mode selection → better terrain → animated units → livelier map → arena as a controlled combat test mode
```

---

## 2. Phase 2 guiding principles

### 2.1 One public entry point

The game should not require separate user-facing links for debug or arena modes.

Target:

```text
Open Four Elements Phaser
→ Main Menu
→ choose Standard / Debug / Arena
```

URL parameters such as `?devtools=1`, `?arena=1`, and `?skipMenu` may remain as developer/smoke-test shortcuts, but they should not be the main UX path.

### 2.2 Make the prototype feel alive

The map and units should stop feeling like static PNGs placed on a grid.

Target feel:

- terrain reads as a natural desert surface, not a chessboard;
- units have visible animation states;
- resource fields feel like resource fields;
- buildings sit correctly on footprints;
- arena can test combat visuals without polluting the main sandbox loop.

### 2.3 Build visual systems before adding bot/combat

Do not add a bot or enemy AI before the map, unit animation pipeline, arena workflow, and basic combat visual testbed are ready.

Combat will need:

- animated chassis / bodies;
- weapon mount visual rules;
- recoil model;
- projectile / beam / smoke VFX;
- arena test harness;
- readable map and fog behavior.

### 2.4 Use Phaser 4 features where they help

Good candidates:

- Scene flow for menu/loading/game/arena transitions;
- Loader events for loading screen progress;
- Animation Manager for unit state animations;
- Tweens for recoil, pulses, UI transitions, small feedback;
- Particles later for smoke/dust/projectile effects;
- Camera and Input systems for RTS controls;
- RenderTexture / decals / overlays for terrain presentation where appropriate.

Not current priorities:

- SpriteGPULayer / TilemapGPULayer implementation;
- full DOMElement HUD migration;
- Data Manager;
- broad event-bus rewrite;
- broad faction-aware loading;
- asset unloading.

### 2.5 Phase 2 roadmap audit is the implementation gate

Phase 2 will have one large roadmap audit PR.

After that audit is accepted, tasks covered by the accepted audit can go directly to implementation PRs.

High-risk or high+ tasks do **not** need a second duplicate audit if:

- the Phase 2 roadmap audit already covers them;
- the implementation scope matches the accepted audit;
- no new unknown technical risk appears;
- the PR stays within the approved constraints.

A separate audit/design is required only if a task goes outside the accepted Phase 2 audit or exposes a new unreviewed risk.

---

## 3. Phase 2 scope

### In scope

- Main menu mode selection;
- standard/debug/arena mode selection from menu;
- proper loading screen;
- hotkeys / command card design;
- terrain visual system;
- map edge / border styling;
- two-layer fog-of-war design;
- animated unit asset workflow;
- regenerated animated harvester and builder assets;
- resource node polish;
- map props / doodads / decals;
- HQ/building grounding and footprint alignment;
- arena mode as a combat sandbox;
- weapon VFX / recoil design for later combat testing;
- normal maps / lighting feasibility spike.

### Out of scope for immediate Phase 2 implementation

- enemy AI / bot;
- full combat implementation in main sandbox;
- full progression/upgrades;
- elements economy as immediate feature;
- broad UI framework;
- large updateGameState rewrite;
- GPU layer implementation;
- full faction-aware loading;
- normal maps implementation before feasibility spike;
- broad save/load redesign.

---

## 4. Roadmap overview

| # | Task ID | Title | Type | Risk | Main value |
|---|---------|-------|------|------|------------|
| 0 | DOCS-P2-00 | Phase 2 docs checkpoint after audit acceptance | docs | low | Make Phase 2 source-of-truth |
| 1 | MENU-01 | Main menu mode selection | implementation | medium | One link, in-game mode selection |
| 2 | MENU-02 | Mode-aware loading and launch flow | implementation | medium-high | Arena/debug works from menu without manual URL links |
| 3 | LOADING-01 | Proper loading screen | implementation | medium | Game-like startup and asset loading feedback |
| 4 | HOTKEYS-01 | Hotkeys and command card design | audit/design + implementation | medium-high | RTS-style controls, visible commands |
| 5 | TERRAIN-01 | Sand terrain visual system | implementation | medium-high | Remove chessboard/grid feel |
| 6 | BASE-ANCHOR-01 | HQ/building grounding and footprint alignment | implementation | low-medium | Buildings visually sit on correct tiles |
| 7 | ASSET-WORKFLOW-01 | Animated unit asset pipeline | docs/design + tooling | high | Prevent ad-hoc sprite generation |
| 8 | UNIT-ANIM-01 | Regenerate harvester animated spritesheet | asset + integration | high | Real movement/gather/unload animation |
| 9 | UNIT-ANIM-02 | Regenerate builder animated spritesheet | asset + integration | high | Builder movement/building animation |
| 10 | RESOURCE-01 | Resource node polish + depleted occupancy | implementation | medium | Better resource fields and no ghost-occupied depleted cells |
| 11 | MAPLIFE-01 | Environment props / doodads / decals | asset + implementation | medium-high | Map feels alive |
| 12 | FOG-01 | Two-layer fog of war | design + implementation | high | RTS exploration feel |
| 13 | ARENA-01 | Arena mode from menu | implementation | medium | Controlled combat sandbox access |
| 14 | WEAPON-WORKFLOW-01 | Weapon VFX and recoil design | audit/design | high | Prepare Wasp/Railgun/Smoky combat visuals |
| 15 | VISUAL-SPIKE-01 | Normal maps / lighting feasibility | spike | high | Decide if lighting pipeline is worth it |

---

## 5. Detailed tasks

## 5.0 DOCS-P2-00 — Phase 2 docs checkpoint after audit acceptance

Type: docs  
Risk: low  
Timing: after Phase 2 roadmap audit is accepted

Goal:

Update source-of-truth docs so new GPT/GLM sessions follow Phase 2 instead of the older technical roadmap.

Likely files:

- `docs/project/PROJECT_STATE.md`
- `docs/project/CURRENT_NEXT_STEP.md`
- `docs/project/NEW_CHAT_HANDOFF.md`
- `docs/project/FIX_BACKLOG.md`
- optionally a checkpoint doc

Important:

This step happens after the Phase 2 roadmap audit PR is accepted. It should not be mixed into this roadmap draft PR.

---

## 5.1 MENU-01 — Main menu mode selection

Type: implementation  
Risk: medium

Goal:

Replace separate user-facing debug/arena links with in-game mode selection.

Target UX:

```text
Main Menu
- New Game / Start Standard
- Continue
- Debug Mode
- Arena Mode
- Settings
- Hotkeys
```

Possible models to audit:

1. Separate start buttons:
   - Start Standard
   - Start Debug
   - Start Arena
2. Mode selector:
   - Mode: Standard / Debug / Arena
   - Start

Constraints:

- Keep URL parameters as dev/test shortcuts;
- do not break `?skipMenu` and `?devtools=1&arena=1` smoke flow;
- do not change game state or combat behavior;
- do not redesign the whole menu.

Value:

The game starts to feel like a product, not a set of test URLs.

---

## 5.2 MENU-02 — Mode-aware loading and launch flow

Type: implementation  
Risk: medium-high

Goal:

Ensure mode selection from menu correctly controls loading and scene startup.

Why separate from MENU-01:

`PHASER4-LOAD-02` made modularUnits load only in devtools/arena mode. If Arena is selected from menu, the game must still load the correct assets.

Audit must decide safest pattern:

1. menu selection sets mode before PreloadScene;
2. mode selection causes controlled reload with query params;
3. mode-aware Scene handoff / registry value;
4. always load arena assets only in explicit arena/debug mode.

Constraints:

- Do not revert to loading all modularUnits in standard mode;
- do not add broad asset unloading;
- do not break current smoke tests;
- do not create hidden global state unless justified.

---

## 5.3 LOADING-01 — Proper loading screen

Type: implementation  
Risk: medium

Goal:

Replace MVP loading feel with a proper game loading screen.

Target:

- loading progress bar;
- mode/map/faction label;
- basic game title/art;
- small tip/hotkey text;
- no fake progress;
- based on Phaser Loader events where possible.

Phaser 4 candidates:

- Loader progress events;
- Scene transitions;
- Text / Graphics for progress UI;
- possible simple tween on loading indicator.

Constraints:

- Do not add heavy UI framework;
- do not change asset manifest behavior;
- do not block smoke testing;
- keep styling consistent with the main menu direction.

---

## 5.4 HOTKEYS-01 — Hotkeys and command card design

Type: audit/design + implementation  
Risk: medium-high

Goal:

Move from scattered hotkeys to an RTS-style command model similar in spirit to StarCraft.

Target concepts:

- command card;
- visible command buttons;
- hotkey labels on buttons;
- Hotkeys menu/help screen;
- one command registry as source-of-truth;
- context-sensitive commands for selected unit/building/mode.

Examples:

```text
Build Separator [S]
Build Power Plant [P]
Build Factory [F]
Train Harvester [H]
Train Builder [B]
Cancel [Esc/X]
Attack Move [A] later
```

Constraints:

- Do not start combat command work now;
- do not add multi-select unless separately scoped;
- do not create a giant UI framework;
- preserve existing working controls until replacement is validated.

---

## 5.5 TERRAIN-01 — Sand terrain visual system

Type: implementation  
Risk: medium-high

Goal:

Remove the chessboard look from the map and make terrain read as natural stylized sand.

Current issue:

The map visually reads as a grid of repeated diamond tiles rather than a terrain surface.

Target direction:

- clustered sand variation instead of random tile noise;
- large soft patches;
- decals: cracks, bumps, stones, tire marks, dry patterns;
- resource field integration;
- no obvious checkerboard;
- preserve isometric readability.

Terminology:

- terrain patches — larger regions of varied terrain;
- decals — flat details over terrain;
- props / doodads — map objects like rocks, bushes, wrecks;
- resource nodes — harvestable crystal/mineral formations.

Constraints:

- Do not replace the whole renderer if current RenderTexture approach can support the target;
- do not implement TilemapGPULayer;
- do not break pathfinding/passability;
- audit must decide whether this is mostly asset work, generator work, or renderer work.

---

## 5.6 BASE-ANCHOR-01 — HQ/building grounding and footprint alignment

Type: implementation  
Risk: low-medium

Goal:

Fix buildings that visually float above their footprint. HQ/base must sit on the correct tile footprint.

Observed issue:

The base appears visually offset above the intended red footprint cells.

Target:

- bottom/anchor aligns with footprint;
- building shadow reads correctly;
- building position matches construction/passability footprint;
- fix without moving logical building coordinates unless root cause requires it.

Likely systems:

- building placement metadata;
- building anchor/origin;
- EntityRenderer / ConstructionRenderer placement;
- generated building meta.

Constraints:

- Do not globally shift all assets blindly;
- do not break other buildings while fixing HQ;
- add manual QA for all four factions if faction HQ sizes differ.

---

## 5.7 ASSET-WORKFLOW-01 — Animated unit asset pipeline

Type: docs/design + tooling  
Risk: high

Goal:

Define the pipeline for generating and integrating animated unit spritesheets before regenerating harvesters/builders/tanks/weapons.

Why high:

Bad asset workflow creates long-term broken animation, wrong directions, wrong anchors, wrong scale, and repeated rework.

Must define:

- sprite sheet layout;
- 8 directions vs 4 directions;
- frame counts per state;
- naming convention;
- anchor/grounding rule;
- scale and crop rules;
- transparent background;
- per-faction variants;
- Phaser Animation Manager key generation;
- validation preview tool;
- how generated art enters `assets/` and manifests;
- how to test directions and states.

Initial unit states:

Harvester:

```text
idle
move
gather
unload
optional carry/loaded visual
```

Builder:

```text
idle
move
build/work
```

Combat later:

```text
idle
move
aim / attack
recoil
fire / muzzle flash
destroyed later
```

Constraints:

- Do not regenerate production assets before the workflow is accepted;
- do not integrate unvalidated spritesheets;
- do not mix Blender/script generation with runtime integration in one risky PR;
- do not rely on manual crop fixes.

---

## 5.8 UNIT-ANIM-01 — Regenerate harvester animated spritesheet

Type: asset + integration  
Risk: high

Goal:

Replace static-feeling harvester visuals with a proper animated spritesheet.

Target states:

- idle;
- move with visible wheels/tracks;
- gather;
- unload;
- possibly loaded/cargo visual.

Phaser 4:

Use Animation Manager, not manual frame switching.

Constraints:

- depends on ASSET-WORKFLOW-01;
- no gameplay behavior changes;
- no pathfinding changes;
- no scale/anchor regressions;
- must preserve 4 faction variants;
- must pass visual direction QA.

---

## 5.9 UNIT-ANIM-02 — Regenerate builder animated spritesheet

Type: asset + integration  
Risk: high

Goal:

Replace static-feeling builder visuals with proper movement and work/build animations.

Target states:

- idle;
- move;
- build/work.

Constraints:

- depends on ASSET-WORKFLOW-01;
- should likely follow harvester animation integration;
- no construction logic changes unless required by animation state mapping;
- must preserve builder grounding.

---

## 5.10 RESOURCE-01 — Resource node polish + depleted occupancy

Type: implementation  
Risk: medium

Goal:

Make resource nodes feel like resource fields and fix depleted resources leaving blocked/occupied cells.

Target:

- resource nodes visually group into fields;
- depleted resources have a clear depleted/removed state;
- depleted cells are freed for movement/occupancy;
- harvesters retarget cleanly;
- no ghost blocked tile after mineral disappears.

Visual ideas:

- crystal shimmer;
- small glow;
- multiple cluster variants;
- depletion transition;
- field-level placement, not isolated chess pieces.

Constraints:

- do not add complex economy;
- do not change resource amounts without balance decision;
- do not mix with terrain redesign unless audit says it is necessary.

---

## 5.11 MAPLIFE-01 — Environment props / doodads / decals

Type: asset + implementation  
Risk: medium-high

Goal:

Add life to the map through non-harvestable environment details.

Definitions:

- props/doodads — rocks, bushes, wrecks, machinery, dried plants;
- decals — cracks, dirt patches, tire marks, scorch marks;
- blocking props — objects that affect pathfinding;
- non-blocking props — visual-only details.

Target:

- map looks authored, not empty;
- props support the desert/sci-fi RTS identity;
- no starting-area blockage;
- no pathfinding regressions.

Constraints:

- separate visual-only and blocking props clearly;
- do not overload the start area;
- audit must decide asset naming and placement rules.

---

## 5.12 FOG-01 — Two-layer fog of war

Type: design + implementation  
Risk: high

Goal:

Implement RTS fog model:

```text
black = never explored
grey = explored but not currently visible
visible = current vision
```

Why high:

Fog touches rendering, game state memory, minimap, unit/building visibility, arena/devtools expectations, and performance.

Target:

- current visibility radius;
- explored memory;
- greyed remembered terrain/buildings;
- black unexplored areas;
- devtools bypass/toggles;
- no heavy per-frame full-map redraw if avoidable.

Constraints:

- do not implement before terrain/render baseline is stable;
- do not break qa smoke;
- do not add enemy/bot because of fog;
- audit should decide if fog is Phase 2 immediate or later within Phase 2.

---

## 5.13 ARENA-01 — Arena mode from menu

Type: implementation  
Risk: medium

Goal:

Make Arena a first-class mode selectable from the main menu.

Target:

- select Arena from menu;
- load arena map;
- enable devtools/arena assets;
- show that this is a test/combat sandbox mode;
- preserve URL shortcuts for smoke/dev.

Relationship to combat:

Arena is where combat mechanics will be tested later. It does not mean adding full combat to the main sandbox.

---

## 5.14 WEAPON-WORKFLOW-01 — Weapon VFX and recoil design

Type: audit/design  
Risk: high

Goal:

Design how weapon visuals, recoil, projectile effects, and chassis response will work before implementing combat.

Examples:

Smoky:

- faster firing rhythm;
- smaller recoil;
- smoke/muzzle flash;
- level upgrades later can alter reload timing.

Railgun:

- strong recoil;
- bright beam/projectile/trail;
- Wasp chassis may rock backward/upward visually;
- no real flip physics, only visual recoil.

Phaser 4 candidates:

- Tweens for recoil;
- Particles for smoke/sparks;
- Animation Manager for firing states;
- layered sprites for hull/turret/weapon;
- arena mode for validation.

Constraints:

- no full combat implementation in this task;
- no bot/enemy AI;
- no balance system yet;
- keep recoil as visual feedback, not physical simulation.

---

## 5.15 VISUAL-SPIKE-01 — Normal maps / lighting feasibility

Type: spike/audit  
Risk: high

Goal:

Evaluate whether normal maps / lighting are worth adding to this 2D isometric Phaser project.

Questions:

- Does Phaser 4.1.0 support the needed 2D lighting / normal map path for our renderer?
- Does this require custom shaders/pipelines?
- Can PNG asset pipeline generate or store `*_normal.png` reliably?
- Does it work with isometric depth sorting?
- Does it improve visuals enough to justify the complexity?
- Should lighting be baked into PNGs instead?

Constraints:

- do not implement normal maps before the spike is accepted;
- do not change asset pipeline yet;
- do not add broad shader complexity without proof.

---

## 6. Expected Phase 2 audit output

The Phase 2 roadmap audit must turn this draft into an accepted implementation plan.

The audit should answer:

- Is this sequence correct?
- Which tasks can go directly to implementation after audit acceptance?
- Which tasks need further design because the roadmap audit cannot fully resolve them?
- Which tasks should be split smaller?
- Which Phaser 4 features are useful and safe?
- Which visual ideas are premature?
- What should be implemented first?
- What should stay parked?

---

## 7. Current active interpretation

Until the Phase 2 roadmap audit is accepted, this document is a draft.

After the audit is accepted and docs are updated, Phase 2 becomes the active roadmap.

The previous technical roadmap remains reference/backlog, not the active implementation order.
