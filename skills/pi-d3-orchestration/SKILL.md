---
name: d3code
description: Orchestrate D3Code (Rocket D3) from Pi. Use for any D3 / Pick BASIC, TCL, System Builder, D3 migration, generated D3 API, or tickets.crystallogic.co.za client-portal work. Pi is the orchestrator; D3Code is the local D3 execution authority on this box.
---

# D3Code orchestration (Pi → D3Code)

Pi is the **top-level orchestrator** on this box. D3Code (the `d3code` CLI, wrapper at `/usr/local/bin/d3code`) is the local
**Rocket D3 execution authority**. Everything is local — Pi calls the `d3code` CLI directly.
There is no remote bridge, and **Hermes / DecisionsAI is not part of this path**.

Client-portal tickets live at **tickets.crystallogic.co.za** (the Crystal Logic client portal).

## 1. Check the D3 connection first (always report state)
- `d3code model-proof --json` — provider / model / key readiness
- `d3code profile-doctor --json` — D3 connection proof (WHO / VERSION / LIST MD)
- `d3code harness-doctor --json` — aggregate readiness

If D3 is **not connected**, do not stop: use D3Code to help connect and diagnose —
`d3code profiles`, `d3code connector-strategy`, `d3code profile-add-ssh|profile-add-local`,
`d3code login`, `d3code sidecar-health`.

## 2. Pull context, reference base and skills into the work
- `d3code reference-audit`, `d3code reference-skills`, `d3code reference-skill-scout`
- `d3code rag-build` / reference RAG index
- `d3code skills`, `d3code skill-coverage`
- `d3code scope-check "<request>"` — keep the work inside D3 scope

## 3. Execute D3 work
- `d3code agent-run basic-check|file-audit|migration-slice <file> [item]`
- `d3code delegate-prompts`, `d3code delegate <mode>`
- `d3code terminal-plan|terminal-capture`, `d3code screen-parse`, `d3code screen-audit`
- `d3code live-proof-init|live-proof-check` — collect evidence

## 4. Rules
- Pi orchestrates and reports; D3Code executes D3 work. Never let D3Code change D3 without proof.
- Never claim D3 is connected unless `profile-doctor` proves it.
- Keep it D3-scoped; run `scope-check` before risky work.
- Feed verified lessons, reference findings and proof back into the ticket and Pi memory.
