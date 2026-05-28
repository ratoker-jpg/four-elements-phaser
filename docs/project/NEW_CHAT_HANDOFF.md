# NEW_CHAT_HANDOFF.md

Status: active handoff for a new GPT/GLM chat
Project: Four Elements Phaser
Repo: `ratoker-jpg/four-elements-phaser`
Date: 2026-05-29

---

## 1. Situation

The Sandbox MVP engine/foundation roadmap is complete through PR #92 (PHASER4-GPU-01 spike report).

All 10 work items from the corrected audit sequence are merged:

```text
FIX-01 through PHASER4-GPU-01 (PR #83–#92)
```

Next work is ARCH-11A — QA smoke automation / Sandbox MVP regression coverage.

---

## 2. Read order for new chat

Read these files first:

```text
1. docs/project/PHASER4_AUDIT_CLARIFICATION_RETRY.md
2. docs/project/PROJECT_STATE.md
3. docs/project/FIX_BACKLOG.md
4. docs/project/PHASE_1_FREEZE.md
5. docs/project/CHECKPOINT_20260528_SANDBOX_MVP_ENGINE.md
6. docs/project/GPT_WORKFLOW.md
7. docs/project/GLM_EXECUTOR_RULES.md
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
Use docs/project/PHASER4_AUDIT_CLARIFICATION_RETRY.md as source-of-truth.
```

### 3.3 Always confirm Phaser version before planning

```text
Before planning engine API tasks, confirm that package.json has phaser 4.1.0.
If it does not, stop and report instead of proceeding with wrong assumptions.
```

### 3.4 Do not implement GPU layers

```text
PHASER4-GPU-01 spike (PR #92) confirmed that both TilemapGPULayer and
SpriteGPULayer are incompatible with the isometric depth model.
Do not recommend or implement GPU layer usage.
Reconsider only when: sprite count exceeds 50, combat is implemented, or
Phaser adds isometric/per-member-depth support.
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

Last merged Sandbox MVP engine PR:

```text
PR #92 — PHASER4-GPU-01: SpriteGPULayer / TilemapGPULayer spike report
```

---

## 5. Completed work (PR #83–#92)

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

---

## 6. Active next work

Next work is ARCH-11A — QA smoke automation / Sandbox MVP regression coverage.

Purpose: Strengthen automated coverage for features shipped in PR #83–#92.

Coverage targets:

- new game start
- faction selection
- harvester movement and animation
- harvester blocked status
- factory production
- unit cap
- factory cancel
- standard mode: modularUnits skipped
- devtools/arena mode: modularUnits enabled
- no console errors

Do not start implementation until the appropriate audit/design is accepted.

---

## 7. Things not to plan now

Do not plan these as immediate next tasks:

```text
- bot;
- enemy AI;
- enemy economy;
- attack waves;
- full combat system;
- upgrades;
- progression systems;
- broad balance/progression pass;
- map editor;
- faction-aware loading (premature);
- asset unloading (premature);
- SpriteGPULayer / TilemapGPULayer implementation (rejected);
- command relay economy expansion;
- refund economy;
- full UI redesign.
```

They are parked for a later phase.

---

## 8. Known fix/polish groups

Use `docs/project/FIX_BACKLOG.md` as the source.

---

## 9. Telegram notification rule

When preparing GLM tasks or fixup prompts, always include Telegram notification instructions.

Standard short block:

```text
Telegram notification:
At task completion, send Telegram notification using /home/z/my-project/.telegram-notify.json if available.
Do not expose token. Missing/invalid config or send failure must not block the task.
```

Never put the bot token in commits, PR bodies, logs, screenshots, or code.

---

## 10. Working style reminders

GPT should:

```text
- be strict about roadmap discipline;
- challenge implementation without audit;
- prefer larger coherent packages only after audit;
- keep bot/enemy/upgrades out of the immediate roadmap;
- avoid one-off fix guessing;
- stop after 1-2 failed fix attempts and return to audit;
- keep docs short and operational.
```
