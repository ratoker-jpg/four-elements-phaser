# FIX_ROADMAP_AUDIT_PROMPT.md

Status: reusable prompt template  
Project: Four Elements Phaser

---

## Purpose

Use this prompt when repeated local fixes stop converging and the issue should be treated as a small system/roadmap problem instead of another ad-hoc tweak.

This is especially useful for bug clusters that cross state, renderer, input, assets, or manual QA expectations.

---

## Prompt template

```text
Task:
FIX-ROADMAP-AUDIT — <short bug cluster name>

Mode:
AUDIT REPORT ONLY.

Important:
Do not edit files.
Do not commit.
Do not push.
Do not open a PR.
Return the audit report only.

Context:
<Describe the failed fix cluster. Include PR numbers, screenshots/video observations, and what already failed.>

Known failed attempts:
1. <attempt 1>
2. <attempt 2>
3. <attempt 3 if relevant>

Current symptoms:
- <symptom 1>
- <symptom 2>
- <symptom 3>

Read first:
- docs/project/GLM_EXECUTOR_RULES.md
- docs/project/PROJECT_STATE.md
- docs/project/ARCH_SCOPING_POLICY.md
- docs/ROADMAP.md
- <relevant state files>
- <relevant renderer files>
- <relevant input/UI files>

Audit goal:
Create a practical fix roadmap for this bug cluster.

Required report structure:

# FIX_ROADMAP_AUDIT.md

## 1. Executive summary
Explain the real problem and why repeated small fixes failed.

## 2. Current system model
Explain the current state/render/input/data model involved in the bug cluster.

## 3. Failed attempts analysis
For every failed attempt, explain what it assumed and why it did not solve the real issue.

## 4. Root causes
Separate symptoms from root causes.

## 5. Correct target model
Pick the recommended model. Do not list five equal options.

## 6. Fix roadmap
Group fixes into coherent PR packages.
For each PR package include:
- title;
- goal;
- files likely touched;
- risk;
- tests;
- manual QA;
- rollback plan;
- what stays out of scope.

## 7. Tests and validation strategy
List automated tests, typecheck/build/smoke, and any missing test hooks.

## 8. Manual QA strategy
List concrete manual checks and failure criteria.

## 9. Risks and anti-patterns
List risks, including what not to do.

## 10. Final recommended next prompt
Write the exact implementation prompt for the first PR package.

Hard constraints:
- No implementation.
- No broad feature expansion.
- No unrelated-system bundling.
- Respect architecture boundaries.
- If the issue is too large, split the audit into smaller fix clusters.
```

---

## Current candidate use

The next likely use is:

```text
FIX-ROADMAP-AUDIT — Unit visual grounding, selection marker, lane movement readability
```

Candidate symptoms:

- selection ring does not visually sit under builder/harvester;
- harvester does not read as centered on tile;
- civil unit movement can look like it crosses cells/lane boundaries;
- unit grounding/anchor model is unclear;
- repeated PR #63 fixes did not fully solve visual grounding.
