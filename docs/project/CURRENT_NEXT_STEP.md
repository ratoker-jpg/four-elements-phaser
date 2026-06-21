# CURRENT_NEXT_STEP.md

Status: RTS-FND-P1A — Phase 1 Validation Baseline / Red Gates
Project: Four Elements Phaser
Updated: 2026-06-22

---

## Purpose

This file answers one operational question:

```text
What should GPT/GLM/Opus/Codex do next by default?
```

---

## Current baseline

```text
Renderer unification Stage 1-4 is CLOSED.
Arena visual/combat fix PR #304 is MERGED and accepted by Denis manual QA.
AoE4-inspired UX redesign slice is CLOSED after PR #319.
FINAL_RTS_FOUNDATION roadmap + audit is MERGED via PR #322.
Phase 0 (Roadmap/Audit) is CLOSED.
Phase 1 (Validation Baseline / Red Gates) is ACTIVE.
Phase 2+ is BLOCKED until Phase 1 is green or explicitly accepted by Denis.
```

Completed sequence leading to current state:

```text
#307 VISUAL-HUD-AUDIT → MERGED
#308 VISUAL-HUD-CORE-01-HIGHPLUS → MERGED
#309 VISUAL-COMMAND-PANEL-02-HIGHPLUS → MERGED
#310 VISUAL-MINIMAP-03-VERYHIGH → MERGED
#311 VISUAL-AOE4-UX-REDESIGN-ROADMAP-01 → MERGED
#312 HUD-LAYOUT-REBUILD-02-VERYHIGHPLUS → MERGED
#313 COMMAND-CARD-REBUILD-03-VERYHIGHPLUS → MERGED
#314 MINIMAP-INTERACTION-04-VERYHIGHPLUS → MERGED
#315 SELECTION-CONTROL-GROUPS-05-VERYHIGHPLUS → MERGED
#316 FEEDBACK-ALERTS-06-HIGHPLUS → MERGED
#317 FOG-VISION-AUDIT-07-HIGHPLUS-DOCS → MERGED
#318 FOG-VISION-IMPLEMENTATION-08-VERYHIGHPLUS → MERGED
#319 AOE4-UX-POLISH-PASS-09-HIGHPLUS → MERGED
#322 FINAL-RTS-FOUNDATION-ROADMAP-AUDIT-01 → MERGED
```

---

## Active next step

```text
RTS-FND-P1A — Phase 1 source-of-truth docs + validation baseline status
  Size: High+
  Type: docs/status-focused implementation
  Goal: update source-of-truth docs and capture current validation baseline after PR #322 merge.
  Status: IN REVIEW via PR #323; after merge, P1A is DONE and next default step is P1B.
```

Phase 1 sub-step sequence:

```text
P1A — Source-of-truth docs + validation baseline status
  Size: High+
  Type: docs + status capture
  Scope: Update PROJECT_STATE.md, CURRENT_NEXT_STEP.md with Phase 1 active status,
         red gate inventory, validation matrix from fresh command runs.
  Non-goals: no runtime code, no Phase 2, no asset changes.

P1B — Command alias contract alignment
  Size: High+
  Type: implementation
  Scope: Align commandRegistry source and tests on legacy alias policy.
         Source registers 13 MVP commands; tests expect 16 (11 primary + 5 legacy).
         Three storage build legacy aliases are missing from source.
         Decide: restore aliases in source, or update tests to match current source.
  Key files: src/commands/commandRegistry.ts, src/__tests__/commandRegistry.test.ts,
             src/__tests__/coreEconomyLoop.test.ts
  Non-goals: no combat changes, no gameplay changes.

P1C — qa:smoke Windows-safe launcher
  Size: High
  Type: implementation
  Scope: Fix qa_smoke.mjs Windows ENOENT from spawn('npx').
         Use shell: true on Windows or switch to process.execPath / npm exec.
         Document Windows workaround if not fully fixable.
  Key files: tools/qa_smoke.mjs
  Non-goals: no gameplay changes, no dependency changes.

P1D — Combat hit-model failures
  Size: High+
  Type: implementation
  Scope: Fix or explicitly accept 19 blockoutDamage.test.ts failures and
         2 blockoutObstacles.test.ts failures related to hit detection and
         damage application. These are pre-existing and predated AoE4 UX work.
         Hit detection functions return null/empty when tests expect hits.
         Continuous damage (tickContinuousDamage) also fails.
  Key files: src/__tests__/blockoutDamage.test.ts, src/__tests__/blockoutObstacles.test.ts,
             src/state/blockoutDamage.ts
  Non-goals: no combat model rewrite, no new combat features, no architecture refactoring.

P1E — Vite advisory maintenance
  Size: High
  Type: maintenance
  Scope: Upgrade Vite past 6.4.2 to resolve high-severity advisory
         (Windows fs deny bypass / launch-editor NTLMv2 disclosure).
         Run npm audit fix or manual upgrade. Verify build still works.
  Key files: package.json
  Non-goals: no gameplay changes, no feature changes.

P1F — Phase 1 closure
  Size: High
  Type: docs
  Scope: Final Phase 1 validation pass. Confirm all red gates are green or
         explicitly accepted by Denis. Update PROJECT_STATE.md and
         CURRENT_NEXT_STEP.md. Unblock Phase 2 if green.
  Non-goals: no new implementation work.
```

Default behavior:

```text
Do not start Phase 2+ until Phase 1 is green or Denis explicitly accepts.
Execute Phase 1 sub-steps in order: P1A → P1B → P1C → P1D → P1E → P1F.
Each sub-step is a separate PR unless Denis approves combining them.
```

---

## Validation baseline (captured 2026-06-22)

| Command | Result | Details | Next owner PR |
|---------|--------|---------|---------------|
| `npm run typecheck` | PASS | tsc --noEmit completed with no errors. | N/A |
| `npm test` | FAIL (28 tests) | 4 test files: blockoutDamage (19), blockoutObstacles (2), commandRegistry (6), coreEconomyLoop (1). 5225 pass, 28 fail out of 5253 total. | P1B (commandRegistry), P1D (blockoutDamage, blockoutObstacles) |
| `npm run build` | FAIL (ENOSPC) | TypeScript compilation passes. Vite build fails: ENOSPC — no space left on device. public/assets is 4.7G; disk is 9.9G. Build failure appears environment-related (ENOSPC), but CI/Denis environment must confirm successful build. | Infrastructure / not a code bug |
| `npm run qa:smoke` | FAIL (ENOSPC) | qa:smoke runs build first, which fails on ENOSPC. Also fails writing _reports directory. Windows spawn('npx') issue cannot be tested in Linux CI. | P1C (Windows fix), Infrastructure (disk) |
| `npm audit` | FAIL (1 high) | Vite <=6.4.2: launch-editor NTLMv2 disclosure + server.fs.deny bypass on Windows. Fix available via `npm audit fix`. | P1E |
| `git diff --check` | PASS | No whitespace errors. | N/A |

Key observations:

```text
- TypeScript type-checking is clean — no type errors.
- Test failures are concentrated in combat hit-model (19) and command alias contract (7).
- Build failure appears environment-related (ENOSPC), but CI/Denis environment must confirm successful build.
- qa:smoke failure is partially environmental (disk) and partially a Windows-specific bug (spawn npx).
- npm audit has one actionable high-severity item (Vite).
```

---

## What is not next by default

```text
- Do not start Phase 2 (unit factory production) until Phase 1 is green or accepted.
- Do not continue AoE4 UX polish by inertia after #319.
- Do not start enemy AI without audit/design.
- Do not start economy/progression changes beyond Phase 1 scope.
- Do not start save/load hardening without audit/design.
- Do not reopen #308-#310 as final HUD direction.
- Do not copy AoE4 assets or exact layout.
- Do not assign number keys 1-9 to build commands. They are control groups.
- Do not merge High+ visual PRs without Denis manual visual approval.
- Do not touch #305 inside unrelated roadmap work.
- Do not upgrade dependencies outside P1E scope.
- Do not fix combat math outside P1D scope.
- Do not touch modular vehicle runtime in Phase 1.
- Do not touch assets in Phase 1.
```

---

## Required validation for implementation PRs

Minimum:

```text
npm run typecheck
npm test
npm run build
npm run qa:smoke
git diff --check
secret/token scan
GitHub Actions final status
```

If build/Playwright is blocked by disk space in GLM/Codex/Opus environment, report it honestly and check GitHub Actions directly.

---

## Manual QA gates for future visual implementation

```text
- default game mode boots;
- devtools/Arena mode still boots;
- no default debug artifacts;
- no broken modular vehicles;
- no regression to #304 accepted Arena visuals;
- no silent cyan recolor;
- no full modular matrix preload;
- no old Wasp M0 preload;
- z-depth unchanged around units/buildings/resources unless explicitly in scope;
- HUD/minimap/command layout approved by Denis before merge when touched.
```

---

## Still in force

```text
- Do not restore pilotVehicleLazyLoad or old Wasp M0 preload.
- Do not restore pilotTurretComposition.
- Do not restore ModularTankDebugOverlay / offset tuner.
- Do not preload the full modular matrix.
- Do not use a combined hull x turret production matrix.
- Do not add new query-string visual test modes.
- Do not turn preview calibration offsets into production constants without audit.
- Do not blindly reuse PR #296 mount-slot / forward-back drift model.
- Do not touch composeModularVehicle() placement/math without explicit Denis approval.
- Do not rewrite RenderManager/GameScene lifecycle without a concrete bug or accepted audit.
- Do not continue closed roadmaps by inertia.
```

---

## Read first

```text
AGENTS.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/FINAL_RTS_FOUNDATION_ROADMAP_2026_06_22.md
docs/project/FINAL_RTS_FOUNDATION_IMPLEMENTATION_AUDIT_2026_06_22.md
docs/project/CAMERA_PROJECTION_CONTRACT.md
docs/project/GLM_EXECUTOR_RULES.md
```
