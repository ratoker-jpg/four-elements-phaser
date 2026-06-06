# CURRENT_NEXT_STEP.md

Status: Hull sprite runtime integration merged — manual visual QA next  
Project: Four Elements Phaser  
Date: 2026-06-06

---

## Purpose

This file answers one operational question:

```text
What should GPT/GLM/Codex do next by default?
```

---

## Current answer

```text
Core Mechanics Roadmap: CLOSED / IMPLEMENTED.
Core Mechanics System Audit: CLOSED / IMPLEMENTED.
Hull sprite asset upload/runtime hook: MERGED after PR #220, PR #221, PR #222.

Default next action:
- Manual QA the merged generated hull sprite integration in Arena.
- If hull visuals are wrong, do a focused fixup for scale/origin/loading only.
- If hull visuals are acceptable, continue with turret sprite pipeline audit/render scripts.
- Do not start broad runtime/gameplay work by inertia.
```

Do not start implementation without explicit Denis/GPT task assignment and either an accepted roadmap/audit or a focused post-merge fixup scope.

---

## Completed implementation checkpoints

```text
STEP 01H+ — COMPLETE
  PR #193 — CORE-STEP-01A: Localization infrastructure and setup flow
  PR #194 — CORE-STEP-01B: Russian UI labels and theme pass
  PR #195 — CORE-STEP-01C: Tooltips and DevTools separation

STEP 02H+ — COMPLETE
  PR #196 — CORE-STEP-02A: Weapon and body config data models
  PR #197 — CORE-STEP-02B: Faction resource and building config data models
  PR #198 — CORE-STEP-02C: Scaling helpers armor formula and config integration tests

STEP 03H+ — COMPLETE
  PR #199 — CORE-STEP-03A: Resource class runtime type and asset mapping
  PR #200 — CORE-STEP-03B: Anchor-based generated resource placement
  PR #202 — CORE-STEP-03C: Resource classes wired into harvesting and validation

STEP 04H+ — COMPLETE
  PR #203 — CORE-STEP-04H: Buildings and Core Economy Loop

STEP 05H+ — COMPLETE
  PR #204 — CORE-STEP-05H+: Unified RTS Controls and Command Routing

STEP 06H+ — COMPLETE
  PR #205 — CORE-STEP-06H+: Movement / Occupancy / Depth Sorting

STEP 07H+ — COMPLETE
  PR #206 — CORE-STEP-07H+: Combat Core / Targeting / Hit Model

STEP 08H+ — COMPLETE
  PR #207 — CORE-STEP-08H+: Weapons / Bodies / M0-M3 / Animation Feel

HULL-ASSET — MERGED
  PR #220 — ASSET: add generated hull sprite matrix
  PR #221 — HULL-ASSET-01: integrate generated hull sprite runtime loader
  PR #222 — HULL-ASSET-01-FIXUP: show generated hull sprites in Arena
```

Closure reports:

```text
docs/project/CORE_MECHANICS_CLOSURE_REPORT_2026_06_04.md
docs/project/ARENA_SANDBOX_CLOSURE_REPORT.md
```

---

## Hull asset state after PR #220/#221/#222

Asset matrix in repo:

```text
public/assets/units/hulls
7 hulls × 4 factions × 4 mods × 16 directions = 1792 PNG
hulls: wasp, hornet, hunter, viking, titan, mammoth, dictator
factions: cyan, green, yellow, purple
mods: m0, m1, m2, m3
directions: dir00_E ... dir15_ENE
```

Runtime state:

```text
- full hull matrix is addressable via `src/assets/generatedHullAssets.ts`
- full matrix is NOT preloaded
- Arena/devtools currently preloads 7 hulls × 2 factions (cyan, green) × m0 = 224 PNG
- PR #222 connected the real Arena renderer path: `BlockoutVehicleRenderer`
- generated hull sprite replaces the blockout body cube when loaded
- turret rendering remains blockout/procedural; generated turret sprites are not integrated yet
```

Manual QA URL:

```text
http://localhost:5173/?devtools=1&arena=1
```

Check:

```text
- generated hull sprites visible instead of cube bodies
- no 404 for `assets/units/hulls/...`
- scale/origin acceptable
- labels/HP bars/selection rings/turret graphics still visible
- no 1792-PNG preload at startup
```

Known risks:

```text
- GENERATED_HULL_SCALE / origin are pilot-tuned and may need visual fixup
- only cyan/green m0 hull sets are preloaded in Arena currently
- non-loaded factions/mods fall back until loading/selection expands
```

---

## Active mode

```text
NO BROAD ACTIVE IMPLEMENTATION ROADMAP.
CORE MECHANICS CYCLE CLOSED.
HULL SPRITE INTEGRATION MERGED; MANUAL QA / FOCUSED FIXUP ONLY.
```

Allowed immediate work:

```text
- manual QA of merged hull sprite integration
- focused hull scale/origin/loading fixup if visual QA fails
- turret sprite pipeline audit/planning
- docs cleanup
- prepare the next roadmap/audit for a new direction
- review existing open PRs, if any
```

Do not start by default:

```text
- more Core Mechanics implementation by inertia
- broad Arena feature work without a new roadmap/audit
- generated turret runtime integration before turret asset audit/render pipeline is accepted
- production visual/world-space work without a new roadmap/audit
- economy/progression/victory systems without a new roadmap/audit
- preloading all generated hull/turret frames at startup
```

---

## Closed roadmap steps

```text
STEP 01H+ — UI / Localization / Start Flow / Faction Display — COMPLETE
STEP 02H+ — Config and Data Model Foundation — COMPLETE
STEP 03H+ — Industrial Map and Resource Layout — COMPLETE
STEP 04H+ — Buildings and Core Economy Loop — COMPLETE
STEP 05H+ — Unified RTS Controls and Command Routing — COMPLETE
STEP 06H+ — Movement / Occupancy / Depth Sorting — COMPLETE
STEP 07H+ — Combat Core / Targeting / Hit Model — COMPLETE
STEP 08H+ — Weapons / Bodies / M0-M3 / Animation Feel — COMPLETE
HULL-ASSET — Generated hull assets uploaded and connected to Arena runtime path — MERGED
```

---

## Recommended next planning options

Pick one direction, then create a roadmap/audit before implementation unless it is a focused fixup:

```text
1. Hull sprite manual QA + focused scale/origin/loading fixup if needed.
2. Turret sprite pipeline audit and Blender batch scripts.
3. Final asset integration roadmap for generated hulls + turrets.
4. Core Mechanics manual QA + polish/fix backlog audit.
5. Normal Game player loop roadmap: onboarding, goals, victory/loss, progression.
6. Arena combat balance/readability roadmap.
```

---

## Validation baseline for future implementation PRs

Future implementation PRs should keep using:

```text
npm run typecheck
npm run test
npm run build
npm run qa:smoke
```

If any command cannot run, the PR body must state why.

---

## Required source docs for future planning

Before new roadmap/task work, read:

```text
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/GLM_EXECUTOR_RULES.md
docs/project/CAMERA_PROJECTION_CONTRACT.md
docs/project/CORE_MECHANICS_CLOSURE_REPORT_2026_06_04.md
docs/project/UNIT_ASSET_PIPELINE_ROADMAP_2026_06_04.md
```

Closed references:

```text
docs/project/MECHANICS_DECISIONS_2026_06_03.md
docs/project/CORE_MECHANICS_ROADMAP_2026_06_03.md
docs/project/CORE_MECHANICS_SYSTEM_AUDIT_2026_06_03.md
```

Closed references are context, not active implementation queues.
