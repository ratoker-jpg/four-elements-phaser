# ARCH_PACKAGE_POLICY.md

Status: accepted workflow policy — expanded coherent PR packages  
Audience: GPT / GLM / PR review  
Project: Four Elements Phaser

---

## Purpose

This document defines when the project may intentionally increase implementation step size beyond a single small ARCH phase.

The goal is to keep speed without losing control.

```text
small mechanical PRs are not required
large coherent packages are allowed
unrelated-system bundles are still rejected
```

---

## Current implementation modes

### Standard mode

```text
Risk: high-controlled
```

Use this for one coherent roadmap workstream where the scope is clear and validation/QA gates exist.

Examples:

```text
ARCH-15A — local save/load skeleton
ARCH-11A — devtools QA sandbox MVP
ARCH-07A — production loop readability
```

### Expanded mode

```text
Risk: high+ coherent package
```

Use this when several adjacent ARCH phases are one connected domain and are safer/faster to implement together than as mechanical micro-PRs.

This is allowed only when Denis explicitly approves the package.

---

## What makes a high+ package acceptable

A high+ package is acceptable when it has:

- one product/system domain;
- one clear user/testing goal;
- shared files or shared contracts;
- one rollback story;
- one manual QA scenario group;
- clear out-of-scope list;
- tests/typecheck/build/qa-smoke gates;
- GPT review before merge;
- Denis manual QA before merge.

The package may be large, but it must not be conceptually mixed.

---

## Good package examples

### Devtools package

```text
ARCH-11B + ARCH-12A
Debug overlays + QA sandbox/test arena MVP
```

Why coherent:

```text
devtools + diagnostics + QA acceleration
same purpose
same testers
shared GameScene/dev UI/debug contracts
```

### UI/save package

```text
ARCH-14C + ARCH-15B
UI shell polish + save list/delete/clear UX
```

Why coherent:

```text
menu flow + Continue screen + save-slot UX
same DOM shell
same manual QA flow
```

### Map setup package

```text
ARCH-16A + ARCH-16B
Map seed + map setup screen
```

Why coherent:

```text
new game setup + map initialization
same launch config path
```

### Asset workflow package

```text
ARCH-17A + ARCH-17B
asset registry + object adding workflow
```

Why coherent:

```text
asset pipeline governance + sample viewer/runtime checklist
same pipeline domain
```

---

## Bad package examples

Do not combine unrelated domains even if each part is individually manageable.

Bad examples:

```text
devtools + faction asset wiring
```

```text
save/load + combat readiness
```

```text
mapgen + harvester movement fix
```

```text
UI settings + pathfinding changes
```

```text
combat + enemy AI in one first PR
```

These are multi-domain bundles. They should be split.

---

## Required mini-contract audit inside high/high+ prompts

For high-controlled and high+ packages, GLM must include a mini-contract audit in the PR body or implementation summary.

Required fields:

```text
Risk level
Why this package is coherent
Touched layers
Touched implicit contracts
What is explicitly not touched
Rollback slices
Manual QA groups
```

Examples of implicit contracts:

```text
occupancy: soft-occupied does not block isPassable
renderer lifecycle: state-added dynamic entities need sprites on sync
save/load: loaded slot id must be preserved for re-save
DOM overlays: scene shutdown must remove old DOM nodes
```

This is not a separate audit phase. It is a short contract check inside the implementation PR.

---

## PR body requirements for high+ coherent package

A high+ coherent package PR body must include:

```text
Goal
Risk: high+ coherent package
Why this package is coherent
Touched layers
Touched implicit contracts
Files changed
Validation results
Manual QA checklist grouped by scenario
Known limitations
Follow-ups
Rollback plan
What is intentionally not implemented
```

---

## Review rule

GPT should not reject a PR only because it is large.

GPT should reject or request split when:

- the package mixes unrelated systems;
- rollback is unclear;
- manual QA would require unrelated scenarios;
- validation is missing;
- PR body does not explain touched contracts;
- GLM is fixing many semantic issues caused by scope overload.

If a high+ package needs too many fixup rounds, fall back to smaller `high-controlled` packages for the next workstream.

---

## Short version

```text
Default: high-controlled.
Expanded: high+ coherent package.
Allowed: bigger PRs inside one connected domain.
Forbidden: unrelated-system bundles.
High+ requires Denis approval, explicit risk label, contract audit, validation, GPT review, and manual QA.
```
