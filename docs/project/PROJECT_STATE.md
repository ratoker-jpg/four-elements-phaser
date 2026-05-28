# PROJECT_STATE.md

Status: operational project state  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Updated: 2026-05-28

---

## Active repo

```text
ratoker-jpg/four-elements-phaser
```

## Phaser version

```text
4.1.0
```

Verified from `package.json`.

## Reference repo

```text
ratoker-jpg/four-elements-next
```

Reference/donor only. Must never be used as active implementation baseline.

---

## Current mode

Sandbox MVP stability + Phaser 4 API adoption roadmap.

Phase 1 Foundation frozen after PR #80 / ARCH-13C-LITE.

Current rule:

```text
No broad feature expansion.
Next work follows the corrected audit sequence.
Combat/enemy/bot/upgrades/progression are parked.
Phaser 4 API adoption is allowed only via spike -> decision -> scoped implementation.
```

---

## Source-of-truth audit

```text
docs/project/PHASER4_AUDIT_CLARIFICATION_RETRY.md
```

All roadmap and future prompts must use this as the current source-of-truth.

Do not use the old Phaser 3.90 clarification as source-of-truth.

---

## Recently completed foundation work

Recently merged foundation packages include:

```text
ARCH-11A — Devtools QA sandbox MVP
ARCH-11B-12A — Debug overlays + QA arena MVP
ARCH-13A-13B — Gameplay feedback / VFX MVP
ARCH-14B — Main menu / New Game / Pause shell
ARCH-14C-15B — UI shell polish + save management UX
ARCH-15A — Local save/load skeleton
ARCH-16A-16B — Map setup options + deterministic generated map MVP
ARCH-08B-09A — Generated map terrain/resource balance MVP
ARCH-17A-17B — Asset diagnostics and asset viewer MVP
ARCH-13C-LITE — Render-only unit motion dust polish MVP
```

---

## Current active docs

```text
docs/project/PHASER4_AUDIT_CLARIFICATION_RETRY.md — source-of-truth audit
docs/project/PROJECT_STATE.md — this file
docs/project/FIX_BACKLOG.md — known fix groups
docs/project/PHASE_1_FREEZE.md — freeze checkpoint
docs/project/NEW_CHAT_HANDOFF.md — new chat handoff
docs/project/GPT_WORKFLOW.md — GPT planner workflow
docs/project/GLM_EXECUTOR_RULES.md — GLM executor rules
```

`docs/ROADMAP.md` is inactive/archived and must not be used as active task source.

---

## No immediate enemy/bot/combat/upgrades/progression work

Do not schedule as immediate next work:

```text
- enemy AI / bot;
- full combat system;
- attack waves;
- enemy economy;
- upgrades;
- progression systems;
- broad balance progression;
- map editor.
```

These are parked until after Sandbox MVP stability is achieved.

---

## Accepted workflow reminder

```text
roadmap -> audit/design -> scoped package -> implementation -> GPT review -> Denis manual QA -> merge
```

For fix work:

```text
fix backlog -> fix-roadmap audit -> scoped fix package -> implementation -> manual QA -> merge
```

---

## Maintenance policy

This file should stay short and operational.

It may be updated after important PRs or direction changes.

Small updates do not always require a dedicated docs-only PR.
