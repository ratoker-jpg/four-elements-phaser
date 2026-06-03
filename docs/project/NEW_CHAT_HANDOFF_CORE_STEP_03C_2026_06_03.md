# NEW_CHAT_HANDOFF_CORE_STEP_03C_2026_06_03.md

Status: handoff for new GPT chat  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Date: 2026-06-03

---

## Why this handoff exists

The previous chat became unstable because of a long project history and repeated GitHub tool initialization. Start a fresh project chat and paste the prompt below.

The new chat should continue from the current Core Mechanics implementation state, not from old Arena/Visual/Symbian context.

---

## Current merged state

```text
Merged PRs:
- #193 CORE-STEP-01A — Localization infrastructure and setup flow
- #194 CORE-STEP-01B — Russian UI labels and theme pass
- #195 CORE-STEP-01C — Tooltips and DevTools separation
- #196 CORE-STEP-02A — Weapon and body config data models
- #197 CORE-STEP-02B — Faction/resource/building config data models
- #198 CORE-STEP-02C — Scaling helpers, armor formula, config integration tests
- #199 CORE-STEP-03A — Resource class runtime type and asset mapping
- #200 CORE-STEP-03B — Anchor-based generated resource placement
```

Current roadmap state:

```text
STEP 01H+ — complete
STEP 02H+ — complete
STEP 03H+ — in progress
Next step: CORE-STEP-03C
```

---

## PR #200 summary

PR #200 replaced generated resource random scatter with deterministic anchor-based placement.

Confirmed decisions:

```text
- generated resources now include resourceClass
- legacy type remains populated for current runtime compatibility
- starter zone contains very_poor / poor / medium
- side zone uses medium / rich
- contested zone uses rich / very_rich
- center has exactly one infinite resource
- infinite footprint is 2x2
- same seed + same size is deterministic
- harvester/economy/UI behavior was intentionally not changed in #200
```

Important known follow-up from #200 review:

```text
03B touched generated resource validation lightly, but did not fully close strict runtime validation.
03C must explicitly close validation for missing/invalid resourceClass on generated resources.
```

---

## Next task

```text
CORE-STEP-03C — Harvester 6-class gathering + UI display + map validation update
```

Expected high-level scope:

```text
- use resourceClass for generated resource runtime amounts where present
- keep legacy fallback for old/saved resources without resourceClass
- update harvester/resource depletion logic only as needed for 6-class resource amounts
- update player-facing resource class display where in scope
- add stricter map validation for missing/invalid generated resourceClass
- keep anchor placement from #200 intact
- keep legacy type populated for compatibility
```

---

## Boundaries for 03C

Do not start STEP 04.

Do not change:

```text
- buildings/economy loop beyond resource amount compatibility
- combat
- movement/pathfinding
- Arena mode
- asset files
- package/dependency files
- TankViewer pipeline
- CAMERA_PROJECTION_CONTRACT.md
```

Be careful with:

```text
- saved/legacy resources without resourceClass
- current harvester behavior
- old RESOURCE_RAW_AMOUNTS fallback
- map validation behavior for generated maps vs old saved maps
```

---

## Required docs to read first

```text
- docs/project/PROJECT_STATE.md
- docs/project/CURRENT_NEXT_STEP.md
- docs/project/GPT_WORKFLOW.md
- docs/project/GLM_EXECUTOR_RULES.md
- docs/project/CAMERA_PROJECTION_CONTRACT.md
- docs/project/MECHANICS_DECISIONS_2026_06_03.md
- docs/project/CORE_MECHANICS_ROADMAP_2026_06_03.md
- docs/project/CORE_MECHANICS_SYSTEM_AUDIT_2026_06_03.md
- docs/project/NEW_CHAT_HANDOFF_CORE_STEP_03C_2026_06_03.md
```

---

## New chat prompt

Copy this into a fresh ChatGPT project chat:

```text
Мы в Four Elements Phaser.
Репозиторий: ratoker-jpg/four-elements-phaser.

Важно: не работать по памяти. Перед задачами/ревью читать актуальные docs из репозитория.

Обязательные документы:
- docs/project/PROJECT_STATE.md
- docs/project/CURRENT_NEXT_STEP.md
- docs/project/GPT_WORKFLOW.md
- docs/project/GLM_EXECUTOR_RULES.md
- docs/project/CAMERA_PROJECTION_CONTRACT.md
- docs/project/MECHANICS_DECISIONS_2026_06_03.md
- docs/project/CORE_MECHANICS_ROADMAP_2026_06_03.md
- docs/project/CORE_MECHANICS_SYSTEM_AUDIT_2026_06_03.md
- docs/project/NEW_CHAT_HANDOFF_CORE_STEP_03C_2026_06_03.md

Текущее состояние:
- PR #193–#200 смержены.
- STEP 01H+ закрыт.
- STEP 02H+ закрыт.
- STEP 03A закрыт.
- STEP 03B закрыт.
- Сейчас следующий шаг: CORE-STEP-03C — Harvester 6-class gathering + UI display + map validation update.

Что уже сделал PR #200:
- generated resources now include resourceClass;
- legacy type remains populated;
- starter zone: very_poor / poor / medium;
- side zone: medium / rich;
- contested zone: rich / very_rich;
- center: exactly one infinite 2x2 deposit;
- same seed deterministic;
- harvester/economy/UI behavior intentionally unchanged.

Что важно закрыть в 03C:
- harvester/resource runtime amounts should use resourceClass when present;
- keep legacy fallback for old/saved resources without resourceClass;
- map validation must fail/warn if generated resource has missing/invalid resourceClass;
- UI/player-facing display should show resource class names where in scope;
- do not change anchor placement from #200 unless there is a blocker;
- do not start STEP 04.

Твоя роль:
- сначала проверь документы и текущие файлы;
- затем подготовь аккуратный prompt для GLM на CORE-STEP-03C;
- scope должен быть узкий;
- не давай GLM лезть в здания, боёвку, movement, Arena, assets, package files.
```

---

## Suggested GLM task direction for 03C

The next GLM task should be implementation, but only after Denis/GPT approval.

Recommended shape:

```text
Task:
CORE-STEP-03C — Harvester 6-class gathering + UI display + map validation update

Goal:
Finish STEP 03H+ by wiring generated resources' resourceClass into runtime resource amount/depletion compatibility, player-facing display where in scope, and map validation.

Hard boundaries:
- no STEP 04
- no building/economy loop rewrite
- no combat/movement/pathfinding
- no Arena changes
- no asset/package changes
- no TankViewer pipeline
```
