# Read-only operations tool

Status: application `981f004` deployed and the bounded read-only report journey verified through the branded production site. This is inspection support through chat and the existing CLI tool runner, not a completed operations workspace.

## Scope and acceptance

`d3_operations_status` accepts exactly one `area`: `jobs`, `printers` or `queue`. It executes only `LIST-JOBS (N`, `SP-STATUS (N` or `LISTPEQS (N` respectively. Reports retain native stdout, stderr and exit information. They are not converted into invented counts or an empty-state success. The command timeout is capped at 15 seconds, retaining any shorter caller timeout and cancellation signal.

The tool is read-only in native D3 Plan safety. Chat/audit/modernize/migrate/qa modes expose it; reference-only plan/gsd modes and API mode retain their previous restrictions. Shell transports still require their normal safeguards. The new `LISTPEQS` read classification permits only the existing plain/no-pause diagnostic forms, not arbitrary options, printer destinations, user selectors or ranges. Printing, job starts, cancellation, spooler controls, scheduler changes and backup operations are not implemented here.

Reports may include system-wide entries visible to the configured D3 login. This tool does not create stronger account-level isolation than the server itself provides.

## Reference grounding

Bundled Rocket D3 Reference Manual 10.3.4, `reference/d3_reference_manual_10.3.4_5-28-2026.pdf`: pages 1419-1420 (phantom job status), 1444-1445 (print-queue status and the nonprinting example), and 1640 (printer device status and no-pause option). All five relevant pages rendered and inspected individually. No SB or SB+ installation is required for these native commands.

Before editing, existing production CLI read probes confirmed a native phantom-jobs heading (3207 output characters) and an inactive office spooler (38 output characters). The queue probe returned 5498 characters with the native "Spooler Queue Elements" heading. No operational state was changed by these probes. The registered tool was subsequently verified through the production identity and model journey below.

## Local verification

- TypeScript server and browser checks pass.
- 101 tests pass across compact output, permissions, schema input, tool execution safety, scope, agent loop and IDE server. The final UI correction also passed all 43 IDE server tests on production before restart.
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

## Production and visual evidence

- Shared application deployed in the existing checkout; service active, zero restarts after startup, approximately 66 MiB resident service memory.
- Actual Crystal Logic director journey at tickets.crystallogic.co.za: anonymous 401, active unflagged other-customer 403, then three real OpenRouter calls using only the typed operations tool.
- Each area returned its native report. Printer status explicitly reports "The spooler is inactive." No native command error was treated as an empty queue.
- [Production captures](production): 32 final screenshots, each inspected individually. Three expanded reports and collapsed cards at 390, 768, 1280 and 1440, light and dark. No page overflow or overlapping controls. Report text wraps inside the chat and remains cumbersome on mobile; this is not acceptance of a finished operations workspace.
- [Local state captures](local-states): 30 final screenshots, each inspected individually. Warning, blocked and running states at 370, 390, 768, 1280 and 1440 in both themes. Header bounds, keyboard expansion/collapse, mobile targets of at least 44 pixels and readable running opacity asserted.
- Report heading and status contrast computed against rendered backgrounds: at least 4.5:1 across both themes and all four production widths.
- Initial capture timing caught the branded sidebar mid-animation. Final capture waits for layout to settle and verifies the report control is unobscured by the outer page. Initial mobile controls were 32 pixels; final scoped controls are at least 44 pixels.
- Temporary browser sessions and authentication records removed; local preview stopped.

## Interaction rationale

- Distinct background jobs, printers and queue titles identify each collapsed result: Nielsen #1, visibility of system status.
- Existing report cards retained: Jakob's law and Gestalt similarity, no competing navigation added.
- Running state says "Checking" and native failures retain their warning: Nielsen #1 and #5, no false success.
- Mobile controls use 44-pixel targets and omit the redundant command preview: Fitts's law and the user's compact-workspace rule.

## Bounded review and limits

| Area | Score | Limit |
|---|---:|---|
| States | 17/20 | Native success and simulated warning/blocked/running verified; no full operations screen. |
| Safety and flow | 14/15 | Fixed read-only commands and rejection coverage; no mutation controls. |
| Forms | 9/10 | Strict enum tool input; no new form. |
| Hierarchy | 10/15 | Distinct report titles; raw column output remains awkward when wrapped. |
| Tokens | 9/10 | Existing card and theme tokens reused. |
| Accessibility | 11/15 | Keyboard toggle, contrast and touch targets checked; no screen reader audit. |
| Responsive | 7/10 | No page overflow; raw reports need a dedicated structured presentation. |
| Rationale | 5/5 | Significant interaction decisions explained above. |

Bounded component score: 82/100. Full-product gates remain incomplete. This score does not certify the requested IDE or operations workspace.

The existing chat compaction limits still apply (18 lines / 3500 characters), with omitted-line markers. Model summaries are not authoritative complete inventories. CLI JSON retains the complete native result. Reports may show system-wide entries visible to the D3 login, including historical metadata for other accounts; the test did not switch accounts or access MerryPak production.

No job start/stop, scheduling, printer assignment, print submission, backup command, native mobile hardware, Safari or screen reader verification was performed. Full operations controls and structured presentation remain unfinished.


## Partial-report qualification follow-up

Application `f01ac7e` adds a shared agent instruction to explicitly qualify reports containing omitted-line or omitted-character markers. It forbids deriving complete totals, absence or exhaustive inventories from an excerpt; an explicit native total may be quoted with the qualification. A regression verifies an 80-line queue report retains its exact omission marker and visible ends in model feedback. All 28 compact/agent-loop tests pass locally and on production.

A fresh real OpenRouter journey requested only the queue report, with no mention of truncation in the user prompt. The answer explicitly reported 56 omitted lines, declined to vouch for the missing middle entries and distinguished visible native totals from derived counts. Anonymous 401 and unflagged 403 remained correct. The response still extrapolated ownership from visible rows, so this is evidence of qualification behavior, not a whole-answer accuracy certification. Model summaries still require judgment.

Eight response screenshots at four widths and both themes were inspected individually. These historical captures are retained in [partial-report-before-table-fix](partial-report-before-table-fix); they exposed split short labels in the mobile table and are not the final table presentation.

Application `c73c889` gives the first table column a minimum text width, preserving short labels while descriptions wrap. This reuses existing rendering, colours and table structure; no new table interaction or data behavior. The first-column rule applies to shared chat tables. TypeScript server/browser checks and 71 focused IDE/compact/agent tests pass locally. Eight local representative table captures pass per-word line-box and page-containment assertions and were inspected individually in both themes. Production table verification passed at application `c73c889`: all 43 IDE tests passed on the server, service active, and eight final branded-domain representative table captures passed short-label line-box and page-containment assertions and were inspected individually. These captures are in [table-production](table-production); they use explicitly injected representative content in the real renderer, not fabricated live model output. The separate model check above used an actual OpenRouter response. All temporary authentication sessions, browsers and local previews were closed.

Interaction rationale: preserve readable label-value grouping (Gestalt proximity); allow descriptions to wrap rather than splitting short labels (WCAG 1.4.10 reflow). Many-column and long-identifier tables still need broader mobile treatment.
