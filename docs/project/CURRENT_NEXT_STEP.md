# CURRENT_NEXT_STEP.md

Status: VEHICLE-RENDER-UNIFY-01-VH implementation PR is the active next step
Project: Four Elements Phaser
Updated: 2026-06-17 (docs consistency fixup)

---

## Purpose

This file answers one operational question:

```text
What should GPT/GLM/Opus/Codex do next by default?
```

---

## Active next step (single)

```text
VEHICLE-RENDER-UNIFY-01-VH (implementation, DRAFT PR)
  Status: DRAFT PR pending GPT review + Denis manual QA.
  Combines: Stage 1 (canonical renderer foundation) + Stage 2 (visual
            parity + placement stabilization).
  Does NOT include: Stage 3 (legacy renderer retirement), Stage 4
            (GameScene render orchestration cleanup).
  PR: https://github.com/ratoker-jpg/four-elements-phaser/pull/298
  Branch: vehicle-render-unify-01-vh
  Base: main @ 2665192 (after PR #297 merge)
  Report: docs/project/VEHICLE_RENDER_UNIFY_01_VH_IMPLEMENTATION_REPORT_2026_06_17.md

  Validation:
    - npm run typecheck: PASS
    - npm test: PASS (91 files, 4698 tests, +45 new: 35 from initial commit
      + 10 from fixup commit b551c476 for debugRenderFlags module)
    - npm run build: BLOCKED — ENOSPC environment constraint (not a code defect;
      verified same failure on clean main)
    - npm run qa:smoke: BLOCKED — ENOSPC + Playwright browser missing
      (same as 04A report; not a code defect)

  What changed:
    - Package C: factionResolver.ts — canonical faction resolution,
      no silent ?? 'cyan' default
    - Package D: sticky no-flicker state in ModularVehicleLiveAdapter —
      once modular succeeds, transient texture-missing does not fall back
      to blockout
    - Package E: debug artifacts OFF by default (mount points, labels,
      aim line, direction arrow, turret-to-cursor)
    - Package F: Arena + normal runtime parity through shared adapter contract
    - Package G: 45 new tests (faction flow, sticky, gating, invariants,
      debugRenderFlags module, devtoolsActive=true blocker regression)
    - Package H: this report + CURRENT_NEXT_STEP update

  What was NOT changed:
    - composeModularVehicle() math (placement preserved)
    - MODULAR_VEHICLE_BASE_SCALE = 0.16 (04A source of truth preserved)
    - Dictator +9% hull-only multiplier preserved
    - cameraProjectionContract.ts (unchanged)
    - combat / movement / economy / mapgen / pathfinding / save-load
    - PNG assets / generated metadata / package files
    - Legacy renderers retained as emergency fallback (Stage 3 retirement
      is a separate future PR after QA acceptance)
    - GameScene orchestration unchanged (Stage 4 is a separate future PR)
    - No PR #296 mount-slot / forward-back drift model reused

  GPT review required before merge.
  Denis manual QA required before merge (see report §12).
  PR is DRAFT — do not mark ready until both reviews pass.
```

---

## Previous step (completed)

```text
VEHICLE-RENDER-UNIFY-AUDIT / ROADMAP
  Status: COMPLETED. PR #297 merged on 2026-06-16.
  Docs (now on main):
    - docs/project/VEHICLE_RENDER_UNIFICATION_AUDIT_2026_06_16.md
    - docs/project/VEHICLE_RENDER_UNIFICATION_ROADMAP_2026_06_16.md
  These define the 4-stage roadmap that VEHICLE-RENDER-UNIFY-01-VH
  implements (Stage 1 + Stage 2 only).
```

After approval, the 4-stage High+ roadmap executes in order:

```text
Stage 1 (High+): Canonical renderer foundation — gate debug artifacts,
                  add contract tests. No runtime visual change.
Stage 2 (High+): Visual parity + placement stabilization — remove
                  silent cyan-default, add spawn-grace, fix faction flow.
                  Manual QA gate (Denis signs off).
Stage 3 (High):  Legacy renderer retirement — move BlockoutVehicleRenderer
                  procedural fallback and ModularTankRenderer to legacy/.
                  Remove per-dir offset tables. Gated on Stage 2 acceptance.
Stage 4 (High):  GameScene render orchestration cleanup.
```

See `docs/project/VEHICLE_RENDER_UNIFICATION_ROADMAP_2026_06_16.md` for
the full stage definitions, risk table, manual QA gates, and rollback plan.

---

## Current PR / branch state (verified 2026-06-17)

```text
#298  VEHICLE-RENDER-UNIFY-01-VH: canonical renderer foundation +
      visual parity stabilization
      state: OPEN, DRAFT (not ready for review)
      branch: vehicle-render-unify-01-vh
      base: main @ 2665192 (after PR #297 merge)
      commits: 3 (93f82ec + b551c476 + aac65ee)
      This is the current active PR. Implementation combines Stage 1 + Stage 2.
      Stage 3 (legacy renderer retirement) and Stage 4 (GameScene render
      orchestration cleanup) are NOT started.
      GPT review + Denis manual visual QA required before mark ready / merge.
```

```text
#297  VEHICLE-RENDER-UNIFY-AUDIT: audit and High+ roadmap
      state: CLOSED / MERGED on 2026-06-16 (historical, completed)
      branch: vehicle-render-unify-audit
      Docs-only audit + roadmap PR. Defined the 4-stage roadmap that
      PR #298 implements (Stage 1 + Stage 2 only).
```

---

## Historical PR state (verified via GitHub API on 2026-06-17)

```text
#278  ASSET-IMPORT-01                          — merged / historical
#279  MODULAR-RUNTIME-01                       — merged / historical
#280  ASSET-FIX-02A                            — merged / historical
#281  LEGACY-WASP-CLEANUP-01B                  — merged / historical
#284  WASP-M0-ASSET-FIX-02C                    — merged / historical
#285  MODULAR-RUNTIME-02A                      — merged / historical
#286  ASSET-IMPORT-02A                         — merged / historical
#287  MODULAR-ALL-FACTIONS-01B                 — merged / historical
#288  MODULAR-ALL-FACTIONS-01C                 — merged / historical
#290  OPUS-AUDIT-RUNTIME-03                    — merged / historical
#292  MODULAR-RUNTIME-03A (Arena live adapter) — merged / historical
#293  MODULAR-RUNTIME-03B (normal runtime)     — merged / historical
#295  MODULAR-RUNTIME-04A (default modular +   — merged / historical (current
      scale normalization)                      main baseline after 04A)
#297  VEHICLE-RENDER-UNIFY-AUDIT (audit +      — merged / historical (2026-06-16)
      4-stage roadmap)                          Defined the roadmap PR #298 implements.
#294  MODULAR-RUNTIME-03C1 (proof-harness      — closed / superseded by 04A
      cleanup)                                   (folded into 04A scope)
#296  MODULAR-RUNTIME-04B (unified corrective  — closed / not merged
      refactor)                                  DO NOT reuse its mount-slot
                                                   / forward-back drift model.
                                                   See VEHICLE_RENDER_UNIFICATION
                                                   _AUDIT_2026_06_16.md §8.5
                                                   and §12.1.
```

---

## Still in force (rules)

```text
- Do not continue PR #263 / Wasp+Smoky offset recovery by inertia.
- Do not continue PR #274/#275 failed generated turret composition path.
- Do not re-enable ENABLE_PILOT_GENERATED_TURRET_COMPOSITION.
- Do not preload the full modular matrix.
- Do not use a combined hull×turret production matrix.
- Do not add new query-string visual test modes.
- Do not turn preview calibration offsets into production constants without audit.
- Do not blindly reuse PR #296 mount-slot / forward-back drift model.
- Do not start runtime implementation before GPT/Denis accepts the roadmap.
- Do not touch combat, movement, economy, pathfinding, save-load, bot/AI,
  or mapgen as part of the render unification roadmap.
```

---

## Read first

```text
AGENTS.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/AI_ORCHESTRATION_RULES_2026_06_14.md
docs/project/AI_GRAPHIFY_WORKFLOW.md
docs/project/VEHICLE_RENDER_UNIFICATION_AUDIT_2026_06_16.md
docs/project/VEHICLE_RENDER_UNIFICATION_ROADMAP_2026_06_16.md
```

Agent-specific:

```text
GPT:   docs/project/GPT_PROJECT_LEAD_INSTRUCTIONS.md
GLM:   docs/project/GLM_EXECUTOR_RULES.md
Opus:  docs/project/OPUS_ARCHITECT_AUDIT_RULES.md
Codex: docs/project/CODEX_LOCAL_AUDITOR_RULES.md
```

For visual/world-space/rendering/asset tasks:

```text
docs/project/CAMERA_PROJECTION_CONTRACT.md
```

---

## History / superseded context

The items below are kept for traceability only. They describe the state
before PR #297 and are **superseded** by the VEHICLE-RENDER-UNIFY-AUDIT
roadmap above. Do not act on them as current instructions.

### Superseded: MODULAR-RUNTIME-04A QA acceptance (now historical)

```text
MODULAR-RUNTIME-04A (PR #295) is merged: modular PNG hull+turret is the
DEFAULT runtime renderer in Arena devtools and normal runtime
(ENABLE_MODULAR_VEHICLE_RENDER default = true). Modular vehicle scale
normalized to MODULAR_VEHICLE_BASE_SCALE = 0.16 (preview == live, no
calibration needed). Dead generated-vehicle proof harness removed.
Emergency blockout/legacy fallback retained for loading/missing assets.
Dictator +9% hull-only preserved.

Previous next-step text (superseded):
1. Manual QA acceptance of 04A default modular rendering + scale across
   all hulls/turrets/factions.
2. After QA acceptance: optional retirement of remaining legacy
   Wasp/Smoky pilot fallback once modular default is proven stable.

These items are superseded by VEHICLE-RENDER-UNIFY-AUDIT Stage 1 + Stage 2
manual QA gates. See the active next step at the top of this file.
```

### Superseded: MODULAR-RUNTIME-03 roadmap/audit sequence

```text
Previous required sequence:
1. ROADMAP-03-DOCS — MODULAR_RUNTIME_03_FULL_GAME_INTEGRATION_ROADMAP_2026_06_15.md
2. OPUS-MODULAR-RUNTIME-03-AUDIT — MODULAR_RUNTIME_03_FULL_GAME_INTEGRATION_AUDIT_2026_06_15.md
3. High/High+ implementation — GLM bounded implementation

Status: COMPLETED. PRs #292, #293, #295 merged. The 03 roadmap/audit
cycle is closed. Do not continue it by inertia.
```

### Superseded: previous current-priority text

```text
Simplify the next phase:
roadmap doc-only PR -> one broad Opus audit/design -> High/High+ GLM implementation.

Reason (historical):
The previous tactical work fixed assets, key collisions, all-factions preview,
Dictator scale and preview calibration.
The next request is larger: add modular hulls/turrets to all relevant game modes.
That needs one cohesive audit/design, not another chain of tiny speculative tasks.

Status: superseded by VEHICLE-RENDER-UNIFY-AUDIT. The "add modular hulls/turrets
to all relevant game modes" goal is now scoped through the 4-stage roadmap.
```

---

## Validation baseline for future implementation PRs

Use when implementation starts (after roadmap approval):

```bash
npm run typecheck
npm run test
npm run build
npm run qa:smoke
```

If a command cannot run, report why. Do not claim validation passed if it did not run.
