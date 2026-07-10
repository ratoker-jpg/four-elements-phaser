from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATUS_PATH = ROOT / 'docs/project/project-status.json'
GENERATOR_PATH = ROOT / 'tools/sync_project_status.mjs'

status = json.loads(STATUS_PATH.read_text(encoding='utf-8'))
status.update({
    'phase': 4,
    'phaseCode': 'SKIRMISH-P4',
    'phaseName': 'Multi-team match state',
    'status': 'READY_FOR_IMPLEMENTATION',
    'updated': '2026-07-10',
    'lastMergedPr': 346,
    'lastMergedTitle': 'Two-layer modular preview for the factory composer',
    'lastMergedCommit': 'd7636b05afe3505172e0d8f0625694dd429ca5cc',
    'nextStep': 'Introduce canonical TeamState and MatchState data with four factions, independent economy, unit cap, tech tier, vision, controller and ownership fields, then migrate the existing single-team state and saves without cross-team resource mutation.',
    'gate': 'Four teams must coexist in one canonical match state with independent resources, ownership and vision; mutating or producing for one team must not change another team, and existing single-team saves must migrate deterministically.',
    'validation': {
        'typecheck': 'PASS',
        'tests': 'PASS (full Vitest suite)',
        'build': 'PASS (GitHub Validation)',
        'smoke': 'PASS (GitHub QA Smoke)',
        'audit': 'PASS (0 high-severity vulnerabilities)',
        'assetBudget': 'PASS',
    },
    'manualQa': [
        'Select a completed units-factory and verify Wasp/Hunter and Smoky/Railgun can be selected independently in the active HUD.',
        'Confirm all four T1 combinations show the correct Russian quote, production time and two-layer modular preview.',
        'Queue and cancel combat, Builder and Harvester orders at the selected factory; verify progress and resources remain coherent.',
        'Produce two combat units, fight, save and reload; confirm movement, HP, target and cooldown state remain coherent.',
        'Accept donor weapon textures, projected tank tracks and dust in browser using issue #335.',
    ],
    'activeFollowUps': [
        'Issue #305: calibrate Smoky muzzle origin on Wasp hull only.',
        'Issue #330: complete manual visual QA for produced combat units in Normal mode.',
        'Issue #331: audit and reduce the current runtime asset footprint below the 5.2 GB guardrail.',
        'Issue #335: visually accept the donor VFX overlay, projected tracks and bounded dust.',
        'Implement SKIRMISH-P4A: canonical TeamState/MatchState, ownership fields, single-team migration and independent-team invariants.',
    ],
})
STATUS_PATH.write_text(json.dumps(status, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

generator = GENERATOR_PATH.read_text(encoding='utf-8')
phase2_anchor = '- Skirmish Phase 2B targeting, turret aiming, firing, damage and bounded wreck cleanup closed via PR #342.'
phase3_lines = '''- Skirmish Phase 3A config-driven T1 catalog and structured production closed via PR #344.
- Skirmish Phase 3B selectable factory composer in the active HUD closed via PR #345.
- Skirmish Phase 3C two-layer generated modular preview closed via PR #346.'''
if phase3_lines not in generator:
    if phase2_anchor not in generator:
        raise SystemExit('project-state Phase 2 anchor not found')
    generator = generator.replace(phase2_anchor, f'{phase2_anchor}\n{phase3_lines}', 1)

start_marker = 'function renderCurrentNext() {'
end_marker = '\n}\n\nconst agentsCurrent'
start = generator.index(start_marker)
end = generator.index(end_marker, start) + 2
new_function = r'''function renderCurrentNext() {
  return `# CURRENT_NEXT_STEP.md

Status: ${status.phaseCode} — ${status.phaseName}
Project: ${status.project}
Updated: ${status.updated}

> Generated from \`docs/project/project-status.json\`. Run \`npm run sync:project-status\` after changing status.

---

## Current status

${renderStatusBlock()}

## Default next work

1. Audit every global single-team assumption before changing behavior:
   - top-level \`playerFaction\`, \`economy\`, \`vision\`, \`hqPosition\` and \`production\`;
   - ownership of HQ, buildings, construction sites, Builders, Harvesters and combat units;
   - save/load, summaries, unit-cap selectors, fog and production mutation paths.
2. Define canonical pure data contracts:
   - \`TeamController = human | ai\`;
   - independent AI difficulty per enemy team;
   - \`TeamState\` with faction, economy, unit cap, tech tier, vision, HQ reference, controller and elimination state;
   - \`MatchState\` with four stable team IDs, player team ID and match clock/state.
3. Add explicit ownership fields to structures and civil/combat units. Ownership must use stable team IDs or a single accepted faction-derived key, not implicit \`playerFaction\` checks.
4. Create a deterministic migration from the current single-team \`GameState\`:
   - preserve the current player economy, entities, queues and vision in the human team;
   - create the other three team records without inventing map entities yet;
   - keep temporary compatibility selectors for existing single-team systems while Phase 4 is split across PRs.
5. Move resource, cap, tech and vision selectors behind owner-aware helpers. New code must never mutate another team through a top-level global reference.
6. Bump and migrate the save schema only when the canonical data contract is stable. Old saves must load into the same deterministic human team.
7. Add invariants and tests:
   - exactly four unique factions and team IDs;
   - exactly one human team;
   - independent economy and vision objects;
   - owner references resolve;
   - mutation/production for one team leaves all other teams byte-equivalent.
8. Keep this first slice data-focused. Rendering four bases, mirrored map generation, civil AI and strategic AI belong to later phases.

## Acceptance gate

${status.gate}

Prefer reviewable slices: P4A establishes contracts and migration; P4B routes economy/production/ownership selectors; P4C removes obsolete global assumptions after all call sites are owner-aware.

## Required validation for implementation PRs

- \`npm run check:project-status\`
- \`npm run typecheck\`
- \`npm test\`
- \`npm audit --audit-level=high\`
- \`npm run build\`
- \`npm run check:asset-budget\`
- \`npm run qa:smoke\`
- \`git diff --check\`
- final GitHub Actions status

## Manual QA carried forward

${listLines(status.manualQa)}

## Not next by default

- Symmetric four-corner map generation; that is Phase 5.
- Running four civil economies and replacement AI; that is Phase 6.
- Builder-local site search; that is Phase 7.
- Strategic AI, squads, victory/defeat or XP progression.
- Removing all compatibility fields in the first data-model PR.
- Broad renderer or HUD rewrites unrelated to team ownership.
- Unrelated issue #305 work inside ${status.phaseCode}.
`;
}'''
generator = generator[:start] + new_function + generator[end:]
GENERATOR_PATH.write_text(generator, encoding='utf-8')
