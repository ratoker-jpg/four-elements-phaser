# PROJECT_STATE.md

Status: operational project state
Project: Four Elements Phaser
Repo: `ratoker-jpg/four-elements-phaser`

---

## Current mode

Sandbox MVP engine/foundation roadmap complete through PR #92.

Phase 1 Foundation freeze remains active. All Sandbox MVP stability work (FIX-01 through PHASER4-GPU-01) is merged.

Next work: ARCH-11A — QA smoke automation / Sandbox MVP regression coverage.

---

## Current Phaser version

```text
4.1.0
```

---

## Completed Sandbox MVP engine roadmap (PR #83–#92)

| PR | Task | What changed |
|----|------|--------------|
| #83 | FIX-01 | Wired faction-specific HQ and harvester asset keys; non-cyan factions now display correct visuals |
| #84 | PHASER4-ANIM-01 | Animation Manager spike; confirmed Phaser 4.1.0 API works with current spritesheet layout; recommended harvester-first migration |
| #85 | PHASER4-ANIM-02 | Migrated harvester walk cycle from manual frame indexing to Phaser Animation Manager |
| #86 | ARCH-18A-LITE | Extracted GameInputController from GameScene; input/command dispatch now in dedicated module |
| #87 | FIX-02 | Added harvester blocked-reason telemetry and idle-state visual feedback |
| #88 | FIX-03 | Added ControlState with unit cap; cap display in HUD |
| #89 | FIX-04 | Added factory spawn blockage UI feedback + cancel button for factory queue |
| #90 | PHASER4-LOAD-01 | Conditional asset loading spike; recommended dev/arena-only modularUnits loading |
| #91 | PHASER4-LOAD-02 | Gated modularUnits loading behind devtools/arena; stripped modular-combat from old saves in standard mode |
| #92 | PHASER4-GPU-01 | GPU layer spike; TilemapGPULayer incompatible (orthographic only); SpriteGPULayer incompatible (no per-member depth); recommendation: no GPU implementation now |

---

## Current Sandbox MVP status

- Civil loop stabilized: gather, convert, build, spawn
- Faction assets wired for HQ, harvester, builder, buildings
- Harvester animation migrated to Animation Manager
- Input/command extracted from GameScene into GameInputController
- Harvester blocked-reason feedback exists
- Unit cap / ControlState enforced
- Factory spawn blockage feedback + cancel exists
- Modular combat assets are devtools/arena-only (`?devtools=1` / `?arena=1`)
- GPU layers rejected/postponed: isometric depth constraints block both TilemapGPULayer and SpriteGPULayer

---

## Next step

ARCH-11A — QA smoke automation / Sandbox MVP regression coverage.

Purpose: Strengthen automated coverage for the features shipped in PR #83–#92 before moving to post-Sandbox work.

Coverage targets:

- new game start
- faction selection
- harvester movement and animation
- harvester blocked status
- factory production
- unit cap
- factory cancel
- standard mode: modularUnits skipped
- devtools/arena mode: modularUnits enabled
- no console errors

---

## Source-of-truth docs

```text
docs/project/PHASER4_AUDIT_CLARIFICATION_RETRY.md  — corrected audit (source-of-truth)
docs/project/PHASE_1_FREEZE.md                      — active freeze checkpoint
docs/project/FIX_BACKLOG.md                         — known issues and parked items
docs/project/NEW_CHAT_HANDOFF.md                    — new chat handoff protocol
docs/project/CHECKPOINT_20260528_SANDBOX_MVP_ENGINE.md — this checkpoint
```

---

## Hard stop

Do not start:

- combat system code;
- enemy AI code;
- bot code;
- upgrades;
- progression;
- faction-aware loading (premature);
- asset unloading (premature);
- SpriteGPULayer / TilemapGPULayer implementation (rejected by spike);
- command relay economy expansion;
- refund economy;
- full UI redesign;
- random / unscoped implementation work.

---

## Maintenance policy

This file should stay short.

It may be updated after important PRs or direction changes.

Small updates to this file do not always require a dedicated docs-only PR if they are part of a related documentation update.

Detailed history belongs in:

- PR bodies;
- roadmap docs;
- audit docs;
- architecture docs.
