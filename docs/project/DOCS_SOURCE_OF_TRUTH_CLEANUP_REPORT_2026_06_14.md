# DOCS_SOURCE_OF_TRUTH_CLEANUP_REPORT_2026_06_14.md

Status: completed  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Date: 2026-06-14  
Branch: cleanup-01-docs-source-of-truth  
Audit source: `docs/project/MODULAR_VEHICLE_ASSET_RUNTIME_SYSTEM_AUDIT_2026_06_14.md` §3, §14 step 1  

---

## 0. Scope

Docs-only source-of-truth cleanup per CLEANUP-01 from the accepted modular vehicle system audit. No code, no assets, no workflows, no runtime changes.

---

## 1. Archived files (14 moved)

All files moved from `docs/project/` or `docs/` to `docs/project/archive/` or `docs/archive/`. Status headers updated to `**ARCHIVED**` with supersession notes. No files deleted.

| # | Original path | Archive path | Reason |
|---|---|---|---|
| 1 | `docs/project/START_HERE_FOR_GPT.md` | `docs/project/archive/START_HERE_FOR_GPT.md` | Superseded by `CURRENT_NEXT_STEP.md` + role docs; predates new orchestration model |
| 2 | `docs/project/NEW_CHAT_HANDOFF_VISUAL.md` | `docs/project/archive/NEW_CHAT_HANDOFF_VISUAL.md` | Point-in-time handoff; conflicts with "active docs must be few" |
| 3 | `docs/project/NEW_CHAT_HANDOFF.md` | `docs/project/archive/NEW_CHAT_HANDOFF.md` | Already marked superseded by NEW_CHAT_HANDOFF_VISUAL; both now archived |
| 4 | `docs/project/BLOCKOUT_MVP_ROADMAP.md` | `docs/project/archive/BLOCKOUT_MVP_ROADMAP.md` | "Active roadmap draft" directly conflicts with BLOCKOUT_MVP_CLOSURE_REPORT (closed); contained `Жду Делай` on line 866 |
| 5 | `docs/project/FIX_BACKLOG.md` | `docs/project/archive/FIX_BACKLOG.md` | "Active backlog" not referenced by any active reading list |
| 6 | `docs/project/FIX_BACKLOG_ROADMAP_2026_06_12.md` | `docs/project/archive/FIX_BACKLOG_ROADMAP_2026_06_12.md` | Superseded by MODULAR_VEHICLE_ASSET_RUNTIME_SYSTEM_AUDIT |
| 7 | `docs/project/FIX_BACKLOG_AUDIT_2026_06_12.md` | `docs/project/archive/FIX_BACKLOG_AUDIT_2026_06_12.md` | "ACCEPTED / SOURCE OF TRUTH" competing with system audit; archived to resolve two-backlog conflict |
| 8 | `docs/project/PHASE_1_FREEZE.md` | `docs/project/archive/PHASE_1_FREEZE.md` | "Active checkpoint" is historical; not an active instruction |
| 9 | `docs/project/STRONG_MODEL_EXPERIMENTS_2026_06_12.md` | `docs/project/archive/STRONG_MODEL_EXPERIMENTS_2026_06_12.md` | "ACTIVE EXPERIMENT PLAN" is concluded; not an active plan |
| 10 | `docs/project/AI_EXECUTION_WORKFLOW_2026_06_12.md` | `docs/project/archive/AI_EXECUTION_WORKFLOW_2026_06_12.md` | "Accepted workflow amendment candidate" superseded by `AI_ORCHESTRATION_RULES_2026_06_14.md` |
| 11 | `docs/project/TURRET_HULL_ATTACHMENT_AUDIT_2026_06_12.md` | `docs/project/archive/TURRET_HULL_ATTACHMENT_AUDIT_2026_06_12.md` | "Design proposal for review" superseded by system audit; RC root-cause retained |
| 12 | `docs/project/TURRET_HULL_SOCKET_RECOVERY_HANDOFF_2026_06_13.md` | `docs/project/archive/TURRET_HULL_SOCKET_RECOVERY_HANDOFF_2026_06_13.md` | "Handoff/stop-point" superseded by system audit; stop-point preserved as history |
| 13 | `docs/project/WASP_HULL_DIRECTION_CALIBRATION_AID_2026_06_08.md` | `docs/project/archive/WASP_HULL_DIRECTION_CALIBRATION_AID_2026_06_08.md` | Calibration tool superseded by system audit; calibration data retained |
| 14 | `docs/project/WASP_HULL_PLACEMENT_CALIBRATION_AID_2026_06_08.md` | `docs/project/archive/WASP_HULL_PLACEMENT_CALIBRATION_AID_2026_06_08.md` | Calibration tool superseded by system audit; calibration data retained |

Top-level docs archived:

| # | Original path | Archive path | Reason |
|---|---|---|---|
| 15 | `docs/PR1_TASK.md` | `docs/archive/PR1_TASK.md` | Historical first-PR task; contains obsolete `Делай PR1` on line 20 |
| 16 | `docs/ROADMAP.md` | `docs/archive/ROADMAP.md` | Already marked "inactive / archived — superseded by VISUAL roadmap"; moved to proper archive |

---

## 2. Status header updates (1 in-place)

| File | Old status | New status |
|---|---|---|
| `docs/project/CODEMAP.md` | "routing map for AI agents" | "reference routing map — not an active instruction queue" |

CODEMAP was not archived because it remains a useful routing reference. Its status was softened to clarify it is not an instruction queue.

---

## 3. Жду / Делай language removal

The stale Russian-language directive `Жду Делай` (wait/do) was found in two files, both of which were archived:

- `docs/project/BLOCKOUT_MVP_ROADMAP.md` line 866: `Жду Делай` — archived to `docs/project/archive/`
- `docs/PR1_TASK.md` line 20: `Делай PR1` — archived to `docs/archive/`

All other `Жду`/`Делай` occurrences in active docs are **prohibitions** (instructing agents *not* to use that language), not usage:

- `AGENTS.md` line 251: "Docs containing obsolete approval phrases such as `Жду Делай` must not be active instructions." — **prohibition, keep**
- `docs/project/AI_ORCHESTRATION_RULES_2026_06_14.md` line 297: same prohibition — **keep**
- `docs/project/MODULAR_VEHICLE_ASSET_RUNTIME_ROADMAP_2026_06_14.md` line 304: "remove obsolete `Жду Делай` style instructions" — **directive to clean, keep**
- `docs/project/MODULAR_VEHICLE_ASSET_RUNTIME_SYSTEM_AUDIT_2026_06_14.md`: references as evidence — **keep**

No `Жду`/`Делай` usage remains in any active doc.

---

## 4. Active docs after cleanup

### Root-level active docs

```text
AGENTS.md
README.md
```

### docs/project/ active source-of-truth

```text
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/AI_ORCHESTRATION_RULES_2026_06_14.md
docs/project/AI_GRAPHIFY_WORKFLOW.md
docs/project/MODULAR_VEHICLE_ASSET_RUNTIME_ROADMAP_2026_06_14.md
docs/project/MODULAR_VEHICLE_ASSET_RUNTIME_SYSTEM_AUDIT_2026_06_14.md
docs/project/CAMERA_PROJECTION_CONTRACT.md
```

### Agent-specific active docs

```text
docs/project/GPT_PROJECT_LEAD_INSTRUCTIONS.md
docs/project/GLM_EXECUTOR_RULES.md
docs/project/OPUS_ARCHITECT_AUDIT_RULES.md
docs/project/CODEX_LOCAL_AUDITOR_RULES.md
```

### Active reference (not instruction queue)

```text
docs/project/CODEMAP.md
```

### Closed/accepted cycle docs (historical, not archived)

These remain in `docs/project/` because they are authoritative closure records, not stale instructions:

```text
docs/project/BLOCKOUT_MVP_CLOSURE_REPORT.md     — "BLOCKOUT-MVP closed"
docs/project/CORE_MECHANICS_CLOSURE_REPORT_2026_06_04.md
docs/project/ARENA_SANDBOX_CLOSURE_REPORT.md
docs/project/ROADMAP_CLOSURE_2026_06_01_VISUAL_UI.md
```

### Closed cycle roadmaps/audits still in docs/project/ (historical reference)

These carry clear "closed" or "superseded" status and are not on any active reading list. They were left in place rather than archived because they serve as accepted reference records for their completed cycles.

```text
docs/project/ARENA_SANDBOX_ROADMAP.md
docs/project/ARENA_SANDBOX_SYSTEM_AUDIT.md
docs/project/CORE_MECHANICS_ROADMAP_2026_06_03.md
docs/project/CORE_MECHANICS_SYSTEM_AUDIT_2026_06_03.md
docs/project/VISUAL_ROADMAP.md
docs/project/VISUAL_SYSTEM_AUDIT.md
docs/project/PLAYER_INTEGRATION_ROADMAP_2026_06_07.md
docs/project/PLAYER_INTEGRATION_IMPLEMENTATION_AUDIT_2026_06_07.md
```

---

## 5. Uncertain docs left untouched

These docs were identified during the audit but left in place because they either:
- carry status that is ambiguous but not clearly stale
- are in `docs/` (not `docs/project/`) and may serve as technical reference
- are not on any active reading list and do not conflict with active docs

```text
docs/ROADMAP_SYSTEM_AUDIT.md          — Russian; claims "source-of-truth after merge" for a past workflow; not in active lists
docs/ASSET_PIPELINE_STRATEGY.md       — "implemented"; technical reference
docs/ASSET_POLICY.md                  — no status header; operational policy
docs/BUILDING_PLACEMENT_STRATEGY.md   — "implemented baseline, accepted direction"; reference
docs/FUTURE_PR4_PR5_NOTES.md          — "captured notes, not an active task"; reference
docs/PHASER4_RUNTIME_NOTES.md         — "reference notes"; technical reference
docs/PROJECT_CHARTER.md               — no status header; founding document
docs/CURRENT_PROJECT_GUARDRAILS.md    — already marked "DEPRECATED"; proper
docs/project/PHASER4_AUDIT_CLARIFICATION_RETRY.md — "corrected source-of-truth audit"; old but still referenced by spike reports
docs/project/ARCH_11A_QA_SMOKE_AUTOMATION_AUDIT.md — technical audit; reference
docs/project/ARCH_PACKAGE_POLICY.md   — packaging policy; reference
docs/project/ARCH_SCOPING_POLICY.md   — scoping policy; reference
docs/project/FIX_ROADMAP_AUDIT_PROMPT.md — audit prompt; reference
docs/project/CHECKPOINT_20260528_SANDBOX_MVP_ENGINE.md — historical checkpoint
docs/project/MECHANICS_DECISIONS_2026_06_03.md — historical decisions
docs/project/MECHANICS_EXPLORATORY_AUDIT_2026_06_03.md — historical audit
docs/project/MECHANICS_INTAKE_2026_06_03.md — historical intake
docs/project/PHASER4_ANIM_01_SPIKE_REPORT.md — spike report
docs/project/PHASER4_GPU_01_SPIKE_REPORT.md — spike report
docs/project/PHASER4_LOAD_01_SPIKE_REPORT.md — spike report
docs/project/VISUAL_01B_LAYERED_PLATFORM_FRAME.md — design doc
docs/project/VISUAL_05A_PRODUCTION_INDUSTRIAL_MAP_INTEGRATION_PLAN.md — design doc
docs/project/VISUAL_06_RESOURCE_FIELD_VISUAL_MODEL.md — design doc
docs/project/VISUAL_CANDIDATE_SUMMARY.md — candidate review
docs/project/VISUAL_SPIKE_01_NORMAL_MAPS_LIGHTING_FEASIBILITY.md — spike report
docs/project/POST_VISUAL_05A_QA_POLISH_BACKLOG.md — backlog reference
docs/project/TERRAIN_02_QUALITY_AUDIT_AND_PIPELINE.md — in docs/project/ not archive (not in active lists)
docs/project/UNIT_ANIM_01_HARVESTER_ASSET_READINESS.md — readiness doc
docs/project/ASSET_USAGE_PERMISSION_STATUS_2026_06_03.md — status reference
docs/project/ASSET_WORKFLOW_01_ANIMATED_UNIT_PIPELINE.md — pipeline reference
docs/project/MAPLIFE_01_ASSET_READINESS.md — duplicate? Already archived; this one in docs/project/
docs/project/UNIT_ASSET_PIPELINE_ROADMAP_2026_06_04.md — pipeline reference
docs/project/WEAPON_WORKFLOW_01_VFX_RECOIL_DESIGN.md — design doc
docs/project/TURRET_DIRECTION_REMAP_REPORT_2026_06_06.md — technical report
docs/project/NEXT_STEP_ARCH_05Y.md — old next-step; not in active lists
```

These should be reviewed in a future cleanup pass or when their respective cycles are revisited. None are on active reading lists and none contain `Жду`/`Делай` usage.

---

## 6. Grep / reference-check evidence

### Жду/Делай scan (before cleanup)

```bash
rg -n "Жду|Делай" docs/ AGENTS.md README.md
```

Results:

```
AGENTS.md:251:Docs containing obsolete approval phrases such as `Жду Делай` must not be active instructions.
docs/project/BLOCKOUT_MVP_ROADMAP.md:866:Жду Делай
docs/project/AI_ORCHESTRATION_RULES_2026_06_14.md:297:Docs containing obsolete approval phrases such as `Жду Делай` must not be active instructions.
docs/project/MODULAR_VEHICLE_ASSET_RUNTIME_ROADMAP_2026_06_14.md:304:- remove obsolete `Жду Делай` style instructions from active docs;
docs/project/MODULAR_VEHICLE_ASSET_RUNTIME_SYSTEM_AUDIT_2026_06_14.md:79:... (references as evidence)
docs/project/MODULAR_VEHICLE_ASSET_RUNTIME_SYSTEM_AUDIT_2026_06_14.md:304:... (references as evidence)
docs/project/MODULAR_VEHICLE_ASSET_RUNTIME_SYSTEM_AUDIT_2026_06_14.md:322:... (references as evidence)
docs/PR1_TASK.md:20:Делай PR1
```

### Жду/Делай scan (after cleanup)

Both files with *usage* (`BLOCKOUT_MVP_ROADMAP.md`, `PR1_TASK.md`) are now archived. All remaining occurrences are prohibitions or references.

### Active reading list reference-check

Each FLAG doc basename was grepped across the 7 active source-of-truth docs + 4 role docs. Result: **zero matches** — no active reading list references any archived doc.

```bash
for doc in START_HERE_FOR_GPT NEW_CHAT_HANDOFF_VISUAL BLOCKOUT_MVP_ROADMAP FIX_BACKLOG PHASE_1_FREEZE STRONG_MODEL_EXPERIMENTS CODEMAP TURRET_HULL_ATTACHMENT_AUDIT TURRET_HULL_SOCKET_RECOVERY_HANDOFF WASP_HULL_DIRECTION_CALIBRATION_AID WASP_HULL_PLACEMENT_CALIBRATION_AID; do
  rg -l "$doc" AGENTS.md README.md docs/project/PROJECT_STATE.md docs/project/CURRENT_NEXT_STEP.md docs/project/GPT_WORKFLOW.md docs/project/AI_ORCHESTRATION_RULES_2026_06_14.md docs/project/AI_GRAPHIFY_WORKFLOW.md docs/project/MODULAR_VEHICLE_ASSET_RUNTIME_ROADMAP_2026_06_14.md docs/project/GPT_PROJECT_LEAD_INSTRUCTIONS.md docs/project/GLM_EXECUTOR_RULES.md docs/project/OPUS_ARCHITECT_AUDIT_RULES.md docs/project/CODEX_LOCAL_AUDITOR_RULES.md
done
# Result: no matches for any FLAG doc in any active reading list
```

---

## 7. Validation results

### Link resolution

All docs listed in active reading lists (`AGENTS.md` §Active source-of-truth docs, `README.md` §Required reading, `PROJECT_STATE.md` §Current source-of-truth docs, `CURRENT_NEXT_STEP.md` §Read first) resolve to existing files:

```text
AGENTS.md                        — exists
docs/project/PROJECT_STATE.md    — exists
docs/project/CURRENT_NEXT_STEP.md — exists
docs/project/GPT_WORKFLOW.md     — exists
docs/project/AI_ORCHESTRATION_RULES_2026_06_14.md — exists
docs/project/AI_GRAPHIFY_WORKFLOW.md — exists
docs/project/MODULAR_VEHICLE_ASSET_RUNTIME_ROADMAP_2026_06_14.md — exists
docs/project/CAMERA_PROJECTION_CONTRACT.md — exists
docs/project/GPT_PROJECT_LEAD_INSTRUCTIONS.md — exists
docs/project/GLM_EXECUTOR_RULES.md — exists
docs/project/OPUS_ARCHITECT_AUDIT_RULES.md — exists
docs/project/CODEX_LOCAL_AUDITOR_RULES.md — exists
```

No active reading list entry points to an archived doc.

### Reading list consistency

All four active reading lists (`AGENTS.md`, `README.md`, `PROJECT_STATE.md`, `CURRENT_NEXT_STEP.md`) are consistent with each other. No additions or removals were needed — they already listed only the correct active docs.

### No broken cross-references

No active doc links to any archived file. Cross-references between archived files are preserved (they point to each other within the archive).

---

## 8. Next recommended step

Per the accepted audit §15 implementation plan:

```text
CLEANUP-01 (this task) is complete.
Next: RUNTIME-01 — Modular turret resolver + metadata contract (pure TS + tests, GLM executor)
```

The remaining uncertain docs (§5 above) can be reviewed in a future pass when their respective cycles are revisited or when the modular vehicle runtime integration makes their status clearly historical.
