# ROADMAP.md

Status: **inactive / archived after Phase 1 Foundation**  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Archived on: 2026-05-27

---

## 0. Current status

This roadmap is no longer the active implementation roadmap.

The previous 21-ARCH roadmap is treated as a **legacy planning artifact** after the Phase 1 Foundation workstream.

Reason:

```text
The old roadmap contained useful system directions, but it also planned later-stage combat/enemy/bot/upgrades work too early.
Denis explicitly decided to stop after ARCH-17A/17B + ARCH-13C-LITE and rebuild the next roadmap around Sandbox MVP polish/fixes first.
```

The old roadmap remains available in Git history at the pre-freeze main commit:

```text
c9b36929514296ea2e34c861747848041048be79
```

Do not use the old ARCH list as active task source.

---

## 1. Active planning source after freeze

Use these docs instead:

```text
docs/project/PHASE_1_FREEZE.md
docs/project/FIX_BACKLOG.md
docs/project/NEW_CHAT_HANDOFF.md
docs/project/PROJECT_STATE.md
```

Next roadmap work must follow:

```text
Phase 1 Foundation freeze -> Sandbox MVP audit -> new Sandbox MVP roadmap -> scoped implementation packages
```

---

## 2. What is explicitly parked

Do not schedule these as immediate next work until the new Sandbox MVP audit accepts them:

```text
- enemy AI / bot;
- enemy economy;
- attack waves;
- full combat system;
- upgrades / progression / balance progression;
- map editor;
- large new gameplay systems.
```

---

## 3. What remains relevant from the legacy roadmap

Some legacy roadmap ideas are still useful as reference material, but not as automatic task approval:

```text
- civil loop before combat;
- system-first workflow;
- asset pipeline/reference diagnostics;
- movement/VFX polish ideas;
- devtools/arena/testing approach;
- save/load/UI shell direction.
```

Any reused idea must be reintroduced through the new Sandbox MVP audit/roadmap.

---

## 4. Immediate next step

No new implementation ARCH should be started immediately after this freeze.

Next step:

```text
Create Sandbox MVP audit/roadmap based on current playable state and known fix backlog.
```

The audit should group fixes into larger coherent packages and define the exact Sandbox MVP exit criteria.
