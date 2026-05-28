# PHASE_1_FREEZE.md

Status: active checkpoint  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Date: 2026-05-28

---

## 1. Decision

Phase 1 Foundation is frozen.

No new major implementation ARCH should start outside the corrected audit sequence.

---

## 2. Why freeze

Phase 1 Foundation delivered a strong base:

```text
- main menu / new game flow;
- settings / UI scale;
- save/load / continue / save management;
- Map 1 and deterministic generated maps;
- generated map quality pass;
- devtools / QA arena / debug overlays;
- gameplay feedback and motion dust MVP;
- asset diagnostics / asset viewer;
- civil economy / construction / separator / factory loop;
- tests + CI QA smoke.
```

Continuing into enemy AI, bot, combat, progression, upgrades, or balance expansion now would broaden the project before the Sandbox MVP is stable.

---

## 3. Next work follows the corrected audit sequence

Next work is not broad feature expansion.

Next work follows the corrected audit sequence from `docs/project/PHASER4_AUDIT_CLARIFICATION_RETRY.md`:

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

---

## 4. Combat/enemy/bot/upgrades/progression are parked

Do not schedule as immediate next work:

```text
- enemy AI / bot;
- enemy economy;
- attack waves;
- full combat system;
- upgrades;
- progression systems;
- broad balance/progression pass;
- map editor;
- large new gameplay systems.
```

These are not deleted. They are postponed until after Sandbox MVP stability.

---

## 5. Phaser 4 API adoption policy

Phaser 4 API adoption is allowed but only via:

```text
spike -> decision document -> scoped implementation -> validation
```

Rules:

```text
- Do not adopt a new Phaser 4 system in production code without a spike first.
- Spikes must produce a written decision (committed to docs/project/).
- Implementation must be scoped and reviewed.
- Do not rewrite large systems unless the spike proves it safe.
- Current working systems must not break during migration.
```

---

## 6. Roadmap status

`docs/ROADMAP.md` is inactive/archived.

Do not use the old 21-ARCH list as active task source.

The corrected audit is the source-of-truth:

```text
docs/project/PHASER4_AUDIT_CLARIFICATION_RETRY.md
```

---

## 7. Rule for the next chat

A new GPT/GLM chat must start from:

```text
docs/project/PHASER4_AUDIT_CLARIFICATION_RETRY.md
docs/project/PROJECT_STATE.md
docs/project/FIX_BACKLOG.md
docs/project/PHASE_1_FREEZE.md
docs/project/GPT_WORKFLOW.md
docs/project/GLM_EXECUTOR_RULES.md
```

Do not start implementation directly. Follow the audit sequence.
