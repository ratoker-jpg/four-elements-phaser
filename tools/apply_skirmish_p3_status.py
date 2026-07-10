from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATUS_PATH = ROOT / "docs/project/project-status.json"
GENERATOR_PATH = ROOT / "tools/sync_project_status.mjs"

status = json.loads(STATUS_PATH.read_text(encoding="utf-8"))
status.update({
    "phase": 3,
    "phaseCode": "SKIRMISH-P3",
    "phaseName": "T1 factory composer",
    "status": "READY_FOR_IMPLEMENTATION",
    "updated": "2026-07-10",
    "lastMergedPr": 342,
    "lastMergedTitle": "Normal Game targeting, firing and damage runtime",
    "lastMergedCommit": "2e1bc98a029ce6cc81028a587c91957c0b1c7678",
    "nextStep": "Implement a config-driven T1 factory composer that independently selects Wasp or Hunter and Smoky or Railgun, calculates additive cost and production time, previews the modular tank and queues a structured production request.",
    "gate": "All four legal T1 hull/turret combinations must be produced through structured requests, preserve separate hull and turret fields, render correctly and remain backward-compatible with Builder, Harvester and legacy Wasp + Smoky queue items.",
    "validation": {
        "typecheck": "PASS",
        "tests": "PASS (full Vitest suite)",
        "build": "PASS (GitHub Validation)",
        "smoke": "PASS (GitHub QA Smoke)",
        "audit": "PASS (0 high-severity vulnerabilities)",
        "assetBudget": "PASS",
    },
    "manualQa": [
        "Produce two combat units in Normal Game, issue movement and attack commands and confirm they can fight, take damage and be removed after destruction.",
        "Confirm Smoky fires on cooldown and Railgun waits for its wind-up before damage is applied.",
        "Save and reload produced combat units during movement and combat; confirm ownership, HP, target and cooldown state remain coherent.",
        "Accept donor weapon textures, projected tank tracks and dust in browser using issue #335.",
    ],
    "activeFollowUps": [
        "Issue #305: calibrate Smoky muzzle origin on Wasp hull only.",
        "Issue #330: complete manual visual QA for produced combat units in Normal mode.",
        "Issue #331: audit and reduce the current runtime asset footprint below the 5.2 GB guardrail.",
        "Issue #335: visually accept the donor VFX overlay, projected tracks and bounded dust.",
        "Implement SKIRMISH-P3: config-driven T1 hull/turret composer, modular preview, structured queue display and all four legal combinations.",
    ],
})
STATUS_PATH.write_text(json.dumps(status, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

generator = GENERATOR_PATH.read_text(encoding="utf-8")
old_baseline = """- Skirmish Phase 1 bounded destruction lifecycle closed via PR #339.\n- Produced combat units use `GameState.combatUnits` as canonical state; render data is derived."""
new_baseline = """- Skirmish Phase 1 bounded destruction lifecycle closed via PR #339.\n- Skirmish Phase 2A canonical movement, selection, occupancy and fog runtime closed via PR #341.\n- Skirmish Phase 2B targeting, turret aiming, firing, damage and bounded wreck cleanup closed via PR #342.\n- Produced combat units use `GameState.combatUnits` as canonical state; render data is derived."""
if old_baseline not in generator and new_baseline not in generator:
    raise SystemExit("project-state baseline marker not found")
generator = generator.replace(old_baseline, new_baseline, 1)

start_marker = "function renderCurrentNext() {"
end_marker = "\n}\n\nconst agentsCurrent"
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

1. Audit the complete structured production path from factory UI to queue item and spawned \`ModularCombatUnit\`:
   - \`UnitProductionRequest\` and legacy \`ProducibleUnitType\` compatibility;
   - component cost and time configuration;
   - queue serialization and cancellation;
   - spawn placement and deterministic IDs;
   - modular renderer inputs.
2. Define one config-driven T1 component catalog for Wasp, Hunter, Smoky and Railgun. Do not scatter matter, element or time constants across UI and production code.
3. Implement pure additive composition helpers:
   - unit matter cost = hull matter + turret matter;
   - unit element cost = hull element units + turret element units;
   - production time = max(hull time, turret time) + assembly offset;
   - legal combinations are Wasp/Hunter × Smoky/Railgun only.
4. Replace the fixed Wasp + Smoky production action with independent hull and turret selection while keeping Builder and Harvester available.
5. Add a modular preview derived from the selected body, weapon and modification fields. Do not create combined hull × turret sprites.
6. Show the selected combination, additive cost, production time and queue progress in Russian. Rejections must clearly explain missing factory, resources, capacity or invalid selection.
7. Preserve structured requests through queueing, save/load and spawn. Migrate old \`wasp-smoky\` queue items to the canonical request.
8. Add focused tests for all four combinations, calculation, queue persistence, cancellation/refund behavior and renderer inputs.

## Acceptance gate

${status.gate}

Split the phase into reviewable slices if needed: first establish component configuration and pure production calculation, then wire the factory composer, preview and queue presentation.

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

- Multi-team economy, mirrored map generation or strategic AI before their roadmap phases.
- Headquarters damage, victory/defeat flow or elimination cleanup.
- Full M0–M3 XP progression and upgrade purchase flow.
- T2/T3 content or additional hulls and turrets beyond the accepted T1 roster.
- Broad renderer, HUD or GameScene rewrite unrelated to the composer.
- Full modular asset preload or a combined hull × turret sprite matrix.
- Unrelated fix for issue #305 inside ${status.phaseCode}.
`;
}'''
generator = generator[:start] + new_function + generator[end:]
GENERATOR_PATH.write_text(generator, encoding="utf-8")
