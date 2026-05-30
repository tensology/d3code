# D3 Code

`d3code` is an OpenCode-inspired terminal coding agent foundation for Rocket D3 Unix 10.3 environments.

Repository: https://github.com/tensology/d3code

This repository currently implements the core scaffolding:

- model/provider catalog
- agent registry and subagent definitions
- config and profile loading under `~/.d3code`
- OS keychain/env secret references
- safety policy and high-risk D3 command classification
- local/SSH D3 detection and command adapters
- virtual D3 URI parsing
- D3 tool runtime primitives
- D3 BASIC symbol extraction and linting
- baked-in GSD, migration, audit, API, modernization, and QA modes
- D3-to-web migration planning and OpenAPI generation
- D3 record shape validation for multi-value/sub-value data
- D3 index capture and expected/observed index validation
- session persistence and event logging
- documentation/manual indexing helpers

See [CHANGELOG.md](CHANGELOG.md) for release notes and repository publishing history.

## Quick Start

```bash
npm install
npm run build
npm link
d3code setup
d3code doctor
d3code setup-proof
d3code acceptance
d3code live-proof
d3code live-proof-init ./live-proof --profile prod --account DM
d3code live-proof-check ./live-proof
d3code status --mode migrate
d3code profile-doctor --profile prod
d3code readiness
d3code product-audit --allow-incomplete
d3code models
d3code model-proof
d3code model-routing migrate --bias balanced
d3code agents
d3code modes
d3code skill-coverage
d3code reference-skills
d3code reference-audit reference
d3code status
d3code detect
d3code index-account --profile prod
d3code search-account CUSTOMER --profile prod
```

For a reproducible first-run bootstrap on a Unix box, configure the provider/key reference and the D3 terminal profile in one command:

```bash
d3code setup \
  --provider anthropic \
  --default-model claude-sonnet-4-5 \
  --api-key-env ANTHROPIC_API_KEY \
  --default-safety ask \
  --d3 local \
  --profile-name prod \
  --account SALES \
  --entry "d3" \
  --prompt ">" \
  --allowed-accounts SALES,DM
```

Profiles created by `setup --d3 local|ssh` default to persistent command execution so D3 account/shell state can survive across tool calls. You can also create or update the profile directly:

```bash
d3code profile-add-local --name prod --account SALES --entry "d3" --prompt ">" --session persistent
d3code profile-add-local --name prod --account SALES --entry "d3" --prompt ">" --session persistent --allowed-accounts SALES,DM
d3code login --profile prod --account SALES --safety trust
d3code live-proof --profile prod --run
d3code live-proof --profile prod --run --goal <goal-id> --phase verify
```

Launch the interactive terminal app:

```bash
d3code --model openai/gpt-5 --safety ask --mode migrate
```

## Operating Modes

D3 Code bakes in the reference skill workflows as first-class modes:

- `chat`: Claude Code-style general terminal assistant for D3.
- `plan`: spec-first read-only planning mode.
- `gsd`: goal, milestone, phase, execution, and verification workflow.
- `migrate`: D3-to-web migration mode with audit, REST API, and browser QA workflows.
- `audit`: read-only D3 database/code audit mode.
- `api`: REST API generation mode for D3 files and subroutines.
- `modernize`: behavior-preserving D3 BASIC modernization mode.
- `qa`: regression and validation mode.

Use:

```bash
d3code --mode migrate
d3code mode-info migrate
d3code runbook migrate
d3code delegate migrate
d3code delegate-prompts migrate
d3code agent-run basic-check BP GET.CUSTOMER --profile prod --compile --catalog --confirm
d3code agent-run file-audit CUSTOMERS --profile prod --sample-limit 5
d3code agent-run migration-slice d3-app-bundle.json --out ./migration-output
d3code webapp-smoke ./migration-output --record
d3code workflow migrate
d3code skill-info verification-before-completion
d3code reference-skills
d3code recipe migrate
d3code recipes
d3code goal --mode migrate Modernize order entry
d3code goal-plan <goal-id>
d3code goal-next <goal-id>
d3code goal-verify <goal-id>
d3code goal-evidence <goal-id> --evidence "Captured D3 bundle and audit output"
d3code goal-apply-bundle-evidence <goal-id> d3-app-bundle.json --artifacts-dir ./migration-output
d3code goal-audit-bundle <goal-id> d3-app-bundle.json --artifacts-dir ./migration-output --apply
d3code goals
d3code goal-advance <goal-id>
```

## Migration And Audit Helpers

```bash
d3code migration-plan migration-input.json
d3code openapi migration-plan.json
d3code audit-json audit-input.json
d3code audit-db database-samples.json
d3code shape record-samples.json
d3code bundle-capture --profile prod --account SALES --files CUSTOMERS,ORDERS --program-files BP --sample-limit 5 > d3-app-bundle.json
d3code bundle-goal d3-app-bundle.json --artifacts-out ./migration-output
d3code bundle-audit d3-app-bundle.json
d3code bundle-code-map d3-app-bundle.json
d3code bundle-code-plan d3-app-bundle.json
d3code bundle-brief d3-app-bundle.json
d3code bundle-backlog d3-app-bundle.json
d3code bundle-qa-plan d3-app-bundle.json
d3code bundle-readiness d3-app-bundle.json --artifacts-dir ./migration-output
d3code bundle-delegate d3-app-bundle.json
d3code bundle-completion-audit d3-app-bundle.json --artifacts-dir ./migration-output
d3code bundle-refresh-evidence d3-app-bundle.json --artifacts-dir ./migration-output
d3code bundle-evidence d3-app-bundle.json --artifacts-dir ./migration-output
d3code goal-audit-bundle <goal-id> d3-app-bundle.json --artifacts-dir ./migration-output --apply
d3code bundle-index d3-app-bundle.json
d3code bundle-index-plan d3-app-bundle.json
d3code bundle-data-plan d3-app-bundle.json
d3code bundle-migration d3-app-bundle.json
d3code bundle-artifacts d3-app-bundle.json --out ./migration-output
d3code webapp-check ./migration-output
d3code webapp-smoke ./migration-output --record
d3code adapter-skeleton migration-plan.json
d3code webapp-skeleton migration-plan.json
d3code adapter-write migration-plan.json --out ./generated
d3code read-item CUSTOMERS 100 --profile prod
d3code read-dict CUSTOMERS NAME --profile prod
d3code locks --profile prod
d3code diff-item CUSTOMERS 100 --profile prod --body-file proposed-customer.txt
d3code write-item CUSTOMERS 100 --profile prod --body-file proposed-customer.txt --confirm
d3code query-aql LIST CUSTOMERS --profile prod
d3code compile-basic BP GET.CUSTOMER --profile prod --confirm
d3code catalog-basic BP GET.CUSTOMER --profile prod --confirm
d3code modernization-proof --before BP_ITEM.before.txt --after BP_ITEM.txt --compile-output compile-output.txt
d3code call-subroutine GET.CUSTOMER 100 --profile prod --confirm
d3code tool-compact d3_tcl '{"command":"LIST MD"}' --profile prod
d3code tool-compact d3_login '{"account":"SALES","confirmed":true}' --profile prod --safety trust
d3code tool-compact d3_index_account '{}' --profile prod
d3code tool-compact d3_search '{"query":"CUSTOMER"}' --profile prod
d3code tool-compact d3_call_subroutine '{"name":"GET.CUSTOMER","args":["100"],"confirmed":true}' --profile prod --safety trust
```

`bundle-capture` also attempts read-only `LIST-INDEX <file>` capture by default. Use `--no-indexes` if a target account does not support that command shape.
OpenAPI and adapter generation preserve sampled dictionary evidence where available: generated schemas include `x-d3-file`, `x-d3-dictionary`, `x-d3-attribute`, and multivalue hints, and TypeScript adapter types expose named D3-backed attributes.
`bundle-artifacts` writes a runnable Node/TypeScript API scaffold around the generated D3 repositories, including `package.json`, `tsconfig.json`, `/health`, `/openapi.json`, `/access-plan.json`, `/terminal/send`, `/dashboard-data.json`, `/proof-dashboard.json`, `/connector-strategy.json`, resource routes, `mock-data.json` from captured samples, `d3code-skill-pack.json/md`, `subagent-prompts.json/md`, `live-operator-runbook.json/md`, `d3-connector-strategy.json/md`, `web-ui-plan.json/md`, `public/ui-plan.json`, `public/dashboard-data.json`, `public/proof-dashboard.json`, `cockpit-terminal.json/md`, a browser shell that can render generated D3 screen plans, D3 estate cockpit panels, graph nodes/edges, integrity risks, access state, data-model relationships, GSD proof gates, release decision, QA state, and guarded terminal commands, a `D3Client` adapter seam, a default-off `D3CODE_ALLOW_WRITES` mutation guard, a default-off `D3CODE_TERMINAL_ENABLED` live terminal-send guard, a default-redacted `terminal-journal.jsonl` metadata trail for PowerTerm-style cockpit sends, a cockpit role guard using `x-d3code-role`/`D3CODE_ACCESS_ROLE`, generated `mutation-journal.jsonl` audit entries with rollback notes for create/update routes, `src/d3-record.ts` for selected-ID parsing plus attribute-mark/multivalue record parsing and serialization, and `test/api-smoke.test.mjs` for mock-mode API verification plus D3 record roundtrip, cockpit terminal send/journal, mutation journal/rollback proof, and access-denied write checks. `webapp-check` verifies the generated scaffold has the required package, server, D3 client, D3 write guard, D3 record mapper/serializer, captured mock data, browser UI, OpenAPI, UI/access plan/dashboard/proof routes, cockpit access guard, mutation journal and rollback proof, cockpit terminal route/screen parser, terminal journal and transcript redaction guard, dashboard graph/panel data, proof dashboard readiness/completion/release data, connector strategy route/UI rendering, bundle-specific subagent prompt packets with allowed-tool/denied-action/evidence boundaries, live operator runbook phases/evidence commands, cockpit terminal contract, layered D3 connector strategy with PowerTerm/UOPY proof, migration plan, smoke test, mock data endpoint proof, record roundtrip test, terminal-send/journal proof, mutation-journal proof, access-denied write proof, and resource files; `webapp-smoke --record` then typechecks, runs the generated API smoke tests in mock mode, and writes `qa-evidence.json`/`qa-evidence.md` so `bundle-readiness --artifacts-dir ./migration-output` can prove the QA gate before you treat it as a migration slice. Run `bundle-refresh-evidence --artifacts-dir ./migration-output` after recording smoke/QA evidence to rewrite `migration-readiness`, `completion-audit`, `goal-evidence`, `release-report`, and `proof-dashboard` files from the latest artifact state.
`bundle-execution-plan` is the one-stop GSD/migration control surface: it orders capture, audit, map, API, and verify phases; names the baked skills and subagents for each phase; emits exact commands; and keeps live-D3, legacy-screen, web/API, QA, regression, and completion-audit proof gates visible.
`bundle-prd` and `bundle-adr` turn the same D3 bundle into GSD-style requirements and architecture-decision documents: the PRD captures goals, non-goals, scope, user stories, acceptance criteria, risks, and metrics; the ADR records the strangler REST boundary decision, consequences, verification commands, and unresolved proof gates.
`bundle-release-report` turns readiness, completion audit, web/API smoke status, QA evidence, and the execution plan into a ship/canary handoff with a decision, blockers, canary scope, rollback steps, and proof commands.
Inside the TUI, the same D3 surfaces are available as `/login`, `/logout`, `/account`, `/files`, `/read`, `/write`, `/dict`, `/locks`, `/diff`, `/index`, `/search`, `/compile`, `/catalog`, and `/call`, with the active safety mode deciding whether write/compile/catalog/subroutine operations can run.
`bundle-code-map` and `bundle-artifacts` produce a BASIC modernization map that groups program calls, file readers/writers/openers, unresolved CALL targets, EXECUTE/TCL usage, lint hazards, and modernization recommendations. `bundle-code-plan` turns that code map into executable BASIC modernization work: write policies, EXECUTE isolation, unresolved CALL capture, mutation boundaries, and compile/catalog proof criteria. `modernization-proof` compares before/after BASIC source plus compile output to catch new side effects, lint regressions, and missing compile proof. `model-proof` verifies default model, provider secret/env availability, local endpoint config, and routing readiness. `setup-proof` audits first-run model, secret reference, D3 profile, pinned account, persistent session, prompt pattern, account allowlist, and safety configuration before a live D3 login. `terminal-plan` names the D3 connector strategy: persistent local/SSH PTY for account-stateful work, typed TCL for tools, UOPY as a later typed adapter, and partial legacy screen-buffer support for BASIC screen utilities, @() cursor control, PROC flows, and PowerTerm-style terminal behavior. `cockpit-terminal` turns that strategy into an explicit cockpit contract: whether the profile can attach to a long-lived D3 session, whether the terminal model is PowerTerm-aware or a plain transcript, which UOPY gaps remain, and what live proof is still required. `terminal-capture --out <dir> <command...>` runs a profile-backed terminal command, writes the raw transcript, stderr, parsed screen buffer, and capture summary, and keeps the same safety policy in front of risky TCL. `live-proof-init <dir>` creates the operator proof folder and placeholders; `live-proof-check <dir>` verifies that folder contains `profile-doctor.json`, terminal capture/screen-buffer artifacts, operator notes, compile/catalog transcript, and rollback proof so product readiness can be proven later without pretending this machine has a D3 login. `screen-parse` parses captured D3/PowerTerm-style transcripts into a stable screen buffer for cockpit inspection and future AI screen modernization. `bundle-screen-plan` audits BASIC screen operations, INPUT prompts, cursor controls, clear behavior, and screen utilities so legacy D3 screens can be rebuilt as modern UI flows without pretending PowerTerm is ordinary xterm output. `bundle-ui-plan` converts D3 resources, dictionaries, data warnings, relationships, and legacy screen evidence into generated web screen plans with fields, actions, warnings, and navigation. `bundle-access-plan` maps captured D3/Unix users and roles to generated resources/screens, flags missing role evidence, and keeps write/admin grants in review until safety, lock, and rollback proof exists. `bundle-index-plan` turns expected/observed D3 indexes, dictionaries, and generated API fields into an index validation plan. `bundle-data-plan` turns dictionary issues, sampled record shape, multivalue/subvalue evidence, and generated API fields into a data validation plan. `dashboard --bundle` and `/dashboard <bundle.json>` render a DBeaver-style D3 estate cockpit graph for files, dictionaries, indexes, programs, subroutines, inferred data-model nodes, generated screens, users, access grants, terminal bridge status, and integrity warnings. `bundle-erp-plan --target-db <name>` turns the same estate evidence into a staged ERP-scale migration blueprint only when you are actually planning migration to a chosen target database, with scalar fields, multivalue child structures, duplicate-column collapse work, inferred relationships, screen layouts, and cutover/reconciliation stages. `bundle-reconciliation-plan --target-db <name>` then names the cutover checks for row-count parity, sampled value comparison, multivalue ordering, index parity, canary, and rollback proof. `safety-guard` classifies planned D3/TCL commands plus bundle BASIC `EXECUTE` strings before risky work, and `bundle-context-pack` creates a compact resumable handoff with runtime state, proof gaps, subagent queue, and next commands. `bundle-brief` produces a markdown modernization brief that ties resources, services, file usage, API artifacts, risks, and GSD evidence into one readable handoff. `bundle-backlog` converts the same audit/code/API evidence into prioritized modernization work items with commands and done criteria. `bundle-qa-plan` creates D3, API, browser, and regression checks for proving a migrated slice. `bundle-readiness` rolls the generated evidence into a ship/health report and keeps live D3 proof plus executed QA as missing gates until they are actually recorded. `bundle-delegate` converts the same bundle into concrete subagent tasks for architecture, data/index validation, BASIC modernization, QA proof, and manual research. `delegate-prompts` turns mode delegation into isolated subagent prompt packets with allowed tools, denied actions, expected outputs, and evidence gates. `bundle-completion-audit` performs the GSD final audit: each requirement is marked proven, partial, or missing with the exact proof, gaps, and commands needed before a goal can honestly be called complete. `bundle-evidence --artifacts-dir` converts bundle findings plus generated scaffold/QA evidence into phase-specific goal evidence suggestions for capture, audit, map, API, and verify phases. `goal-audit-bundle --artifacts-dir` audits a persisted goal against that artifact-aware phase evidence and can apply the evidence before reporting which phases still need proof or review.

These helpers are JSON-driven so they can be regression-tested before connecting to a live Rocket D3 account. `d3code acceptance` runs the disposable mock-D3 path end to end: profile doctor, bundle capture, index generation, artifact writing, web app check, generated API smoke proof, recorded QA evidence, goal evidence, readiness gates, and completion audit.
`bundle-goal` bridges the artifact pipeline into the GSD loop by creating a migration goal, recording bundle/artifact evidence, and printing the next active phase.

## Baked Skill Packs

The reference repositories are productized as D3 Code modes and runbooks rather than copied as loose prompt files:

- Superpowers: brainstorming, spec-first planning, implementation plans, TDD, debugging, code review, verification, subagent execution, and skill authoring.
- GSD: persisted goals with mode-specific checklists, deliverables, suggested commands, and evidence gates.
- gstack: migrated web app dogfooding, browser/API evidence, and QA-oriented workflows.
- RTK: compact output and token-efficient large-account search/test behavior.
- OpenCode skills: Effect-style TypeScript service discipline, architecture-deepening review, and optional Cloudflare/Agents SDK migration-target guidance.

Use `d3code product-audit`, `d3code model-proof`, `d3code skills`, `d3code skill-info <id>`, `d3code skill-coverage`, `d3code reference-skills`, `d3code reference-audit`, `d3code runbook <mode>`, `d3code bundle-skill-pack <bundle.json>`, `d3code delegate <mode>`, `d3code delegate-prompts <mode>`, `d3code agent-run basic-check <file> <item>`, `d3code agent-run file-audit <file>`, `d3code agent-run migration-slice <bundle.json> --out <dir>`, and `d3code webapp-smoke <dir> --record` to inspect the whole product completion audit, baked behavior, coverage, full reference inventory, bundle-specific mode/recipe/evidence map, subagent handoff plan, isolated subagent prompt packets, and bounded executable D3 agent loops.

## D3 Application Bundle

A bundle is the preferred exchange format for offline audit and migration work:

```json
{
  "account": "SALES",
  "profile": "prod",
  "files": [
    {
      "name": "CUSTOMERS",
      "suggestedResource": "customers",
      "dictionary": [{ "id": "@ID", "type": "A", "attribute": 0 }],
      "records": [{ "id": "100", "raw": "Alice" }],
      "expectedIndexes": ["NAME"],
      "observedIndexes": ["NAME"]
    }
  ],
  "programs": [
    {
      "file": "BP",
      "item": "GET.CUSTOMER",
      "source": "SUBROUTINE GET.CUSTOMER(ID)\\nRETURN\\n"
    }
  ]
}
```
