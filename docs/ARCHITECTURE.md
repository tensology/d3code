# D3 Code Architecture

## Shape

D3 Code is intentionally OpenCode-inspired rather than an OpenCode fork. The current codebase separates the product into small subsystems:

- `config`: non-secret configuration and D3 connection profiles under `~/.d3code`.
- `security`: secret references backed by environment variables or OS keychain.
- `providers`: model/provider catalog.
- `agents`: primary agents and subagent definitions.
- `core`: permission and safety evaluation.
- `d3`: local/SSH adapters, virtual URI parsing, D3 tools, BASIC linting, and D3 detection.
- `indexing`: cached manual and D3 account indexes.
- `sessions`: resumable event logs.
- `tui`: Ink shell placeholder for the interactive runtime.
- `skills`: baked-in Superpowers/GSD/gstack/RTK-inspired operating modes.
- `migration`: D3-to-web migration planning and OpenAPI generation.
- `audit`: D3 dictionary/program audit reporting.
- `goal`: GSD-style goal and phase skeletons.

## D3 Adapter

The first adapter is Rocket D3 Unix 10.3 oriented:

1. Try local D3 detection.
2. Use a local profile when D3 is available on the same host.
3. Use an SSH profile when D3 lives on another Unix box.
4. Run one active account per session.
5. Require explicit profile configuration for account, entry command, and prompt pattern when automatic detection is not enough.

The adapter currently uses process execution as a portable foundation. The next implementation step is a long-lived PTY session so prompts, editors, paged output, interrupts, and multi-step TCL interactions are robust.

## Safety

Safety is a launch/session policy:

- `plan`: read-only TCL/AQL/search; mutations denied.
- `ask`: reads allowed; writes, compile, catalog, and risky commands require confirmation.
- `trust`: writes and compile/catalog allowed; destructive account/file/shell commands still require typed confirmation.

The command classifier is conservative and lives in `src/core/permissions.ts`.

## Baked-In Modes

The reference skills are productized as modes rather than copied wholesale:

- Superpowers contributes spec-first planning, red/green/refactor testing, and subagent-driven development discipline.
- GSD contributes goal, milestone, phase, execution, and verification structure.
- gstack contributes QA/browser-flow evidence mindset for migrated web apps.
- RTK contributes compact-output behavior for noisy TCL, test, and shell output.

The D3-specific modes are:

- `migrate`: audit a D3 app, map files/programs to web resources/services, generate API contracts, and plan strangler phases.
- `audit`: inspect dictionaries, sampled data shape, BASIC symbols, locks, triggers, and compile risks.
- `api`: generate REST/OpenAPI surfaces from D3 files and subroutines.
- `modernize`: refactor D3 BASIC with regression fixtures and compile/catalog verification.

## Generated Artifacts

Migration helpers are JSON-driven for repeatability:

- `migration-plan` converts sampled D3 file/program input into resources, services, phases, and risks.
- `openapi` converts a migration plan into OpenAPI 3.1.
- `adapter-skeleton` emits in-memory TypeScript repository/routes/type skeletons.
- `adapter-write` writes those skeleton files to an output directory.
- `audit-db` validates sampled dictionaries, record shapes, multivalue/subvalue usage, and expected indexes.
- `bundle-capture` runs read-only TCL commands through a selected profile to create a D3 application bundle.
- `bundle-*` commands use one D3 application bundle to produce audit, migration, OpenAPI, index, and adapter artifacts.

## Runtime Tooling

The tool runner provides one execution seam for CLI and TUI slash commands:

- `tool` emits raw JSON tool output.
- `tool-compact` emits RTK-inspired compact output for noisy D3/TCL commands.
- TUI slash commands `/run-tool`, `/tcl`, and `/aql` use the same runner and safety policy.
- TUI slash commands `/audit-help`, `/migrate-help`, `/api-help`, and `/modernize-help` render concrete command recipes for the baked workflows.

## Next Engineering Milestones

1. Replace one-shot process execution with a persistent PTY adapter.
2. Build the full Ink chat loop and slash command dispatcher.
3. Add live LLM calls and tool-calling orchestration.
4. Expand D3 indexing from MD file pointers into real file/item/dictionary crawls.
5. Add compile/catalog feedback loops with rollback metadata.
