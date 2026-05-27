# PROJECT_STATE.md

Status: Phase 1 Foundation frozen  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Updated: 2026-05-27

---

## Current mode

Planning checkpoint after fast Phase 1 Foundation work.

Implementation is paused until the next roadmap/audit is created.

Current rule:

```text
Do not start new runtime ARCH packages immediately.
Next step is Sandbox MVP audit/roadmap.
```

---

## Recently completed foundation work

Recently merged foundation packages include:

```text
ARCH-11A — Devtools QA sandbox MVP
ARCH-11B-12A — Debug overlays + QA arena MVP
ARCH-13A-13B — Gameplay feedback / VFX MVP
ARCH-14B — Main menu / New Game / Pause shell
ARCH-14C-15B — UI shell polish + save management UX
ARCH-15A — Local save/load skeleton
ARCH-16A-16B — Map setup options + deterministic generated map MVP
ARCH-08B-09A — Generated map terrain/resource balance MVP
ARCH-17A-17B — Asset diagnostics and asset viewer MVP
ARCH-13C-LITE — Render-only unit motion dust polish MVP
```

The project now has:

```text
- main menu / new game setup;
- faction and map selection;
- generated maps with seed/size;
- save/load/continue and save management;
- settings with UI scale;
- devtools and QA arena;
- debug overlays;
- gameplay feedback/VFX;
- render-only dust MVP;
- asset diagnostics/viewer;
- civil economy, construction, separator and factory loop;
- tests + build + QA smoke CI gates.
```

---

## Current active docs

Use these docs after freeze:

```text
docs/project/NEW_CHAT_HANDOFF.md
docs/project/PHASE_1_FREEZE.md
docs/project/FIX_BACKLOG.md
docs/project/PROJECT_STATE.md
```

`docs/ROADMAP.md` is now inactive/archived and must not be used as active task source.

---

## Next step

Create a new Sandbox MVP audit/roadmap.

The audit should define:

```text
- Sandbox MVP exit criteria;
- fix groups;
- which issues block MVP;
- which issues are polish-only;
- recommended implementation packages;
- manual QA plan;
- what moves to Phase 2.
```

Do not start implementation before Denis approves the audit/roadmap.

---

## Parked until later phase

Do not schedule as immediate next work:

```text
- enemy AI / bot;
- full combat system;
- attack waves;
- enemy economy;
- upgrades;
- progression;
- broad balance progression;
- map editor.
```

These are not deleted. They are postponed until after Sandbox MVP planning.

---

## Known fix backlog candidate groups

See `docs/project/FIX_BACKLOG.md`.

Current groups:

```text
- faction asset wiring;
- harvester reliability;
- unit grounding / centering;
- selection marker model;
- lane movement / diagonal cut-through readability;
- optional player tank control baseline;
- movement dust style rework;
- controlled render-only unit bobbing/suspension.
```

---

## Accepted workflow reminder

The project still follows:

```text
roadmap -> audit/design -> scoped package -> implementation -> GPT review -> Denis manual QA -> merge
```

For fix work:

```text
fix backlog -> fix-roadmap audit -> scoped fix package -> implementation -> manual QA -> merge/follow-up
```

If a fix fails after 1-2 attempts, stop and return to audit instead of guessing.

---

## Telegram notification rule

When preparing GLM prompts, include:

```text
Telegram notification:
At task completion, send Telegram notification using /home/z/my-project/.telegram-notify.json if available.
Do not expose token. Missing/invalid config or send failure must not block the task.
```

This is also documented in `docs/project/GLM_EXECUTOR_RULES.md` and repeated in `NEW_CHAT_HANDOFF.md`.
