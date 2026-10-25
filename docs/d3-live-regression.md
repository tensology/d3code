# D3 live regression suite

`d3code regression` runs a chapter-per-manual-domain regression against a live D3
account and also checks the harness/agent layer.

```bash
d3code regression --profile office                 # read-only
d3code regression --profile office --mutate        # + scratch program/file/index CRUD
d3code regression --profile office --mutate --prints --out ./evidence
d3code regression --profile office --json
```

Exit code is `1` when any check fails. `--out <dir>` writes
`regression-report.md` and `regression-report.json`.

## Chapters

| Chapter | Manual domain | Notes |
|---|---|---|
| ch00 harness | scope guard, permission classifier, tool-input validation | offline |
| ch01 accounts | Accounts & master dictionaries | `WHO`, `LIST MD`, `COUNT MD` |
| ch02 files | Files, dictionaries, attributes | `CT`, `CT DICT`, `LIST DICT` |
| ch03 aql | Access Query Language | `COUNT`, `WITH`, `SSELECT`, `SORT`, `LIST` |
| ch04 basic | BASIC / FlashBASIC | read + scratch write/compile/delete (`--mutate`) |
| ch05 tcl | Terminal Control Language | `LIST-VERBS`, `WHO`, `TERM`, `TIME` |
| ch06 locks | Locks & concurrency | `LIST-LOCKS`, `LIST-ITEM-LOCKS` |
| ch07 phantoms | Triggers & phantoms | `LIST-JOBS` (PHANTOM JOBS status) |
| ch08 diagnostics | Debugger & diagnostics | `WHERE`, lock/dictionary diagnostics |
| ch09 screens | Terminal screens & cursor control | `TERM`, `STTY`, screen dictionary |
| ch10 indexes | Indexes | scratch file CRUD + `CREATE-INDEX`/indexed AQL/`DELETE-INDEX` (`--mutate`) |
| ch11 spooler | Printers & print jobs | `SP-STATUS`, `LIST-JOBS`, `SP-ASSIGN`; `SPOOL` only with `--prints` |
| ch12 backup | Backup & restore | save/restore verbs in the vocabulary (a real save needs a sandbox) |
| ch13 osfi | OSFI / shell / external tooling | OSFI files in MD; `!shell` deliberately not run |

## Design rules

- **Version-tolerant.** Version-specific verbs are `optional`; a miss is a warning,
  not a failure, so the suite runs across D3 10.3 and 10.4.
- **Non-destructive by default.** Mutations only run with `--mutate` and use the
  `D3CODE.TEST.*` prefix, cleaning up in the same run. Printing only runs with
  `--prints`.
- **Active select lists.** D3 shows `>` while a list is active; the runner accepts
  `:` and `>`, and runs a `reset` command (`WHO`) after list-building checks
  because a live list changes what a later `COUNT`/`LIST` counts.
- **Self-healing.** A session that dies mid-run is recreated, and the remaining
  checks continue.

## Live findings (office `dm` account, 2026-10)

Two real bugs the suite exposed and fixed:

1. **`ED` editor writes never returned.** D3's line editor ends insert mode on a
   blank line; the batch sequence must be `ED file item` → `I` → body → *blank
   line* → `FI`. The old `...FI` sequence left the editor open forever.
2. **`SELECT`/`SSELECT` left the session stuck.** The prompt becomes `>` with an
   active list; matching only `:` timed out and killed the session.

Result: **65 pass, 0 fail, 0 warn, 2 skipped** (print jobs), including the full
scratch file/index lifecycle and BASIC write/compile/delete with cleanup.
