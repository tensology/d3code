# Findings: building and pressure-testing the D3CODE order app

Every bug below was found by extending the sandbox app and pressure-testing it
against the live office D3 box, then confirmed fixed by re-running the suite.
Iterations ran deploy → verify → pressure until green.

## Harness bugs (D3 Code)

| # | Bug | Symptom | Fix |
|---|---|---|---|
| 1 | `d3_write_item` used ED `I`, which **inserts before the current line** | Re-writing an existing item **prepended** instead of replacing it — silent corruption on every update | Gate the write, `DELETE` the item, then write (`runReplaceWrite`) |
| 2 | ED ends insert mode on a **blank line** | The batch `…bodyFI` sequence left the editor open; the session never returned to the prompt | Send `…body` + blank line + `FI`; the tool now **rejects** a body with blank lines loudly instead of truncating |
| 3 | A single ED write above ~5 KB **never returns to the prompt** | Large programs appeared to write but were not filed; the session hung until timeout (content seen was the editor echo) | Write in chunks: `I` creates, then `ED … 9999 / I / … / FI` appends |
| 4 | D3 has **no TCL `CALL`** verb | Subroutines cannot be invoked from the command line; concurrency participants must be catalogued main programs | Documented; the pressure suite generates one tiny catalogued program per participant |
| 5 | D3 refuses a logon when **every licensed slot is busy** | 3 of 12 concurrent sessions **hung** until timeout instead of reporting the cause | `adapter.ts` now detects `too many users` during startup and fails fast with an actionable message |
| 6 | D3 answers with **`>` while a select list is active** | Matching only `:` timed out and killed the session after `SELECT`/`SSELECT` | Accept `:` and `>` as ready prompts; run a reset command after list-building checks |
| 7 | `CT file item` (no options) opens the interactive editor | `d3_read_item`/`d3_read_dict` hung | Read with `CT <file> <item> (N` |
| 8 | D3 redraws the prompt with an **ANSI cursor move** (`ESC[24;1H:`) | Live sessions never matched the prompt at all | Strip terminal escapes for matching only (output keeps them for the screen parser) |

## D3 language rules learned (each one cost a compile cycle)

| Rule | Detail |
|---|---|
| No `PROGRAM` header | A main program starts with code or `*` comments; a `PROGRAM name` line aborts compilation (`[B102] Bad statement`). |
| `SUBROUTINE` must be line 1 | Comments may only follow the `SUBROUTINE name(args)` line. |
| Compile/catalogue signals | `[241] Successful compile!` and `[244] '…' cataloged`. `[428] object pointer not found` means the object was never produced. |
| `RELEASE`, not `UNLOCK` | `RELEASE file, item` clears an item lock from `READU`; `UNLOCK` resets an execution lock from `LOCK`. |
| `:` separates statements | A concatenation assignment cannot begin with a bare variable: `X = X : Y` parses as two statements. Start the right-hand side with a literal, or use a counter. |
| `clear-file` is the right reset | `clear-file <file>` empties data while keeping the file, its dictionary and its indexes. `DELETE-FILE` + `CREATE-FILE` drops all three. |
| `EXECUTE` runs TCL from BASIC | Lets a program self-reset. |
| AQL reserved words as dictionary names | A field named `TOTAL` makes `LIST … TOTAL` fail with *"the last word may not be a connective"*; rename to `AMOUNT`. |
| Display is 80 columns | Verifying long attributes by `CT` truncates; assert length in BASIC (`LEN`) instead. |
| `SAMPLE` is not a D3 AQL clause | `SELECT MD SAMPLE 3` treats `3` as a key. |

## Sandbox application bugs

| # | Bug | Fix |
|---|---|---|
| 1 | `CANCEL` silently restored no stock when a product had been deleted | Detects missing products, prints `CANCEL.WARNING`, returns `OK.PARTIAL` |
| 2 | No return path | Added `D3CODE.CREDIT` (goods returned): restores stock, reduces order subtotal/VAT/total and the customer balance, journals a `CREDIT` movement, refuses a cancelled order |

## Invariants now proven under pressure

- Stock is **conserved**: 6 buyers raced a 3-unit product and exactly 3 won; stock ended at 0, never negative.
- Same-order contention: 5 concurrent writers produced exactly 5 lines with the correct subtotal (425 × 5 = 212.5).
- No deadlocks and **no orphaned locks** after mixed overlapping writers.
- Balance reconciles to the sum of OPEN orders after a mix of sale, cancel and settle.
- 300 orders through one program: stock 1000 → 700 and the **indexed count matches**.
- Index reflects an updated key (`CUSTOMER` changed and re-queried).
- A missing file returns a `FILE.*` token rather than hanging.

## Harness/tool coverage added

- `sandbox/d3-order-app/pressure.mjs` — 76 checks (26 in-D3 scenarios + concurrency, licence, volume, tool-path and file-failure checks).
- `sandbox/d3-order-app/verify.mjs` — 16 checks on the worked example.
- `sandbox/d3-order-app/deploy.mjs` — 73 steps including chunked program upload.
- `d3code regression --profile office --mutate --prints` — 68 checks over the whole harness.
