# CURRENT_NEXT_STEP.md

Status: RTS-FND-P1 — Validation Baseline Closure Pack
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
Phase 1 (Validation Baseline / Red Gates) code red gates resolved.
Phase 2+ is BLOCKED until PR #324 is merged.
CI confirmed: build PASS, qa-smoke PASS, Graphify PASS (GitHub Actions run 27917869231).
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
#323 RTS-FND-P1A source-of-truth docs + baseline status → MERGED
```

---

## Active next step

```text
RTS-FND-P1 — Validation Baseline Closure Pack
  Size: Very High
  Type: implementation + docs closure
  Goal: Close Phase 1 by resolving all code red gates and updating source-of-truth docs.
  Status: IN REVIEW via PR #324. Code red gates resolved. Build/smoke confirmed green in CI. After merge, Phase 1 is CLOSED and next default step is Phase 2.
```

Phase 1 closure pack (one Very High PR, not separate micro-PRs):

```text
P1A — Source-of-truth docs + validation baseline status [DONE via PR #323]

P1B — Command alias contract alignment [FIXED in this PR]
  Root cause: SELECTION-CONTROL-GROUPS-05 removed ONE/TWO/THREE legacy aliases
  from source but tests still expected 16 commands. Updated tests to expect 13 (11+2)
  and assert legacy storage aliases are undefined. Number keys 1-9 stay as control groups.
  Key files: src/__tests__/commandRegistry.test.ts, src/__tests__/coreEconomyLoop.test.ts

P1C — qa:smoke Windows-safe launcher [FIXED in this PR]
  Root cause: spawn('npx') without shell:true on Windows where npx is npx.cmd.
  Fixed by adding platform detection: shell:true on Windows (process.platform === 'win32').
  Key files: tools/qa_smoke.mjs

P1D — Combat hit-model failures [FIXED in this PR]
  Root cause: test vehicles defaulted to team='ally'; isSameTeamAlly filter
  correctly removed same-team targets from hit detection. Fixed by setting target
  vehicles to team='enemy' in both blockoutDamage.test.ts and blockoutObstacles.test.ts.
  No combat system bug. All 70+51 tests now pass.
  Key files: src/__tests__/blockoutDamage.test.ts, src/__tests__/blockoutObstacles.test.ts

P1E — Vite advisory maintenance [FIXED in this PR]
  Vite upgraded from 6.4.2 to 6.4.3 (patch version). npm audit now reports 0 vulnerabilities.
  Key files: package.json, package-lock.json

P1F — Phase 1 closure [this PR]
  Final validation pass. All code red gates resolved. Docs updated.
  Remaining: build must be confirmed green in CI/Denis environment.
```

Default behavior:

```text
Do not start Phase 2+ until PR #324 is merged.
Phase 1 is handled as one Very High closure pack, not separate micro-PRs.
```

---

## Validation baseline (updated 2026-06-22 — after fixes)

| Command | Result | Details |
|---------|--------|---------|
| `npm run typecheck` | PASS | tsc --noEmit completed with no errors. |
| `npm test` | PASS (5253/5253) | All 107 test files pass. 0 failures. Previously 28 failures — all fixed. |
| `npm run build` | PASS (CI) | Build confirmed green in GitHub Actions (run 27917869231). Fails with ENOSPC in GLM/Codex local env only (4.7G assets, 9.9G disk). |
| `npm run qa:smoke` | PASS (CI) | qa-smoke confirmed green in GitHub Actions (run 27917869192). Windows spawn fix applied. |
| `npm audit` | PASS | 0 vulnerabilities. Vite upgraded from 6.4.2 to 6.4.3. |
| `git diff --check` | PASS | No whitespace errors. |

Key observations:

```text
- TypeScript type-checking is clean — no type errors.
- All 5253 tests pass — 28 previously failing tests are now fixed.
- Build and qa-smoke confirmed green in GitHub Actions CI. Local ENOSPC is a disk constraint only, not a code defect.
- qa:smoke confirmed green in CI. Windows spawn fix applied and verified in GitHub Actions.
- npm audit is clean — 0 vulnerabilities after Vite 6.4.3 upgrade.
```

---

## What is not next by default

```text
- Do not start Phase 2 (unit factory production) until Phase 1 closure PR is merged.
- Do not continue AoE4 UX polish by inertia after #319.
- Do not start enemy AI without audit/design.
- Do not start economy/progression changes beyond Phase 1 scope.
- Do not start save/load hardening without audit/design.
- Do not reopen #308-#310 as final HUD direction.
- Do not copy AoE4 assets or exact layout.
- Do not assign number keys 1-9 to build commands. They are control groups.
- Do not merge High+ visual PRs without Denis manual visual approval.
- Do not touch #305 inside unrelated roadmap work.
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
