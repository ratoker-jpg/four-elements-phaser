# CURRENT_NEXT_STEP.md

Status: BLOCKOUT-01 audit complete / awaiting owner review before BLOCKOUT-02  
Project: Four Elements Phaser  
Date: 2026-06-01

---

## Why this file exists

This short checkpoint prevents confusion about the current operational workstream.

Use `PROJECT_STATE.md` as the primary operational source of truth.

This file answers one question:

```text
What should GPT/GLM/Codex do next by default?
```

Current answer:

```text
Review BLOCKOUT-01 Huge Roadmap Audit (docs/project/BLOCKOUT_01_HUGE_ROADMAP_AUDIT.md).
If audit is accepted, proceed to BLOCKOUT-02 config skeleton.
Do not start implementation until audit is reviewed.
```

---

## Current next step

```text
BLOCKOUT-01 audit is complete.
Awaiting owner/GPT review of docs/project/BLOCKOUT_01_HUGE_ROADMAP_AUDIT.md.
After review, first implementation PR is BLOCKOUT-02 (config skeleton only).
```

Mode:

```text
AUDIT COMPLETE — DOCS-ONLY PR
No runtime code changes.
No implementation until audit is reviewed.
```

The audit exists to inspect the current repo and convert `BLOCKOUT_MVP_ROADMAP.md` into a safe scoped implementation sequence.

---

## Current roadmap state

```text
VISUAL/UI roadmap slice: CLOSED
Current active planning direction: BLOCKOUT-MVP
Current implementation task: NONE (audit complete, awaiting review)
Next action: review BLOCKOUT-01 audit, then start BLOCKOUT-02
```

Roadmap document:

```text
docs/project/BLOCKOUT_MVP_ROADMAP.md
```

Previous closure document:

```text
docs/project/ROADMAP_CLOSURE_2026_06_01_VISUAL_UI.md
```

---

## BLOCKOUT-MVP goal

The new roadmap direction is:

```text
Vehicle / Combat / Upgrade Skeleton before final art.
```

The working model:

```text
reference → contract → blockout → audit → scoped implementation → validation → final assets later
```

Core rule:

```text
Do not make it beautiful before it is clear what exactly must become beautiful.
```

---

## What BLOCKOUT-MVP is about

The roadmap focuses on Phaser/blockout placeholders for:

```text
- vehicle bodies
- body-specific turret mount points
- independent turret rotation
- semi-physics vehicle movement feel
- recoil
- weapon behavior families
- primitive VFX placeholders
- direct/splash/penetration/status damage placeholders
- obstacle blockers
- upgrade skeleton
- combat readability sandbox
```

This is not a final-art roadmap.

---

## What is explicitly NOT active

Do not start these by default:

```text
- final tank asset integration
- deleting current/legacy tank assets
- mass asset generation
- full combat system
- enemy AI/bots
- attack waves
- save schema rewrite
- economy expansion
- map size migration
- fog of war
- full upgrade shop UI
- broad renderer refactor
```

---

## Required next audit questions

The BLOCKOUT-01 audit must answer:

```text
1. Where current unit rendering lives.
2. Where current unit/tank data lives.
3. How to add blockout vehicle renderer behind a flag or dev route.
4. Whether a separate scene/dev route is safer than production wiring.
5. How to avoid save/load breakage.
6. How to avoid economy/mapgen/resource changes.
7. Exact files/functions to touch.
8. Exact forbidden files/functions.
9. Test plan.
10. Rollback plan.
11. Smallest safe first code PR after the audit.
```

The audit must end with:

```text
Жду Делай
```

---

## Closed roadmap summary

The previous VISUAL/UI roadmap remains closed.

Completed:

```text
VISUAL-05A — Production industrial map integration — DONE
VISUAL-06 — Resource model/assets/wiring/rendering — DONE
UI-01 — Main menu polish — DONE
UI-02 — New Game setup polish — DONE
UI-03 — ESC menu polish — DONE
UI-04 — Save/Continue flow polish — DONE
HUD-01 — Playtest HUD readability polish — DONE
```

Do not continue the old VISUAL/UI queue by inertia.

---

## Read before doing anything

```text
docs/project/BLOCKOUT_MVP_ROADMAP.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/GLM_EXECUTOR_RULES.md
docs/project/ROADMAP_CLOSURE_2026_06_01_VISUAL_UI.md
```

---

## Short handoff

```text
We are working in ratoker-jpg/four-elements-phaser.
The VISUAL/UI roadmap is closed after PR #144-#162.
The new active planning direction is BLOCKOUT-MVP: vehicle/combat/upgrade skeleton before final art.
BLOCKOUT-01 huge roadmap audit is complete (docs/project/BLOCKOUT_01_HUGE_ROADMAP_AUDIT.md).
Awaiting owner/GPT review before starting BLOCKOUT-02 config skeleton.
```
