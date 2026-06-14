# Four Elements Phaser

Clean Phaser-first restart of **Four Elements** — browser-playable isometric RTS / civil sandbox.

## Core decisions

```text
Engine: Phaser 4
Runtime: browser / Vite / TypeScript
Renderer: Phaser-first, WebGL-only
Repository: ratoker-jpg/four-elements-phaser
Old repo: ratoker-jpg/four-elements-next is donor/reference/specification only
```

Forbidden as implementation sources:

```text
- old Canvas renderer
- renderer bridge
- legacy GameWorld
- WorldRenderSnapshot
- dual renderer architecture
- unapproved old TypeScript runtime code
```

## Current work model

The project is documentation/roadmap gated.

```text
roadmap -> broad audit/design when needed -> High/High+ implementation steps -> PR review -> merge decision
```

GPT is the project lead/coordinator. GLM, Opus, Codex and browser GPT have separate roles described in the project docs.

## Required reading before project work

Read current source-of-truth docs instead of stale top-level legacy docs:

```text
AGENTS.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/AI_ORCHESTRATION_RULES_2026_06_14.md
docs/project/AI_GRAPHIFY_WORKFLOW.md
docs/project/CAMERA_PROJECTION_CONTRACT.md
```

For agent-specific work:

```text
GPT:   docs/project/GPT_PROJECT_LEAD_INSTRUCTIONS.md
GLM:   docs/project/GLM_EXECUTOR_RULES.md
Opus:  docs/project/OPUS_ARCHITECT_AUDIT_RULES.md
Codex: docs/project/CODEX_LOCAL_AUDITOR_RULES.md
```

## Graphify workflow

Repository-wide AI context should be generated in GitHub, not manually on Denis's machine.

Use the GitHub Actions workflow:

```text
Graphify Project Graph
```

The workflow uploads `graphify-out/**` as an artifact. Do not commit generated graph outputs by default.

## Current direction

As of 2026-06-14, the next direction is:

```text
cleanup + modular vehicle asset runtime
```

Accepted modular runtime model:

```text
hull sprite separately
+
turret sprite separately
+
socket/pivot metadata
```

Rejected model:

```text
combined hull x turret production matrix
```

See:

```text
docs/project/MODULAR_VEHICLE_ASSET_RUNTIME_ROADMAP_2026_06_14.md
```

## Development rule

No implementation PR starts without a current roadmap/audit or explicit accepted task scope.

No new URL debug-mode sprawl. Use Arena/debug UI surfaces for manual visual QA controls.
