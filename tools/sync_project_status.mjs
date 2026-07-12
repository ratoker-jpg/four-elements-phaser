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
- Skirmish Phase 5 activation and reviewable map slices established via PR #351.
- Skirmish Phase 5A canonical four-corner Headquarters closed via PR #352.
- Skirmish Phase 5B symmetric finite resources closed via PR #353.
- Skirmish Phase 5C canonical center Infinity contract closed via PR #354.
- Skirmish Phase 5D exits, reachability and structural fairness validation closed via PR #355.
- Skirmish Phase 6 activation established via PR #356.
- Skirmish Phase 6A deterministic four-team civil bootstrap closed via PR #357.
- Skirmish Phase 6B owner-isolated harvesting, processing, storage and power closed via PR #358.
- Skirmish Phase 6C deterministic civil destruction and AI replacement closed via PR #359.
- Skirmish Phase 6D save v6, civil migration and deterministic continuation closed via PR #360.
- Skirmish Phase 7 activation established via PR #361.
- Skirmish Phase 7 selected-Builder local automatic construction closed via PR #362.
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

1. Establish canonical Headquarters combat state as P8A:
   - give every canonical Headquarters a stable target ID, HP, max HP, armor and destruction timestamps;
   - migrate legacy maps/saves without inventing duplicate Headquarters;
   - keep \`mapData.hq\` as the selected-human compatibility alias only;
   - persist damaged and destroyed Headquarters deterministically.
2. Extend production combat targeting as P8B:
   - resolve combat-unit and Headquarters targets through one target abstraction;
   - path and range calculations use Headquarters 3x3 footprints;
   - reject friendly, missing, destroyed and eliminated targets;
   - apply damage, cooldown, muzzle feedback and target cleanup consistently.
3. Apply team elimination transactionally:
   - mark the owner team eliminated once when its Headquarters reaches zero HP;
   - stop that team's factories, queues and civil replacement policy;
   - disable or clean remaining owned units through bounded transitions;
   - keep other teams and economies unaffected.
4. Complete match result and UX as P8C:
   - human Headquarters destroyed means Defeat;
   - all three enemy Headquarters destroyed means Victory;
   - freeze new human commands after result;
   - expose one deterministic result overlay and restart with the same seed/setup;
   - preserve result state through save/load.
5. Add pure-state, integration and browser coverage:
   - partial HQ damage and save/load;
   - single-team elimination isolation;
   - victory and defeat exactly once;
   - post-elimination production/AI rejection;
   - restart retains the same generated-map seed.
6. Keep this phase match-result focused. Faction bonuses, XP/M0-M3 and strategic AI remain later phases.

## Acceptance gate

${status.gate}

Prefer reviewable slices: P8A establishes Headquarters state and damage; P8B connects combat targeting and elimination; P8C closes result UX, persistence and the phase.

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

- Faction bonuses; that is Phase 9.
- XP and independent M0-M3 upgrades; that is Phase 10.
- Strategic combat AI; that is Phase 11.
- Broad terrain, obstacle or asset changes unrelated to Headquarters combat/result flow.
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
