# ROADMAP.md

Status: **inactive / archived — superseded by VISUAL roadmap**  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Archived on: 2026-05-26 (Phase 1 freeze)  
Superseded on: 2026-05-30 (VISUAL roadmap)

---

## 0. Current status

This roadmap is no longer the active implementation roadmap.

**The active roadmap is now:** `docs/project/VISUAL_ROADMAP.md`

Previous milestones:

1. The old 21-ARCH roadmap was archived after Phase 1 Foundation freeze (2026-05-27).
2. The Phase 2 roadmap (`PHASE_2_ROADMAP.md`) was the active direction through PR #98–#119, but has been superseded by the VISUAL roadmap as of 2026-05-30.
3. The VISUAL roadmap (`VISUAL_ROADMAP.md`) is now the active planning direction.

Do not use any of the old roadmap documents as active task sources. Read them only as historical reference.

---

## 1. Active planning source

Use this instead:

```text
docs/project/VISUAL_ROADMAP.md — current active roadmap
docs/project/PROJECT_STATE.md — current operational state
docs/project/CURRENT_NEXT_STEP.md — current next step
```

---

## 2. What is explicitly parked

Do not schedule these as immediate next work until the new Sandbox MVP audit accepts them:

```text
- enemy AI / bot;
- enemy economy;
- attack waves;
- full combat system;
- upgrades / progression / balance progression;
- map editor;
- large new gameplay systems.
```

---

## 3. What remains relevant from the legacy roadmap

Some legacy roadmap ideas are still useful as reference material, but not as automatic task approval:

```text
- civil loop before combat;
- system-first workflow;
- asset pipeline/reference diagnostics;
- movement/VFX polish ideas;
- devtools/arena/testing approach;
- save/load/UI shell direction.
```

Any reused idea must be reintroduced through the new Sandbox MVP audit/roadmap.

---

## 4. Immediate next step

No new implementation ARCH should be started immediately after this freeze.

Next step:

```text
Create Sandbox MVP audit/roadmap based on current playable state and known fix backlog.
```

The audit should group fixes into larger coherent packages and define the exact Sandbox MVP exit criteria.
