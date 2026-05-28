# PROJECT_STATE.md

Status: operational project state  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Current phase: Phase 2 — Playability / visual identity / menu flow / animated assets / terrain / arena

---

## Current mode

Phase 1 Sandbox MVP engine/foundation work is complete.

Phase 2 is now the active roadmap direction after:

```text
PR #97 — DOCS-P2-ROADMAP
PR #98 — PHASE-2-ROADMAP-AUDIT
```

Phase 2 focus:

```text
menu → loading → HUD cleanup → terrain readability → building grounding → mode-aware loading → animated asset workflow → animated units → resource/map life → arena/combat visual testbed
```

The old full-project audit PR #96 was **not merged** and is **not active source-of-truth**.

---

## Current Phaser version

```text
4.1.0
```

Always confirm this in `package.json` before planning Phaser API work.

---

## Completed Phase 1 / Sandbox foundation work

| PR | Task | What changed |
|----|------|--------------|
| #83 | FIX-01 | Wired faction-specific HQ and harvester asset keys; non-cyan factions display correct visuals |
| #84 | PHASER4-ANIM-01 | Animation Manager spike; confirmed Phaser 4.1.0 API works with current spritesheet layout |
| #85 | PHASER4-ANIM-02 | Migrated harvester walk cycle from manual frame indexing to Phaser Animation Manager |
| #86 | ARCH-18A-LITE | Extracted GameInputController from GameScene |
| #87 | FIX-02 | Added harvester blocked-reason telemetry and idle-state feedback |
| #88 | FIX-03 | Added ControlState with unit cap; cap display in HUD |
| #89 | FIX-04 | Added factory spawn blockage UI feedback + cancel button for factory queue |
| #90 | PHASER4-LOAD-01 | Conditional asset loading spike; recommended dev/arena-only modularUnits loading |
| #91 | PHASER4-LOAD-02 | Gated modularUnits loading behind devtools/arena; stripped modular-combat from old saves in standard mode |
| #92 | PHASER4-GPU-01 | GPU layer spike; TilemapGPULayer / SpriteGPULayer not suitable for current isometric renderer |
| #93 | DOCS-CHECKPOINT-01 | Checkpoint after Sandbox MVP engine roadmap |
| #94 | ARCH-11A-AUDIT | QA smoke automation audit |
| #95 | ARCH-11A | Dual-mode QA smoke automation: standard + devtools/arena |
| #97 | DOCS-P2-ROADMAP | Added Phase 2 roadmap + audit prompt |
| #98 | PHASE-2-ROADMAP-AUDIT | Accepted Phase 2 roadmap direction and implementation gate |

---

## Current Phase 2 source-of-truth docs

Read these before any Phase 2 task:

```text
docs/project/PHASE_2_ROADMAP.md
docs/project/PHASE_2_ROADMAP_AUDIT.md
docs/project/PHASE_2_ROADMAP_AUDIT_PROMPT.md
docs/project/NEW_CHAT_HANDOFF.md
docs/project/FIX_BACKLOG.md
docs/project/GPT_WORKFLOW.md
docs/project/GLM_EXECUTOR_RULES.md
```

Important:

```text
PR #98 / PHASE_2_ROADMAP_AUDIT.md is the accepted audit gate for Phase 2 implementation.
```

Implementation prompts for Phase 2 should check that main includes merged PR #98.

---

## Active next work

```text
DOCS-P2-00 — update stale project docs for Phase 2
```

This file is part of DOCS-P2-00.

After DOCS-P2-00 is merged, the first implementation task is expected to be:

```text
MENU-01 — Main menu mode selection via controlled URL launch
```

Other ready early tasks from PR #98:

```text
LOADING-01 — Proper loading screen
HUD-01 — Legacy HUD removal + HUD consolidation
TERRAIN-01 — Sand terrain visual system, with asset constraints
BASE-ANCHOR-01 — HQ/building grounding and footprint alignment
```

---

## Accepted Phase 2 implementation sequence

Current sequence from PR #98:

```text
1. DOCS-P2-00 — docs checkpoint
2. MENU-01 — Main menu mode selection via controlled URL launch
3. LOADING-01 — Proper loading screen
4. HUD-01 — Legacy HUD removal + HUD consolidation
5. TERRAIN-01 — Sand terrain visual system
6. BASE-ANCHOR-01 — HQ/building grounding and footprint alignment
7. MENU-02 — Mode-aware late-loading / seamless mode switching
8. ASSET-WORKFLOW-01 — Animated unit asset pipeline design
9. UNIT-ANIM-01 — Regenerate harvester animated spritesheet
10. UNIT-ANIM-02 — Regenerate builder animated spritesheet
11. HOTKEYS-01 — Command registry / hotkey system
12. RESOURCE-01 — Resource node polish + depleted occupancy fix
13. BUILDER-ID — Builder stable IDs
14. FIX-05 — CameraControls.destroy() bound handler fix
15. MAPLIFE-01 — Environment props / doodads / decals
16. ARENA-01 — Arena mode from menu
17. FOG-01 — Two-layer fog of war
18. WEAPON-WORKFLOW-01 — Weapon VFX / recoil design
19. VISUAL-SPIKE-01 — Normal maps / lighting feasibility
```

---

## Direct implementation rule for Phase 2

Phase 2 has an accepted large roadmap audit in PR #98.

Tasks covered by `PHASE_2_ROADMAP_AUDIT.md` can proceed directly to implementation if:

```text
- the prompt checks merged PR #98;
- scope stays inside the accepted audit;
- no new unknown high-risk problem appears;
- hard rules from the audit are preserved.
```

A new mini-audit/design is required only when:

```text
- the task exceeds PR #98 scope;
- implementation reveals a new unreviewed high-risk issue;
- PR #98 explicitly marks the task as needing design/spike first.
```

Tasks requiring design/spike before implementation:

```text
ASSET-WORKFLOW-01
HOTKEYS-01 design part
FOG-01
WEAPON-WORKFLOW-01
VISUAL-SPIKE-01
```

---

## Key constraints

Do not start these as immediate implementation:

```text
- bot / enemy AI;
- full combat in main sandbox;
- attack waves;
- elements economy;
- upgrades / progression;
- SpriteGPULayer / TilemapGPULayer implementation;
- normal maps implementation before VISUAL-SPIKE-01;
- faction-aware loading unless a new approved reason appears;
- broad UI framework;
- giant updateGameState rewrite;
- production PNG asset generation inside code PRs;
- unscoped asset regeneration without ASSET-WORKFLOW-01.
```

---

## Notes for next implementation

### MENU-01 model

PR #98 accepted a controlled URL launch model:

```text
Standard → start normally
Debug → reload with ?devtools=1
Arena → reload with ?devtools=1&arena=1
```

Do not implement late-loading in MENU-01. That is MENU-02.

### TERRAIN-01 asset rule

Do not generate final production PNG assets inside the code PR.

If approved terrain/decal assets exist, integrate them.
If not, create asset requirements / placeholder integration plan and stop or request assets.

---

## Maintenance policy

Keep this file short and operational.

Detailed history belongs in:

- PR bodies;
- `PHASE_2_ROADMAP.md`;
- `PHASE_2_ROADMAP_AUDIT.md`;
- task-specific audit/design docs.
