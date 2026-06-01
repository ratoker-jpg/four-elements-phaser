# CURRENT_NEXT_STEP.md

Status: roadmap closed / waiting for next owner-defined roadmap  
Project: Four Elements Phaser  
Date: 2026-06-01

---

## Why this file exists

This short checkpoint prevents confusion about the current operational workstream.

Use `PROJECT_STATE.md` as the primary operational source of truth.

This file answers one question:

```text
What should GPT/GLM/Codex do next by default?
```

Current answer:

```text
Nothing by default. The current VISUAL/UI roadmap is closed.
Wait for the owner to define the next roadmap.
```

---

## Current next step

```text
No active implementation task.
```

Next action:

```text
Owner defines the next roadmap target.
```

Do not start a new implementation PR from the old VISUAL/UI queue unless the owner explicitly reopens a specific item.

---

## Current roadmap state

```text
VISUAL/UI roadmap slice: CLOSED
Implementation task: NONE
Recommended mode: roadmap definition / owner review
```

Closure checkpoint:

```text
docs/project/ROADMAP_CLOSURE_2026_06_01_VISUAL_UI.md
```

That closure document is the handoff for everything completed in PR #144 through PR #161.

---

## Closed roadmap summary

### VISUAL-05A — Production industrial map integration

```text
DONE
PR #144 — Parameterize ?visual04a map preview 96/128/192
PR #145 — Industrial terrain behind mapStyle
PR #146 — Production industrial frame/background layer
PR #147 — Lower-left HQ/start/resources
PR #148 — Industrial generated map default
```

Final state:

```text
- industrial generated map is default for new games
- mapStyle industrial/sand is preserved
- sand/fixed/custom map paths remain fallback/reference
- HQ/start/resources use lower-left industrial composition
- frame/background/walls are connected in production for industrial
- save/load compatibility preserved
- current production small map remains 32x32
- 96/128/192 production migration is deferred
```

### VISUAL-06 — Resource model/assets/wiring/rendering

```text
DONE
PR #150 — VISUAL-06A resource visual model docs/design
PR #151 — VISUAL-06B resource candidate review package
PR #152 — VISUAL-06B1 resource model pivot
PR #153 — VISUAL-06C approved industrial resources added
PR #154 — VISUAL-06D preload/manifest wiring behind resourceStyle
PR #155 — VISUAL-06E renderer wiring behind resourceStyle
PR #156 — VISUAL-06E fixup: resourceStyle resolved from mapStyle
```

Final state:

```text
- normal resource model: 1x1 richness-tier visual assets
- central infinite resource: 2x2 industrial asset
- approved resource PNGs are in repo
- industrial resource assets are preloaded through generated manifest pipeline
- industrial resource rendering works through resourceStyle
- industrial mapStyle resolves to industrial resourceStyle by default
- sand mapStyle resolves to legacy resourceStyle
- old mineral assets remain available
- no resource economy, amount, depletion, pathfinding, or mapgen behavior changed
```

### UI roadmap — Menus, Save/Continue, HUD readability

```text
DONE
PR #157 — UI-01 main menu visual polish and navigation shell
PR #158 — UI-02 New Game setup polish
PR #159 — UI-03 ESC menu polish
PR #160 — UI-04 Save/Continue flow polish
PR #161 — HUD-01 Playtest HUD readability polish
```

Final state:

```text
- main menu uses industrial sci-fi style
- New Game setup matches the same style
- ESC menu matches the same style
- Save/Continue flow is polished around existing save/load behavior
- ESC Load uses existing loadGame flow
- save schema/core was not changed
- Playtest HUD readability was polished
- HUD gameplay/economy/build/production callbacks remain unchanged
```

---

## What is NOT active now

The following are not active implementation tasks:

```text
VISUAL-06F resource QA polish
VISUAL-07 HUD layout design doc
VISUAL-08 HUD shell implementation
VISUAL-09 command panel/hotkey visual pass
VISUAL-10 main menu visual refresh
VISUAL-11 harvester/builder visual workflow design
VISUAL-12 approved unit visual integration
```

Some of these names existed in older queue drafts, but they are not the current active roadmap.

The UI work was completed through UI-01/UI-04 and HUD-01 instead.

---

## Known deferred topics

These remain known future options, not current tasks:

```text
- production map size migration to 96/128/192
- full RTS HUD bottom bar with minimap/info/commands
- fog of war
- arena mode
- unit visual workflow
- combat/enemy/bot/AI systems
- upgrades/progression
- save schema/migration/autosave/cloud saves
- resource richness gameplay/mapgen beyond small/medium/large/infinite
```

Each needs a new owner-approved roadmap or scoped task before implementation.

---

## Rules for the next message/task

If the owner asks for the next roadmap:

```text
1. Ask/derive the desired target outcome.
2. Write a clear roadmap with phases and PR boundaries.
3. Separate design/docs from implementation.
4. Keep PRs small and reviewable.
5. Do not start code until the roadmap/scope is accepted.
```

If the owner asks for immediate code without a new roadmap:

```text
Stop and clarify unless the task is a tiny, concrete bugfix.
```

If the owner asks for visual changes:

```text
Do not generate batches of assets or change runtime visuals without an approved visual contract/reference.
```

---

## Read before next roadmap planning

```text
docs/project/ROADMAP_CLOSURE_2026_06_01_VISUAL_UI.md
docs/project/PROJECT_STATE.md
docs/project/GPT_WORKFLOW.md
docs/project/GLM_EXECUTOR_RULES.md
```

Historical VISUAL docs remain useful background, but they are no longer an active implementation queue:

```text
docs/project/VISUAL_ROADMAP.md
docs/project/VISUAL_SYSTEM_AUDIT.md
docs/project/VISUAL_CANDIDATE_SUMMARY.md
docs/project/VISUAL_01B_LAYERED_PLATFORM_FRAME.md
docs/project/VISUAL_05A_PRODUCTION_INDUSTRIAL_MAP_INTEGRATION_PLAN.md
docs/project/VISUAL_06_RESOURCE_FIELD_VISUAL_MODEL.md
```

---

## Short handoff

```text
We are working in ratoker-jpg/four-elements-phaser.
The VISUAL/UI roadmap slice is closed after PR #144-#161.
Industrial map is default, approved industrial resources are visible by default, and UI-01 through UI-04 plus HUD-01 are complete.
Current implementation task: none.
Next step: define a new roadmap from owner goals.
Do not continue the old VISUAL/UI queue by inertia.
```
