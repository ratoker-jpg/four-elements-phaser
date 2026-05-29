# PROJECT_STATE.md

Status: operational project state  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Current phase: VISUAL roadmap — industrial biome visual direction

---

## Current mode

VISUAL roadmap is the active planning direction.

The previous Phase 2 (sand-terrain-focused) roadmap is archived. The current visual direction is an industrial RTS battlefield / mining platform / industrial mineral wasteland.

This pivot happened after:

```text
PR #119 — TERRAIN-02A 256x128 terrain integration (sand pipeline, merged)
PR #120 — MAPLIFE decor (visually rejected, not merged)
VISUAL-ROADMAP-01 — Archive old roadmap and add VISUAL_ROADMAP.md
```

---

## Current Phaser version

```text
4.1.0
```

Always confirm this in `package.json` before planning Phaser API work.

---

## Key decisions

- **Primary biome**: Industrial RTS battlefield / mining platform (not sand desert)
- **Sand terrain**: Paused as primary direction. Sand assets remain in repo as fallback.
- **MAPLIFE #120**: Rejected. Desert decor must not be continued.
- **Map presentation**: Grounded industrial platform with irregular edges and outer world frame
- **Start position**: Lower-left start zone (future change)
- **HUD target**: Bottom bar — minimap left, info center, commands right (StarCraft-inspired)
- **Menu**: Preserve cinematic central composition, update background to industrial

---

## Current source-of-truth docs

Read these before any task:

```text
docs/project/VISUAL_ROADMAP.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/GLM_EXECUTOR_RULES.md
```

Important:

```text
VISUAL_ROADMAP.md is the accepted planning direction.
Implementation requires separate audit/design PR (VISUAL-AUDIT-01) first.
```

---

## Active next work

```text
VISUAL-AUDIT-01 — Visual audit/design (docs only, no runtime)
```

After VISUAL-AUDIT-01:

```text
VISUAL-PROTO-01 — Map direction prototype (visual candidates)
```

Do not start VISUAL implementation before the audit is accepted.

---

## Also needed (from previous Phase 2, rescheduled)

These tasks are still valid and can proceed in parallel with VISUAL phases:

```text
MENU-01 — Main menu mode selection via controlled URL launch
LOADING-01 — Proper loading screen
BASE-ANCHOR-01 — HQ/building grounding and footprint alignment
HOTKEYS-01 — Command registry / hotkey system
BUILDER-ID — Builder stable IDs
FOG-01 — Two-layer fog of war (design + implementation)
ARENA-01 — Arena mode from menu
WEAPON-WORKFLOW-01 — Weapon VFX / recoil design
```

---

## What is paused

```text
TERRAIN-01 / TERRAIN-02 / TERRAIN-FIX-01 — Sand terrain work paused
MAPLIFE-01 — Desert decor rejected, will be re-scoped for industrial
RESOURCE-01 — Deferred to VISUAL Phase V6 after map style approved
UNIT-ANIM-01 / UNIT-ANIM-02 — Deferred to VISUAL Phase V9 after industrial biome established
```

---

## Key constraints

Do not start these as immediate implementation:

```text
- bot / enemy AI
- full combat in main sandbox
- attack waves
- elements economy
- upgrades / progression
- SpriteGPULayer / TilemapGPULayer implementation
- normal maps implementation before feasibility spike
- sand terrain as primary visual direction
- MAPLIFE #120 continuation
- mass image generation in docs PRs
- runtime implementation without accepted audit/design
```

---

## Archived docs

The following documents are archived (read as historical reference only):

```text
docs/project/PHASE_2_ROADMAP.md → deprecated, see VISUAL_ROADMAP.md
docs/project/PHASE_2_ROADMAP_AUDIT.md → deprecated
docs/project/PHASE_2_ROADMAP_AUDIT_PROMPT.md → deprecated
docs/project/TERRAIN_02_QUALITY_AUDIT_AND_PIPELINE.md → paused/superseded
docs/project/MAPLIFE_01_ASSET_READINESS.md → rejected
```

Archived copies: `docs/project/archive/`

---

## Maintenance policy

Keep this file short and operational.

Detailed history belongs in:

- PR bodies
- `VISUAL_ROADMAP.md`
- Audit/design docs for each VISUAL phase
