# D3 errors and fixes found in practice

Every entry was hit for real while driving a live Rocket D3 10.3.6 account from
D3Code and building a sandbox application. Format: **symptom → cause → fix**.

## Harness / session

| # | Symptom | Cause | Fix |
|---|---|---|---|
| 1 | Session never returns; editor stays open | ED insert mode is ended by a **blank line** | Send `…body` + blank line + `FI` |
| 2 | Re-writing an item kept the old content | `I` inserts *before* the current line | `DELETE` the item, then write (`runReplaceWrite`) |
| 3 | Large program "written" but not filed; session hangs | A single ED write > ~5 KB never returns to the prompt (what you see is the editor echo) | Chunk the write; append with `9999` + `I` |
| 4 | Body with a blank line silently truncated | ED cannot express empty attributes | Reject loudly; build such items from BASIC |
| 5 | Session died after `SELECT` | D3 answers with `>` while a select list is active | Accept `:` and `>`; reset the list after list-building checks |
| 6 | `d3_read_item` timed out | `CT file item` opens the interactive editor | Read with `CT file item (N` |
| 7 | Prompt never matched; every live session failed | D3 redraws the prompt with an ANSI move (`ESC[24;1H:`) plus NUL bytes | Strip ANSI/NUL for matching (keep raw for the screen parser) |
| 8 | 3 of 12 concurrent sessions hung | Licence slots exhausted → `Too many users` | Detect it during startup and fail fast |
| 9 | Prompt pattern rejected as an invalid regex | JavaScript RegExp has **no `(?i)`** inline flag | Plain patterns only |
| 10 | A live `COUNT` returned the wrong number | An active select list makes `COUNT file` count the **list** | Clear the list with a non-AQL command |

## D3 BASIC

| # | Symptom | Cause | Fix |
|---|---|---|---|
| 11 | `[B102] Bad statement` at line 2 | A `PROGRAM <name>` header is not valid D3 BASIC | Main programs start with code or `*` |
| 12 | `[B102] Bad statement` on the `SUBROUTINE` line | Comments before `SUBROUTINE` | `SUBROUTINE Name(args)` must be line 1 |
| 13 | `[B102] Bad statement` on `X = X : Y` | `:` is the **statement separator** as well as concat | Start the RHS with a literal, or build into a temp var |
| 14 | `[B113] Unrecognized code at end of statement` on `UNLOCK PF, SKU` | `UNLOCK` releases an *execution* lock | `RELEASE file,item` for a `READU` item lock |
| 15 | `[B10] Variable has not been assigned; zero used` | `EXECUTE` used as a function | Use `EXECUTE "cmd" CAPTURING var` |
| 15b | Could not read TCL output back | No capture | `Execute 'select …' Capturing xx` is the house idiom |
| 16 | `[428] object pointer not found` at `CATALOG` | Compilation aborted (no object produced) | Check for `[241] Successful compile!` before cataloguing |
| 17 | `'x' is a subroutine, not accessible from TCL` | Subroutines are not TCL verbs | Call from a program; **there is no TCL `CALL`** |
| 18 | `illegal master dictionary` | Bare `LOGTO` with no account | Use `TO <account>` |
| 19 | `TO MPSTORE` hung | SB+ password prompt is not newline-anchored | Match the prompt at buffer end; a `TO <account>` may be an SB+ application |

## AQL / dictionary

| # | Symptom | Cause | Fix |
|---|---|---|---|
| 20 | `[18] the last word may not be a connective` | A dictionary item named `TOTAL` collides with the AQL keyword | Rework the field name (e.g. `AMOUNT`) |
| 21 | `[24] The word "@ID" cannot be identified` | `SORT … BY @ID` where the dictionary has no `@ID` | Sort by a real attribute |
| 22 | Index/query returned nothing after a reset | `DELETE-FILE` + `CREATE-FILE` drops dictionary **and** indexes | Prefer `clear-file`; otherwise rebuild dict + indexes |

## Devices, backups, scheduling

| # | Symptom | Cause | Fix |
|---|---|---|---|
| 23 | `set-device 8` hung | `set-device` prompts for the device number | Select by name: `set-device /backup/d3/sunday` |
| 24 | The save attached `monday` when told 8 | `set-floppy <n>` is a **density/drive** option, not a device number | Use `set-device <name>` |
| 25 | `backgrounds` ACTIVATE.TIME listed as `00:00` | D3 time is **seconds since midnight** | Store `18*3600 = 64800`; date is the internal day number |
| 26 | Scheduled job ran immediately | `z` submits now; it has no future time | Use the `backgrounds` file (ACTIVATE.TIME + SKIP.DAYS) |
| 27 | `LIST-ACCOUNTS` / `ACCOUNTS` not defined | No such verbs | Accounts are in the `system` file: `sort only system` |
| 28 | `file-save` reported `done` but wrote no file | Suspected: spooler inactive and/or the FSI `DM,BP` compile step awaiting input (manual documents a "Remote file system error" prompt answered with `Q`) | Unresolved — start the spooler, or capture the prompt before retrying |

## Notes on two red herrings

- `d3py` and the MerryPak API are a **separate Python path** into a different D3 host
  (`MPSTORE` on the MerryPak LAN). Do not confuse it with the D3Code SSH/TCL path.
- `merrypak.crystallogic.org` (41.71.37.96) was used historically to `rsync` backups
  onto this box and is **no longer reachable**; the existing `/backup/d3/*` files were
  copied from there, not produced locally.
