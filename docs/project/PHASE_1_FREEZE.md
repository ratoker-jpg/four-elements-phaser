# PHASE_1_FREEZE.md

Status: active checkpoint after Phase 1 Foundation  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Date: 2026-05-27

---

## 1. Decision

Phase 1 Foundation feature work is frozen after:

```text
ARCH-17A-17B — Asset diagnostics and asset viewer MVP
ARCH-13C-LITE — Render-only unit motion dust polish
```

No new major implementation ARCH should start before a new Sandbox MVP audit/roadmap is created.

This is not project stop. It is a planning checkpoint.

---

## 2. Why freeze now

The project moved fast and now has a much stronger base:

```text
- main menu / new game flow;
- settings / UI scale;
- save/load / continue / save management;
- Map 1 and deterministic generated maps;
- generated map quality pass;
- devtools / QA arena / debug overlays;
- gameplay feedback and motion dust MVP;
- asset diagnostics / asset viewer;
- civil economy / construction / separator / factory loop;
- tests + CI QA smoke.
```

Continuing into enemy AI, bot, combat progression, upgrades, or balance progression now would expand the project before the Sandbox MVP is stable.

---

## 3. Frozen / parked until new audit

Do not schedule as immediate next work:

```text
- enemy AI / bot;
- enemy economy;
- attack waves;
- full combat system;
- upgrades;
- progression systems;
- broad balance/progression pass;
- map editor;
- large new gameplay systems.
```

These may be useful later, but they belong to a later phase after Sandbox MVP polish/fixes.

---

## 4. Next planning target

Next target:

```text
Sandbox MVP audit/roadmap
```

This audit should answer:

```text
- what exactly counts as Sandbox MVP;
- which known issues block it;
- which issues are polish-only;
- how to group fixes into larger coherent packages;
- what to do before moving to combat/enemy/bot/upgrades.
```

---

## 5. Sandbox MVP rough target

The likely Sandbox MVP target is:

```text
Player can start a game, choose faction/map/seed, gather resources, build the civil economy, produce/use civil units, save/load, use devtools/arena, and test a basic player-controlled tank/object sandbox without critical visual/resource/control bugs.
```

This is intentionally not final. The next audit owns the final definition.

---

## 6. Known major fix groups to audit

The next audit should at least cover:

```text
- faction asset wiring;
- harvester reliability;
- unit visual grounding / centering;
- selection marker model;
- tile-lane movement readability / diagonal cut-through;
- player tank control baseline if still required for Sandbox MVP;
- dust style rework and controlled render-only unit bobbing/suspension;
- final Sandbox MVP QA checklist.
```

---

## 7. Roadmap status

`docs/ROADMAP.md` is now inactive/archived.

Do not use the old 21-ARCH list as active task source. It remains useful only as historical reference and Git history.

---

## 8. Rule for the next GPT chat

A new GPT chat must start from:

```text
docs/project/NEW_CHAT_HANDOFF.md
docs/project/PROJECT_STATE.md
docs/project/FIX_BACKLOG.md
```

Then prepare the Sandbox MVP audit. Do not start implementation directly.
