# ARCH_SCOPING_POLICY.md

Status: accepted workflow policy  
Audience: GPT / task planning / PR review  
Project: Four Elements Phaser

---

## Purpose

This document defines how large roadmap blocks (`ARCH-*`) should turn into implementation PRs.

It exists to prevent two bad extremes:

1. **One huge PR per ARCH** — too risky, hard to review, mixes layers.
2. **Mechanical micro-PR splitting** — too slow, burns executor context, creates unnecessary process overhead.

The correct approach is:

```text
large ARCH -> accepted audit/design -> risk-based scoped PR sequence -> implementation
```

---

## Core rule

A large `ARCH-*` block should normally have one accepted audit/design source before implementation.

That source can be:

- `docs/ROADMAP_SYSTEM_AUDIT.md`;
- a topic-specific architecture/design document;
- a dedicated audit PR;
- a short delta-check if a full audit already exists and only current code drift must be checked.

Do not create a new big audit if an accepted audit/design already covers the system.

Use a delta-check only to answer:

```text
what changed since the audit
what current files actually contain
which PR grouping is safe now
```

---

## ARCH phases are not PR boundaries

A roadmap `ARCH-*` can contain internal phases such as A/B/C/D/E/F.

Those phases describe logical work units. They are not mandatory PR boundaries.

Correct model:

```text
ARCH = large product/system block
phase = logical part of the ARCH
PR = risk-based package of one or more phases
```

Therefore, do not automatically implement:

```text
phase A -> PR A
phase B -> PR B
phase C -> PR C
```

Instead, choose PR boundaries by risk:

```text
phase A + phase B -> one PR if combined risk is acceptable
phase C -> separate PR if it introduces a runtime loop or higher rollback risk
phase D + phase E -> one PR if they are coupled and testable together
```

---

## Risk levels

Use four risk levels for implementation planning and PR review.

| Risk | Meaning | Typical examples |
|---|---|---|
| `low` | Local, simple, easy to test and roll back. | Constants, pure type/model changes, simple initialization, focused tests. |
| `medium` | One meaningful behavior change or one layer plus a small adjacent update. | One state-system behavior, one construction rule, one HUD readout for existing state. |
| `elevated` | Several related phases bundled together, still reviewable and rollback-safe. | Economy caps + storage config + cap-safe processing + HUD caps, if all are same workstream and well tested. |
| `high` | Too broad or fragile for one PR. Must be split unless explicitly accepted. | Multiple runtime loops, gameplay + renderer + UI, production queue + spawning + new commands + HUD, or unclear rollback. |

`elevated` means higher than medium, but still acceptable when the project is early and the scope is coherent.

---

## Combined risk rule

Implementation PRs may combine phases only up to the allowed combined risk ceiling.

Current early-project ceiling:

```text
maximum allowed combined PR risk = elevated
```

If a proposed PR is `high`, split it into at least two PRs.

When the project becomes more mature and interconnected, especially around later roadmap blocks such as save/load, UI shell, combat, or enemy AI, the default ceiling should become stricter:

```text
mature-project default maximum = medium
```

`elevated` work in a mature phase requires an explicit decision from Denis.

`high` work should not be merged as one PR.

---

## Risk is not arithmetic

Combined risk is not calculated by adding labels mechanically.

Examples:

```text
low + low can stay low
```

if both changes are in the same pure state model and covered by simple tests.

```text
low + low can become medium
```

if they touch different files/layers or create a new behavior boundary.

```text
medium + medium usually becomes elevated or high
```

because each medium item already contains meaningful behavior.

```text
elevated + anything is usually high
```

unless the extra change is a tiny same-layer fix required by the elevated scope.

Judge combined risk by:

- number of layers touched;
- number of runtime behaviors changed;
- whether a new tick loop or queue is introduced;
- testability in one validation pass;
- rollback clarity;
- player-visible impact;
- whether the PR pulls in future ARCH scope;
- whether the PR body can explain the whole change without hiding complexity.

---

## Risk-based PR grouping

Implementation PRs should be grouped by risk, not split mechanically.

A PR may include multiple small phases if all are true:

- they belong to the same ARCH workstream;
- they touch the same architecture layer or a tightly coupled boundary;
- the behavior is easy to test in one validation pass;
- rollback is understandable;
- the PR body can clearly explain the whole change;
- the scope does not hide unrelated systems;
- the combined risk is not above the current allowed ceiling.

Split into separate PRs when any are true:

- the combined risk is `high`;
- the change crosses several layers at once, for example state + renderer + UI + assets;
- the change adds more than one new runtime loop or tick-based system;
- the change affects existing player-visible behavior in several places;
- the change needs manual visual QA and state logic changes together;
- rollback would be unclear;
- tests become broad and hard to reason about;
- the implementation starts pulling in future ARCH scope.

---

## Low-only PR policy

Low-only implementation PRs are discouraged by default.

A low-risk change can be valid by itself, but isolated low-only implementation PRs burn review time, executor context, PR preview cycles, and decision bandwidth. GPT should normally batch low-risk implementation changes into the next coherent `medium` or `elevated` PR instead of creating a separate PR for each small cleanup.

Default target for implementation PRs:

```text
preferred implementation PR risk = medium or elevated
```

This does **not** mean unrelated low-risk changes should be bundled just to increase risk. Low changes may be batched only when they are coherent:

- same ARCH workstream;
- same architecture layer or boundary;
- same manual QA path;
- same rollback story;
- no unrelated systems hidden inside the PR.

Correct examples:

```text
ARCH-14B — playtest HUD usability bundle
- throttle noisy preload logs
- improve playtest HUD labels
- clean duplicated status text
- add one missing same-layer button/status hint
risk: medium
```

```text
ARCH-05A — unit selection MVP
- click selection
- selected unit highlight
- minimal selected-unit HUD readout
risk: medium/elevated depending on scope
```

Bad examples:

```text
PRELOAD-LOG-01 — only throttle one console log
risk: low
```

if it can safely wait for the next coherent UI/playtest/devtools bundle.

```text
MIXED-LOW-01 — preload logs + roadmap typo + tank renderer rename + economy constant
```

This is unrelated batching and should be rejected even if each individual change is low-risk.

Allowed low-only exceptions:

- review fixup requested on an open PR;
- CI, PR preview, or workflow unblock;
- hotfix for broken `main` or broken preview;
- docs-only sync or policy update;
- PR metadata/body correction;
- safety or security issue;
- explicit Denis approval.

When GPT proposes a low-only implementation PR, it must explain:

```text
why this cannot be batched into a nearby medium/elevated PR
which exception applies
why waiting would be worse than merging now
```

If no exception applies, GPT should hold the low task and include it in the next coherent PR bundle.

---

## Smoke-check effect on PR risk

ARCH-11A introduced automated QA smoke checks (`npm run qa:smoke`, CI `QA Smoke Test` workflow, report/screenshot artifacts). This section clarifies how smoke automation affects risk grouping decisions.

### Core principle

Automated smoke checks improve confidence for coherent medium/elevated PRs, but they do not lower high-risk scope by default.

### What smoke checks validate

Smoke checks detect technical boot, preload, and runtime readiness issues:

- the Vite build succeeds;
- the preview server starts and responds;
- the game page opens in a headless Chromium instance;
- all three readiness markers appear in the console (`PreloadScene` assets loaded, `GameScene` textures verified, `GameScene` state-driven scene ready);
- no unhandled errors or failed network requests crash the page;
- a screenshot artifact is captured for manual inspection.

Smoke checks do **not** validate gameplay correctness, visual layout, UX sensitivity, or logic edge cases. They confirm that the application boots and reaches a runnable state without throwing technical errors.

### When smoke checks justify larger PRs

Smoke checks can justify larger coherent medium/elevated PRs when all of the following conditions are met:

- scope is the same workstream/layer — the PR does not cross unrelated systems;
- rollback is clear — reverting the PR restores the previous working state without side effects;
- `qa:smoke` is green — no console errors, no failed requests, all readiness markers present;
- `npm test`, `npm run typecheck`, and `npm run build` are all green;
- the PR body explains phase grouping and scope rationale.

When these conditions hold, a PR that would otherwise sit at the boundary of `medium` may be accepted as `elevated`, because smoke automation provides an additional automated gate that catches technical regressions before merge.

### What smoke checks do NOT permit

Smoke checks do **not** permit high-risk PRs by default. A green smoke run does not change a `high` risk assessment into `elevated` or `medium`.

High-risk PRs must still be split into smaller scoped PRs unless Denis explicitly accepts the risk. The reasons:

- smoke checks cannot detect gameplay logic errors, balance problems, or visual regressions;
- smoke checks cannot validate multi-system interactions that only emerge during manual play;
- a green smoke run on a high-scope PR only confirms the app boots — it does not confirm that all the interleaved systems work correctly together;
- high-risk PRs by definition have unclear rollback, and a screenshot artifact does not make rollback clearer.

### Smoke checks and manual QA

Smoke checks do not replace manual QA for:

- visual or gameplay correctness — sprite placement, animation timing, HUD layout;
- UX-sensitive changes — control responsiveness, information readability, interaction flow;
- cross-system behavior — economy loops under real play, unit pathfinding, construction sequences;
- any change where the correct result must be judged by a human looking at the running game.

Smoke automation reduces the chance that a technical boot/preload/runtime error slips through, but it does not reduce the need for human verification of behavior that requires judgement.

### Summary

```text
Green smoke + coherent scope + clear rollback + green CI = larger medium/elevated PR is acceptable.
Green smoke does NOT downgrade high risk.
High-risk PRs must still be split unless Denis explicitly accepts.
Smoke checks detect technical readiness, not gameplay correctness.
Smoke checks do not replace manual QA for visual/gameplay/UX-sensitive changes.
```

---

## Layer rule still applies

Risk-based grouping does not cancel the existing rule:

```text
one PR should not mix unrelated layers
```

Allowed examples:

```text
state model + pure tests
state model + small initialization update + pure tests
config constants + pure validation tests
state economy caps + cap-safe economy processing + HUD cap readout
```

Risky examples:

```text
economy state + separator tick loop + HUD + build menu + new assets
auto-gather pathfinding + manual move controls + UI commands
renderer formula + gameplay costs + production queues
storage caps + power online/offline + units-factory queue + spawning
```

If a PR starts drifting into another layer or future ARCH, split it.

---

## How GPT should plan an ARCH

For a new ARCH workstream, GPT should:

1. Read `PROJECT_STATE.md` and the relevant roadmap section.
2. Check whether `ROADMAP_SYSTEM_AUDIT.md` or another accepted design already covers the work.
3. If yes, do not request a duplicate big audit.
4. Identify the logical phases inside the ARCH.
5. Inspect current code only enough to detect drift and direct interfaces.
6. Estimate the risk of each phase.
7. Propose a risk-based PR sequence.
8. Combine low/medium adjacent steps where sensible, up to the allowed combined risk ceiling.
9. Avoid isolated low-only implementation PRs unless an explicit exception applies.
10. Split high-risk scopes into smaller PRs.
11. Prepare compact GLM prompts.

---

## How GLM should be used

GLM is an executor, not the planner.

For already-audited ARCH work:

- prefer `IMPLEMENTATION ONLY` tasks after GPT has selected the scope;
- use `PHASE 1 AUDIT ONLY` only when a real unknown remains;
- do not ask GLM to re-plan the whole roadmap;
- do not ask GLM to perform broad repo audits unless explicitly needed;
- do not send GLM isolated low-only implementation tasks unless an exception applies.

A valid small delta-check prompt can be used before implementation when the audit is known to be old.

---

## Example: ARCH-01 Economy baseline

ARCH-01 is the economy baseline. The accepted roadmap/audit already says economy is the next civil workstream and lists the baseline concepts.

Therefore ARCH-01 does not need a new large audit by default.

Logical phases inside ARCH-01 may be described as:

```text
A — raw -> matter/elements economy direction
B — separator processing
C — power-plant
D — units-factory
E — storage caps
F — builder/harvester costs
```

These phases are not mandatory PR boundaries.

A good flow is:

```text
ARCH-01 existing audit/design -> short current-code delta-check -> grouped implementation PRs
```

Example risk-based grouping:

```text
ARCH-01B — EconomyState + initial resources + matter-based construction
risk: medium

ARCH-01C — Separator processing cycle
risk: medium

ARCH-01D — Storage caps + storage buildings baseline + cap-safe processing
risk: elevated

ARCH-01E — Power-plant baseline + separator online/offline integration
risk: medium or elevated, depending on scope

ARCH-01F — Units-factory + builder/harvester production costs/queue
risk: elevated or high; split if queue + spawning + UI become too broad
```

Bad flow:

```text
ARCH-01D — only rawCap field
ARCH-01E — only matterCap field
ARCH-01F — only elementCap field
ARCH-01G — only raw-storage config
ARCH-01H — only matter-storage config
```

This is mechanical micro-splitting.

Also bad:

```text
ARCH-01D — storage caps + power-plant + units-factory + production queue + new build UI
```

This is high risk and must be split.

Do not implement all ARCH-01 items in one PR.

---

## PR review implication

When reviewing a PR, GPT should not reject it just because it contains more than one phase.

GPT should reject or request changes when the combined scope creates real risk:

- combined risk above allowed ceiling;
- unrelated systems;
- hidden renderer/gameplay coupling;
- untested runtime loops;
- future ARCH scope;
- broad changes with unclear rollback.

A PR with multiple phases can be mergeable when:

- risk is `low`, `medium`, or currently acceptable `elevated`;
- the PR body clearly explains phase grouping;
- tests cover each included phase;
- manual QA is clear;
- rollback is understandable.

A low-only implementation PR can be mergeable only when it matches an allowed exception or Denis explicitly accepts it.

---

## Short version

```text
Use big audits for big ARCH decisions.
ARCH phases are logical units, not mandatory PR boundaries.
Use risk-based PR grouping for implementation.
Batch low-risk implementation tasks by default.
Avoid low-only implementation PRs unless an exception applies.
Current early-project ceiling: elevated.
High-risk scopes must be split.
Smoke checks improve confidence for coherent medium/elevated PRs but do not lower high risk.
Smoke checks detect technical readiness, not gameplay correctness.
Smoke checks do not replace manual QA for visual/gameplay/UX-sensitive changes.
Do not re-audit what is already accepted.
Do not split so small that process overhead dominates.
Do not bundle so large that review/rollback becomes unsafe.
```