# NEW_CHAT_HANDOFF.md

Status: active handoff for a new GPT chat  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Date: 2026-05-27

---

## 1. Situation

This handoff exists because the previous GPT conversation became overloaded after a fast Phase 1 Foundation run.

The next GPT chat should not continue blindly from the old 21-ARCH roadmap.

Current decision:

```text
Phase 1 Foundation feature work is frozen.
Next task is planning, not implementation.
```

---

## 2. Repository / branch baseline

Main repo:

```text
ratoker-jpg/four-elements-phaser
```

Last accepted feature PR before freeze:

```text
PR #80 — ARCH-13C-LITE: Add render-only unit motion dust polish
```

After PR #80:

```text
No new runtime feature package should start until Sandbox MVP audit/roadmap is created.
```

---

## 3. Read order for new GPT chat

Read these files first:

```text
1. docs/project/NEW_CHAT_HANDOFF.md
2. docs/project/PHASE_1_FREEZE.md
3. docs/project/FIX_BACKLOG.md
4. docs/project/PROJECT_STATE.md
5. docs/project/GPT_WORKFLOW.md
6. docs/project/GLM_EXECUTOR_RULES.md
```

Only read old roadmap/audit files as historical reference if needed.

---

## 4. Active next work

Next work is:

```text
Create Sandbox MVP audit/roadmap.
```

The audit should produce:

```text
- Sandbox MVP definition;
- current system status;
- fix groups;
- risks;
- recommended high-controlled/high+ fix packages;
- manual QA checklist;
- what is explicitly postponed to Phase 2.
```

Do not start implementation until Denis approves the new roadmap/audit.

---

## 5. Things not to plan now

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

They are not deleted forever. They are parked for later phase.

---

## 6. Known fix/polish groups

Use `docs/project/FIX_BACKLOG.md` as the source.

At minimum, the new audit should cover:

```text
- faction asset wiring;
- harvester reliability;
- unit grounding / centering;
- selection marker model;
- lane movement / diagonal cut-through readability;
- optional player tank control baseline;
- movement dust rework;
- controlled render-only unit bobbing/suspension.
```

---

## 7. Telegram notification rule

When preparing GLM tasks or fixup prompts, always include Telegram notification instructions.

Standard short block:

```text
Telegram notification:
At task completion, send Telegram notification using /home/z/my-project/.telegram-notify.json if available.
Do not expose token. Missing/invalid config or send failure must not block the task.
```

GLM executor rules also contain this requirement. Still include it in prompts because fixup tasks may not always trigger the long executor flow.

Never put the bot token in commits, PR bodies, logs, screenshots, or code.

---

## 8. Working style reminders

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

Denis prefers:

```text
- short, direct, structured Russian;
- clear yes/no recommendations;
- no automatic agreement;
- practical prompts that can be sent to GLM.
```

---

## 9. Suggested first message in new chat

Denis can start the new GPT chat with:

```text
Прочитай docs/project/NEW_CHAT_HANDOFF.md, PHASE_1_FREEZE.md, FIX_BACKLOG.md и PROJECT_STATE.md.
Мы заморозили Phase 1 Foundation после PR #80.
Нужно собрать новый Sandbox MVP audit/roadmap без бота/врага/апгрейдов.
```
