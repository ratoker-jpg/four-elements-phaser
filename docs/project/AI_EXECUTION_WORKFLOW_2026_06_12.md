# AI_EXECUTION_WORKFLOW_2026_06_12.md

Status: accepted workflow amendment candidate  
Project: Four Elements Phaser  
Repo: `ratoker-jpg/four-elements-phaser`  
Date: 2026-06-12

---

## 1. Purpose

This document defines the temporary multi-agent execution model for the current bugfix/polish phase.

It does **not** replace:

```text
- docs/project/PROJECT_STATE.md
- docs/project/CURRENT_NEXT_STEP.md
- docs/project/GPT_WORKFLOW.md
- docs/project/GLM_EXECUTOR_RULES.md
- accepted roadmap / audit docs
```

It clarifies how to use Claude/Opus, Codex, GLM, and GPT without burning high-value model limits on work that cheaper/lower-context agents can do.

---

## 2. Current project discipline still applies

The project has closed roadmap/audit cycles. Closed docs remain reference material, not active implementation queues.

Current high-level rule remains:

```text
roadmap -> system audit -> scoped steps -> implementation -> PR review -> manual QA -> merge decision
```

Bug/polish work must not become random one-off hacking. It should be collected into a scoped **fix roadmap/backlog**, audited, split into implementation steps, and then executed.

---

## 3. Immediate owner-selected sequence

The current operational sequence is:

```text
1. Create this AI execution workflow docs PR.
2. Create CODEMAP docs so agents can route to the right files cheaply.
3. Collect the current visual/arena/core bugs into one fix roadmap/backlog.
4. Run GLM audit on that fix roadmap/backlog.
5. Split accepted audit into High / High+ implementation steps.
6. Implement steps using Claude/Opus or Codex depending on task type and remaining limits.
7. Use GLM mainly for patch application / PR delivery when needed.
8. GPT reviews every PR before merge recommendation.
9. Denis performs final visual/manual QA and decides merge/no-merge.
```

Do not continue the turret/grid/visual fix sequence until steps 1 and 2 are done unless Denis explicitly overrides.

---

## 4. Agent role matrix

| Agent/tool | Primary role | Use for | Avoid using for |
|---|---|---|---|
| GPT | coordinator / reviewer / task writer | scope control, prompt writing, PR review, merge/no-merge advice, docs direction | unverified assumptions, broad code changes without reading repo docs |
| GLM | low-cost executor / audit / PR delivery | roadmap/fix-backlog audits, applying provided patches, running validation, opening PRs, Telegram notification | creative architecture, broad implementation design, visual guesswork |
| Claude / Opus | high-value code executor | difficult local patches, renderer/gameplay fixes, root-cause implementation, complex local validation | routine audits, repeated repo scans, PR push when permissions are blocked |
| Codex 5.5 | high-value code executor / independent reviewer | complex code implementation, visual/runtime debugging, screenshot-driven validation, PRs when its GitHub access works | routine patch delivery, broad scope without a precise task |
| Denis | product owner / visual QA | final visual acceptance, priorities, roadmap decisions, merge approval | accepting code based only on passing tests |

---

## 5. Claude / Opus operating rule

Claude/Opus is valuable and limited. Use it as a code executor, not as a routine repo scanner.

Use Claude/Opus for:

```text
- difficult renderer/runtime patches
- root-cause implementation when the code path is hard
- local validation and screenshot/manual inspection when useful
- patch handoff when push is blocked
```

Do not use Claude/Opus for:

```text
- routine roadmap audits
- repetitive docs reads
- applying an already-reviewed patch to GitHub
- repeated push retries after 403
```

When Claude/Opus cannot push:

```text
1. Retry push at most once.
2. If still blocked by 403, stop push attempts.
3. Produce patch handoff:
   - base SHA
   - head SHA
   - changed files
   - validation results
   - full `git format-patch --stdout origin/main..HEAD`
4. Do not keep amending/retrying unless Denis/GPT asks.
```

---

## 6. Codex 5.5 operating rule

Codex 5.5 can be used as a high-value implementation agent and, when connected with write access, can open PRs directly.

Use Codex for:

```text
- complex code patches
- independent review of Claude patches
- visual/runtime fixes where screenshots and browser QA help
- PR creation when its repository access is working
```

Codex must still follow the same scope boundaries:

```text
- read required docs first
- do not broaden scope
- do not change unrelated systems
- run validation
- open PR into main
- do not merge
```

If Codex cannot push, it follows the same patch-handoff rule as Claude.

---

## 7. GLM operating rule in this mode

GLM is used mainly as:

```text
- fix-roadmap audit executor
- patch application executor
- validation runner
- PR opener
- Telegram notifier
```

GLM should not redesign implementation if the task says `PATCH APPLY ONLY`.

For patch delivery tasks, GLM must:

```text
1. Start from latest origin/main.
2. Apply the exact patch.
3. Stop if the patch does not apply cleanly.
4. Change only allowed files.
5. Run required validation.
6. Open PR into main.
7. Do not merge.
8. Send Telegram notification when configured.
```

---

## 8. GPT operating rule in this mode

GPT must protect the workflow from wasted high-value model usage.

Before sending work to Claude/Opus or Codex, GPT should decide:

```text
- Is this actually a high-value code task?
- Can GLM do the audit instead?
- Can GLM apply a ready patch instead?
- Is a CODEMAP/project map available to reduce file scanning?
- Has this approach failed twice already?
```

GPT should prefer:

```text
GLM audit -> GPT task slicing -> Claude/Codex implementation -> GPT review -> GLM patch/PR if needed
```

GPT must not recommend merge based only on an agent summary. It must inspect PR metadata, changed files, diff/scope, validation, and manual QA status.

---

## 9. CODEMAP requirement

The next docs step after this file is:

```text
DOCS-CODEMAP-01 — create docs/project/CODEMAP.md
```

Purpose:

```text
- map files to responsibilities
- reduce repeated repo scanning
- route agents to exact files quickly
- define task-specific "read first" file groups
```

Once created, future tasks should start with:

```text
Read docs/project/CODEMAP.md first.
Use it as routing map.
Do not scan the whole repository unless CODEMAP is insufficient.
```

---

## 10. Fix roadmap / bug backlog process

After CODEMAP, current visual/arena/core issues should be collected into a single scoped fix roadmap/backlog.

The fix roadmap should include:

```text
- bug description
- screenshot/preview evidence if available
- expected behavior
- suspected systems
- out-of-scope systems
- manual QA checklist
- priority: High+ / High / Medium / Low
```

Then GLM should produce an audit for that fix roadmap:

```text
- root causes
- impacted files/systems
- implementation order
- risks
- PR slicing
- validation plan
- manual QA plan
```

Only after Denis/GPT accepts the audit should Claude/Opus or Codex implement the steps.

---

## 11. Current known examples that motivated this rule

Recent failed attempts showed why code review is not enough without manual visual QA:

```text
- PR #245: depth-only turret fix passed code review shape but failed preview.
- PR #246: Smoky turret sprite appeared but was mounted/rotated incorrectly in preview.
```

Lesson:

```text
passing tests + plausible diff != accepted visual result
```

Visual/runtime PRs require manual preview by Denis before merge.

---

## 12. Required validation by PR type

Implementation PRs:

```bash
npm run typecheck
npm run test
npm run build
npm run qa:smoke
```

Docs-only PRs:

```text
No runtime validation required.
PR body must state: docs only; no code/assets/runtime/dependency changes.
```

Visual/runtime PRs additionally require:

```text
- preview URL
- screenshot or manual QA notes when possible
- Denis visual acceptance before merge
```

---

## 13. Telegram rule

GLM tasks should keep the final Telegram block:

```text
Telegram:
After completing the task, send Denis a Telegram notification.
You already know where to send it.
Include:
- task name
- PR link or patch handoff status
- short result
- validation status
- whether GPT review is needed
```

If a tool does not have Telegram configured, it must report that notification was unavailable instead of pretending it sent one.

---

## 14. Stop conditions

Stop and return to GPT/Denis if:

```text
- the task tries to continue a closed roadmap by inertia
- there is no accepted fix roadmap/audit for broad bugfix implementation
- patch does not apply cleanly
- Claude/Codex push is blocked by 403
- a task expands beyond allowed files/systems
- the same approach failed twice
- visual result contradicts the intended behavior even if tests pass
```
