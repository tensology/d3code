---
name: d3-practical
description: Hard-won, verified Rocket D3 operator and BASIC rules learned from live work on a D3 10.3.6 account (dm) - session/login, the ED editor, BASIC compile traps, files and indexes, AQL, terminal prompt handling, pseudo-floppy backups, and phantom scheduling. Use whenever driving D3 from D3Code, writing D3 BASIC, or scripting saves and phantoms.
origin: D3Code verified against live Rocket D3 10.3.6 (pick0)
---

# Practical D3 (verified rules)

Every rule here was proven by hitting the failure and fixing it against a live D3
10.3.6 account. Prefer these over guessing.

## Getting in

- Login sequence: `d3` → `Enter your user id:` (`dm`) → `master dictionary:`
  (`dm`) → the TCL prompt `:`. Use automatic port allocation for service connections;
  `d3 -0` requests console port 0 and can fail when it is occupied. `termu j` sets the terminal type if the screen is wrong.
- **Accounts are listed in the `system` file**: `sort only system`. There is no
  `LIST-ACCOUNTS` or `ACCOUNTS` verb.
- Switch account with **`TO <account>`**. `TO` is a noun that runs `logto`. Bare
  `LOGTO` gives *"illegal master dictionary"* and `LOGTO <acct>` hangs.
- An account can be a **System Builder (SB+) application**: logging in lands you on
  an SB+ menu, not TCL. `WHO` then shows `port user account`.
- Leave with `OFF`.

## The ED editor (`ED file item`)

- Batch write: `ED f i` → `I` → body → **blank line to end insert** → `FI` to file.
  Without the blank line the editor stays open and the session never returns.
- **`I` inserts before the current line** — over an existing item it *prepends*.
  Automated replacements must use the native record helper with a lossless read
  baseline and explicit approval. Never delete first or fall back to ED: deletion
  can lose the record if insertion fails and cannot detect a concurrent edit.
- To **append**, position at a high line number first: `ED f i` → `9999` → `I` →
  body → blank → `FI`.
- A single ED write above roughly **5 KB never returns to the prompt** (the content
  you see is the editor echo, not a filed item). Write in chunks, appending.
- ED **cannot express empty attributes** (a blank line ends insert). Build items
  with blank attributes from BASIC with `WRITE`.

## Guarded automated replacements

- Read with `d3_read_item` or `d3_read_dict` and `lossless:true`; retain its returned baseline.
- Pass that baseline to the corresponding write tool or BASIC build tool. They
  compare under a D3 item lock, replace once and verify the exact bytes.
- These tools replace existing sandbox items only, up to 8 KiB of single-byte
  text. Missing helpers, unsupported records and conflicts must stop the write.
- Newlines in a tool body represent attribute marks. Existing literal CR/LF bytes
  are refused by the text tool; the byte-exact API can retain them.
- Build catalogs only after a verified save and successful native compilation.
- CLI: redirect a `read-item --lossless` result to a baseline JSON file and pass
  it back with `--baseline-file`. Do not take a new baseline automatically at save time.

## BASIC rules

- A main program has **no `PROGRAM` header** — start with code or `*`. A `PROGRAM`
  line aborts compilation with `[B102] Bad statement`.
- `SUBROUTINE Name(args)` **must be line 1**; comments may only follow it.
- `:` is both the statement separator and the concat operator, so `X = X : Y`
  parses as two statements. Start a concatenation with a literal, or build into a
  temp: `CMD = "set-device " : DEV` then `EXECUTE CMD`.
- `EXECUTE "tcl"` runs TCL. To capture output use **`EXECUTE "cmd" CAPTURING var`** — the
  bare function form yields `[B10] Variable has not been assigned`.
- `:=` appends to a string (`cmd := aname`); `:` concatenates. `TRIM()`, `FIELD()`, `DIM var(n)`
  are all in normal use.
- Item locks: `READU` locks, `WRITE` releases, and **`RELEASE file,item`** releases
  explicitly. `UNLOCK` is for execution locks from `LOCK` — it is not the item-lock release.
- `LOOP` / `WHILE`-`UNTIL` / `REPEAT`, `FOR I = 1 TO N` / `NEXT I`, `IF … THEN … END ELSE … END`.
- Date/time: `DATE()` is an internal day number (21483 = 25 Oct 2026);
  `OCONV(DATE(),"D2/")` → `"mm/dd/yy"`; `OCONV(DATE(),"DW")` → 1..7 **Mon..Sun (Sunday = 7)**;
  `TIME()` is seconds since midnight; `OCONV(TIME(),"MTS")` → `"hh:mm:ss"`.
- Compile and catalogue: success is `[241] Successful compile!` and
  `[244] '…' cataloged`. `[428] '…' object pointer not found` means no object was produced.
- Only catalogued names are runnable from TCL. A `SUBROUTINE` is *not* runnable from
  TCL (`'x' is a subroutine, not accessible from TCL`) — call it from a program.
- **There is no TCL `CALL` verb.** For scripted/ad-hoc invocation, write and
  catalogue a small main program.

## Files, indexes, AQL

- `clear-file <file>` empties data and keeps the file, its dictionary and its
  indexes. `DELETE-FILE` + `CREATE-FILE` drops all three (re-run the dict builder
  and re-create indexes afterwards).
- `CREATE-INDEX file attr`, `LIST-INDEX file`, `DELETE-INDEX file attr`.
- AQL: `COUNT`, `LIST`, `SORT`, `SELECT`, `SSELECT`, `WITH`, `(N)`; `SORT … BY @ID`
  fails with *"@ID cannot be identified"* when the dictionary has no `@ID`.
- **AQL reserved words must not be dictionary names** — a field called `TOTAL` makes
  `LIST … TOTAL` fail with *"the last word may not be a connective"*. Use `AMOUNT`.
- `SAMPLE` is not a D3 AQL clause.
- A live select list changes the prompt to `>` and makes a later `COUNT file` count
  **the list**, not the file. Clear it with any non-AQL command (e.g. `WHO`).

## Terminal / prompt handling

- D3 redraws the prompt with an ANSI cursor move (`ESC[24;1H:`) and interleaves NUL
  bytes. **Strip ANSI and NUL before matching prompts**; keep raw output for screen parsing.
- Accept **both `:` and `>`** as ready prompts.
- Interactive prompts are not always newline-anchored (SB+ prints
  `PLEASE ENTER PASSWORD FOR <account>` with cursor positioning). Match at the buffer
  end, not only after `\n`.
- `CT file item` with no options opens the interactive editor — read with
  `CT file item (N`.
- JavaScript RegExp has **no `(?i)` inline flag**; prompt patterns using it are invalid.
- Licence slots are finite: too many concurrent sessions give `Too many users`; fail
  fast with a clear message rather than hanging.

## Pseudo-floppy devices and saves

- `list-device` / `t-stat` lists devices; pseudo-floppies are numbered 0..9 and map to
  a UNIX file (e.g. `2 monday … 9 monthend3` → `/backup/d3/<name>`).
- Select a device **by name**: `set-device /backup/d3/sunday` (non-interactive).
  `set-floppy <n>` is a **density/drive** option, not a device number — it attaches
  the first floppy and will silently pick the wrong device.
- `t-att 512` sets the tape block size; `t-det` detaches.
- `file-save {(options}` saves the whole file system from DM; `account-save {acct}`
  saves one account to the attached device; both invoke the `save` procedure and
  normally log off when done (the `f` option prevents that).
- A device file is only created when data is first written — "no file yet" does not
  prove the save failed, but a job that reports done with no file and no open handle
  means nothing was written.

## Phantoms and scheduling

- `z {h}{s}{d} {tcl.command}` submits a phantom job (`h` holds output in the spooler,
  `s` suppresses errors, `d` deletes the job item when done). `z` runs **immediately** —
  there is no built-in future time.
- `LIST-JOBS`, `phantom-status`, `clear-jobs`, `startsched` for the scheduler.
- **`backgrounds` file = scheduled jobs.** Attributes: 1 USER, 2 PORT, 3 MSG,
  4 COMMAND, 5 TYPE, 6 ACTIVATE.DATE, 7 ACTIVATE.TIME, 8 SKIP.DAYS, 9 SKIP.TIME,
  10 DOW (Sunday = 0), 11/12 INACTIVE.FROM/TILL, 15/16 START.DATE/TIME.
- **ACTIVATE.DATE must be the internal day number (`DATE()`), not the text date**, and
  **ACTIVATE.TIME must be seconds since midnight** (`18*3600 = 64800`). Writing
  `"18:00"` silently lists as `00:00`. `SKIP.DAYS = 1` repeats daily.
- Write blank attributes (2, 3, 5) from BASIC — ED cannot.

## House style (from the account's own programs)

Read the local BP programs before writing new ones; the account has a consistent style.

- Header block: `* <name> - <purpose>`, the Rocket copyright line, a `* ====` rule, then a
  change log of `[NN] <date><initials>: [<ticket>] <note>`.
- `EQUATE` the system delimiters and constants at the top, e.g.
  `EQUATE AM TO CHAR(254)`, `EQUATE VM TO CHAR(253)`, `EQUATE MD TO "MD"`.
- Keywords are case-insensitive and written mixed-case: `Open … To … Else`, `Execute`,
  `Loop`, `Readnext`, `Readu`, `Then`, `End`, `Else`, `Repeat`.
- Control flow: `Loop … Readnext id Else Exit … Repeat`; `Readu job From id Then … End Else
  Release id End`; `If … Then … End Else … End`.
- Read the command line with `TCLREAD sen`, prompt with `PROMPT ''` / `INPUT` / `CRT`, parse
  with `FIELD(sen,'(',1)`.
- Run TCL from BASIC with `Execute cmd` (build `cmd` first), and capture with
  `Execute 'select …' Capturing xx`.
- Fail loudly: `STOP 201,'peqs'`, `STOP 1145,job.id` — a code plus a message.
- File open idiom: `Open 'peqs' To peqs Else Stop 201,'peqs'` (older code uses
  `Open 'dm,jobs,'` with no `To`).
- Writes use `Writev "l" On id,1` and `Write item On file,id`; releases use `Release id`.

## Known environment

- The office demo box (`office.crystallogic.org:2266`, host `CL-RH-SRV`) runs D3 10.3.6
  on `pick0`. Its `dm` account is the master dictionary and the only plain TCL account;
  `MPSTORE` and `MULTISNACK` are also present and are **System Builder (SB+) applications**
  — `TO MPSTORE` prompts for a password (SB+) and lands on the SB+ main menu, not TCL.
- `MPSTORE` is the **production** MerryPak account. Treat it as read-only; get a separate
  account that lands straight in TCL before doing any real work.
- Jackcat reaches the MerryPak production server over **ZeroTier** (jackcat
  `192.168.100.14` ↔ merrypak `192.168.100.13`); the office demo machine has **no ZeroTier**,
  and `merrypak.crystallogic.org` is not reachable directly.

## Safety

- Treat production accounts as read-only. Do development in a scratch namespace
  (for example `D3CODE.*` files) and never run destructive tests against live data.
- Before any write: confirm the account, the device, and the target file. A mis-set
  device silently targets the wrong backup.
