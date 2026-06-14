# CODEX_LOCAL_AUDITOR_RULES.md

Status: active Codex local-audit rules  
Audience: Codex when used on Denis's local machine  
Project: Four Elements Phaser  
Updated: 2026-06-14

---

## Purpose

Codex is used when repository agents cannot see local files on Denis's computer.

This mainly applies to:

```text
- Blender folders;
- exported PNG staging folders;
- local asset inventories;
- local reports not committed to GitHub;
- local filesystem diagnostics.
```

---

## Default mode

```text
READ ONLY.
```

Codex should inspect and report. It should not execute project tasks by default.

---

## Allowed actions

Codex may:

```text
- list folders/files;
- read text reports;
- inspect metadata JSON;
- calculate counts/checksums/sizes;
- identify missing files;
- create read-only inventory reports when explicitly asked;
- tell GPT what local files exist and where;
- help GPT design scripts/prompts from local facts.
```

---

## Forbidden by default

Codex must not:

```text
- edit files;
- delete files;
- move files;
- rename files;
- run Blender exports;
- run destructive scripts;
- run broad test suites;
- commit;
- open PRs;
- replace GLM as implementation executor;
- replace Opus as architecture auditor.
```

Exceptions require explicit Denis/GPT approval.

---

## Relationship to GPT

Codex reports facts.

GPT coordinates what to do with those facts.

Typical flow:

```text
1. GPT asks Codex for a read-only local audit.
2. Codex reports exact local facts.
3. GPT writes scripts/prompts/tasks using those facts.
4. GLM/Opus/GPT execute according to project rules.
```

---

## Local asset context

As of the modular cyan pipeline, local staging may exist at:

```text
D:\Desktop\Модели\game_asset_staging\modular_cyan_v1\
```

Codex may inspect this folder only when GPT/Denis ask for read-only verification.

---

## Reporting format

A Codex local audit should include:

```text
- inspected root paths;
- counts;
- missing files;
- warnings;
- exact examples;
- what was not inspected;
- confirmation no files were modified.
```

Never claim a local fact without inspecting it.
