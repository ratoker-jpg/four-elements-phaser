from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STATUS_PATH = ROOT / "docs/project/project-status.json"
SYNC_PATH = ROOT / "tools/sync_project_status.mjs"

status = json.loads(STATUS_PATH.read_text(encoding="utf-8"))
status.update(
    {
        "phase": 7,
        "phaseCode": "SKIRMISH-P7",
        "phaseName": "Builder-local automatic construction",
        "status": "READY_FOR_IMPLEMENTATION",
        "updated": "2026-07-12",
        "lastMergedPr": 360,
        "lastMergedTitle": "Four-team civil save/load and migration",
        "lastMergedCommit": "64595fc10853b5406daf210f0fb12809c8a699a1",
        "nextStep": (
            "Replace Headquarters/building-anchor placement with an expanding-ring search around the "
            "selected Builder, validate footprint spacing and Builder reachability, assign that exact "
            "Builder, and preserve resources on every failed request."
        ),
        "gate": (
            "Moving the selected Builder must change where the next building is constructed; the chosen "
            "site must be the nearest deterministic legal and reachable footprint within a bounded radius, "
            "with one empty tile between buildings, no resource charge on failure and clear Russian feedback."
        ),
        "manualQa": [
            "Move one Builder away from Headquarters, select it and confirm the next building is placed near that Builder rather than the base.",
            "Select different Builders in different corners and confirm each build request uses the selected Builder and owner economy.",
            "Block every site inside the bounded radius and confirm no matter is deducted and Russian failure feedback is shown.",
            "Confirm completed buildings preserve one empty tile between footprints and Builders can physically reach the assigned site.",
            "Produce combat units, save and reload; confirm team ownership, factory preview, movement and HP remain coherent.",
            "Accept donor weapon textures, projected tank tracks and dust in browser using issue #335."
        ],
        "activeFollowUps": [
            "Issue #305: calibrate Smoky muzzle origin on Wasp hull only.",
            "Issue #330: complete manual visual QA for produced combat units in Normal mode.",
            "Issue #331: audit and reduce the current runtime asset footprint below the 5.2 GB guardrail.",
            "Issue #335: visually accept the donor VFX overlay, projected tracks and bounded dust.",
            "Implement SKIRMISH-P7: selected-Builder local search, reachability and exact assignment."
        ],
    }
)
STATUS_PATH.write_text(json.dumps(status, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

sync = SYNC_PATH.read_text(encoding="utf-8")
phase6_baseline = """- Skirmish Phase 5D exits, reachability and structural fairness validation closed via PR #355.
- Skirmish Phase 6 activation established via PR #356.
- Skirmish Phase 6A deterministic four-team civil bootstrap closed via PR #357.
- Skirmish Phase 6B owner-isolated harvesting, processing, storage and power closed via PR #358.
- Skirmish Phase 6C deterministic civil destruction and AI replacement closed via PR #359.
- Skirmish Phase 6D save v6, civil migration and deterministic continuation closed via PR #360."""
sync = sync.replace(
    "- Skirmish Phase 5D exits, reachability and structural fairness validation closed via PR #355.",
    phase6_baseline,
)

render_current_next = r'''function renderCurrentNext() {
  return `# CURRENT_NEXT_STEP.md

Status: ${status.phaseCode} — ${status.phaseName}
Project: ${status.project}
Updated: ${status.updated}

> Generated from \`docs/project/project-status.json\`. Run \`npm run sync:project-status\` after changing status.

---

## Current status

${renderStatusBlock()}

## Default next work

1. Make the selected Builder the only construction anchor:
   - resolve the primary selected Builder by stable ID;
   - reject missing, foreign, busy or destroyed Builders;
   - use the Builder's current fractional tile position rather than Headquarters or existing buildings;
   - keep owner economy and ownership explicit.
2. Implement bounded deterministic local site search:
   - expand outward in Manhattan rings from the selected Builder;
   - validate the full building footprint and map bounds;
   - preserve one complete empty tile between building/construction footprints;
   - reject resources, obstacles, units and protected center tiles;
   - break equal-distance ties deterministically.
3. Validate Builder reachability before spending resources:
   - find at least one passable tile adjacent to the candidate footprint;
   - compute a cardinal path from the selected Builder to that approach tile;
   - reject unreachable candidates and continue the local search;
   - return no-valid-site after the bounded radius is exhausted.
4. Bind construction to the exact selected Builder:
   - create the site only after search and path validation succeed;
   - deduct matter only on successful placement;
   - assign the selected Builder and validated path immediately;
   - do not let another idle Builder steal the request.
5. Add Russian failure feedback and regression coverage:
   - no selected Builder;
   - Builder busy/destroyed/foreign;
   - insufficient matter;
   - no reachable legal site;
   - deterministic placement and no mutation on every rejection.
6. Keep this phase construction-only. Headquarters combat, faction bonuses, XP and strategic combat AI remain later phases.

## Acceptance gate

${status.gate}

This phase should close through one cohesive implementation PR plus a status closure PR; do not split the placement algorithm from exact Builder assignment because the transaction must remain atomic.

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

- Headquarters damage, elimination and victory/defeat; that is Phase 8.
- Faction bonuses; that is Phase 9.
- XP and independent M0-M3 upgrades; that is Phase 10.
- Strategic combat AI; that is Phase 11.
- Broad terrain, obstacle or asset changes unrelated to Builder-local construction.
- Unrelated issue #305 work inside ${status.phaseCode}.
`;
}'''

sync, count = re.subn(
    r"function renderCurrentNext\(\) \{.*?\n\}\n\nconst agentsCurrent",
    render_current_next + "\n\nconst agentsCurrent",
    sync,
    count=1,
    flags=re.S,
)
if count != 1:
    raise RuntimeError("renderCurrentNext replacement marker not found")

SYNC_PATH.write_text(sync, encoding="utf-8")
print("SKIRMISH-P7 status patch applied")
