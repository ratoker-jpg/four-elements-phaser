# FIX_BACKLOG.md

Status: **ARCHIVED** — not referenced by any active reading list; superseded by PROJECT_STATE.md (2026-06-14)  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Date: 2026-05-29

---

## 1. Purpose

This file summarizes known work groups after Phase 1 Foundation.

Phase 2 source-of-truth is:

```text
docs/project/PHASE_2_ROADMAP.md
docs/project/PHASE_2_ROADMAP_AUDIT.md
```

This backlog is not an implementation plan by itself.

Use it as a short index and status tracker.

---

## 2. Required flow

For Phase 2 tasks covered by PR #98:

```text
PHASE_2_ROADMAP_AUDIT -> scoped implementation prompt -> implementation PR -> validation -> manual QA -> merge
```

Do not implement items directly from this file unless they are covered by the accepted Phase 2 audit and the prompt checks merged PR #98.

A separate design/spike is required only when PR #98 marks the task as design/spike-first or the implementation reveals a new unknown risk.

---

## 3. Completed foundation work

These are merged and no longer active backlog.

| PR | Task | Status |
|----|------|--------|
| #83 | FIX-01 — Faction asset wiring | DONE |
| #84 | PHASER4-ANIM-01 — Animation Manager spike | DONE |
| #85 | PHASER4-ANIM-02 — Harvester Animation Manager migration | DONE |
| #86 | ARCH-18A-LITE — GameInputController extraction | DONE |
| #87 | FIX-02 — Harvester idle/blocked feedback | DONE |
| #88 | FIX-03 — Unit cap / ControlState | DONE |
| #89 | FIX-04 — Factory spawn blockage + cancel | DONE |
| #90 | PHASER4-LOAD-01 — Conditional loading spike | DONE |
| #91 | PHASER4-LOAD-02 — Dev/arena-only modularUnits loading | DONE |
| #92 | PHASER4-GPU-01 — GPU layer spike / no implementation | DONE |
| #93 | DOCS-CHECKPOINT-01 | DONE |
| #94 | ARCH-11A-AUDIT | DONE |
| #95 | ARCH-11A — Dual-mode QA smoke automation | DONE |
| #97 | DOCS-P2-ROADMAP | DONE |
| #98 | PHASE-2-ROADMAP-AUDIT | DONE |

---

## 4. Active Phase 2 queue

### 4.1 DOCS-P2-00 — Phase 2 docs checkpoint

```text
Status: ACTIVE NOW
Type: docs
Risk: low
Scope: update stale docs after PR #98
Files: PROJECT_STATE.md, CURRENT_NEXT_STEP.md, NEW_CHAT_HANDOFF.md, FIX_BACKLOG.md
```

### 4.2 MENU-01 — Main menu mode selection

```text
Status: NEXT IMPLEMENTATION AFTER DOCS-P2-00
Type: implementation
Risk: medium
Accepted model: controlled URL launch
Standard -> start normally
Debug -> reload with ?devtools=1
Arena -> reload with ?devtools=1&arena=1
Do not implement late-loading in MENU-01.
```

### 4.3 LOADING-01 — Proper loading screen

```text
Status: READY AFTER PR #98
Type: implementation
Risk: medium
Scope: Phaser Loader progress UI, no fake progress, no asset loading behavior changes.
```

### 4.4 HUD-01 — Legacy HUD removal + HUD consolidation

```text
Status: READY AFTER PR #98
Type: implementation
Risk: medium
Scope: remove legacy top HUD, keep PlaytestHud as single HUD, preserve qa:smoke DOM assertion.
```

### 4.5 TERRAIN-01 — Sand terrain visual system

```text
Status: READY AFTER PR #98 WITH ASSET CONSTRAINTS
Type: implementation / asset integration
Risk: medium-high
Scope: cluster-based terrain variation, decals if approved assets exist, preserve RenderTexture.
Hard rule: do not generate final production PNG assets in code PR.
```

### 4.6 BASE-ANCHOR-01 — HQ/building grounding and footprint alignment

```text
Status: READY AFTER PR #98
Type: implementation
Risk: low-medium
Scope: fix HQ/building visual anchor/footprint alignment without global blind shifts.
```

### 4.7 MENU-02 — Mode-aware late-loading

```text
Status: LATER PHASE 2
Type: implementation
Risk: medium-high
Scope: replace MENU-01 controlled reload with seamless late-loading if still needed.
```

### 4.8 ASSET-WORKFLOW-01 — Animated unit asset pipeline design

```text
Status: DESIGN REQUIRED BEFORE UNIT REGENERATION
Type: docs/design + tooling
Risk: high
Scope: spritesheet layout, directions, states, naming, anchors, scale, validation preview.
```

### 4.9 UNIT-ANIM-01 — Regenerate harvester animated spritesheet

```text
Status: BLOCKED BY ASSET-WORKFLOW-01
Type: asset + integration
Risk: high
Scope: animated harvester states using accepted workflow.
```

### 4.10 UNIT-ANIM-02 — Regenerate builder animated spritesheet

```text
Status: BLOCKED BY ASSET-WORKFLOW-01 AND PREFERABLY UNIT-ANIM-01
Type: asset + integration
Risk: high
Scope: builder movement/build animation and Animation Manager migration.
```

### 4.11 HOTKEYS-01 — Command registry / hotkey system

```text
Status: DESIGN PART REQUIRED BEFORE IMPLEMENTATION
Type: audit/design + implementation
Risk: medium-high
Scope: command registry, hotkey labels, limited command card; no combat commands yet.
```

### 4.12 RESOURCE-01 — Resource node polish + depleted occupancy

```text
Status: READY AFTER PR #98
Type: implementation
Risk: medium
Scope: fix ghost occupancy for depleted resources, resource visual polish if assets available.
```

### 4.13 BUILDER-ID — Builder stable IDs

```text
Status: READY AFTER PR #98 / BEFORE BUILDER ANIMATION WORK
Type: implementation
Risk: medium
Scope: replace builder array-index identity with stable IDs where needed.
```

### 4.14 FIX-05 — CameraControls.destroy bound handler fix

```text
Status: READY AFTER PR #98
Type: implementation
Risk: low-medium
Scope: remove only CameraControls listeners on destroy, not all scene input listeners.
```

### 4.15 MAPLIFE-01 — Environment props / doodads / decals

```text
Status: LATER PHASE 2
Type: asset + implementation
Risk: medium-high
Scope: props/doodads/decals; validate blocking props against pathfinding.
```

### 4.16 ARENA-01 — Arena mode from menu

```text
Status: AFTER MENU-01 / MENU-02
Type: implementation
Risk: medium
Scope: arena as first-class test mode; no full combat in main sandbox.
```

### 4.17 FOG-01 — Two-layer fog of war

```text
Status: DESIGN REQUIRED, LATER PHASE 2
Type: design + implementation
Risk: high
Scope: black unexplored / grey explored / visible; requires dedicated design.
```

### 4.18 WEAPON-WORKFLOW-01 — Weapon VFX / recoil design

```text
Status: DESIGN REQUIRED, LATER PHASE 2
Type: audit/design
Risk: high
Scope: recoil/projectiles/smoke/railgun/Smoky visual model before combat implementation.
```

### 4.19 VISUAL-SPIKE-01 — Normal maps / lighting feasibility

```text
Status: SPIKE REQUIRED, LATER PHASE 2
Type: spike
Risk: high
Scope: evaluate normal maps/custom shader feasibility. No production implementation before spike.
```

---

## 5. Explicitly parked / not immediate

```text
- bot;
- enemy AI;
- full combat in main sandbox;
- attack waves;
- elements economy;
- upgrades;
- progression systems;
- SpriteGPULayer / TilemapGPULayer implementation;
- normal maps implementation before VISUAL-SPIKE-01;
- production asset generation inside code PRs;
- unapproved asset regeneration;
- broad UI framework;
- giant updateGameState rewrite;
- faction-aware loading unless a new accepted reason appears;
- asset unloading unless a new accepted reason appears.
```

---

## 6. Notes from Phase 2 audit

### MENU-01

Use controlled URL launch:

```text
Standard -> normal start
Debug -> ?devtools=1
Arena -> ?devtools=1&arena=1
```

### TERRAIN-01

Do not generate final terrain/decal PNGs inside a code PR.

If assets are missing:

```text
create asset requirements / placeholder integration plan -> stop or request assets
```

### GPU layers

Do not implement SpriteGPULayer / TilemapGPULayer. PHASER4-GPU-01 rejected them for current isometric/depth needs.

### Normal maps

Normal maps / lighting require VISUAL-SPIKE-01 first. No production implementation before spike acceptance.
