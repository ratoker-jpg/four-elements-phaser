# NEW_CHAT_HANDOFF.md

Status: active handoff for a new GPT/GLM chat  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Date: 2026-05-29

---

## 1. Situation

Phase 1 Sandbox MVP engine/foundation work is complete through PR #95.

Phase 2 is now active after:

```text
PR #97 — DOCS-P2-ROADMAP
PR #98 — PHASE-2-ROADMAP-AUDIT
```

Phase 2 focus:

```text
playability / visual identity / menu flow / loading screen / animated assets / terrain / arena testbed / map life
```

The old PR #96 full-project audit was **not merged** and is **not active source-of-truth**.

---

## 2. Read order for new chat

Read these files first:

```text
1. docs/project/PROJECT_STATE.md
2. docs/project/PHASE_2_ROADMAP.md
3. docs/project/PHASE_2_ROADMAP_AUDIT.md
4. docs/project/CURRENT_NEXT_STEP.md
5. docs/project/FIX_BACKLOG.md
6. docs/project/GPT_WORKFLOW.md
7. docs/project/GLM_EXECUTOR_RULES.md
8. docs/project/PHASER4_GPU_01_SPIKE_REPORT.md, only if GPU/API rendering is discussed
9. docs/project/PHASER4_LOAD_01_SPIKE_REPORT.md, only if loading/faction-aware loading is discussed
10. docs/project/PHASER4_ANIM_01_SPIKE_REPORT.md, only if animation pipeline is discussed
```

Only read old roadmap/audit files as historical reference if needed.

---

## 3. Critical warnings

### 3.1 Do not use four-elements-next as active baseline

```text
four-elements-next is reference/donor only.
It must never be treated as the active implementation baseline.
Do not copy code directly from Next without adapting to Phaser 4 architecture.
```

### 3.2 Do not use the old Phaser 3.90 clarification

```text
A previous clarification audit accidentally analyzed four-elements-next / Phaser 3.90.
That audit is invalid for active implementation planning.
The active repo is four-elements-phaser with Phaser 4.1.0.
```

### 3.3 Always confirm Phaser version before planning

```text
Before planning engine/API tasks, confirm package.json has phaser 4.1.0.
If it does not, stop and report.
```

### 3.4 Do not implement GPU layers

```text
PHASER4-GPU-01 spike confirmed that both TilemapGPULayer and SpriteGPULayer
are incompatible with the current isometric/depth model.
Do not recommend or implement GPU layer usage unless new source-backed evidence
changes that conclusion.
```

### 3.5 Do not treat PR #96 as active source-of-truth

```text
PR #96 / FULL_PROJECT_AUDIT_20260529.md was not merged.
It was superseded by Phase 2 roadmap direction.
Use PR #98 / PHASE_2_ROADMAP_AUDIT.md as the Phase 2 audit gate.
```

---

## 4. Repository / branch baseline

Main repo:

```text
ratoker-jpg/four-elements-phaser
```

Phaser version:

```text
4.1.0
```

Current accepted audit gate:

```text
PR #98 — PHASE-2-ROADMAP-AUDIT
```

---

## 5. Completed foundation work

| PR | Task | Summary |
|----|------|---------|
| #83 | FIX-01 | Faction asset wiring for HQ + harvester |
| #84 | PHASER4-ANIM-01 | Animation Manager spike report |
| #85 | PHASER4-ANIM-02 | Harvester walk Animation Manager migration |
| #86 | ARCH-18A-LITE | GameInputController extraction from GameScene |
| #87 | FIX-02 | Harvester blocked-reason UI feedback |
| #88 | FIX-03 | Unit cap / ControlState |
| #89 | FIX-04 | Factory spawn blockage feedback + cancel |
| #90 | PHASER4-LOAD-01 | Conditional asset loading spike report |
| #91 | PHASER4-LOAD-02 | Dev/arena-only modularUnits loading |
| #92 | PHASER4-GPU-01 | GPU layer spike; no implementation recommended |
| #93 | DOCS-CHECKPOINT-01 | Sandbox MVP engine checkpoint |
| #94 | ARCH-11A-AUDIT | QA smoke automation audit |
| #95 | ARCH-11A | Dual-mode QA smoke automation |
| #97 | DOCS-P2-ROADMAP | Phase 2 roadmap + audit prompt |
| #98 | PHASE-2-ROADMAP-AUDIT | Accepted Phase 2 roadmap audit |

---

## 6. Active next work

Current task:

```text
DOCS-P2-00 — update stale docs for Phase 2
```

After DOCS-P2-00:

```text
MENU-01 — Main menu mode selection via controlled URL launch
```

Accepted MENU-01 model:

```text
Standard → start normally
Debug → reload with ?devtools=1
Arena → reload with ?devtools=1&arena=1
```

MENU-01 must preserve `?skipMenu`, `?devtools=1`, and `?arena=1` shortcuts.

Do not implement late-loading in MENU-01. Late-loading is MENU-02.

---

## 7. Phase 2 implementation queue

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

## 8. Direct implementation rule

Phase 2 has one accepted large roadmap audit: `PHASE_2_ROADMAP_AUDIT.md`.

Tasks covered by the audit can go directly to implementation if:

```text
- implementation prompt checks merged PR #98;
- scope stays inside audit constraints;
- no new unknown high-risk issue appears;
- task is not marked as design/spike-only.
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

## 9. Things not to plan now

Do not plan these as immediate implementation:

```text
- bot;
- enemy AI;
- full combat system in main sandbox;
- elements economy;
- upgrades;
- progression systems;
- SpriteGPULayer / TilemapGPULayer implementation;
- normal maps implementation before VISUAL-SPIKE-01;
- production PNG asset generation inside code PRs;
- asset regeneration without ASSET-WORKFLOW-01;
- broad UI framework;
- giant updateGameState rewrite.
```

---

## 10. Telegram notification rule

When preparing GLM tasks or fixup prompts, always include Telegram notification instructions.

Standard short block:

```text
Telegram notification:
At task completion, send Telegram notification using /home/z/my-project/.telegram-notify.json if available.
Do not expose token. Missing/invalid config or send failure must not block the task.
```

Never put the bot token in commits, PR bodies, logs, screenshots, or code.

---

## 11. Working style reminders

GPT should:

```text
- keep Phase 2 source-of-truth centered on PR #98;
- avoid drifting back to the old technical roadmap;
- challenge implementation outside Phase 2 audit scope;
- keep bot/enemy/full combat out of immediate work;
- prefer scoped implementation PRs;
- avoid production asset generation in code PRs unless explicitly approved;
- stop after 1-2 failed fix attempts and return to audit/design.
```
