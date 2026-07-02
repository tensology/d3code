---
name: ecc-hermes-d3-harness
description: Required D3Code harness backbone adapted from Hermes and relevant ECC skills. Use for D3Code chats, setup, RAG, memory, orchestration, evals, terminal operations, coding standards, generated app work, and proof gates.
origin: D3Code adapted from Hermes/ECC
---

# ECC / Hermes D3 Harness

Hermes is the D3Code memory and orchestration backbone. ECC is the harness-pattern library. D3Code is still the Rocket D3 execution authority.

## Required Operating Rule

Before changing D3 BASIC, System Builder code, TCL flows, generated adapters, or D3Code harness behavior:

1. Retrieve relevant D3Code RAG evidence.
2. Check Hermes operator memory for prior verified lessons.
3. Preserve local coding style unless compiler/manual/runtime evidence proves it wrong.
4. Make the smallest behavior-preserving edit.
5. Record reusable verified lessons back into operator memory.

## Adapted Hermes Skills

- `hermes-operator-memory`: store verified lessons, local style, recurring fixes, and workflow rules without secrets or private data.
- `hermes-workflow-imports`: turn repeated operator workflows into D3-specific skills, recipes, and evals.

## Adapted ECC Harness Skills

- `ecc-agent-harness-construction`: schema-first tools, deterministic observations, recoverable errors, narrow action spaces.
- `ecc-eval-harness` and `ecc-agent-eval`: capability/regression evals for RAG, D3 tools, BASIC, System Builder, and generated apps.
- `ecc-iterative-retrieval`, `ecc-research-ops`, `ecc-deep-research`: route through manuals, System Builder, MV BASIC, operator memory, then live D3 evidence.
- `ecc-team-agent-orchestration`, `ecc-plan-orchestrate`, `ecc-dynamic-workflow-mode`: split D3 work into audit, reference research, BASIC review, migration, QA, and release roles.
- `ecc-agent-introspection-debugging`: inspect failed assumptions, tool inputs, tool output, prompt routing, and retrieval quality.
- `ecc-coding-standards`: respect PICK BASIC, System Builder, and local house-style idioms.
- `ecc-terminal-ops`: make Unix/TCL/PICK command boundaries explicit and preserve screen/runtime evidence.
- `ecc-token-budget-advisor`, `ecc-cost-aware-llm-pipeline`, `ecc-cost-tracking`: use RAG and compact output before large context.
- `ecc-production-audit`, `ecc-canary-watch`, `ecc-gateguard`: proof gates, canary checks, release readiness, and rollback signals.
- `ecc-architecture-decision-records`, `ecc-recursive-decision-ledger`: record D3 modernization decisions and consequences.
- `ecc-error-handling`: map errors to the failing layer with one safe next diagnostic.
- `ecc-rules-distill`, `ecc-prompt-optimizer`: improve prompts and skills only from verified repeated failures.
- `ecc-autonomous-agent-harness`, `ecc-autonomous-loops`: bounded loops with explicit stop conditions and no unconfirmed mutation.
- `ecc-benchmark`, `ecc-benchmark-optimization-loop`: improve only against measured D3Code fixtures.
- `ecc-workspace-surface-audit`, `ecc-mcp-server-patterns`: audit and improve harness surfaces.
- `ecc-api-connector-builder`, `ecc-hexagonal-architecture`, `ecc-backend-patterns`, `ecc-postgres-patterns`: generated API/app architecture around D3 adapters.
- `ecc-react-patterns`, `ecc-react-performance`, `ecc-frontend-a11y`, `ecc-dashboard-builder`: generated D3 web/IDE UI quality.
- `ecc-git-workflow`: intentional diffs, no unrelated reverts, proof with handoff.

## D3-Specific Style Lesson

The `B.JOBSCHED` curl work established a standing rule:

- do not add extra file pointers or helper routines unless the program proves they are needed
- if a file is already opened, use that fact
- explain inferred choices separately from verified facts
- preserve existing screen flow and local display idioms
- debug runtime errors from the exact D3/Unix layer that emitted them

## Setup Contract

Installation should configure Hermes/ECC with:

```bash
d3code hermes-setup --ecc-root <path-to-ecc>
d3code rag-build --ecc-root <path-to-ecc>
d3code hermes-status
```

If the ECC checkout is missing, setup must make that gap visible instead of silently degrading the harness.
