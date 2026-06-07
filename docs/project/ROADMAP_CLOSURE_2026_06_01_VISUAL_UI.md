# ROADMAP_CLOSURE_2026_06_01_VISUAL_UI.md

Status: closed roadmap checkpoint  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Date: 2026-06-01  
Scope: VISUAL-05A → VISUAL-06 → UI-01/UI-04 → HUD-01

---

## 1. Purpose

This document closes the current VISUAL/UI roadmap slice.

The goal is to prevent the next GPT/GLM/Codex session from accidentally continuing the old roadmap by inertia.

After this checkpoint:

```text
No old VISUAL/UI task is active by default.
No implementation task should be started until the owner defines the next roadmap.
The next roadmap must start from an explicit owner-approved direction.
```

This is intentionally docs-only.

---

## 2. Final owner-facing result

The project now has a playable industrial RTS prototype flow with:

```text
- industrial generated map as the default new-game map
- production industrial terrain/frame/background layer
- lower-left HQ/start/resource composition
- approved industrial resource crystal assets wired and visible by default on industrial maps
- polished main menu
- polished New Game setup screen
- polished ESC/pause menu
- polished Save/Continue flow
- polished playtest HUD readability
```

The current roadmap is therefore considered complete enough to stop and plan the next roadmap deliberately.

---

## 3. Completed PR sequence

### VISUAL-05A — Production industrial map integration

```text
PR #144 — VISUAL-05A PR1: Parameterize ?visual04a map preview 96/128/192
PR #145 — VISUAL-05A PR2: Industrial terrain behind mapStyle
PR #146 — VISUAL-05A PR3: Production industrial frame/background layer
PR #147 — VISUAL-05A PR4: Lower-left HQ/start/resources
PR #148 — VISUAL-05A PR5: Industrial generated map default
```

Outcome:

```text
- industrial generated map became the default for new games
- mapStyle: industrial/sand remains available
- sand/fixed/customMap1 remain fallback/reference paths
- HQ/start/resources are positioned in the lower-left composition
- production industrial frame/background/walls are connected
- save/load compatibility was preserved
- current production small map remains 32x32
- 96/128/192 production size migration remains deferred
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

Outcome:

```text
- resource model pivoted to 1x1 richness-tier normal resources
- only central infinite resource remains 2x2
- approved industrial crystal PNGs are in repo
- approved assets are loaded through the generated manifest/preload pipeline
- EntityRenderer can render approved industrial resource assets
- mapStyle=industrial resolves to resourceStyle=industrial by default
- mapStyle=sand resolves to resourceStyle=legacy
- old legacy mineral assets remain available
- no resource economy/amount/depletion/pathfinding changes were made
```

Important current resource mapping:

```text
small    -> resource_industrial_poor_01
medium   -> resource_industrial_medium_01
large    -> resource_industrial_rich_01
infinite -> resource_industrial_infinite_center_2x2_01
```

Available but not currently mapped to production resource types:

```text
resource_industrial_very_poor_01
resource_industrial_very_rich_01
```

These can be used later only if the next roadmap explicitly adds resource richness logic or mapgen support.

### UI roadmap — menu/setup/pause/save/HUD

```text
PR #157 — UI-01: Main menu visual polish and navigation shell
PR #158 — UI-02: New Game setup polish
PR #159 — UI-03: ESC menu polish
PR #160 — UI-04: Save/Continue flow polish
PR #161 — HUD-01: Playtest HUD readability polish
```

Outcome:

```text
- main menu matches the industrial sci-fi direction
- New Game setup matches the menu visual style
- ESC menu matches the industrial UI style
- Main Menu Continue flow is polished
- ESC Save remains functional
- ESC Load opens a save slot list using existing loadGame flow
- Save/Continue flow did not change save schema
- HUD now uses the same industrial UI language
- HUD gameplay callbacks and economy/build/production logic were preserved
```

---

## 4. What is now explicitly closed

The following workstreams are closed for this roadmap slice:

```text
VISUAL-05A production industrial map integration
VISUAL-06 resource visual model + asset integration
UI-01 main menu polish
UI-02 New Game setup polish
UI-03 ESC menu polish
UI-04 Save/Continue flow polish
HUD-01 Playtest HUD readability polish
```

Do not continue these as active roadmaps unless the owner explicitly reopens a specific issue.

---

## 5. What remains deliberately deferred

These are known deferred topics, not accidental misses.

### Production map size migration

```text
Current production small map is still 32x32.
The 96/128/192 production size migration is still deferred.
Do not silently change map dimensions.
```

### Resource richness gameplay/mapgen

```text
The visual asset set includes very_poor and very_rich variants.
The current gameplay data model still maps only small/medium/large/infinite.
Do not add new resource types or richness logic unless the next roadmap explicitly scopes it.
```

### Save system internals

```text
UI-04 polished Save/Continue UI.
It did not change save schema, migration, autosave, cloud saves, or overwrite manager logic.
Do not start save-system refactors unless explicitly requested.
```

### Settings

```text
Settings remains limited to the existing available behavior/placeholders.
A full settings system was not part of this roadmap.
```

### Full production HUD redesign

```text
HUD-01 polished the existing PlaytestHud readability layer.
It did not implement a full RTS bottom-bar HUD with minimap/info/commands.
```

### Fog / arena / combat / AI / upgrades

```text
FOG-01, ARENA-01, combat, bot/enemy AI, attack waves, upgrades, progression, and deeper economy systems are not part of the closed roadmap.
They require a new roadmap/audit before implementation.
```

---

## 6. What must not be continued by inertia

Do not continue any of these without a new owner-approved roadmap:

```text
- old Phase 2 implementation sequence
- sand terrain as primary direction
- MAPLIFE desert decor
- four-biome system
- resource asset generation batches
- new map size migration
- new gameplay economy/resource balance
- new save schema/migration work
- enemy AI/bot/combat implementation
- broad renderer refactor
- HUD bottom-bar redesign
- asset generation without visual approval
```

---

## 7. Current source-of-truth status after this closure

After this PR merges, the state should be treated as:

```text
Current roadmap: CLOSED
Current implementation task: NONE
Next action: owner defines a new roadmap
```

This means GPT should not propose a code PR immediately after this checkpoint unless the owner defines the new target.

---

## 8. Required workflow for the next roadmap

The next roadmap should follow:

```text
1. owner defines target outcome
2. GPT writes/updates roadmap document
3. roadmap audit/design if scope is broad or risky
4. small scoped PR sequence
5. implementation only after scope is accepted
```

A new roadmap is required if the next work touches:

```text
- map size migration
- fog of war
- arena mode
- combat/enemies/bots
- production HUD redesign
- economy/resource mechanics
- save schema
- new asset pipeline
- unit visuals/workflows
- architecture-level rendering changes
```

Small visual polish fixes can still be done as scoped PRs, but only after owner review identifies a concrete problem.

---

## 9. Validation expectations for this docs closure

This closure PR should be docs-only.

Expected changed files:

```text
docs/project/ROADMAP_CLOSURE_2026_06_01_VISUAL_UI.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/PROJECT_STATE.md
```

Expected validation:

```text
No code changes.
No asset changes.
No runtime changes.
No tests required beyond reviewing the docs diff.
```

---

## 10. Short handoff for a new chat

Use this if starting a new conversation:

```text
We are working in ratoker-jpg/four-elements-phaser.
The VISUAL/UI roadmap slice is closed after PR #144-#161.
Industrial map is default, approved industrial resources are visible by default, and UI-01 through UI-04 plus HUD-01 are complete.
Do not continue the old VISUAL/UI roadmap by inertia.
Current implementation task: none.
Next step: define a new roadmap from owner goals.
Read docs/project/ROADMAP_CLOSURE_2026_06_01_VISUAL_UI.md, PROJECT_STATE.md, CURRENT_NEXT_STEP.md, GPT_WORKFLOW.md, and GLM_EXECUTOR_RULES.md before planning.
```
