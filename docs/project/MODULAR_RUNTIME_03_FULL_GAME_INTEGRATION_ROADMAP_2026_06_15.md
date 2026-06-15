# MODULAR_RUNTIME_03_FULL_GAME_INTEGRATION_ROADMAP_2026_06_15

Status: proposed roadmap for owner review  
Project: Four Elements Phaser  
Direction: modular hull/turret integration into game modes  
Updated: 2026-06-15

---

## Purpose

This roadmap replaces the previous drift toward many small visual/runtime steps with one simpler operating model:

```text
roadmap doc-only PR
-> one broad Opus audit/design
-> one High/High+ GLM implementation plan from that audit
```

The goal is not to keep splitting work into process theater. The goal is to use the accepted modular vehicle runtime to put real hulls and turrets into the actual game modes safely.

---

## Current accepted baseline

Already accepted / merged before this roadmap:

```text
- modular vehicle runtime uses hull sprite + turret sprite + socket/pivot metadata;
- combined hull x turret production matrix is rejected;
- all-factions modular assets are imported;
- modular hull texture keys use modular_hull_* and do not collide with legacy generated_hull_* keys;
- Modular Vehicle devtools preview supports all factions;
- Dictator has hull-only visual scale compensation 1.09;
- Modular Vehicle preview has calibration controls and a tile overlay.
```

The current preview/calibration surface is a measuring tool. It is not the final gameplay integration.

---

## Owner hypothesis: three turret mount slots

Preview calibration exposed that hulls are not all the same from the turret mounting perspective. The production model should not become one-off X/Y offsets per hull unless proven necessary.

Owner-approved working hypothesis:

```text
hull -> mountSlot
mountSlot -> shared mount behavior / offset preset
```

Initial slot grouping:

| mountSlot | hulls | meaning |
|---|---|---|
| `front` | `mammoth`, `titan` | turret mount sits toward the front of the hull |
| `center` | `viking`, `hunter`, `hornet` | turret mount sits near the center of the hull |
| `rear` | `wasp`, `dictator` | turret mount sits toward the rear of the hull |

This is a roadmap hypothesis, not a request to hardcode blind offsets without audit. Opus must validate whether this should be implemented as:

```text
- metadata-side socket selection;
- runtime mount slot offset;
- devtools-only calibration preset;
- generated metadata correction;
- or a mixed approach.
```

---

## Target: full modular vehicle rendering in three modes

The next runtime direction is to add modular hulls and turrets into all relevant game surfaces, not only the preview overlay.

The three target surfaces/modes must be confirmed by audit, but current owner terminology means:

```text
1. Modular Vehicle Preview / calibration surface;
2. Arena Devtools / controlled demo unit surface;
3. Normal Arena / game runtime unit rendering surface.
```

If the codebase names these differently, Opus must map the exact files/scenes/systems before GLM implementation.

---

## Roadmap sequence

### STEP 0 — ROADMAP-03-DOCS

Type: docs-only  
Owner: GPT  
Risk: low

Goal:

```text
Create this roadmap and make it the current source of truth for the next modular vehicle phase.
```

Output:

```text
docs/project/MODULAR_RUNTIME_03_FULL_GAME_INTEGRATION_ROADMAP_2026_06_15.md
```

Forbidden:

```text
- runtime code changes;
- asset changes;
- metadata changes;
- renderer changes;
- gameplay changes.
```

---

### STEP 1 — OPUS-MODULAR-RUNTIME-03-AUDIT

Type: architecture audit/design  
Owner: Opus  
Risk: high+

Goal:

```text
Produce one durable audit/design for mount slots and full modular vehicle rendering across the three game surfaces.
```

Execution mode:

```text
Opus works as orchestrator.
Use cheaper workers/subagents for repo search, graph inspection, file inventory, tests, and runtime tracing.
Opus synthesizes the final design.
```

Inputs:

```text
- this roadmap;
- latest PROJECT_STATE.md;
- latest CURRENT_NEXT_STEP.md;
- Graphify artifact if available;
- CAMERA_PROJECTION_CONTRACT.md;
- current modular runtime files;
- current Arena renderer/unit files;
- current devtools/calibration files.
```

Audit must answer:

```text
1. What exactly are the three target modes/surfaces in code?
2. Which files/classes own current Arena unit visuals?
3. Where should GeneratedModularVehicleRenderer be integrated first?
4. What is the safest guard/fallback strategy?
5. How should bodyId/weaponId/team/mod data map to hullId/turretId/faction/hullMod/turretMod?
6. How should front/center/rear mount slots be represented?
7. Should mount slots alter metadata, runtime socket, or devtools preview only?
8. How does Dictator 1.09 visual scale interact with mount profiles?
9. What tests prove no all-assets preload and no key collision regression?
10. What is the smallest cohesive High/High+ implementation scope for GLM?
```

The audit must not implement code.

Output:

```text
docs/project/MODULAR_RUNTIME_03_FULL_GAME_INTEGRATION_AUDIT_2026_06_15.md
```

The report must end with:

```text
Жду Делай
```

---

### STEP 2 — MODULAR-RUNTIME-03-IMPLEMENTATION

Type: High/High+ implementation  
Owner: GLM by default, Opus only if the audit classifies it above High+  
Risk: high/high+

Goal:

```text
Implement the accepted audit plan without splitting into many tiny PRs unless the audit identifies a real risk boundary.
```

Expected cohesive scope, subject to Opus audit:

```text
- add/validate mountSlot model: front / center / rear;
- apply mount behavior to modular preview and/or runtime composition as designed;
- add controlled Arena demo unit using GeneratedModularVehicleRenderer;
- map existing unit body/weapon/faction/mod data to modular visual data;
- enable modular vehicle rendering in the three accepted surfaces/modes under a safe guard/fallback;
- keep lazy loading; no preload of all modular assets;
- preserve modular_hull_* key namespace;
- preserve Wasp m0 regression fix;
- preserve Dictator 1.09 hull-only visual compensation;
- update tests and docs.
```

Implementation may be one PR if cohesive. Split only if audit says the risk boundary is real, for example:

```text
- mount model is uncertain;
- live Arena renderer integration touches too many unrelated systems;
- fallback behavior needs separate validation;
- CI/build limits require smaller asset/runtime changes.
```

---

## Hard non-goals

Do not do these in this roadmap:

```text
- no combined hull x turret production matrix;
- no all-assets preload;
- no new query-string debug modes;
- no manual zHeight/y-offset hacks as production solution;
- no per-direction pixel tables unless audit proves metadata cannot solve it;
- no gameplay stat changes;
- no collision/hitbox/footprint changes unless a later gameplay roadmap approves it;
- no combat/economy/pathfinding/save-load changes for visual integration;
- no re-enable of failed Wasp/Smoky pilot composition path;
- no legacy generated_hull_* modular key regression.
```

---

## Acceptance criteria

The roadmap is successful when:

```text
- Opus audit is accepted;
- GLM implementation passes validation;
- Modular Vehicle Preview still works;
- controlled Arena demo unit renders with modular hull/turret;
- normal Arena/runtime surface can render modular vehicles through accepted mapping;
- Wasp m0 remains correct;
- Dictator scale compensation remains hull-only;
- mount slots front/center/rear are visible/testable;
- one selected modular vehicle loads max 32 PNG;
- fallback works when an asset is missing;
- no unrelated gameplay systems regress.
```

---

## Manual QA checklist after implementation

```text
1. Preview: switch cyan/green/yellow/purple.
2. Preview: front mount hulls — mammoth/titan.
3. Preview: center mount hulls — viking/hunter/hornet.
4. Preview: rear mount hulls — wasp/dictator.
5. Preview: Wasp m0 + Smoky remains correct.
6. Preview: Dictator + Railgun is not clipped and keeps turret alignment.
7. Arena devtools/demo: controlled modular unit appears on world tile.
8. Normal Arena/runtime: at least one real unit renders through modular path or guarded mapping.
9. Selection rings, labels, HP bars and z-order remain readable.
10. Diagnostics show no full-matrix preload and max 32 queued assets for selected visual.
```

---

## Next instruction for GPT

After this docs PR is merged:

```text
Write the OPUS-MODULAR-RUNTIME-03-AUDIT prompt.
Do not write a GLM implementation task until the Opus audit is accepted.
```
