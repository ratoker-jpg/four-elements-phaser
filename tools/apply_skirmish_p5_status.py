from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
STATUS = ROOT / 'docs/project/project-status.json'
GENERATOR = ROOT / 'tools/sync_project_status.mjs'

status = json.loads(STATUS.read_text(encoding='utf-8'))
status.update({
    'phase': 5,
    'phaseCode': 'SKIRMISH-P5',
    'phaseName': 'Symmetric four-corner map',
    'status': 'READY_FOR_IMPLEMENTATION',
    'updated': '2026-07-11',
    'lastMergedPr': 350,
    'lastMergedTitle': 'Owner-aware rendering, HUD faction data and dev spawning',
    'lastMergedCommit': 'bbbe2013a13ca3545f465168daee20831d36c10e',
    'nextStep': 'Introduce a backward-compatible four-Headquarters map contract, generate deterministic corner starts by mirroring one accepted placement, then mirror finite quadrant resources around one shared center Infinity deposit.',
    'gate': 'The same seed and size must produce exactly four unique non-overlapping corner Headquarters, equivalent finite resource value and access per quadrant, one protected center Infinity deposit, and deterministic validation results.',
    'manualQa': [
        'Start a generated map for each player faction and verify the camera and human compatibility HQ resolve to the selected team corner.',
        'Inspect all four corners and confirm each Headquarters and Builder uses the owning faction assets.',
        'Confirm finite resource groups are equivalent by quadrant and the center contains exactly one Infinity deposit with four approaches.',
        'Produce combat units, save and reload; confirm team ownership, factory preview, movement and HP remain coherent.',
        'Accept donor weapon textures, projected tank tracks and dust in browser using issue #335.',
    ],
    'activeFollowUps': [
        'Issue #305: calibrate Smoky muzzle origin on Wasp hull only.',
        'Issue #330: complete manual visual QA for produced combat units in Normal mode.',
        'Issue #331: audit and reduce the current runtime asset footprint below the 5.2 GB guardrail.',
        'Issue #335: visually accept the donor VFX overlay, projected tracks and bounded dust.',
        'Implement SKIRMISH-P5A: canonical four-Headquarters map data, legacy HQ migration and deterministic corner placement.',
    ],
})
STATUS.write_text(json.dumps(status, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

text = GENERATOR.read_text(encoding='utf-8')
old_baseline = """- Skirmish Phase 3C two-layer generated modular preview closed via PR #346.
- Produced combat units use `GameState.combatUnits` as canonical state; render data is derived."""
new_baseline = """- Skirmish Phase 3C two-layer generated modular preview closed via PR #346.
- Skirmish Phase 4A canonical four-team state, ownership and save v5 migration closed via PR #348.
- Skirmish Phase 4B owner-aware selection, commands, construction and HUD selectors closed via PR #349.
- Skirmish Phase 4C owner-aware rendering, presentation and dev tools closed via PR #350.
- Produced combat units use `GameState.combatUnits` as canonical state; render data is derived."""
if old_baseline not in text:
    raise RuntimeError('baseline marker not found')
text = text.replace(old_baseline, new_baseline, 1)

start = text.find('function renderCurrentNext() {')
end = text.find('\nconst agentsCurrent =', start)
if start < 0 or end < 0:
    raise RuntimeError('renderCurrentNext boundaries not found')

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

1. Define one backward-compatible map contract for four Headquarters:
   - add canonical four-team Headquarters placements with stable owner IDs;
   - preserve the legacy human \`mapData.hq\` alias during migration;
   - keep Headquarters footprints at 3x3 and reject duplicate or overlapping owners.
2. Implement deterministic corner placement as P5A:
   - generate one accepted lower-left Headquarters placement;
   - mirror it vertically and horizontally for the other three teams;
   - use one fixed faction-to-corner mapping;
   - update \`TeamState.hqPosition\` from canonical map placements.
3. Make map infrastructure multi-HQ aware:
   - occupancy and construction exclusion must include all Headquarters;
   - render all Headquarters with owner faction assets;
   - map validation must report per-team exits rather than checking only the human HQ;
   - old custom maps and saves must still normalize to one human Headquarters plus three teams without map entities.
4. Implement symmetric finite resources as P5B:
   - generate finite starter/side/contested placements in one quadrant;
   - mirror placements across X and Y without overlap;
   - preserve equal resource classes, footprints and total finite value per quadrant;
   - keep resource IDs/order deterministic.
5. Implement the center contract as P5C:
   - exactly one Infinity deposit centered deterministically;
   - construction exclusion around the center footprint;
   - at least four passable approach sectors;
   - no finite resource or Headquarters overlap with the protected center zone.
6. Add fairness validation as P5D:
   - exactly four unique corner teams and Headquarters;
   - equal finite resource value by quadrant;
   - at least two exits from every start zone;
   - every team can reach starter resources and the center;
   - same seed and size produce byte-equivalent structural output.
7. Keep this phase map-focused. Civil AI, simultaneous economy updates, HQ combat and victory remain later phases.

## Acceptance gate

${status.gate}

Prefer reviewable slices: P5A establishes four-HQ contracts and corner placement; P5B mirrors finite resources; P5C establishes protected center Infinity; P5D adds fairness/path validation and closes the phase.

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

- Running four civil economies and replacement AI; that is Phase 6.
- Builder-local site search; that is Phase 7.
- Headquarters damage, elimination and victory/defeat; that is Phase 8.
- Faction bonuses, XP, M0-M3 progression or strategic AI.
- Broad terrain, obstacle or asset changes unrelated to symmetric map contracts.
- Unrelated issue #305 work inside ${status.phaseCode}.
`;
}
'''
text = text[:start] + new_function + text[end:]
GENERATOR.write_text(text, encoding='utf-8')

print('SKIRMISH-P5 status patch applied')
