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
        "phase": 8,
        "phaseCode": "SKIRMISH-P8",
        "phaseName": "Headquarters combat, elimination and match result",
        "status": "READY_FOR_IMPLEMENTATION",
        "updated": "2026-07-12",
        "lastMergedPr": 362,
        "lastMergedTitle": "Selected-Builder local automatic construction",
        "lastMergedCommit": "739a523e76a706f0593fd7c9d9f39ec50fdc7632",
        "nextStep": (
            "Introduce canonical Headquarters durability and target IDs, route production combat attacks "
            "against enemy Headquarters, eliminate teams on HQ destruction, then expose deterministic "
            "victory/defeat state and a restart-with-same-seed result flow."
        ),
        "gate": (
            "Every canonical Headquarters must be targetable, damageable and persistable; destroying one "
            "must eliminate only its owner team and disable that team's production/replacement logic; "
            "losing the human HQ must produce Defeat and destroying all three enemy HQs must produce Victory."
        ),
        "manualQa": [
            "Attack each enemy Headquarters with produced tanks and confirm HP, damage feedback and owner faction remain correct.",
            "Destroy one enemy Headquarters and confirm only that team stops production and civil replacement while other teams continue.",
            "Destroy all three enemy Headquarters and confirm Victory appears once with restart using the same seed.",
            "Destroy the human Headquarters and confirm Defeat appears once and gameplay commands stop.",
            "Save and load before and after an HQ is damaged/eliminated and confirm HP, eliminated teams and match result persist.",
            "Move a selected Builder and confirm construction still starts locally after the Phase 8 changes.",
            "Accept donor weapon textures, projected tank tracks and dust in browser using issue #335."
        ],
        "activeFollowUps": [
            "Issue #305: calibrate Smoky muzzle origin on Wasp hull only.",
            "Issue #330: complete manual visual QA for produced combat units in Normal mode.",
            "Issue #331: audit and reduce the current runtime asset footprint below the 5.2 GB guardrail.",
            "Issue #335: visually accept the donor VFX overlay, projected tracks and bounded dust.",
            "Implement SKIRMISH-P8A: canonical Headquarters durability, damage and elimination state."
        ],
    }
)
STATUS_PATH.write_text(json.dumps(status, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

sync = SYNC_PATH.read_text(encoding="utf-8")
phase7_baseline = """- Skirmish Phase 6D save v6, civil migration and deterministic continuation closed via PR #360.
- Skirmish Phase 7 activation established via PR #361.
- Skirmish Phase 7 selected-Builder local automatic construction closed via PR #362."""
sync = sync.replace(
    "- Skirmish Phase 6D save v6, civil migration and deterministic continuation closed via PR #360.",
    phase7_baseline,
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
print("SKIRMISH-P8 status patch applied")
