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
        "phase": 6,
        "phaseCode": "SKIRMISH-P6",
        "phaseName": "Four-team civil economy",
        "status": "READY_FOR_IMPLEMENTATION",
        "updated": "2026-07-12",
        "lastMergedPr": 355,
        "lastMergedTitle": "Four-team exits, reachability and structural fairness validation",
        "lastMergedCommit": "83709db9f33897e3ec092ff17f6beb2979348e9d",
        "nextStep": (
            "Spawn one Builder and two Harvesters for every canonical team, bind each civil loop "
            "to its owner Headquarters and economy, then harden processing, depletion and save/load "
            "without cross-team mutation."
        ),
        "gate": (
            "Four teams must harvest, unload, process and spend resources simultaneously; every civil "
            "unit must use only its owner Headquarters and economy; finite deposits must deplete, the "
            "center Infinity must not, and save/load must preserve all four loops deterministically."
        ),
        "manualQa": [
            "Start a generated map as each player faction and confirm all four Headquarters, Builders and Harvesters use their owner faction assets.",
            "Observe all four civil loops simultaneously and confirm Harvesters return only to their owner Headquarters.",
            "Confirm finite quadrant resources deplete while the center Infinity remains available from all four approaches.",
            "Produce combat units, save and reload; confirm team ownership, factory preview, movement and HP remain coherent.",
            "Accept donor weapon textures, projected tank tracks and dust in browser using issue #335."
        ],
        "activeFollowUps": [
            "Issue #305: calibrate Smoky muzzle origin on Wasp hull only.",
            "Issue #330: complete manual visual QA for produced combat units in Normal mode.",
            "Issue #331: audit and reduce the current runtime asset footprint below the 5.2 GB guardrail.",
            "Issue #335: visually accept the donor VFX overlay, projected tracks and bounded dust.",
            "Implement SKIRMISH-P6A: deterministic four-team civil-unit bootstrap and owner-HQ binding."
        ],
    }
)
STATUS_PATH.write_text(json.dumps(status, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

sync = SYNC_PATH.read_text(encoding="utf-8")

p5_baseline = """- Skirmish Phase 4C owner-aware rendering, presentation and dev tools closed via PR #350.
- Skirmish Phase 5 activation and reviewable map slices established via PR #351.
- Skirmish Phase 5A canonical four-corner Headquarters closed via PR #352.
- Skirmish Phase 5B symmetric finite resources closed via PR #353.
- Skirmish Phase 5C canonical center Infinity contract closed via PR #354.
- Skirmish Phase 5D exits, reachability and structural fairness validation closed via PR #355."""
sync = sync.replace(
    "- Skirmish Phase 4C owner-aware rendering, presentation and dev tools closed via PR #350.",
    p5_baseline,
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

1. Implement deterministic four-team civil bootstrap as P6A:
   - generated four-HQ maps receive one Builder and two Harvesters per team;
   - civil-unit IDs are stable and independent from the selected human faction;
   - every unit receives canonical \`ownerTeamId\` and faction data;
   - spawn tiles are passable, deterministic and local to the owner Headquarters;
   - legacy one-HQ maps and old saves do not invent enemy civil units.
2. Complete owner-aware harvesting and processing as P6B:
   - Harvesters select resources, return and unload through their owner team only;
   - Headquarters, separators, storage caps, power and factories mutate only the owner economy;
   - finite resources deplete once globally; the center Infinity never depletes;
   - simultaneous team updates must not depend on the human faction alias.
3. Add civil destruction and bounded replacement as P6C:
   - destroyed Builders and Harvesters stop acting and release occupancy;
   - AI teams can replace missing minimum civil units without hidden resources;
   - replacement requests obey team unit caps, power and production ownership;
   - deterministic IDs replace remaining \`Date.now()\` civil spawn IDs.
4. Close persistence and isolation as P6D:
   - save/load preserves four economies, civil ownership, cargo, targets and processing progress;
   - old saves migrate into the canonical four-team shape;
   - tests prove no cross-team resource mutation and deterministic replay behavior.
5. Keep this phase civil-only. Builder-local placement, Headquarters combat, faction bonuses, XP and strategic combat AI remain later phases.

## Acceptance gate

${status.gate}

Prefer reviewable slices: P6A establishes deterministic team-owned civil starts; P6B closes simultaneous harvesting and processing; P6C handles civil loss and replacement; P6D closes save/load, isolation and the phase.

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

- Builder-local automatic construction; that is Phase 7.
- Headquarters damage, elimination and victory/defeat; that is Phase 8.
- Faction bonuses; that is Phase 9.
- XP and independent M0-M3 upgrades; that is Phase 10.
- Strategic combat AI; that is Phase 11.
- Broad terrain, obstacle or asset changes unrelated to four-team civil economy.
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
print("SKIRMISH-P6 status patch applied")
