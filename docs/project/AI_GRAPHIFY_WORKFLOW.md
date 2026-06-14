# AI_GRAPHIFY_WORKFLOW.md

Status: active AI tooling workflow  
Audience: GPT / GLM / Opus / Codex / repo agents  
Project: Four Elements Phaser  
Updated: 2026-06-14

---

## Purpose

Graphify is an AI tooling layer for repository understanding. It is not game runtime code.

Use it to reduce repeated broad file reading by heavy models and to make system audits start from a repository graph instead of raw grep/scanning.

---

## Rule

```text
Graph first for repository-level reasoning.
```

Before a broad architecture audit, cleanup audit, modular asset runtime audit, or High/High+ implementation plan, agents should use a fresh Graphify artifact when available.

Do not ask Denis to download the repo or PR locally just to build project context.

---

## GitHub-first workflow

Graphify runs in GitHub Actions through:

```text
.github/workflows/graphify.yml
```

The workflow:

```text
1. checks out the repo/PR branch;
2. installs Graphify from the official PyPI package `graphifyy`;
3. runs `graphify .`;
4. uploads `graphify-out/**` as a GitHub Actions artifact;
5. does not commit generated graph files to the repo.
```

Expected artifact contents:

```text
graphify-out/graph.html
graphify-out/GRAPH_REPORT.md
graphify-out/graph.json
```

Optional callflow export may also appear if supported by the installed Graphify version.

---

## Why artifact, not committed graph

Do not commit `graphify-out/` by default.

Reasons:

```text
- graph files can be large and noisy;
- graph output changes often;
- committed graph snapshots can bloat git history;
- artifacts are enough for Opus/GLM/GPT audits.
```

A compact summary doc may be committed later only if GPT/Denis explicitly approve it.

---

## Agent usage policy

### GPT

GPT uses the artifact as routing context and still reads current source-of-truth docs.

GPT decides whether a task needs:

```text
- no graph;
- graph artifact only;
- Opus graph-based audit;
- GLM implementation using the accepted audit;
- Codex local read-only audit for local-only files/assets.
```

### Opus

For broad cleanup/runtime architecture work, Opus should read:

```text
1. this workflow;
2. GPT_PROJECT_LEAD_INSTRUCTIONS.md if supplied by GPT;
3. OPUS_ARCHITECT_AUDIT_RULES.md;
4. current roadmap;
5. graphify-out/GRAPH_REPORT.md;
6. graphify-out/graph.json or graph queries if available.
```

Opus should not start by reading the entire repo file-by-file if a fresh graph artifact is available.

### GLM

GLM may use Graphify for scoped implementation orientation, but GLM should not turn every task into a new audit.

GLM executes accepted High/High+ steps after the relevant roadmap/audit is already accepted.

### Codex

Codex may use local Graphify only when it is performing a read-only local audit of Denis's machine/project files.

Codex is not the default executor for this project.

---

## Local exception policy

Local work is allowed only for:

```text
- Blender / asset export;
- heavy local asset inspection that cannot run in GitHub;
- visual QA that cannot be evaluated from repo artifacts;
- emergency reproduction explicitly approved by Denis.
```

For normal repo analysis, standard validation, cleanup planning, and PR review preparation, use GitHub artifacts/workflows first.

---

## Non-goals

```text
- no Phaser runtime dependency;
- no Vite dependency;
- no package.json dependency unless explicitly approved;
- no game code changes;
- no generated graph committed by default;
- no replacement for accepted roadmap/audit discipline.
```

---

## Required before Opus system audit

Before asking Opus for a broad cleanup/modular runtime audit:

```text
1. merge or prepare the current roadmap doc;
2. run the Graphify workflow on the target branch;
3. provide the Graphify artifact to Opus;
4. tell Opus to use the graph first;
5. ask for one broad, reusable audit, not one audit per small task.
```
