# POST-VISUAL-05A QA Polish Backlog

Status: operational backlog
Project: Four Elements Phaser
Date: 2026-06-01

---

## Purpose

Short operational checklist for QA polish after VISUAL-05A completion.
Not a giant audit. Track known items that need manual verification or small fixes.

---

## Known status after VISUAL-05A

VISUAL-05A production industrial map integration is complete.
All five PRs merged: PR #144, #145, #146, #147, #148.
Industrial generated map is now the default for new games.
Sand/fixed/custom map paths remain available as fallback.

---

## QA checklist items

- [ ] Industrial default new game: start a new game, verify industrial map loads by default
- [ ] mapStyle fallback: manually select sand map style, verify it renders correctly
- [ ] Lower-left HQ: verify HQ appears in lower-left area on industrial generated maps
- [ ] Frame/background/walls: verify frame border, background layer, and wall faces render correctly on industrial maps
- [ ] Starter resources reachable: verify harvesters can path from HQ to starter resources
- [ ] Save/load compatibility: load an old sand save, verify it loads with sand terrain (no forced conversion)
- [ ] Camera bounds: verify camera stays within valid bounds on industrial maps
- [ ] Production small currently 32x32: confirm small map is 32x32 (not 96x96)

---

## Explicit deferred items

These are out of scope for QA polish. They require separate scoped tasks:

```text
96/128/192 production size migration — separate task/PR sequence required
VISUAL-06 — Resource field visual model design — separate task with guardrails
VISUAL-07 through VISUAL-12 — HUD, menu, unit visual work — separate tasks
FOG-01 — Two-layer fog of war — separate task
ARENA-01 — Arena mode from menu — separate task
```

---

## Rules

- QA polish fixes must not change gameplay, economy, pathfinding, or occupancy
- QA polish fixes must not change production map sizes
- QA polish fixes must not start VISUAL-06 implementation
- QA polish fixes must not generate resource assets
- Each fix should be a small focused PR, not a batch
