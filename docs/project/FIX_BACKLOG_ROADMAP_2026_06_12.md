# FIX_BACKLOG_ROADMAP_2026_06_12.md

Status: draft fix roadmap / backlog for GLM audit  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Date: 2026-06-12

---

## 1. Purpose

This document collects the current owner-reported bugs, visual calibration problems, and workflow corrections into one scoped **fix roadmap/backlog**.

It exists so the team can stop doing random one-off visual patches and return to the accepted project discipline:

```text
roadmap/backlog -> GLM audit -> scoped High / High+ steps -> implementation -> PR review -> Denis manual QA -> merge decision
```

This is not a new feature roadmap. It is a bugfix/polish backlog for the current Arena / debug / visual calibration work.

---

## 2. Relationship to existing docs

Read first before auditing or implementing this backlog:

```text
AGENTS.md
docs/project/PROJECT_STATE.md
docs/project/CURRENT_NEXT_STEP.md
docs/project/GPT_WORKFLOW.md
docs/project/GLM_EXECUTOR_RULES.md
docs/project/AI_EXECUTION_WORKFLOW_2026_06_12.md
docs/project/CODEMAP.md
docs/project/CAMERA_PROJECTION_CONTRACT.md
docs/project/CORE_MECHANICS_CLOSURE_REPORT_2026_06_04.md
```

Existing roadmap/audit/closure docs remain source-of-truth references. Do not reopen closed roadmaps by inertia. This backlog should be audited against them to avoid duplicate work.

Useful routing notes already exist in `docs/project/CODEMAP.md`:

```text
- Arena/control/combat map
- Body/turret routing map
- Generated hull / modular asset map
- Devtools/debug map
- Hard boundaries for visual tasks
```

---

## 3. Current accepted process for this backlog

```text
1. Collect current bugs/polish into this fix roadmap/backlog.          THIS DOC
2. Run GLM audit on this backlog.
3. GPT/Denis review and accept the audit.
4. Split into High / High+ implementation steps.
5. Use Claude/Opus or Codex for high-value code implementation.
6. Use GLM for patch application / validation / PR delivery when needed.
7. GPT reviews PRs.
8. Denis performs final visual/manual QA and decides merge/no-merge.
```

Agent usage rule:

```text
GLM: audit / patch apply / validation / PR delivery.
Claude/Opus: expensive/high-value implementation, local patches, root-cause code work.
Codex 5.5: expensive/high-value implementation, screenshot-driven debugging, direct PRs when access works.
GPT: coordinator / reviewer / task writer.
Denis: final visual QA and merge decision.
```

---

## 4. Important recent context

Recent visual attempts were closed and must not be continued blindly:

```text
PR #245 — depth-only turret fix failed preview.
PR #246 — Smoky turret sprite became visible but mount/rotation was wrong in preview.
```

Lessons:

```text
- Passing tests + plausible diff != accepted visual result.
- Do not keep tuning offsets blindly.
- Visual/runtime PRs require Denis manual preview.
- If two attempts fail, change approach.
```

Current owner decision:

```text
Do not implement the dev grid overlay yet.
Use Sand Classic as the calibration map because its visible sand tile grid already shows cell alignment.
```

---

## 5. Manual QA route policy

### Problem

Manual QA has been using large hidden query links such as:

```text
?skipMenu&arena=1&devtools=1
```

Owner feedback: this is confusing and risks testing behavior that does not match the real player/debug entry flow.

### Expected behavior

Manual acceptance should use the real in-game routes:

```text
Standard
Debug / Отладка
Arena / Арена
```

Preview URLs are still allowed as the build host, but the flow inside the build should go through menus unless a task explicitly tests a query-flag-only path.

### Scope

- Keep query flags for automated smoke tests and technical shortcuts when needed.
- Do not treat query-flag-only behavior as manual QA acceptance.
- Future PR bodies for visual/manual QA should state whether QA was done through real menus or through query flags.

Priority: **High**  
Type: workflow/runtime UX fix  
Audit first: yes

---

## 6. Debug / Отладка mode cleanup

### Current problem

The debug entry contains unclear map/mode options, especially:

```text
Map 1
Sand Classic / Песок классика
```

Owner initially wanted both removed, then corrected the decision after using the sand grid for calibration.

### Accepted decision

```text
Keep Sand Classic.
Do not remove Sand Classic.
Use Sand Classic as the calibration map because its visible isometric tile grid helps verify unit placement.
```

`Map 1` should be audited:

```text
- If it is obsolete/noisy, remove it from Debug mode.
- If it is still useful, rename it to a clear purpose.
- Do not remove Sand Classic while replacing Map 1.
```

Priority: **High**  
Type: debug UX / calibration support  
Audit first: yes

Manual QA:

```text
- Open real Debug / Отладка menu.
- Confirm Sand Classic is available.
- Confirm obsolete Map 1 is removed or renamed.
- Confirm Sand Classic shows visible tile grid for calibration.
```

---

## 7. Arena placement / preview clarity

### Current problem

When placing a unit in Arena, the preview/placement marker appears to target the center of a cell, but the relationship between marker, selected cell, hull anchor, and final unit position is confusing.

Owner feedback:

```text
When I choose/create a unit, it looks like it wants to draw in the middle of a cell, and this confuses me.
```

### Expected behavior

```text
- Arena placement preview should clearly identify the exact cell where the unit will spawn.
- Final spawned unit should appear centered in that cell.
- Selection ring should align with the cell/vehicle.
- Placement marker should not imply a different position than the final spawn.
```

Use Sand Classic for visual calibration before adding new grid overlays.

Priority: **High+**  
Type: Arena visual placement / UX  
Audit first: yes

Manual QA:

```text
- Open Arena through real menu.
- Place Wasp+Smoky on Sand Classic / calibration map if available.
- Confirm marker cell matches final spawn cell.
- Confirm body sits centered inside the visible tile diamond.
- Confirm selection ring aligns with body/cell.
```

---

## 8. Arena body + weapon visual calibration

### Current problem

Generated/legacy body+weapon combinations do not reliably render as a coherent tank:

```text
- hull/body can be centered correctly while turret is offset incorrectly;
- turret can detach from the body;
- enemy turret can be mounted differently/wrong;
- turret direction can diverge from aim line or target direction;
- some combinations may still show procedural fallback or missing turret/body visuals.
```

Owner goal:

```text
In Arena, choose any body + any weapon and create a unit. It should appear centered in the selected cell, with body and turret visible, attached, and readable.
```

### Expected behavior

```text
- Body appears for every supported body selection.
- Weapon/turret appears for every supported weapon selection where visual assets exist.
- Turret is attached to the body.
- No visual floating/detachment.
- Ally and enemy rendering are consistent.
- Aim line, turret direction, and target direction do not visibly contradict each other.
- Existing Wasp generated hull placement from PR #244 is not changed casually.
```

### Scope warning

Do not solve this by blind offset tuning. Audit should identify the correct coordinate model and whether Arena should use:

```text
- Blockout procedural geometry;
- generated hull sprites;
- modular turret sprites;
- a limited visual adapter;
- or a staged migration per body/weapon.
```

Priority: **High+**  
Type: visual calibration / renderer architecture  
Audit first: yes

Manual QA:

```text
- Arena through real menu.
- Place Wasp+Smoky, Hornet+Ricochet, Hunter+Smoky and several other body+weapon combinations.
- Check ally and enemy versions.
- Verify center, selection ring, turret mount, turret direction and aim line.
```

---

## 9. Turret rest / target-lock behavior

### Current problem

The turret has no clear visual rest state. When there is no valid target, the turret can keep its previous direction while the body turns, which makes it appear detached or wrong.

### Accepted owner rule

```text
No attack target -> turret is parallel to the body.
Explicit attack target -> turret turns toward and tracks the enemy.
Move-only command -> clear target-lock and return turret to body-parallel rest.
Target lost/dead or stop command -> return turret to body-parallel rest.
```

This should apply to both ally and enemy Arena vehicles.

### Audit note

This is behavior-adjacent, not pure rendering. GLM audit must identify the minimal safe implementation and tests before Claude/Codex implementation.

Priority: **High+**  
Type: Arena behavior / visual correctness  
Audit first: yes

Manual QA:

```text
- Spawn ally and enemy Wasp+Smoky.
- Idle: turret parallel to body.
- Move-only: turret remains/returns parallel to body.
- Attack enemy: turret points at enemy and tracks target.
- Enemy dies / stop / move-only: turret returns to body.
```

---

## 10. Arena body/weapon inspection controls

### Current problem

Testing combinations is slow because the tester must repeatedly create units or switch setup manually.

### Expected dev UX

Arena should support a convenient way to inspect body/weapon combinations, for example:

```text
- choose body;
- choose weapon;
- create unit in selected cell;
- optionally change selected unit body;
- optionally change selected unit weapon;
- next body / previous body;
- next weapon / previous weapon;
- reset direction / reset pose.
```

This is a dev/calibration feature, not production gameplay.

Priority: **High**  
Type: Arena debug UX / QA productivity  
Audit first: yes

Manual QA:

```text
- Open Arena through real menu.
- Create several body+weapon combinations quickly.
- Verify selected unit can be inspected without repeatedly restarting the scene.
```

---

## 11. Dev grid overlay status

### Previous idea

A toggleable dev-only isometric grid overlay was proposed.

### Current owner decision

```text
Do not implement a new dev grid overlay yet.
Use Sand Classic as the calibration map first.
```

### Revisit condition

Only revisit a separate grid overlay if Sand Classic is insufficient for calibration, or if future production maps need grid-free visuals while debug still needs precise cell overlays.

Priority: **Deferred**  
Type: debug overlay  
Audit first: only if reopened

---

## 12. Manual QA checklist for this fix backlog

Use real menu flows first:

```text
Standard
Debug / Отладка
Arena / Арена
```

Do not accept visual fixes based only on `?skipMenu&arena=1&devtools=1`.

Checklist:

```text
[ ] Debug mode opens through real menu.
[ ] Sand Classic remains available and shows visible cell grid.
[ ] Obsolete Map 1 is removed or renamed.
[ ] Arena opens through real menu.
[ ] Arena placement preview matches final spawn cell.
[ ] Spawned body is centered in cell on Sand Classic.
[ ] Selection ring aligns with body/cell.
[ ] Wasp+Smoky ally body and turret are visible and attached.
[ ] Wasp+Smoky enemy body and turret are visible and attached.
[ ] Multiple body+weapon combinations render coherently.
[ ] No turret detachment during idle/move-only.
[ ] Turret points at target only during attack/target-lock.
[ ] Move-only clears target-lock and returns turret to body rest.
[ ] Aim line does not contradict visible turret direction.
[ ] No full matrix preload is introduced.
[ ] No Wasp placement regression from PR #244.
```

---

## 13. Out of scope for this backlog

Do not include in this fix roadmap unless Denis explicitly reopens:

```text
- economy/progression redesign;
- save/load changes;
- strategic AI/waves;
- full generated turret asset pipeline;
- full hull/turret matrix preload;
- production map generation changes beyond menu/debug routing;
- broad combat balance changes;
- pathfinding rewrites;
- asset PNG edits;
- new gameplay features unrelated to the reported visual/debug bugs.
```

---

## 14. Required GLM audit output

GLM should audit this backlog before implementation and return:

```text
1. Which items duplicate existing closed roadmap work and which are new.
2. Root causes and suspected files/systems for each item.
3. Recommended implementation order.
4. PR slicing with High+ / High / Medium / Deferred labels.
5. Files to read first for each PR.
6. Files/systems that must not be touched.
7. Risks.
8. Tests to add or update.
9. Validation plan.
10. Manual QA plan through real menus.
11. Whether Claude/Opus, Codex, or GLM should execute each implementation step.
```

Expected implementation-agent routing:

```text
- GLM: audit, patch apply, validation, PR delivery.
- Claude/Opus: difficult renderer/runtime implementation when patch handoff is acceptable.
- Codex: difficult code + screenshot/manual visual debugging, PRs when access works.
```

---

## 15. Status after this doc

This backlog is a planning artifact only.

Next step after this doc is accepted/merged:

```text
Run GLM audit on docs/project/FIX_BACKLOG_ROADMAP_2026_06_12.md.
Do not implement yet.
```
