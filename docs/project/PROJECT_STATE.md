# PROJECT_STATE.md

Status: active operational project state  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Updated: 2026-06-14

---

## Current mode

```text
NO RUNTIME IMPLEMENTATION UNTIL THE NEW CLEANUP + MODULAR VEHICLE ROADMAP/AUDIT IS ACCEPTED.
```

Current direction:

```text
Graphify-first AI workflow
+
documentation/source-of-truth cleanup
+
modular vehicle asset runtime integration planning
```

Closed / accepted cycles:

```text
VISUAL/UI roadmap slice: CLOSED.
BLOCKOUT-MVP roadmap slice: CLOSED.
CAMERA-00 projection contract: IMPLEMENTED / ACCEPTED.
PROJECTION-01 ground-plane retrofit: IMPLEMENTED / ACCEPTED.
Arena Sandbox roadmap/audit cycle: CLOSED after PR #184.
Core Mechanics roadmap/audit cycle: CLOSED after PR #207.
```

Do not continue closed roadmaps by inertia.

---

## Current source-of-truth docs

Read before project work:

```text
AGENTS.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/AI_ORCHESTRATION_RULES_2026_06_14.md
docs/project/AI_GRAPHIFY_WORKFLOW.md
docs/project/MODULAR_VEHICLE_ASSET_RUNTIME_ROADMAP_2026_06_14.md
```

Agent-specific docs:

```text
GPT:   docs/project/GPT_PROJECT_LEAD_INSTRUCTIONS.md
GLM:   docs/project/GLM_EXECUTOR_RULES.md
Opus:  docs/project/OPUS_ARCHITECT_AUDIT_RULES.md
Codex: docs/project/CODEX_LOCAL_AUDITOR_RULES.md
```

For visual/world-space/rendering/asset work:

```text
docs/project/CAMERA_PROJECTION_CONTRACT.md
```

Closed docs are references only, not active queues.

---

## Current Phaser version

```text
4.1.0
```

Always confirm this in `package.json` before Phaser API work.

---

## Current owner-facing state

The project currently has:

```text
- standalone Arena mode;
- ArenaMenu as primary Arena UX;
- manual Arena unit creation: body + weapon + team;
- projected click placement through CAMERA_PROJECTION_CONTRACT.md;
- target-lock turret behavior in Arena;
- accepted weapon runtime mechanics for 10 weapons, excluding Shaft;
- body armor/damage reduction and body/weapon M0-M3 runtime scaling;
- industrial generated map as default for new games;
- core economy/building/movement/combat baseline from closed Core Mechanics work;
- multiple stale/legacy docs and asset/runtime paths that require cleanup before final modular asset integration.
```

---

## Current asset-runtime direction

Accepted model:

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

Reason:

```text
combined matrix explodes with independent hull/turret mods and factions.
```

Known local staging summary outside repo:

```text
448 hull PNG
640 turret PNG
1088 runtime PNG total
warnings 0
```

The full staging package must not be imported before cleanup/loader/renderer strategy is accepted.

---

## Graphify / GitHub-first context rule

Repository-level context building should happen in GitHub, not by asking Denis to download and inspect the repo locally.

Use:

```text
.github/workflows/graphify.yml
```

Generated `graphify-out/**` artifacts are used for broad Opus/GLM/GPT audits.

Do not commit graph output by default.

---

## Active next work

```text
1. Merge/accept docs-only Graphify + AI governance + modular roadmap update.
2. Run Graphify GitHub Actions workflow on the target branch/main.
3. Give Graphify artifact + roadmap to Opus for one broad cleanup + modular runtime system audit.
4. Commit the Opus audit as a durable project doc.
5. Execute High/High+ steps through GLM or Opus according to audit and GPT routing.
```

---

## Stop rules

Do not start implementation if:

```text
- there is no accepted roadmap/audit for the requested direction;
- the task continues a closed roadmap by inertia;
- docs contradict current repo state;
- visual/world-space work ignores CAMERA_PROJECTION_CONTRACT.md;
- task asks for final modular assets without accepted cleanup/runtime plan;
- task proposes combined hull x turret production matrix;
- task proposes preloading all modular assets at startup;
- task adds new URL debug/test modes instead of using Arena/debug UI;
- task asks Denis to do local repo context work that can run in GitHub;
- task turns Codex from read-only local auditor into executor without explicit approval.
```

---

## Working model

```text
GPT = project lead / router / task writer / PR reviewer
GLM = High/High+ executor after accepted audit
Opus = broad architect auditor and complex High+ executor when justified
Codex = read-only local auditor for files/assets unavailable through GitHub
Denis = product owner and merge decision maker
```
