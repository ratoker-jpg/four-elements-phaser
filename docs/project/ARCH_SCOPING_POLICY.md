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

## Risk-based PR grouping

Implementation PRs should be grouped by risk, not split mechanically.

A PR may include multiple small phases if all are true:

- they belong to the same ARCH workstream;
- they touch the same architecture layer or a tightly coupled boundary;
- the behavior is easy to test in one validation pass;
- rollback is understandable;
- the PR body can clearly explain the whole change;
- the scope does not hide unrelated systems.

Split into separate PRs when any are true:

- the change crosses several layers at once, for example state + renderer + UI + assets;
- the change adds a new runtime loop or tick-based system;
- the change affects existing player-visible behavior in several places;
- the change needs manual visual QA and state logic changes together;
- rollback would be unclear;
- tests become broad and hard to reason about;
- the implementation starts pulling in future ARCH scope.

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
```

Risky examples:

```text
economy state + separator tick loop + HUD + build menu + new assets
auto-gather pathfinding + manual move controls + UI commands
renderer formula + gameplay costs + production queues
```

If a PR starts drifting into another layer, split it.

---

## How GPT should plan an ARCH

For a new ARCH workstream, GPT should:

1. Read `PROJECT_STATE.md` and the relevant roadmap section.
2. Check whether `ROADMAP_SYSTEM_AUDIT.md` or another accepted design already covers the work.
3. If yes, do not request a duplicate big audit.
4. Inspect current code only enough to detect drift and direct interfaces.
5. Propose a risk-based PR sequence.
6. Combine low-risk adjacent steps where sensible.
7. Split medium/high-risk runtime loops, UI/rendering, and gameplay changes.
8. Prepare compact GLM prompts.

---

## How GLM should be used

GLM is an executor, not the planner.

For already-audited ARCH work:

- prefer `IMPLEMENTATION ONLY` tasks after GPT has selected the scope;
- use `PHASE 1 AUDIT ONLY` only when a real unknown remains;
- do not ask GLM to re-plan the whole roadmap;
- do not ask GLM to perform broad repo audits unless explicitly needed.

A valid small delta-check prompt can be used before implementation when the audit is known to be old.

---

## Example: ARCH-01 Economy baseline

The accepted roadmap/audit already says economy is the next civil workstream and lists the baseline concepts.

Therefore ARCH-01 does not need a new large audit by default.

A good flow is:

```text
ARCH-01 existing audit/design -> short current-code delta-check -> grouped implementation PRs
```

Possible grouping example:

```text
ARCH-01B — Economy state model + initial resources + HUD readout
ARCH-01C — Construction costs switch to matter + tests
ARCH-01D — Separator processing cycle + tests
ARCH-01E — Storage caps / blocked processing
ARCH-01F — Units-factory production baseline
```

If the delta-check finds that several early items are low risk and same-layer, they may be combined.

Do not implement all ARCH-01 items in one PR.

---

## PR review implication

When reviewing a PR, GPT should not reject it just because it contains more than one small phase.

GPT should reject or request changes when the combined scope creates real risk:

- unrelated systems;
- hidden renderer/gameplay coupling;
- untested runtime loops;
- future ARCH scope;
- broad changes with unclear rollback.

---

## Short version

```text
Use big audits for big ARCH decisions.
Use risk-based PR grouping for implementation.
Do not re-audit what is already accepted.
Do not split so small that process overhead dominates.
Do not bundle so large that review/rollback becomes unsafe.
```
