# FIX_BACKLOG.md

Status: active backlog for Sandbox MVP audit  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Date: 2026-05-27

---

## 1. Purpose

This file collects known issues and polish items after Phase 1 Foundation.

It is not an implementation plan by itself.

Next step:

```text
FIX_BACKLOG -> Sandbox MVP audit -> new Sandbox MVP roadmap -> scoped fix packages
```

Do not pick items from this file and implement them directly unless the new audit/roadmap has accepted the package.

---

## 2. Critical / likely Sandbox MVP blockers

### 2.1 Faction asset wiring

Known issues:

```text
- non-cyan faction HQ/base can be missing/invisible;
- non-cyan harvester can show cyan visual;
- faction selection exists, but runtime visuals are not fully wired for all factions.
```

Use current diagnostics:

```text
- Asset Viewer / asset diagnostics from ARCH-17A-17B;
- generated manifest vs renderer wiring report.
```

Likely package:

```text
FIX-PACKAGE-01 — Faction asset wiring
```

---

### 2.2 Harvester reliability

Known issue:

```text
Harvesters can gather and work for a while, then later stop gathering / fail to continue the loop.
```

This existed before the recent UI/map/devtools work. It was parked intentionally.

Likely package:

```text
FIX-PACKAGE-02 — Harvester reliability and economy loop stability
```

Must audit first:

```text
- harvester phase transitions;
- resource target selection;
- approach path / return path;
- dropoff selection;
- storage/full behavior;
- blockedReason telemetry;
- save/load interaction if relevant.
```

---

### 2.3 Unit grounding / centering / selection marker

Known issues:

```text
- selection marker/ring is not properly grounded under unit;
- some units do not appear centered on the intended tile;
- unit visual anchor and tile anchor are not yet consistently modeled.
```

Likely package:

```text
FIX-PACKAGE-03 — Unit visual anchor model and selection marker
```

Must stay system-first:

```text
Do not solve via random per-unit offsets unless the audit explicitly accepts metadata/config-based exceptions.
```

---

### 2.4 Lane movement / diagonal cut-through readability

Known issue:

```text
Units can visually appear to cut through cells / move diagonally in a way that feels wrong.
```

Important distinction:

```text
This may be visual interpolation/readability, not necessarily pathfinding failure.
```

Audit must separate:

```text
- actual state/path movement;
- visual sprite movement;
- tile lane readability;
- collision/passability;
- command target validation.
```

---

### 2.5 Player tank control baseline

Open question:

```text
Should Sandbox MVP include a controllable player tank/object, even without enemy AI/combat?
```

If yes, scope should be minimal:

```text
- selectable player tank;
- move command;
- visual facing if safe;
- no shooting;
- no enemies;
- no attack-move;
- no bot.
```

This requires audit before implementation.

---

## 3. Visual polish backlog

### 3.1 Movement dust rework

PR #80 added minimal render-only dust MVP.

Known follow-up:

```text
Current dust exists and is acceptable as MVP, but the style should be redesigned/tuned later.
```

Future work should consider:

```text
- softer dust shape;
- better placement behind wheels/tracks;
- less circular look;
- different intensity per unit type;
- avoiding screen clutter.
```

---

### 3.2 Controlled unit bobbing / suspension

Future visual idea:

```text
Add controlled render-only unit bobbing/suspension while moving.
```

Rules:

```text
- render-only;
- no gameplay state changes;
- no pathfinding changes;
- no idle bobbing for stationary units;
- must be planned in Sandbox MVP audit before implementation.
```

This item came from the accepted old ARCH-13 visual motion direction, but must be reintroduced through the new audit.

---

## 4. Non-blocking / later backlog

These should probably wait until after Sandbox MVP unless the audit says otherwise:

```text
- combat foundation;
- enemy AI / bot;
- attack waves;
- upgrades;
- progression;
- balance progression;
- map editor;
- advanced asset previews;
- obstacle/decor visual placeholders and generated obstacle re-enable;
- asset diagnostics CI integration.
```

---

## 5. Fix package rule

Do not implement one-off fixes directly from this backlog.

Required flow:

```text
1. Audit issue cluster.
2. Identify root cause and touched contracts.
3. Group into coherent fix package.
4. Define manual QA checklist.
5. Implement with validation.
6. Merge only after Denis manual QA.
```

If a fix fails after 1-2 attempts, stop and return to audit instead of guessing.
