# Changelog

All notable changes to D3 Code will be documented in this file.

## Unreleased

- Fixed large item writes: a single `ED` insert above ~5 KB never returns the session to its prompt (the content seen is the editor echo, not a filed item). `d3_write_item`/`d3_write_dict` now write in chunks (`I` creates, `9999` + `I` appends).
- `d3_write_item`/`d3_write_dict` now reject a body containing a blank line loudly instead of silently truncating, because D3's editor ends insert mode on a blank line.
- Fixed licence exhaustion hanging a session: `adapter.ts` detects `too many users` during startup and fails fast with an actionable message (3 of 12 concurrent sessions previously hung until timeout).
- Extended the D3CODE order sandbox app: goods receipt, credit notes, settlement, cancellation with partial-restore reporting, customer statements, and a self-resetting pressure suite (`sandbox/d3-order-app/pressure.mjs`, 76 checks) covering boundaries, credit limits, locks, reconciliation, 6-way and same-order concurrency, licence pressure, volume and index updates.
- Added `sandbox/d3-order-app/docs/FINDINGS.md` recording the harness bugs, the D3 language rules learned, and the invariants now proven under pressure.

- Fixed `d3_write_item`/`d3_write_dict` replace semantics: D3's editor `I` inserts before the current line, so re-writing an existing item prepended instead of replacing. The tools now gate the write, clear the item, then write.
- Added the D3CODE order sandbox application (`sandbox/d3-order-app/`): 5 D3 files, a dictionary generator, a catalogued posting subroutine with stock/credit/VAT rules, a driver and a report, plus `deploy.mjs`, `verify.mjs` and a PDF runbook. Verified live: 16/16 assertions (stock control, credit limit, VAT, indexed AQL).
- D3 BASIC conventions captured while building it: main programs must not start with a `PROGRAM` header, `SUBROUTINE` must be line 1, item locks release with `RELEASE` (not `UNLOCK`), the editor ends insert mode on a blank line, and AQL field names must avoid reserved words such as `TOTAL`/`DATE`.

- Added `d3code regression`: a live D3 regression suite with one chapter per manual domain (accounts, files/dictionaries, AQL, BASIC, TCL, locks, phantoms, diagnostics, screens, indexes, spooler, backup, OSFI) plus harness/agent checks. Read-only by default; mutations (`--mutate`) and printing (`--prints`) are opt-in. Writes `regression-report.md` and `.json` with `--out`.
- Fixed `d3_write_item`/`d3_write_dict`: D3's line editor ends insert mode on a blank line, so the batch `ED` sequence needs a blank line before `FI`. Without it the editor stayed open and the session never returned to the TCL prompt.
- Fixed live sessions against accounts with an active select list: D3 answers with a `>` prompt after `SELECT`/`SSELECT`, and the regression runner now treats `:` and `>` as ready prompts, resets the list after list-building checks, and recreates a dead session instead of poisoning the rest of a run.
- Live office run (D3 `dm` account, 67 checks): **65 pass, 0 fail, 0 warn, 2 skipped** (print jobs skipped), covering read, data write/read, `CREATE-FILE`/`CREATE-INDEX`/indexed AQL/`DELETE-INDEX`/`DELETE-FILE`, and BASIC write/compile/delete with full cleanup.

- Added native tool calling: the LLM client now sends provider `tools`/`tool_use` and parses `tool_calls` (OpenAI-compatible streaming and non-streaming, plus Anthropic), and the agent prefers native calls with the `<d3_tool>` text wrapper kept as a fallback for models without function calling.
- Added parallel read-only tool execution: one assistant turn can request several D3 tools, mutating batches stay serial and operator-gated.
- Added `src/d3/tool-schema.ts` JSON Schema for every registered D3 tool, generated from the tool catalog and paired with the existing zod validation.
- Fixed persistent SSH D3 sessions: D3 redraws the TCL prompt with an ANSI cursor move (`\x1b[24;1H:`), so prompt matching now strips terminal escapes (matching only; command output keeps its escapes for the screen parser) and the `expect` prompt pattern tolerates the escape/NUL padding.
- Fixed `d3_read_item`/`d3_read_dict` hanging on the interactive D3 editor over a persistent PTY by reading with `CT <file> <item> (N`.
- Added DeepSeek V4 Flash to the OpenRouter catalog.
- Repointed the Hermes/ECC bridge to the live ECC checkout so all 40 adapted imports resolve.
- Added `docs/rocket-d3-10.4.md` (D3 10.4 Python/RPC/VME-FSI/encryption/AQL changes and known issues) and `docs/pi-parity-roadmap.md` (harness capability gaps and ranked next steps).

- Hardened the D3 agent runtime with strict schema-first tool inputs, read-only TCL/AQL validation, model-confirmation rejection, bounded tool loops, request timeouts, repeated-call detection, cancellable browser jobs, and recoverable provider/tool failures.
- Added live project, Hermes memory, ECC skill-procedure, and fresh RAG context to every agent turn with bounded retrieval, secret filtering, stale-index rebuilding, and browser/TUI harness parity.
- Added atomic operator-memory writes, active/superseded lifecycle records, corrupt-record recovery, owner-only permissions, and the `operator-memory-supersede` command.
- Upgraded browser responses to render GitHub-flavored Markdown structure, including headings, ordered and unordered lists, tables, blockquotes, links, inline code, and fenced code blocks. Existing stored conversations are reformatted on reload.
- Hardened the browser IDE with explicit authentication for public binding, timing-safe credential checks, same-origin mutation enforcement, CSP and response security headers, request/job/event/history limits, and operator stop controls.
- Improved project-instruction discovery, narrow-terminal table layout, D3 connection diagnostics, SSH login handling, estate probe validation, and the local Ollama default model path.
- Added regression coverage for tool injection, schema enforcement, agent convergence, cancellation, harness context, history compaction, memory lifecycle, RAG freshness, Markdown tables, public IDE authentication, and connection recovery.
- Verified the complete TypeScript, Rust, Python, browser, mock-D3, and generated-application suite with 424 passing tests.

## 0.1.1 - 2026-07-02

- Expanded D3 Code from the initial IDE release into a broader D3-native harness with doctor-grade readiness checks, reference skill scouting, NDJSON agent-run events, scoped reference/RAG routing, and machine-readable safety/reporting surfaces.
- Added strict D3 scope enforcement across agent and tool execution so the harness fails closed on unrelated work and keeps chat, audit, migration, modernization, QA, and D3Code-ops modes bound to D3/manual-backed behavior.
- Added the Rust sidecar and TypeScript sidecar client for fast profile-aware helper operations, with autostart support, status/health commands, scope prefiltering, and TypeScript fallback behavior.
- Added Rocket D3, SB+/System Builder, ECC/Hermes, and operator-reference grounding through new manifests, RAG indexes, imported skill gating, and local operator memory utilities.
- Added SB+/screen workflow support for legacy BASIC screen audits, terminal/screen transcript parsing, and SB+ screen planning that explicitly avoids unverified direct definition-record writes.
- Upgraded the browser IDE into a fuller D3 workbench with profile/session management, D3 browser categories, editor-safe item and dictionary reads, persistent terminal transcripts, profile online probes, RAG/manual search, SB+ discovery/planning controls, model/safety controls, and visible slash-command tool results.
- Added an optional Python FastAPI runtime spike and D3 connector routing documentation/tests so D3PY/UOPY remains evidence-gated rather than assumed.
- Improved D3 command compaction and editor output handling so persistent PTY results no longer leak `exit unknown` into code buffers.
- Added reference and workflow tests covering harness doctor, RAG routing, sidecar behavior, D3 scoping, screen workflow, reference skill scouting, IDE server behavior, and compact D3 output.
- Validated the IDE with a Playwright full-spectrum audit against a deterministic fake D3 profile: 35/35 checks across API surfaces, slash commands, editor, terminal, profile lifecycle, settings, SB+ controls, RAG/manual search, and desktop/mobile overflow.

## 0.1.0 - 2026-05-30

- Added `/ide` and `d3code ide` to start a local browser-based D3 Code IDE server with profile context, D3 terminal sends, file/dictionary reads, guarded item writes, file listing, and indexed evidence search.
- Shaped the browser IDE shell around D3 terminology from the local Rocket references: profiles/accounts, data files/items, dictionaries, BASIC/subroutines, indexes/references, and a D3 runtime terminal.
- Wired the browser IDE agent lane into the existing D3-only agent tool loop so browser requests can inspect D3 through guarded tools instead of bypassing safety.
- Removed the old user-facing dashboard/cockpit commands and artifacts from the TUI/CLI path so browser work consolidates around the IDE surface.
- Added a D3-only model tool loop for the interactive terminal session, allowing the model to request registered D3 tools, receive compact evidence, and continue the answer.
- Added Rocket D3 manual/reference search as a read-only D3 tool for manual-grounded answers.
- Reframed the TUI path so normal text goes through the D3-aware session engine instead of plain chat.
- Prepared the project for initial publication at https://github.com/tensology/d3code.
- Documented the repository location in the README.
- Captured the current Rocket D3 agent foundation as the first tracked release.
