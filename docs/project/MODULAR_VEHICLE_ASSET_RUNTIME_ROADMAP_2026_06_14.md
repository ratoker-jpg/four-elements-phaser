# MODULAR_VEHICLE_ASSET_RUNTIME_ROADMAP_2026_06_14.md

Status: active roadmap draft for owner review  
Project: Four Elements Phaser  
Direction: cleanup + modular vehicle asset runtime  
Updated: 2026-06-14

---

## Purpose

This roadmap defines the next direction before any modular cyan vehicle assets are integrated into game runtime.

The project has accumulated stale docs, old asset paths, old generated asset formulas, and partially obsolete experimental vehicle integration work. Adding new assets on top of that would create more debt.

This roadmap therefore combines:

```text
1. AI/tooling governance;
2. docs/source-of-truth cleanup;
3. asset/runtime legacy inventory;
4. modular hull+turret runtime integration;
5. Arena/debug UX discipline.
```

---

## Accepted strategic direction

Use modular runtime assembly:

```text
hull sprite separately
+
turret sprite separately
+
socket/pivot metadata
=
vehicle rendered in Phaser
```

Runtime composition principle:

```text
1. draw hull sprite;
2. read hull socket from metadata for hull dir;
3. draw turret sprite;
4. set turret origin to its pivot from metadata;
5. place turret pivot exactly on hull socket;
6. allow turret dir to differ from hull dir later.
```

---

## Rejected direction

Do not use a production combined matrix:

```text
hull x turret x faction x hullMod x turretMod x dirs
```

Reason:

```text
- explodes asset count with independent body/turret modifications;
- makes turret-independent rotation harder;
- bloats repo/artifacts;
- encourages preloading too much;
- hides socket/pivot correctness inside baked images.
```

Combined renders may remain QA references only.

---

## Existing local staging facts

Local staging exists outside this repo:

```text
D:\Desktop\Модели\game_asset_staging\modular_cyan_v1\
```

Known facts from packaging report:

```text
hull sets: 28 / 28
hull PNGs: 448 / 448
turret sets: 40 / 40
turret PNGs: 640 / 640
total runtime PNGs: 1088 / 1088
warnings: 0
```

This repo must not import the full staging package until cleanup, loader, renderer, and lazy-loading strategy are accepted.

---

## First principle: cleanup before integration

Do not integrate final/modular assets into a stale architecture layer.

Before importing broad assets, identify:

```text
- active asset folders;
- obsolete asset folders;
- current generated hull registry format;
- older Wasp+Smoky / turret experiments;
- old manual offset formulas;
- old debug-only render code;
- stale docs that still look active;
- source files that are historical but still imported;
- UI/debug surfaces that should host visual QA.
```

Do not delete broad folders by guess. Archive/deprecate only after inventory.

---

## Graphify first

Before broad Opus audit or broad cleanup planning:

```text
1. run GitHub Actions workflow: Graphify Project Graph;
2. download/use graphify-out artifact;
3. feed graph summary/artifact into Opus;
4. require Opus to use graph-first discovery.
```

Do not ask Denis to download the repo locally just to generate project context.

---

## AI execution model for this roadmap

```text
GPT = project lead / task router / PR reviewer / docs keeper
Opus = main architect auditor, complex High+ executor when justified
GLM = High/High+ executor after accepted audit
Codex = read-only local auditor for Denis's computer-only assets/files
```

We do not create tiny steps for the sake of process.

We also do not skip audit when the work is cross-system cleanup/runtime integration.

Preferred model:

```text
roadmap doc-only PR
-> Graphify artifact
-> one broad Opus audit committed to repo
-> High/High+ GLM or Opus implementation tasks from that audit
```

---

## UX policy: no URL flag sprawl

Do not add new query-string flags for every visual asset test.

Use existing surfaces:

```text
- Standard menu path;
- Debug / Отладка;
- Arena / Арена;
- ArenaMenu;
- Arena debug/inspection panels.
```

Query flags can be used for automation/smoke shortcuts only. They are not final manual QA UX.

If modular vehicle controls are needed, add them inside Arena/debug UI, not as new URL-mode branches.

---

## Roadmap steps

## GRAPHIFY-00 — Remote project graph workflow

Type: docs/tooling  
Risk: low  
Owner: GPT docs-only PR

Goal:

```text
Add GitHub Actions workflow and rules so Graphify runs in GitHub and produces artifacts for Opus/GLM/GPT.
```

Allowed:

```text
.github/workflows/graphify.yml
docs/project/AI_GRAPHIFY_WORKFLOW.md
docs/project/AI_ORCHESTRATION_RULES_2026_06_14.md
docs/project/GPT_PROJECT_LEAD_INSTRUCTIONS.md
docs/project/OPUS_ARCHITECT_AUDIT_RULES.md
docs/project/CODEX_LOCAL_AUDITOR_RULES.md
AGENTS.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/GLM_EXECUTOR_RULES.md
README.md
```

Forbidden:

```text
- game runtime changes;
- asset import;
- renderer changes;
- package.json dependency changes;
- Graphify output committed to repo.
```

---

## ROADMAP-00 — Accept modular runtime + cleanup direction

Type: docs-only  
Risk: low  
Owner: GPT/Denis

Goal:

```text
Accept this roadmap as the active direction before code/assets integration.
```

Output:

```text
docs/project/MODULAR_VEHICLE_ASSET_RUNTIME_ROADMAP_2026_06_14.md
```

---

## OPUS-AUDIT-00 — Full cleanup + modular runtime system audit

Type: audit/design  
Risk: high+  
Owner: Opus  
Input: Graphify artifact + active roadmap

Goal:

```text
Produce one durable system audit that describes how to clean stale docs/source/assets and integrate modular vehicle runtime correctly.
```

Audit must answer:

```text
- active vs legacy asset paths;
- active vs legacy generated asset registries;
- current renderer ownership;
- current Arena body/weapon/mod/faction flow;
- old Wasp/Smoky/manual offset paths to remove or archive;
- exact cleanup candidates;
- exact files/functions for runtime integration;
- loader/lazy-loading architecture;
- metadata schema decision;
- renderer composition plan;
- fallback behavior;
- Arena/debug UX plan without URL sprawl;
- implementation steps and which executor should handle each;
- validation and manual QA plan.
```

Expected committed output:

```text
docs/project/MODULAR_VEHICLE_ASSET_RUNTIME_SYSTEM_AUDIT_2026_06_14.md
```

No code/assets in the audit PR unless explicitly approved as docs-only.

---

## CLEANUP-01H+ — Source-of-truth docs cleanup

Type: implementation/docs  
Risk: high  
Executor: GLM or Opus depending on audit complexity

Goal:

```text
Make active docs clear and move stale docs out of active path.
```

Expected work:

```text
- update active reading lists;
- mark closed docs as historical;
- archive unused docs;
- remove obsolete `Жду Делай` style instructions from active docs;
- update README pointers;
- keep one authoritative GPT/GLM/Opus/Codex rule set.
```

Do not delete large historical docs without audit-backed inventory.

---

## CLEANUP-02H+ — Legacy asset/runtime inventory cleanup

Type: implementation  
Risk: high+  
Executor: GLM if audit boundaries are strict; Opus if refactor is too cohesive

Goal:

```text
Deprecate/archive/remove stale runtime asset paths and old formulas that would conflict with modular vehicle runtime.
```

Possible targets, subject to Opus audit:

```text
- legacy Wasp+Smoky-only asset pathing;
- old generatedHullAssets format mismatch;
- old manual socket/offset formulas;
- unused modularUnitAssets remnants;
- debug-only renderer branches that should move into Arena/debug UI.
```

No broad deletion without reference checks.

---

## RUNTIME-01H+ — Modular asset resolver and metadata contract

Type: implementation  
Risk: high+  
Executor: GLM if audit is precise; Opus if schema refactor is broad

Goal:

```text
Add pure TypeScript resolver/metadata layer for modular vehicle assets without importing heavy assets yet.
```

Expected:

```text
- bodyId -> hull asset id;
- weaponId -> turret asset id;
- modification levels -> m0..m3;
- dir mapping -> 16 directions;
- texture key builders;
- asset path builders;
- metadata shape adapters;
- fallback reason model;
- tests.
```

No renderer wiring yet unless Opus audit says it is safer as one cohesive step.

---

## RUNTIME-02H+ — Tiny pilot asset import + lazy loading

Type: implementation/assets/runtime  
Risk: high+  
Executor: GLM or Opus based on audit

Goal:

```text
Import a tiny pilot only, prove lazy loading and resolver pathing.
```

Preferred pilot:

```text
wasp + smoky
cyan
selected mods only or one minimal test set accepted by audit
```

Do not import all 1088 PNG first.

Do not preload all assets.

---

## RUNTIME-03H+ — Renderer composition in Arena/debug UI

Type: implementation/rendering  
Risk: high+  
Executor: Opus if cohesive renderer refactor; GLM if audit isolates changes safely

Goal:

```text
Render hull sprite + turret sprite with turret pivot aligned to hull socket.
```

Rules:

```text
- Arena/debug UI only first;
- no new URL flag sprawl;
- blockout fallback if missing asset/metadata/faction/weapon;
- preserve selection rings, HP labels, target-lock visuals, and depth rules;
- no combat/movement/economy/mapgen/save-load changes unless explicitly scoped.
```

---

## RUNTIME-04H+ — Full cyan modular asset import

Type: implementation/assets  
Risk: high+  
Executor: GLM if path is proven; Opus if packaging/refactor remains coupled

Goal:

```text
Import full cyan modular runtime assets only after pilot and renderer QA pass.
```

Scope:

```text
448 hull PNG
640 turret PNG
1088 runtime PNG total
metadata/manifest/generated TS draft as accepted by audit
```

Hard rule:

```text
still no startup preload of all 1088 PNG.
```

---

## RUNTIME-05H+ — Broaden Arena modular vehicle QA

Type: implementation/UI/debug  
Risk: high  
Executor: GLM after audit

Goal:

```text
Expose modular vehicle visual QA inside Arena/debug UI.
```

Expected:

```text
- choose body;
- choose weapon;
- choose hull mod;
- choose turret mod;
- choose cyan only unless more factions exist;
- show loaded/fallback status;
- no new URL flags.
```

---

## Deferred

```text
- all factions;
- production game integration outside Arena;
- independent upgrade gameplay UI;
- final balance;
- saving modular visual selections;
- full asset deletion after migration;
- non-cyan recolor/export.
```

---

## Stop rules

Stop if an implementation task proposes:

```text
- combined hull x turret matrix;
- importing 1GB of assets before loader/renderer proof;
- startup preload of broad assets;
- new URL debug modes instead of Arena/debug UI;
- manual per-PNG offset tuning as source of truth;
- source cleanup by guessing instead of reference inventory;
- continuing PR #263 or old Wasp socket work by inertia;
- changing combat/movement/economy/mapgen/save-load during asset runtime cleanup.
```
