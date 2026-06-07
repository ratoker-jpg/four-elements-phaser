# PHASE_2_ROADMAP_AUDIT_PROMPT.md

> **DEPRECATED — This audit prompt is no longer active.**
> The Phase 2 roadmap direction has been superseded by `docs/project/VISUAL_ROADMAP.md`.
> Archived copy: `docs/project/archive/PHASE_2_ROADMAP_AUDIT_PROMPT.md`
> Do not use this prompt for new audits.

Status: **archived / deprecated**  
Project: Four Elements Phaser  
Target roadmap: `docs/project/PHASE_2_ROADMAP.md`  
Expected audit output: `docs/project/PHASE_2_ROADMAP_AUDIT.md`  
Date: 2026-05-29
Archived on: 2026-05-30

---

## Purpose

Use this prompt after `PHASE_2_ROADMAP.md` is merged.

The goal is to make GLM perform a large, high-quality roadmap audit before Phase 2 implementation starts.

This audit is intended to become the authorization layer for Phase 2 implementation. After the audit is reviewed, fixed if needed, and accepted, implementation tasks covered by that audit can move directly to implementation PRs without a second duplicate audit.

A separate audit/design is only required later if a task goes outside the accepted Phase 2 roadmap audit or exposes a new unreviewed high-risk problem.

---

## Prompt

```text
Task:
PHASE-2-ROADMAP-AUDIT — Playability, visual identity, menu flow, animated assets, terrain, arena roadmap audit

Mode:
AUDIT REPORT ONLY / DOCS ONLY.

Do not edit runtime code.
Do not edit tests.
Do not edit package files.
Do not edit assets.
Do not start implementation.
Do not fix issues during the audit.
Do not update existing project state docs in this PR.

Active repo:
ratoker-jpg/four-elements-phaser

Reference/donor repo:
ratoker-jpg/four-elements-next

Critical repo rule:
four-elements-next is donor/reference only.
Do not treat it as active implementation baseline.
You may inspect it only for comparison/reference where useful.
Do not copy donor implementation blindly.

Before doing anything:
1. Confirm active repo is ratoker-jpg/four-elements-phaser.
2. Confirm package.json has "phaser": "4.1.0".
3. Confirm main includes merged Phase 1 / Sandbox foundation work through PR #95.
4. Confirm docs/project/PHASE_2_ROADMAP.md exists.
5. Read docs/project/PHASE_2_ROADMAP.md.
6. If repo/version/docs/main mismatch, stop and report. Do not continue.

Read first:
- docs/project/START_HERE_FOR_GPT.md
- docs/project/GPT_WORKFLOW.md
- docs/project/GLM_EXECUTOR_RULES.md
- docs/project/PROJECT_STATE.md
- docs/project/NEW_CHAT_HANDOFF.md
- docs/project/CURRENT_NEXT_STEP.md
- docs/project/FIX_BACKLOG.md
- docs/project/PHASE_1_FREEZE.md
- docs/project/CHECKPOINT_20260528_SANDBOX_MVP_ENGINE.md
- docs/project/PHASER4_AUDIT_CLARIFICATION_RETRY.md
- docs/project/PHASER4_ANIM_01_SPIKE_REPORT.md
- docs/project/PHASER4_LOAD_01_SPIKE_REPORT.md
- docs/project/PHASER4_GPU_01_SPIKE_REPORT.md
- docs/project/ARCH_11A_QA_SMOKE_AUTOMATION_AUDIT.md
- docs/project/PHASE_2_ROADMAP.md
- package.json
- README.md
- AGENTS.md, if present

Then inspect broadly:
- src/phaser/*
- src/phaser/render/*
- src/phaser/input/*
- src/phaser/ui/*
- src/state/*
- src/config/*
- src/assets/*
- src/__tests__/*
- tools/*
- tests/*, if present
- index.html
- src/styles.css
- docs/project/*
- docs/* roadmap/audit files if relevant

Context:
Phase 1 created and stabilized the Phaser-first Sandbox MVP foundation.

Recently completed foundation work:
- PR #83 — FIX-01 faction asset wiring
- PR #84 — PHASER4-ANIM-01 Animation Manager spike
- PR #85 — PHASER4-ANIM-02 harvester Animation Manager migration
- PR #86 — ARCH-18A-LITE GameInputController extraction
- PR #87 — FIX-02 harvester idle/blocked status feedback
- PR #88 — FIX-03 Unit Cap / ControlState
- PR #89 — FIX-04 factory spawn blockage feedback + cancel
- PR #90 — PHASER4-LOAD-01 conditional loading spike
- PR #91 — PHASER4-LOAD-02 dev/arena-only modularUnits loading
- PR #92 — PHASER4-GPU-01 GPU layer spike, no implementation recommended
- PR #93 — DOCS-CHECKPOINT-01
- PR #94 — ARCH-11A-AUDIT
- PR #95 — ARCH-11A QA smoke automation

Phase 2 is a roadmap pivot:

From:
engine/foundation stabilization

To:
playability, visual identity, menu flow, animated assets, terrain, arena testbed, and map life.

The current user direction:
- stop over-focusing on technical cleanup;
- make the game feel more like an RTS;
- use one public game link with mode selection in menu;
- make debug/arena selectable inside the game;
- add proper loading screen;
- add hotkeys / command card style controls;
- improve terrain so it does not look like a chessboard;
- add props / doodads / decals / map life;
- regenerate harvesters/builders as animated spritesheets;
- define an asset workflow before creating more chassis/weapons;
- use arena as a combat sandbox later;
- design weapon recoil/projectile/VFX before bot/enemy;
- investigate normal maps / lighting only as a spike;
- keep bot/enemy/combat implementation parked until visuals and arena workflow are ready.

Important workflow rule:
This Phase 2 roadmap audit should be the large planning audit for the entire Phase 2 roadmap.

After this audit is accepted:
- implementation tasks covered by the accepted audit may go directly to implementation;
- high+ tasks do not need a duplicate second audit if the accepted Phase 2 audit already covers them;
- a separate audit/design is required only if a future task exceeds the accepted audit scope or exposes new unknown risks.

Audit goal:
Create a full source-of-truth audit for `PHASE_2_ROADMAP.md`.

The audit must answer:
1. Is the Phase 2 roadmap direction correct?
2. Is the task order correct?
3. Which tasks can go directly to implementation after this audit is accepted?
4. Which tasks still require a dedicated mini-design despite this audit?
5. Which tasks should be split smaller?
6. Which tasks are too risky or premature?
7. Which Phaser 4.1.0 APIs should be used?
8. Which Phaser 4.1.0 APIs should not be used?
9. What current code architecture supports the roadmap?
10. What current code architecture blocks the roadmap?
11. How should mode selection work without breaking conditional loading?
12. How should animated asset workflow be designed before regenerating units?
13. How should terrain/map-life be implemented without destroying current render/pathfinding performance?
14. What should be implemented first?
15. What should stay parked?

Required report output:
Create exactly one Markdown report:

docs/project/PHASE_2_ROADMAP_AUDIT.md

Do not create multiple audit docs unless absolutely necessary.
Do not update PROJECT_STATE.md, CURRENT_NEXT_STEP.md, NEW_CHAT_HANDOFF.md, or FIX_BACKLOG.md in this PR.
Those docs will be updated in a later docs checkpoint after the audit is accepted.

Required report structure:

# PHASE_2_ROADMAP_AUDIT.md

## 1. Executive summary
Include:
- audit verdict;
- whether Phase 2 direction is correct;
- top 5 roadmap risks;
- top 5 implementation priorities;
- whether the roadmap can authorize direct implementation after acceptance.

## 2. Repo/version/docs confirmation
Confirm:
- active repo;
- Phaser version;
- PR #95 merged;
- PHASE_2_ROADMAP.md exists;
- docs that are stale and need later checkpoint.

## 3. Current system model relevant to Phase 2
Explain current:
- scene flow;
- menu flow;
- loading flow;
- mode detection / URL params;
- PreloadScene conditional loading;
- GameScene startup;
- arena/devtools flow;
- input/hotkeys;
- HUD / DOM UI;
- terrain renderer;
- entity/building renderer;
- asset pipeline;
- Animation Manager usage;
- QA smoke coverage.

## 4. Roadmap direction assessment
Assess the pivot:
- from technical cleanup to playable/visual RTS feel;
- whether this is correct now;
- what technical debt can safely wait;
- what technical debt still blocks Phase 2.

## 5. Task-by-task audit
For every Phase 2 roadmap task:
- DOCS-P2-00
- MENU-01
- MENU-02
- LOADING-01
- HOTKEYS-01
- TERRAIN-01
- BASE-ANCHOR-01
- ASSET-WORKFLOW-01
- UNIT-ANIM-01
- UNIT-ANIM-02
- RESOURCE-01
- MAPLIFE-01
- FOG-01
- ARENA-01
- WEAPON-WORKFLOW-01
- VISUAL-SPIKE-01

Include for each:
- problem statement;
- current code support;
- current blockers;
- recommended scope;
- risk;
- whether it can go directly to implementation after this audit;
- likely touched files;
- validation strategy;
- manual QA;
- what not to touch.

## 6. High+ task authorization matrix
Create a table for high/medium-high/high-risk tasks.

For each high+ task, state:
- covered enough by this audit for direct implementation: yes/no;
- if yes, implementation constraints;
- if no, what additional design is needed;
- exact stop conditions.

Important:
Do not blindly require separate audit for every high+ task.
This audit itself is intended to authorize direct implementation where it provides enough detail.

## 7. Main menu and mode selection design
Analyze:
- current MainMenuScene/NewGameSetupScene flow;
- current URL shortcuts;
- standard/debug/arena selection model;
- whether mode should be selected before or after PreloadScene;
- implications for PHASER4-LOAD-02 conditional modularUnits loading;
- whether controlled reload with URL params is acceptable;
- whether registry/session storage/global state is better;
- how to preserve smoke tests.

Recommend exact MENU-01/MENU-02 implementation model.

## 8. Loading screen design
Analyze:
- current BootScene/PreloadScene;
- Phaser Loader events;
- how progress should be displayed;
- how to show mode/map/faction labels;
- how to avoid fake progress;
- how to keep qa:smoke stable.

Recommend exact LOADING-01 implementation model.

## 9. Hotkeys and command card design
Analyze:
- current GameInputController hotkeys;
- current PlaytestHud buttons;
- feasibility of a command registry;
- StarCraft-style command card structure;
- what should be config-driven;
- how to avoid overbuilding;
- what can be implemented now without combat.

Recommend exact HOTKEYS-01 scope.

## 10. Terrain and map visual system audit
Analyze:
- current terrain renderer;
- sand tile usage;
- why map looks like a chessboard;
- terrain patching options;
- decals;
- props/doodads;
- map edge styling;
- resource field integration;
- implications for pathfinding/passability;
- implications for RenderTexture caching.

Recommend TERRAIN-01 / MAPLIFE-01 / MAP-EDGE scope and sequencing.

## 11. Building grounding / HQ anchor audit
Analyze:
- current HQ/building placement;
- footprint vs visual anchor;
- generatedBuildingMeta / buildingPlacementMeta;
- EntityRenderer / ConstructionRenderer placement;
- faction HQ variants;
- how to fix base floating without global regressions.

Recommend BASE-ANCHOR-01 implementation scope.

## 12. Animated asset workflow audit
Analyze:
- current harvester spritesheet and Animation Manager use;
- current builder static/manual frame behavior;
- required animation states;
- 8-direction layout;
- frame counts;
- naming convention;
- anchor/grounding rules;
- scale/crop rules;
- per-faction variants;
- asset processing tooling;
- preview/validation tooling;
- how to integrate with generated manifests;
- how to avoid manual crop/anchor fixes.

Recommend ASSET-WORKFLOW-01.

## 13. Harvester/builder regeneration audit
Analyze:
- whether current units should be regenerated;
- what states are required;
- how to integrate gather/unload/build animations;
- how to avoid gameplay changes;
- how to stage asset generation vs runtime integration;
- how to validate directions and anchors.

Recommend UNIT-ANIM-01 and UNIT-ANIM-02 implementation sequence.

## 14. Resource nodes audit
Analyze:
- current resource entity/state model;
- visual resource placement;
- resource field concept;
- depleted resource behavior;
- ghost occupancy risk;
- shimmer/glow/depletion VFX options;
- whether resource polishing depends on terrain work.

Recommend RESOURCE-01 scope.

## 15. Fog of war audit
Analyze:
- current visibility/exploration state, if any;
- standard RTS model: black unexplored / grey explored / visible;
- render strategy;
- state memory strategy;
- minimap implications;
- devtools bypass;
- performance implications;
- whether FOG-01 belongs early or later in Phase 2.

## 16. Arena and combat sandbox audit
Analyze:
- current arena/devtools mode;
- how Arena should be selected from menu;
- how arena should support weapon/chassis testing later;
- how to avoid contaminating main sandbox;
- what minimum arena UX is required now.

Recommend ARENA-01.

## 17. Weapon VFX / recoil design audit
Analyze:
- how to model visual recoil with Phaser Tweens;
- how to model projectiles/beams/smoke with Phaser tools;
- how to support Wasp + Railgun strong recoil;
- how to support Smoky faster firing/reload feel;
- what should be visual only vs gameplay state;
- what should wait for actual combat implementation.

Recommend WEAPON-WORKFLOW-01.

## 18. Normal maps / lighting feasibility audit
Analyze:
- Phaser 4.1.0 lighting/normal map possibilities;
- whether custom shader/pipeline is required;
- asset pipeline requirements (`*_normal.png`);
- interaction with isometric depth sorting;
- whether baked lighting/shadows are better now;
- whether this should remain a spike only.

Recommend VISUAL-SPIKE-01.

## 19. Phaser 4 API usage matrix
Create table:
- API / feature;
- current usage;
- Phase 2 use case;
- safe now / later / avoid;
- risks;
- recommended task.

Must cover:
- Scene lifecycle;
- Loader events;
- Animation Manager;
- Tweens;
- Particles;
- RenderTexture;
- Cameras;
- Input;
- DOMElement;
- Containers;
- Groups;
- Events;
- Data Manager;
- SpriteGPULayer;
- TilemapGPULayer.

## 20. Recommended Phase 2 implementation sequence
Produce final audited sequence.

For each task include:
- task ID;
- type;
- risk;
- direct implementation allowed after audit: yes/no;
- dependencies;
- touched files;
- validation;
- manual QA;
- rollback plan;
- what stays out of scope.

Keep PRs scoped and practical.
Do not create giant mixed PRs.

## 21. First 5 ready-to-send implementation prompts
Create complete prompts for the first 5 tasks that can move directly to implementation after audit acceptance.

Each prompt must include:
- task title;
- mode;
- active repo;
- donor repo;
- critical repo rule;
- pre-checks;
- read-first files;
- context;
- goal;
- scope;
- hard rules;
- validation;
- manual QA;
- PR body requirements;
- Telegram notification block.

If one of the first 5 tasks cannot move directly to implementation, include a ready-to-send mini-design prompt instead and explain why.

## 22. Manual playtest checklist for Phase 2
Create checklist for Denis:
- menu mode selection;
- standard game launch;
- debug mode launch;
- arena launch;
- loading screen;
- hotkeys/command card;
- terrain visual review;
- base grounding;
- animated harvester;
- animated builder;
- resource depletion and occupancy;
- props/doodads;
- fog behavior;
- arena VFX test.

## 23. Do not do list
Explicitly list:
- no bot implementation now;
- no enemy AI now;
- no full combat in main sandbox now;
- no elements economy now;
- no SpriteGPULayer / TilemapGPULayer implementation now unless PHASER4-GPU-01 finding changes due to new evidence;
- no broad UI framework;
- no normal maps implementation before VISUAL-SPIKE-01 acceptance;
- no huge updateGameState rewrite;
- no asset regeneration without accepted ASSET-WORKFLOW-01;
- no breaking smoke shortcuts.

## 24. Final verdict
State:
- whether Phase 2 roadmap should be accepted as active direction;
- what must be fixed in roadmap before acceptance;
- exact first implementation task;
- whether docs checkpoint should follow after audit acceptance.

Hard rules:
- Do not edit runtime code.
- Do not edit tests.
- Do not edit package files.
- Do not edit assets.
- Do not update PROJECT_STATE.md, CURRENT_NEXT_STEP.md, NEW_CHAT_HANDOFF.md, or FIX_BACKLOG.md in this PR.
- Only create docs/project/PHASE_2_ROADMAP_AUDIT.md.
- Do not start implementation.
- Do not create multiple docs unless absolutely necessary.
- Do not use four-elements-next as active baseline.
- Do not use Phaser 3 assumptions.
- Do not recommend GPU layer implementation unless there is new, source-backed evidence contradicting PHASER4-GPU-01.
- Do not recommend normal maps implementation before a spike.
- Do not recommend bot/enemy as immediate implementation.
- Do not require a second audit for every high+ task if this audit covers it enough.
- If a finding is based on suspicion, mark it as “needs confirmation”, not confirmed.

Validation:
Because this is docs-only, runtime validation is not required.
But for audit accuracy, run and report exact results if feasible:

- npm test
- npm run typecheck
- npm run build
- npm run qa:smoke

If any command fails, include exact failure summary.
Do not claim a command passed unless actually run.

PR:
Create a branch from latest main.
Commit only:
- docs/project/PHASE_2_ROADMAP_AUDIT.md

Open PR into main.
Do not merge.

PR body must include:
- Goal
- Files changed
- Key findings
- Top risks
- Whether Phase 2 audit authorizes direct implementation
- Recommended Phase 2 sequence
- First 5 ready prompts status
- What was intentionally not changed
- Commands run / validation
- Risks
- Next recommended action

Telegram notification:
At task completion, send Telegram notification using /home/z/my-project/.telegram-notify.json if available.
Do not expose token.
Missing/invalid config or send failure must not block the task.
Report notification status:
- sent
- skipped: config missing
- failed: <reason>
```

---

## Review checklist for GPT after GLM opens the audit PR

When GLM opens the PHASE-2-ROADMAP-AUDIT PR, review for:

1. It changed only `docs/project/PHASE_2_ROADMAP_AUDIT.md`.
2. It did not edit runtime/tests/assets/package files.
3. It did not accidentally turn the roadmap into bot/combat-first.
4. It did not require a duplicate audit for every high+ task.
5. It clearly states which tasks are authorized for direct implementation after audit acceptance.
6. It preserves URL shortcuts for smoke/dev while moving user UX into menu.
7. It does not recommend SpriteGPULayer/TilemapGPULayer without new evidence.
8. It does not recommend normal maps implementation before a spike.
9. It has ready-to-send prompts for the first 5 tasks or clearly explains why a prompt is design-only.
10. It has enough detail to avoid repeating roadmap audit before each implementation task.
