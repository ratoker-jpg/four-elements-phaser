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

1. Audit the exact boundary between canonical \`GameState.combatUnits\` and Arena-only \`blockoutVehicles\`:
   - movement and tile reservation;
   - turret aiming;
   - weapon range and cooldown;
   - hit and armor calculation;
   - damage attribution and destruction;
   - input, selection and command routing;
   - save/load migration.
2. Define the smallest backward-compatible Normal Game combat runtime fields on \`ModularCombatUnit\` or composed child state:
   - fractional tile position;
   - HP and max HP;
   - move/stop order;
   - current target;
   - weapon cooldown;
   - destroyed state.
3. Extract or adapt pure shared helpers from Arena. Do not import Phaser or copy the complete \`BlockoutVehicleState\` into production state.
4. Implement movement and stop commands for factory-produced combat units before attack behavior.
5. Add target acquisition, turret aiming, firing, damage and bounded destruction using the shared combat formulas.
6. Keep \`CombatUnitRenderer\` as a derived view of canonical state and update it from fractional position and facing.
7. Migrate old saves with safe defaults and preserve deterministic IDs.
8. Add focused lifecycle tests and one end-to-end state test: \`produce → move → target → damage → destroy → save/load\`.

## Acceptance gate

${status.gate}

The phase should be split into reviewable PRs. The first implementation PR establishes canonical runtime state and move/stop lifecycle without strategic AI, multi-team economy or the factory composer.

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

- Strategic Enemy AI, scouting, economy planning or win/lose flow.
- Four-team state or mirrored four-corner map before their roadmap phases.
- Factory hull/turret composer before the Normal Game combat runtime is functional.
- Full M0–M3 XP progression.
- Broad renderer or GameScene lifecycle rewrite.
- Full modular asset preload.
- Reopening closed AoE4 UX work by inertia.
- Unrelated fix for issue #305 inside ${status.phaseCode}.
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
