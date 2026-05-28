# NEW_CHAT_HANDOFF.md

Status: active handoff for a new GPT/GLM chat  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Date: 2026-05-28

---

## 1. Situation

This handoff exists because the previous GPT conversation became overloaded after a fast Phase 1 Foundation run.

The next chat should not continue blindly from the old 21-ARCH roadmap.

Current decision:

```text
Phase 1 Foundation feature work is frozen.
Next work is Sandbox MVP stability + Phaser 4 API adoption.
Work follows the corrected audit sequence.
```

---

## 2. Read order for new chat

Read these files first:

```text
1. docs/project/PHASER4_AUDIT_CLARIFICATION_RETRY.md
2. docs/project/PROJECT_STATE.md
3. docs/project/FIX_BACKLOG.md
4. docs/project/PHASE_1_FREEZE.md
5. docs/project/GPT_WORKFLOW.md
6. docs/project/GLM_EXECUTOR_RULES.md
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

Last accepted feature PR before freeze:

```text
PR #80 — ARCH-13C-LITE: Add render-only unit motion dust polish
```

---

## 5. Active next work

Next work follows the corrected audit sequence from `PHASER4_AUDIT_CLARIFICATION_RETRY.md`:

```text
1.  FIX-01 — Faction asset wiring
2.  PHASER4-ANIM-01 — Animation Manager spike
3.  ARCH-18A-LITE — GameScene input/command extraction
4.  FIX-02 — Harvester idle-forever UI feedback
5.  FIX-03 — Unit cap / ControlState
6.  FIX-04 — Factory spawn blockage UI feedback + cancel
7.  PHASER4-ANIM-02 — Animation Manager migration
8.  PHASER4-LOAD-01 — Conditional asset loading spike
9.  PHASER4-GPU-01 — SpriteGPULayer / TilemapGPULayer spike
10. ARCH-11A — QA smoke automation
```

Do not start implementation until the appropriate audit/design is accepted.

---

## 6. Things not to plan now

Do not plan these as immediate next tasks:

```text
- bot;
- enemy AI;
- enemy economy;
- attack waves;
- full combat system;
- upgrades;
- progression;
- broad balance progression;
- map editor.
```

They are parked for a later phase.

---

## 7. Known fix/polish groups

Use `docs/project/FIX_BACKLOG.md` as the source.

---

## 8. Telegram notification rule

When preparing GLM tasks or fixup prompts, always include Telegram notification instructions.

Standard short block:

```text
Telegram notification:
At task completion, send Telegram notification using /home/z/my-project/.telegram-notify.json if available.
Do not expose token. Missing/invalid config or send failure must not block the task.
```

Never put the bot token in commits, PR bodies, logs, screenshots, or code.

---

## 9. Working style reminders

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
