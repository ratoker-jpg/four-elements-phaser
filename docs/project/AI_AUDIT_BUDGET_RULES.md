# AI_AUDIT_BUDGET_RULES.md

Status: active budget rules  
Audience: GPT Project Lead / Opus / Claude / GLM / Codex  
Project: Four Elements Phaser  
Updated: 2026-06-14

---

## Purpose

This document prevents expensive AI audits from burning limits by using premium models for mechanical repository inventory.

It applies to broad architecture audits, cleanup audits, modular runtime audits, and any task that asks an AI to inspect many files.

The goal is simple:

```text
cheap facts first -> strong model synthesis second
```

---

## Why this exists

The OPUS-AUDIT-00 modular vehicle audit was useful, but expensive.

Usage report summary:

```text
- 4 Opus subagents were used for mechanical file-reading;
- subagents alone consumed 473,783 tokens and 199 tool calls;
- large files were read fully, including renderer/UI/governance files;
- the main Opus context accumulated large docs and subagent reports across many turns.
```

The lesson is not "avoid Opus".

The lesson is:

```text
Use Opus where Opus is needed: architecture synthesis and hard tradeoffs.
Do not use Opus as four parallel grep/read workers.
```

---

## Model routing rule

Use this routing for broad audits:

| Work type | Preferred model/tool |
|---|---|
| grep, search, file inventory, line references | scripts / rg / Haiku / Sonnet / GLM |
| compact facts inventory | Sonnet / GLM / cheaper subagent |
| final architecture synthesis | Opus |
| cohesive High+ refactor where splitting is harmful | Opus |
| scoped implementation from accepted audit | GLM / Sonnet |
| local filesystem / Blender / asset folders on Denis's PC | Codex read-only |

Opus should be the final architect, not the default file crawler.

---

## Two-phase audit pattern

For broad audits, use two phases.

### Phase A — facts inventory

Goal:

```text
collect facts, not opinions
```

Rules:

```text
- use Graphify first if available;
- use rg/grep before opening files;
- avoid reading files >400 lines fully;
- read only relevant line ranges;
- return file:path + line range + fact + risk;
- no architecture recommendations;
- no broad prose;
- max output: about 150-250 lines total, unless explicitly expanded.
```

Good output shape:

```text
src/phaser/render/BlockoutVehicleRenderer.ts:L340-L390
Fact: generated hull sprites are already rendered in Arena.
Risk: turret still procedural, so sprite turret wiring is not there.
Verify next: texture key resolver and depth handling.
```

Bad output shape:

```text
long narrative summary after reading 10 large files fully
```

### Phase B — architecture synthesis

Goal:

```text
turn the facts inventory into decisions
```

Inputs:

```text
- compact project context digest;
- Graphify summary;
- Phase A facts inventory;
- only selected file ranges;
- exact non-goals.
```

Output:

```text
- recommendation;
- cleanup order;
- implementation sequence;
- executor routing;
- validation;
- stop rules;
- open questions.
```

---

## Graphify rule

Use Graphify artifacts as a map, not as raw context.

Do:

```text
- parse graph.json / analysis.json with scripts;
- summarize top communities, central files, and dependency edges;
- use graph output to choose narrow file ranges.
```

Do not:

```text
- paste graph.json into model context;
- read broad folders blindly after Graphify is available;
- treat Graphify as a reason to skip source verification.
```

---

## Large-file reading rule

Do not read large files fully by default.

Threshold:

```text
>400 lines or >40 KB = large file
```

Required method:

```text
1. rg/grep target symbols first;
2. inspect imports/exports if needed;
3. read only relevant line ranges;
4. cite exact file:line evidence;
5. only full-read if the file is small or there is a written justification.
```

Examples of files that should not be fully read without justification:

```text
- BlockoutVehicleRenderer.ts
- GameScene.ts
- ArenaMenu.ts
- large generated manifests
- large governance bundles
- graph.json
```

---

## Subagent budget rule

If subagents are available, they must be budgeted.

Default caps:

```text
- use cheaper model for fact inventory when possible;
- max 20-25 tool calls per inventory subagent;
- max 120 lines returned per inventory subagent;
- no full reads of files over 400 lines;
- no independent architecture recommendations from inventory subagents;
- no duplicate reading of the same large file by multiple subagents.
```

Subagent prompt must include:

```text
Return only:
- file:path
- line range
- fact
- risk
- what to verify next
```

If a task cannot fit the budget, stop and ask GPT/Denis to split it.

---

## Context digest rule

Before a broad Opus audit, prefer a compact digest over many full docs.

Target digest size:

```text
150-250 lines
```

Digest should include:

```text
- current project state;
- active roadmap;
- strict non-goals;
- tool roles;
- source-of-truth docs list;
- what not to touch;
- current open question.
```

The digest does not replace source-of-truth docs. It reduces repeated full-doc reading.

---

## Stop conditions

Stop and propose a cheaper plan if:

```text
- expected audit cost is roughly >200k tokens;
- the prompt asks for 10+ full docs plus broad source exploration;
- the task requires reading multiple files over 400 lines fully;
- Opus subagents would be used only for grep/search/inventory;
- the requested output is arbitrarily huge without clear evidence needs.
```

Recommended fallback:

```text
1. Produce Phase A facts inventory with cheaper tooling.
2. Then ask Opus for Phase B synthesis from that inventory.
```

---

## Prompt template for economical Opus audit

```text
You are Opus, but do not perform broad repo exploration yourself.

Goal:
Create final architecture audit for <topic>.

Budget rules:
- Do not use Opus subagents for file-reading.
- If subagents are needed, use Sonnet/Haiku or a cheaper model.
- Do not read files >400 lines fully.
- Use grep/ripgrep first.
- Read only relevant line ranges.
- Do not paste large file contents into context.
- Do not dump graph.json.
- Parse Graphify artifact via script/CLI and return only summary tables.
- Stop if expected work exceeds roughly 200k tokens and report plan first.

Inputs:
1. PROJECT_CONTEXT_DIGEST.md
2. Graphify artifact
3. Accepted roadmap/audit prompt
4. Target docs list

Phase 1:
Produce a facts inventory only:
- active files
- legacy candidates
- key clusters
- file:line citations
No architecture recommendations.
No full file reads.
Max 200 lines.

Phase 2:
Using only the facts inventory and selected ranges, write the final audit:
- architecture recommendation
- cleanup order
- implementation plan
- validation
- non-goals

Do not implement.
Do not edit files.
```

---

## Non-goals

These rules do not mean:

```text
- never use Opus;
- avoid deep architecture work;
- skip source verification;
- prefer shallow audits;
- replace Opus with GLM for cohesive High+ refactors.
```

They mean:

```text
Opus should spend tokens on judgment, not on mechanical reading.
```
