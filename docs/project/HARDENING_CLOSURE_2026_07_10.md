# Repository hardening closure — 2026-07-10

The repository audit and hardening sequence is complete.

## Merged work

- PR #325 — canonical multi-unit combat production, deterministic IDs, structured production requests and save v4 migration.
- PR #326 — required Validation workflow, asset budget, production sourcemap policy and closed-PR preview cleanup.
- PR #327 — generated project-status source of truth and drift gate.
- PR #328 — behavior-preserving map-generation module boundaries and symmetry primitives.
- PR #329 — integration lifecycle test covering production, render derivation, save/load and unit cap.

## Current automated baseline

- TypeScript: pass.
- Vitest: 5,261 tests across 110 files.
- Build: pass in GitHub Validation.
- QA Smoke: pass.
- Dependency audit: no high-severity vulnerabilities.
- Asset budget: pass against the current 5.2 GB guardrail.

## Honest remaining gates

- Issue #330: manual browser QA for two produced combat units and save/load visuals.
- Issue #331: audit and materially reduce the existing runtime asset footprint.
- Issue #305: Wasp + Smoky muzzle-origin visual calibration.

## Next roadmap state

Phase 3 is ready for design, not runtime implementation. The factory hull/turret selection interaction must be explicit and accepted before implementation begins.
