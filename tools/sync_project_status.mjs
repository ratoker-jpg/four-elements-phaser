#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const STATUS_PATH = resolve(ROOT, 'docs/project/project-status.json');
const AGENTS_PATH = resolve(ROOT, 'AGENTS.md');
const PROJECT_STATE_PATH = resolve(ROOT, 'docs/project/PROJECT_STATE.md');
const CURRENT_NEXT_PATH = resolve(ROOT, 'docs/project/CURRENT_NEXT_STEP.md');
const CHECK_ONLY = process.argv.includes('--check');

const START = '<!-- PROJECT_STATUS:START -->';
const END = '<!-- PROJECT_STATUS:END -->';

const status = JSON.parse(await readFile(STATUS_PATH, 'utf8'));

function validateStatus(value) {
  const requiredStrings = [
    'project', 'repository', 'roadmap', 'roadmapDocument', 'phaseCode', 'phaseName', 'status',
    'updated', 'lastMergedTitle', 'lastMergedCommit', 'nextStep', 'gate',
  ];
  for (const key of requiredStrings) {
    if (typeof value[key] !== 'string' || value[key].trim() === '') {
      throw new Error(`project-status.json: ${key} must be a non-empty string`);
    }
  }
  if (!Number.isInteger(value.schemaVersion) || value.schemaVersion < 1) {
    throw new Error('project-status.json: schemaVersion must be a positive integer');
  }
  if (!Number.isInteger(value.phase) || value.phase < 0) {
    throw new Error('project-status.json: phase must be a non-negative integer');
  }
  if (!Number.isInteger(value.lastMergedPr) || value.lastMergedPr < 1) {
    throw new Error('project-status.json: lastMergedPr must be a positive integer');
  }
  if (!value.validation || typeof value.validation !== 'object') {
    throw new Error('project-status.json: validation object is required');
  }
  if (!Array.isArray(value.manualQa) || !Array.isArray(value.activeFollowUps)) {
    throw new Error('project-status.json: manualQa and activeFollowUps must be arrays');
  }
}

validateStatus(status);

function listLines(items, fallback = '- none') {
  return items.length > 0 ? items.map(item => `- ${item}`).join('\n') : fallback;
}

function validationTable() {
  const labels = {
    typecheck: 'TypeScript',
    tests: 'Tests',
    build: 'Build',
    smoke: 'QA smoke',
    audit: 'Dependency audit',
    assetBudget: 'Asset budget',
  };
  const rows = Object.entries(labels).map(([key, label]) => `| ${label} | ${status.validation[key] ?? 'UNKNOWN'} |`);
  return ['| Check | Result |', '|---|---|', ...rows].join('\n');
}

function renderStatusBlock() {
  return `${START}
Updated: ${status.updated}

\`\`\`text
${status.roadmap} — Phase ${status.phase}: ${status.phaseName}
Status: ${status.status}
Last merged: PR #${status.lastMergedPr} — ${status.lastMergedTitle}
Next: ${status.nextStep}
Gate: ${status.gate}
\`\`\`
${END}`;
}

function replaceMarkedBlock(text, replacement, path) {
  const startIndex = text.indexOf(START);
  const endIndex = text.indexOf(END);
  if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
    throw new Error(`${path}: missing or invalid ${START}/${END} markers`);
  }
  return `${text.slice(0, startIndex)}${replacement}${text.slice(endIndex + END.length)}`;
}

function renderProjectState() {
  return `# PROJECT_STATE.md

Status: generated active operational state
Project: ${status.project}
Repo: \`${status.repository}\`
Updated: ${status.updated}

> Generated from \`docs/project/project-status.json\`. Run \`npm run sync:project-status\` after changing status.

---

## Current mode

${renderStatusBlock()}

## Current baseline

- RTS Foundation roadmap/audit accepted via PR #322.
- Validation baseline closed via PR #324.
- Canonical multi-unit combat production and save/load fixup closed via PR #325.
- Playable Four-Faction Skirmish roadmap accepted via PR #338.
- Skirmish Phase 1 bounded destruction lifecycle closed via PR #339.
- Skirmish Phase 2A canonical movement, selection, occupancy and fog runtime closed via PR #341.
- Skirmish Phase 2B targeting, turret aiming, firing, damage and bounded wreck cleanup closed via PR #342.
- Skirmish Phase 3A config-driven T1 catalog and structured production closed via PR #344.
- Skirmish Phase 3B selectable factory composer in the active HUD closed via PR #345.
- Skirmish Phase 3C two-layer generated modular preview closed via PR #346.
- Skirmish Phase 4A canonical four-team state, ownership and save v5 migration closed via PR #348.
- Skirmish Phase 4B owner-aware selection, commands, construction and HUD selectors closed via PR #349.
- Skirmish Phase 4C owner-aware rendering, presentation and dev tools closed via PR #350.
- Produced combat units use \`GameState.combatUnits\` as canonical state; render data is derived.
- Full Validation, QA Smoke, Graphify and asset-budget checks are available in GitHub Actions.
- Number keys 1–9 recall control groups; Ctrl+1–9 assigns them.

## Validation baseline

${validationTable()}

## Manual QA still required

${listLines(status.manualQa)}

Automated checks do not replace visual acceptance for produced-unit rendering, destruction effects and save/load behavior.

## Active follow-ups

${listLines(status.activeFollowUps)}

## Current source-of-truth documents

1. \`AGENTS.md\`
2. \`docs/project/project-status.json\`
3. \`docs/project/PROJECT_STATE.md\`
4. \`docs/project/CURRENT_NEXT_STEP.md\`
5. \`${status.roadmapDocument}\`
6. \`docs/project/FINAL_RTS_FOUNDATION_ROADMAP_2026_06_22.md\`
7. \`docs/project/FINAL_RTS_FOUNDATION_IMPLEMENTATION_AUDIT_2026_06_22.md\`
8. \`docs/project/CAMERA_PROJECTION_CONTRACT.md\`

The Playable Four-Faction Skirmish roadmap is the active implementation queue. Historical closure details remain in the older roadmap, audit and closure documents.

## Non-negotiable architecture

- Phaser 4.1.0, strict TypeScript, Vite, WebGL-only.
- Fixed isometric/axonometric 2.5D camera; camera rotation is forbidden.
- Hull and turret remain separate assets with socket/pivot metadata.
- Do not create a combined hull × turret sprite matrix.
- Modular assets load on demand; do not preload the full matrix.
- Produced combat units are canonical in \`combatUnits\`; render data is derived.
- Do not create a third combat runtime or copy \`BlockoutVehicleState\` wholesale into Normal Game.
- Reuse or extract pure Arena movement, aiming, range, hit and damage systems.
- Do not restore legacy Wasp preload, offset tuner, dual renderer or legacy GameWorld.

## Stop rules

Stop and correct the task if:

- active docs disagree with \`project-status.json\`;
- work follows the old RTS Foundation phase queue instead of the active Skirmish roadmap;
- Normal Game combat creates a parallel state source instead of extending canonical \`combatUnits\`;
- visual/world-space work ignores \`CAMERA_PROJECTION_CONTRACT.md\`;
- unrelated work changes economy, map generation, save/load or renderer lifecycle;
- a PR claims manual visual QA that was not performed;
- required GitHub checks are red or absent.
`;
}

function renderCurrentNext() {
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

const agentsCurrent = await readFile(AGENTS_PATH, 'utf8');
const expected = new Map([
  [AGENTS_PATH, replaceMarkedBlock(agentsCurrent, renderStatusBlock(), AGENTS_PATH)],
  [PROJECT_STATE_PATH, renderProjectState()],
  [CURRENT_NEXT_PATH, renderCurrentNext()],
]);

let drift = false;
for (const [path, content] of expected) {
  let current = '';
  try {
    current = await readFile(path, 'utf8');
  } catch {
    current = '';
  }
  if (current === content) continue;
  drift = true;
  if (CHECK_ONLY) {
    console.error(`[project-status] DRIFT: ${path.slice(ROOT.length + 1)}`);
  } else {
    await writeFile(path, content);
    console.log(`[project-status] updated ${path.slice(ROOT.length + 1)}`);
  }
}

if (CHECK_ONLY && drift) {
  console.error('[project-status] Run npm run sync:project-status and commit the generated files.');
  process.exit(1);
}

console.log(drift ? '[project-status] sync complete' : '[project-status] already synchronized');
