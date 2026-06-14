# AGENTS.md — Four Elements Phaser

Status: active root agent instructions  
Updated: 2026-06-14

---

## Project identity

```text
repo: ratoker-jpg/four-elements-phaser
engine: Phaser 4
language: TypeScript
build: Vite
renderer: Phaser-first / WebGL-only
camera: fixed isometric / axonometric 2.5D
```

The old repository `ratoker-jpg/four-elements-next` is donor/reference/specification only. Do not copy old runtime implementation by inertia.

---

## Current operating mode

```text
NO CODE WITHOUT ACCEPTED ROADMAP/AUDIT FOR THE DIRECTION.
```

Current active direction:

```text
Graphify-first AI workflow
+
repo/docs/source cleanup
+
modular vehicle asset runtime integration planning
```

The active modular vehicle model is:

```text
hull sprite separately
+
turret sprite separately
+
socket/pivot metadata
```

The rejected production model is:

```text
combined hull x turret production matrix
```

---

## Active source-of-truth docs

Read these first for project work:

```text
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/AI_ORCHESTRATION_RULES_2026_06_14.md
docs/project/AI_GRAPHIFY_WORKFLOW.md
docs/project/MODULAR_VEHICLE_ASSET_RUNTIME_ROADMAP_2026_06_14.md
```

For visual/world-space/rendering/asset work, also read:

```text
docs/project/CAMERA_PROJECTION_CONTRACT.md
```

Agent-specific docs:

```text
GPT:   docs/project/GPT_PROJECT_LEAD_INSTRUCTIONS.md
GLM:   docs/project/GLM_EXECUTOR_RULES.md
Opus:  docs/project/OPUS_ARCHITECT_AUDIT_RULES.md
Codex: docs/project/CODEX_LOCAL_AUDITOR_RULES.md
```

Closed/old roadmap docs are references only. They are not active implementation queues.

---

## Tool roles

```text
GPT   = project lead / task router / PR reviewer / docs keeper
GLM   = High/High+ executor after accepted audit/roadmap
Opus  = system architect, broad auditor, complex High+ executor when justified
Codex = read-only local auditor for Denis's computer-only files/assets
Denis = product owner and merge decision maker
```

Do not swap these roles silently.

---

## Graphify-first rule

For broad repo reasoning, cleanup audits, architecture audits, and High/High+ planning, use the GitHub Actions Graphify artifact first when available.

Workflow:

```text
.github/workflows/graphify.yml
```

Do not commit `graphify-out/` by default.

Do not ask Denis to repeatedly download repo/PRs locally for standard context generation.

---

## Roadmap/audit model

Preferred model:

```text
roadmap with many steps
-> one broad durable Opus audit when needed
-> High/High+ implementation steps
-> PR review
-> docs update
```

Avoid:

```text
1 tiny task -> 1 audit -> 1 tiny task -> 1 audit
```

Do not do audits for theater. Use audits when the system/direction is genuinely broad or risky.

---

## Current modular vehicle constraints

Local staging facts may exist outside the repo:

```text
D:\Desktop\Модели\game_asset_staging\modular_cyan_v1\
```

Known staging summary:

```text
448 hull PNG
640 turret PNG
1088 runtime PNG total
warnings 0
```

Rules:

```text
- do not import the full staging package before cleanup/loader/renderer plan is accepted;
- do not preload all 1088 PNG at startup;
- do not use combined hull x turret production matrix;
- do not manually tune per-PNG offsets as source of truth;
- use socket/pivot metadata;
- integrate visual QA through Arena/debug UI, not new URL flag sprawl.
```

---

## Camera/projection non-negotiables

For every visual/world-space/rendering/asset task, read:

```text
docs/project/CAMERA_PROJECTION_CONTRACT.md
```

Rules:

```text
- fixed isometric / axonometric 2.5D camera;
- not top-down;
- not side-view;
- pan + zoom allowed;
- camera rotation forbidden;
- projection formula: screen = origin + x*basisX + y*basisY + z*basisZ;
- ground markers/rings/shadows/ranges/footprints must be projected onto ground plane;
- no top-down screen circles for ground-space concepts.
```

---

## Arena/debug UX policy

Manual visual QA should use real project surfaces:

```text
Standard
Debug / Отладка
Arena / Арена
ArenaMenu
Arena debug/inspection panels
```

Do not add a new query-string flag for every visual test.

Query flags may exist for automation/smoke/dev shortcuts only. They are not final manual acceptance UX.

---

## GitHub-first rule

Repository-level context, validation, graph generation, and PR review preparation should happen in GitHub workflows/artifacts when possible.

Local machine work is for:

```text
- Blender/export work;
- local-only asset/file audits;
- manual visual QA that cannot run in GitHub;
- explicitly approved emergency reproduction.
```

---

## Strict non-goals unless explicitly scoped

```text
- no combat/movement/economy/mapgen/save-load changes during asset runtime cleanup;
- no PR #263 continuation by inertia;
- no final all-faction asset import;
- no package/runtime dependency for Graphify;
- no hidden temporary architecture expected to be cleaned later;
- no Rex runtime dependencies without separate audit/approval;
- no Canvas renderer;
- no renderer bridge;
- no legacy GameWorld;
- no WorldRenderSnapshot;
- no dual renderer.
```

---

## Documentation hygiene

Active docs must be explicit and few.

Stale docs must be marked closed/historical or archived and removed from required reading lists.

Docs containing obsolete approval phrases such as `Жду Делай` must not be active instructions.
