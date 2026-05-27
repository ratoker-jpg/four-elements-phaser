# ARCH_SCOPING_POLICY.md

Status: accepted workflow policy v3 — high-controlled default + failed-fix audit rule  
Audience: GPT / task planning / PR review  
Project: Four Elements Phaser

---

## Purpose

This document defines how large roadmap blocks (`ARCH-*`) should turn into implementation PRs and how failed fix attempts should be handled.

It exists to prevent three bad extremes:

1. **One uncontrolled mega-PR** — risky, hard to review, mixes unrelated systems.
2. **Mechanical micro-PR splitting** — too slow, burns executor context, creates unnecessary process overhead.
3. **Repeated ad-hoc fix guessing** — multiple small fixes that chase symptoms without a shared root-cause model.

The correct approach is:

```text
large ARCH -> accepted audit/design -> risk-based scoped PR package -> implementation -> review/hardening -> merge
failed fix cluster -> fix-cluster audit -> scoped fix package -> implementation -> manual QA -> merge/follow-up
```

---

## Current working model after ARCH-11A and ARCH-05X

ARCH-11A added automated smoke QA:

```text
npm run qa:smoke
CI QA Smoke Test
report/screenshot artifacts
```

ARCH-05X proved GLM can handle a large, coherent, multi-layer implementation when GPT and Denis actively control the scope, review the diff, run validation, and perform manual QA.

Therefore the project no longer treats `elevated` as the normal ceiling.

Current default implementation mode:

```text
preferred implementation PR size = high-controlled
```

`high-controlled` means a larger PR is acceptable when it is one coherent workstream and has strong gates:

- one product/system domain;
- clear rollback path;
- tests for state/helper logic;
- `npm test`, `npm run typecheck`, `npm run build`, and `npm run qa:smoke` green;
- PR body explains layers and risks;
- GPT review is performed;
- Denis performs manual QA for visual/gameplay/UX-sensitive behavior;
- hardening pass is allowed before merge.

This is not blind trust in GLM. GLM remains the executor. GPT and Denis remain the control layer.

---

## Risk levels

| Risk | Meaning | Current use |
|---|---|---|
| `low` | Local, simple, easy to test and roll back. | Do not usually make separate low-only implementation PRs. Batch into a coherent larger PR unless an exception applies. |
| `medium` | One meaningful behavior change or one layer plus a small adjacent update. | Safe, but often too small for current workflow if it can be batched coherently. |
| `elevated` | Several related phases bundled together, still reviewable and rollback-safe. | Safe working size; no longer the ceiling. |
| `high-controlled` | Larger coherent implementation across multiple related layers inside one workstream. | New default target for GLM implementation when scope is clear and validation/QA gates exist. |
| `high+` | Broad, multi-layer implementation with meaningful gameplay/runtime interaction. | Allowed when explicitly approved by Denis and still limited to one connected domain. |
| `uncontrolled-high` | Unrelated systems mixed into one PR. | Reject/split. |

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

Do not automatically implement:

```text
phase A -> PR A
phase B -> PR B
phase C -> PR C
```

Instead, choose PR boundaries by coherence and risk:

```text
phase A + phase B + phase C -> one PR if they are one domain and testable together
phase D -> separate PR if it starts another domain or changes rollback story
```

---

## Coherence rule

A large PR may be accepted when all changes support one clear domain.

Good high/high+ examples:

```text
ARCH-05 movement/control/passability
- unit selection
- manual civil move
- resource approach behavior
- passability blocking
- focused tests
```

This is broad, but coherent: one domain is civil unit control/movement.

Bad high/high+ examples:

```text
menu shell + tank movement + economy balancing + save/load
```

```text
asset pipeline + renderer rewrite + gameplay controls
```

```text
combat AI + production economy + UI shell
```

These are unrelated domains. They must be split.

---

## Combined risk rule

Current early-project ceiling:

```text
maximum normal PR risk = high-controlled
```

Allowed with Denis approval:

```text
high+ in one coherent domain
```

Reject or split:

```text
uncontrolled-high / unrelated-system bundle
```

A PR is not rejected just because it is large. It is rejected when it mixes unrelated systems, hides risk, lacks validation, or cannot be reviewed/rolled back.

---

## Smoke-check effect on PR risk

Smoke checks improve confidence and are now part of the standard gate for runtime/gameplay PRs.

Smoke checks validate:

- build succeeds;
- preview server starts;
- page opens in Chromium;
- readiness console markers appear;
- no unhandled errors or failed critical requests;
- screenshot/report artifact is produced.

Smoke checks do **not** validate:

- gameplay correctness;
- visual placement;
- control feel;
- economy balance;
- pathfinding edge cases;
- long-session behavior.

Therefore:

```text
Green smoke makes high-controlled PRs easier to trust.
Green smoke does not replace GPT review or Denis manual QA.
```

For high/high+ gameplay PRs, manual QA is mandatory.

---

## Hardening pass rule

Large PRs are allowed to go through review-hardening cycles before merge.

Accepted hardening examples:

- remove prototype `as any` state fields;
- type runtime state properly;
- remove unsafe fallback behavior;
- fix manual QA findings that were not fully specified in the original prompt;
- update stale PR body or docs.

A hardening pass should not expand the product scope. If a fix starts a new domain, it becomes a follow-up PR.

---

## Failed-fix audit rule

When a fix does not converge after one or two focused implementation attempts, stop implementation and switch to a small audit.

Trigger this rule when any of the following happens:

- the first fix fails manual QA and the second fix would require guessing;
- the same bug reappears after a different implementation approach;
- a local visual bug turns out to involve several models, such as state position, renderer anchor, input, and asset crop;
- GPT/GLM starts debating which coordinate/owner/model is correct;
- manual QA finds a new symptom caused by the fix itself;
- the PR starts accumulating repeated small tweak commits without a stable root-cause model.

Required response:

```text
STOP implementation.
Run FIX-CLUSTER-AUDIT or FIX-ROADMAP-AUDIT.
Return audit report only.
Do not add another blind tweak.
```

### FIX-CLUSTER-AUDIT

Use for one bug cluster inside one PR or one feature area.

Output should include:

```text
root cause
failed attempts analysis
current model / ownership map
recommended model
exact files/functions to change
tests needed
manual QA checklist
risks
what stays out of scope
final implementation prompt
```

### FIX-ROADMAP-AUDIT

Use when several related follow-up bugs should be grouped into a mini-roadmap.

Example:

```text
unit visual grounding
selection marker model
tile-lane movement readability
civil unit centering
anchor debug tools
```

The output should group fixes into coherent PR packages, just like a normal ARCH roadmap.

### Merge with known follow-up

If a PR partially fixes the problem and the remaining issues belong to a broader fix cluster, it may be merged only when:

- the partial fix has standalone value;
- remaining issues are documented in the PR comments/body;
- Denis explicitly accepts the follow-up;
- the follow-up will be handled through fix-cluster or fix-roadmap audit, not ad-hoc tweaks.

---

## Low-only PR policy

Low-only implementation PRs are discouraged by default.

A low-risk change can be valid by itself, but isolated low-only implementation PRs burn review time, executor context, PR preview cycles, and decision bandwidth.

Default behavior:

```text
batch low-risk implementation work into the next coherent medium/elevated/high-controlled PR
```

Allowed low-only exceptions:

- review fixup requested on an open PR;
- CI, PR preview, or workflow unblock;
- hotfix for broken `main` or broken preview;
- docs-only sync or policy update;
- PR metadata/body correction;
- safety or security issue;
- explicit Denis approval.

---

## How GPT should plan implementation

For a new workstream, GPT should:

1. Read `PROJECT_STATE.md`, this policy, roadmap, and relevant audit/design docs.
2. Identify whether the requested work is one coherent domain.
3. Prefer a larger coherent PR over mechanical micro-splitting.
4. Use high-controlled as the default implementation target when the scope is clear.
5. Allow high+ when Denis explicitly approves and the PR remains one connected domain.
6. Reject unrelated-system bundles even if GLM is capable.
7. Require tests/typecheck/build/qa-smoke for runtime work.
8. Require manual QA for visual/gameplay/UX-sensitive work.
9. Use hardening passes before merge when review finds prototype debt.
10. Use failed-fix audit when repeated fixes stop converging.
11. Fall back to smaller elevated PRs if GLM starts requiring too many fixups or the diff becomes unreviewable.

---

## How GLM should be used

GLM is an executor, not the planner.

For already accepted work:

- prefer `IMPLEMENTATION ONLY` after GPT has selected scope;
- do not ask GLM to re-plan the roadmap;
- do not ask for broad audits unless a real unknown remains;
- allow high-controlled/high+ implementation when the prompt explicitly scopes it;
- require PR body layer breakdown for high/high+ PRs;
- keep PRs unmerged until GPT/Denis review.

For high/high+ work, GLM PR body must include:

```text
Goal
Layer breakdown
Files changed
Risk/limitations
Validation
Manual QA checklist
Rollback plan
What is intentionally not implemented
Next step / follow-up
```

For failed-fix audit work, GLM must not edit code, commit, push, or open PR unless the task explicitly changes from audit mode to implementation mode.

---

## PR review implication

GPT should not reject a PR merely because it is large.

GPT should request changes when:

- the PR mixes unrelated systems;
- PR body does not match the diff;
- validation is missing or falsely reported;
- runtime/gameplay changes lack tests where testable;
- manual QA found blockers;
- prototype debt remains in merge-critical code;
- rollback is unclear.

GPT should stop requesting small fixups and switch to audit when the failed-fix audit rule is triggered.

A high/high+ PR can be mergeable when:

- it is one coherent domain;
- it passes validation;
- GPT review is complete;
- Denis manual QA is acceptable;
- remaining issues are explicitly accepted as follow-up;
- rollback is understandable.

---

## Short version

```text
Do not mechanically split ARCH phases.
Do not make low-only implementation PRs by default.
Current default implementation target: high-controlled.
High+ is allowed with explicit Denis approval when it stays inside one coherent domain.
Large PRs are allowed, but only with tests, qa:smoke, GPT review, manual QA, and hardening.
Smoke checks catch technical readiness, not gameplay correctness.
Manual QA remains mandatory for visual/gameplay/UX-sensitive changes.
If a fix fails after 1-2 attempts, stop implementation and run FIX-CLUSTER-AUDIT.
Group recurring related bugs into FIX-ROADMAP-AUDIT instead of ad-hoc tweaks.
Reject unrelated-system bundles even if each part looks manageable.
If GLM starts needing too many fixups or the PR becomes unreviewable, fall back to elevated/smaller PRs.
```
