# NEW_CHAT_HANDOFF_VISUAL.md

Status: **ARCHIVED** — point-in-time handoff; superseded by active source-of-truth docs (2026-06-14)  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Date: 2026-05-30

---

## 1. Situation

The VISUAL roadmap is the active planning direction. The previous Phase 2 (sand-terrain-focused) roadmap is archived.

Key milestones completed:

```text
PR #122 — VISUAL-ROADMAP-01: Archive old roadmap, add VISUAL_ROADMAP.md
PR #123 — VISUAL-AUDIT-01: Full visual system audit and implementation plan
```

The civil economy loop is functional. The current focus is bringing the visual presentation to a real RTS quality bar.

---

## 2. Active docs

Read these before any work:

```text
1. docs/project/VISUAL_ROADMAP.md — accepted visual planning direction
2. docs/project/VISUAL_SYSTEM_AUDIT.md — accepted audit with staged PR sequence (VISUAL-01..12)
3. docs/project/PROJECT_STATE.md — current operational state
4. docs/project/CURRENT_NEXT_STEP.md — current next step
5. docs/project/GPT_WORKFLOW.md — GPT planner/reviewer workflow rules
6. docs/project/GLM_EXECUTOR_RULES.md — GLM executor rules
```

Do not follow PHASE_2_ROADMAP.md or PHASE_2_ROADMAP_AUDIT.md as active direction. They are archived.

---

## 3. Current roadmap model

```text
roadmap first → huge roadmap audit second → implementation after audit
```

Implementation can use high+/medium/low scoped steps directly if covered by the accepted audit (`VISUAL_SYSTEM_AUDIT.md`). Do not require a new mini-audit for every step that is already covered by the accepted audit.

If a task expands scope, touches gameplay/pathfinding/economy unexpectedly, or combines multiple phases, stop and request approval.

---

## 4. Active VISUAL implementation sequence

```text
VISUAL-01 — Industrial map visual candidate workflow
VISUAL-02 — Map rendering prototype spike
VISUAL-03 — Industrial terrain/platform integration
VISUAL-04 — Map frame / grounded presentation
VISUAL-05 — Lower-left start composition
VISUAL-06 — Resource field visual model design
VISUAL-07 — HUD layout design doc
VISUAL-08 — HUD shell implementation
VISUAL-09 — Command panel/hotkey visual pass
VISUAL-10 — Main menu visual refresh
VISUAL-11 — Harvester/builder visual workflow design
VISUAL-12 — Approved unit visual integration
```

---

## 5. Current next step

```text
VISUAL-01 — Industrial map visual candidate workflow
```

This is a docs/assets-only task. Produce 2-3 static visual direction candidates. No runtime changes. One direction must be approved by the project owner before any runtime work begins.

---

## 6. High+ implementation model

Tasks inside VISUAL_SYSTEM_AUDIT.md scope can go directly to implementation:

```text
- Use the audit's PR sequence, scope, and non-goals directly.
- Do not ask for another audit if the task is covered.
- If the task expands scope, stop and request approval.
```

Tasks requiring separate design/approval before implementation:

```text
- Tasks that combine multiple VISUAL phases
- Tasks that touch gameplay/pathfinding/economy
- Tasks not covered by VISUAL_SYSTEM_AUDIT.md
```

---

## 7. What NOT to do

```text
- Do not follow Phase 2 / sand / MAPLIFE as active direction
- Do not continue MAPLIFE #120 or desert decor direction
- Do not mass-generate assets into repo without visual approval
- Do not fix bad art by code-only patches
- Do not build a four-biome system now
- Do not copy StarCraft assets/UI exactly
- Do not start VISUAL-01 implementation — that is the next step, assigned separately
- Do not require a new mini-audit for VISUAL steps already covered by the accepted audit
```

---

## 8. Important project decisions

```text
- One strong primary biome first: industrial platform / mining battlefield
- Map must feel grounded on a surface, not floating
- Playable edges should eventually feel irregular/organic, not a perfect board
- HQ/start zone should move to lower-left later (VISUAL-05)
- HUD target: bottom-left minimap, bottom-center selected info, bottom-right commands/production/hotkeys
- Old successful main menu composition should be preserved, but background/theme updated
- Harvester and Builder visuals will be refreshed later (VISUAL-11/12)
- Tank/Wasp combat 3D asset direction should not be restyled by default
```

---

## 9. What to ask GLM next

If preparing the next GLM task, use VISUAL-01:

```text
Task:
VISUAL-01 — Industrial map visual candidate workflow

Mode:
DOCS / ASSETS ONLY.

Active repo:
ratoker-jpg/four-elements-phaser

Prerequisite:
VISUAL-AUDIT-01 must be merged.
If docs/project/VISUAL_SYSTEM_AUDIT.md is missing, stop and report.

Read first:
- docs/project/GLM_EXECUTOR_RULES.md
- docs/project/VISUAL_ROADMAP.md
- docs/project/VISUAL_SYSTEM_AUDIT.md
- docs/project/PROJECT_STATE.md

Goal:
Produce 2-3 static visual direction candidates for the industrial map surface.
One direction must be approved by the project owner before any runtime work begins.

Hard rules:
- Do not modify runtime code.
- Do not add assets to public/assets/.
- Do not change the Phaser renderer.
- Do not start VISUAL-02 or any implementation.

PR:
Create branch: visual-01-visual-candidates
Open PR into main. Do not merge.
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

## 11. Critical warnings

### Do not use four-elements-next as active baseline

```text
four-elements-next is reference/donor only.
It must never be treated as the active implementation baseline.
```

### Do not use the old Phaser 3.90 clarification

```text
A previous clarification audit accidentally analyzed four-elements-next / Phaser 3.90.
That audit is invalid for active implementation planning.
The active repo is four-elements-phaser with Phaser 4.1.0.
```

### Always confirm Phaser version before planning

```text
Before planning engine/API tasks, confirm package.json has phaser 4.1.0.
If it does not, stop and report.
```

### Do not implement GPU layers

```text
PHASER4-GPU-01 spike confirmed that both TilemapGPULayer and SpriteGPULayer
are incompatible with the current isometric/depth model.
```
