# PHASE_1_FREEZE.md

Status: active checkpoint
Project: Four Elements Phaser
Repo: `ratoker-jpg/four-elements-phaser`
Date: 2026-05-29

---

## 1. Decision

Phase 1 Foundation is frozen.

Sandbox MVP engine/foundation roadmap (FIX-01 through PHASER4-GPU-01) is complete through PR #92.

No new major implementation ARCH should start outside the next approved work item (ARCH-11A).

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

Sandbox MVP engine roadmap added:

```text
- faction asset wiring (FIX-01);
- Animation Manager adoption (PHASER4-ANIM-01, PHASER4-ANIM-02);
- GameInputController extraction (ARCH-18A-LITE);
- harvester blocked feedback (FIX-02);
- unit cap / ControlState (FIX-03);
- factory blockage feedback + cancel (FIX-04);
- dev/arena-only modularUnits loading (PHASER4-LOAD-01, PHASER4-LOAD-02);
- GPU layer evaluation (PHASER4-GPU-01 — no implementation recommended).
```

Continuing into enemy AI, bot, combat, progression, upgrades, or balance expansion now would broaden the project before the Sandbox MVP is stable and has adequate automated coverage.

---

## 3. Completed audit sequence

The corrected audit sequence from `PHASER4_AUDIT_CLARIFICATION_RETRY.md` is fully complete:

```text
 1. FIX-01 — Faction asset wiring                 (PR #83, merged)
 2. PHASER4-ANIM-01 — Animation Manager spike     (PR #84, merged)
 3. ARCH-18A-LITE — GameInputController extraction (PR #86, merged)
 4. FIX-02 — Harvester blocked feedback           (PR #87, merged)
 5. FIX-03 — Unit cap / ControlState              (PR #88, merged)
 6. FIX-04 — Factory blockage feedback + cancel    (PR #89, merged)
 7. PHASER4-ANIM-02 — Animation Manager migration (PR #85, merged)
 8. PHASER4-LOAD-01 — Conditional loading spike   (PR #90, merged)
 9. PHASER4-LOAD-02 — Dev/arena modularUnits      (PR #91, merged)
10. PHASER4-GPU-01 — GPU layer spike              (PR #92, merged)
```

---

## 4. Next step

ARCH-11A — QA smoke automation / Sandbox MVP regression coverage.

This is the next item from the corrected audit sequence.

Purpose: Strengthen automated coverage for the features shipped in PR #83–#92 before moving to post-Sandbox work.

---

## 5. Combat/enemy/bot/upgrades/progression are parked

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
- large new gameplay systems;
- faction-aware loading (premature);
- asset unloading (premature);
- SpriteGPULayer / TilemapGPULayer implementation (rejected by PHASER4-GPU-01);
- command relay economy expansion;
- refund economy;
- full UI redesign.
```

These are not deleted. They are postponed until after Sandbox MVP stability and automated coverage.

---

## 6. Phaser 4 API adoption policy

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

Completed spikes:

```text
PHASER4-ANIM-01 — Animation Manager (implemented as PHASER4-ANIM-02)
PHASER4-LOAD-01 — Conditional loading (implemented as PHASER4-LOAD-02)
PHASER4-GPU-01 — GPU layers (no implementation recommended)
```

---

## 7. Roadmap status

`docs/ROADMAP.md` is inactive/archived.

Do not use the old 21-ARCH list as active task source.

The corrected audit is the source-of-truth:

```text
docs/project/PHASER4_AUDIT_CLARIFICATION_RETRY.md
```

---

## 8. Rule for the next chat

A new GPT/GLM chat must start from:

```text
docs/project/PHASER4_AUDIT_CLARIFICATION_RETRY.md
docs/project/PROJECT_STATE.md
docs/project/FIX_BACKLOG.md
docs/project/PHASE_1_FREEZE.md
docs/project/CHECKPOINT_20260528_SANDBOX_MVP_ENGINE.md
docs/project/GPT_WORKFLOW.md
docs/project/GLM_EXECUTOR_RULES.md
```

Do not start implementation directly. Follow the audit sequence.
