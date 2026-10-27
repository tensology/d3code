# Pi orchestration (local)

On Tensology's production box, **Pi is the top-level orchestrator** and **D3Code is the
local Rocket D3 execution authority**. Everything runs on the one server — there is no
remote bridge and **no Hermes / DecisionsAI dependency**.

## Topology

```
tickets.crystallogic.co.za (Tensology client portal)
        │  ticket conversation agent pulls D3 context / asks for a probe / hands off
        ▼
Pi  (/usr/bin/pi, OpenRouter  deepseek/deepseek-v4.1-flash, skill: skills/pi-d3-orchestration)
        │  calls the d3code CLI
        ▼
d3code  (/usr/local/bin/d3code wrapper, D3CODE_HOME=/var/lib/d3code/customer-51)
        │  SSH profile "Office demo"  root@office.crystallogic.org:2266, account dm
        ▼
Rocket D3 (office.crystallogic.org)
```

## How Pi drives D3Code

1. **Connection first** — `d3code profile-doctor --json` (WHO / VERSION / LIST MD).
   If disconnected, Pi helps connect (`profiles`, `connector-strategy`, `login`) and reports state.
2. **Context / reference / skills** — `d3code reference-skills --json` (families + product skills),
   `d3code skill-coverage`, reference RAG.
3. **Execute** — `d3code agent-run basic-check|file-audit|migration-slice`, `delegate-prompts`,
   `terminal-capture`, `screen-parse`, `live-proof-*`.
4. **Scope** — `d3code scope-check "<request>"` before risky work.

Rules: Pi orchestrates and reports; D3Code executes D3 work; never claim D3 is connected
without `profile-doctor` proof; never change D3 without evidence; feed verified lessons back.

## Portal bridge

The Tensology app owns the client-portal side (`apps/main/d3_bridge.py`):

- injects a compact `d3` context block into the ticket conversation agent,
- runs read-only D3 probes,
- hands execution to Pi (`dispatch_ticket_to_pi`).

The portal agent is read-only; development/execution flows through Pi.

## Requirements on the box

- `d3code` available on `PATH` (wrapper) with `D3CODE_HOME` set.
- `pi` installed and configured (`OPENROUTER_API_KEY` in `<agent-dir>/auth.json`).
- The server's SSH public key authorized on `office.crystallogic.org` for the `dm` flow.
