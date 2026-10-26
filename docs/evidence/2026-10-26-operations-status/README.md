# Read-only operations tool

Status: local checks pass; new tool not yet verified in production. This is inspection support through chat and the existing CLI tool runner, not a completed operations workspace.

## Scope and acceptance

`d3_operations_status` accepts exactly one `area`: `jobs`, `printers` or `queue`. It executes only `LIST-JOBS (N`, `SP-STATUS (N` or `LISTPEQS (N` respectively. Reports retain native stdout, stderr and exit information. They are not converted into invented counts or an empty-state success. The command timeout is capped at 15 seconds, retaining any shorter caller timeout and cancellation signal.

The tool is read-only in native D3 Plan safety. Chat/audit/modernize/migrate/qa modes expose it; reference-only plan/gsd modes and API mode retain their previous restrictions. Shell transports still require their normal safeguards. The new `LISTPEQS` read classification permits only the existing plain/no-pause diagnostic forms, not arbitrary options, printer destinations, user selectors or ranges. Printing, job starts, cancellation, spooler controls, scheduler changes and backup operations are not implemented here.

Reports may include system-wide entries visible to the configured D3 login. This tool does not create stronger account-level isolation than the server itself provides.

## Reference grounding

Bundled Rocket D3 Reference Manual 10.3.4, `reference/d3_reference_manual_10.3.4_5-28-2026.pdf`: pages 1419-1420 (phantom job status), 1444-1445 (print-queue status and the nonprinting example), and 1640 (printer device status and no-pause option). All five relevant pages rendered and inspected individually. No SB or SB+ installation is required for these native commands.

Before editing, existing production CLI read probes confirmed a native phantom-jobs heading (3207 output characters) and an inactive office spooler (38 output characters). No operational state was changed by those probes. Queue inspection and the newly registered tool still require live verification.

## Local verification

- TypeScript server and browser checks pass.
- 95 tests pass across permissions, schema input, tool execution safety, scope, agent loop and IDE server.
- Exact fixed commands verified in Plan/Ask/Trust safety; no dynamic command text is accepted.
- Native output and warnings preserved; timeout errors propagate instead of becoming an empty queue.
- Unknown areas, prototype-key areas, command injection and extra fields rejected. Both runtime and native provider schemas require the same enum.
- All existing mutation and shell safety tests remain passing.

## Usage

In chat, ask to inspect D3 background jobs, printer status or the print queue. The agent can use the typed tool and show the native report.

Existing CLI entry point:

```sh
d3code tool d3_operations_status '{"area":"printers"}' --profile 'Office demo' --safety plan --mode audit
```

Change `area` to `jobs` or `queue` for the other report. No extra CLI command or navigation panel was added.

## Remaining acceptance

Deploy the shared app, run all three areas through the dedicated production identity, then exercise the real OpenRouter tool calls through the branded tickets UI. Inspect expanded/collapsed report events at desktop/mobile widths in both themes. Preserve access-denial checks and close temporary browser/login sessions.
