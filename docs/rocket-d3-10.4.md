# Rocket D3 10.4 — what changed and what D3Code must do about it

Sourced from Rocket's D3 10.4 Linux/Windows release notes and the MultiValue
Product Lifecycle Handbook. D3 10.4 is the only line that receives new features:
**Rocket MV will continue to support D3 10.3 and earlier, but future enhancements
are delivered exclusively in D3 10.4.** D3Code defaults to 10.4 awareness and keeps
10.3-compatible reads.

## New in 10.4

| Area | Change | D3Code impact |
|------|--------|---------------|
| Python | Call Python 3.11 from FlashBASIC and TCL; access D3 data/apps from Python. Python calls **require Flash compilation**. | Prefer `UOPY`/Python evidence over guessing; the `d3_python_runtime` probe already gates this. Treat Python calls as FlashBASIC-only. |
| RPC / TCL client | Linux 10.4 uses Apache Thrift; `d3tcl` is the RPC terminal client (`d3tcl -l` for root privilege). | Detect `d3tcl` alongside `d3`; a persistent PTY over `d3tcl` must be treated like the legacy `d3` prompt. |
| VME / FSI | Linux 10.4 splits the VME and the FSI (host file system). FSI-side commands (most `NT*`) and FSI Hot Backup behave like 10.4 Windows. | Do not assume Linux paths are D3 storage. Keep the "D3 is not a mounted filesystem" rule; use FSI/OSFI semantics. |
| AQL | FSI now processes some selection criteria itself; the "items processed" count reflects FSI-returned items and can differ from 10.3. | Never assert a row count as proof without the statement; note the 10.4 count semantics. |
| Compiler | `$options` supports conditional-compilation directives. | Lint hints should not treat `$options` blocks as errors. |
| Locks | BASIC supports up to **992** locks (was 64) as of 10.3.1. | Lock advice should not cap at 64. |
| Security | OpenSSL 3 (and 1.1/1.0 where present); MVSP and OSFI-to-OSFI can run TLS. | Report TLS/OpenSSL posture as evidence, not assumption. |
| Encryption | **Field-level encryption** at rest for individual attributes. | `set-dptr` on an encrypted file corrupts the D-pointer — never run it after encryption. |
| Installer | New `D3_setup`; `/usr/lib/pick` default install dir; `D3Vme.ini` + `d3config`. | Detection should look for `/usr/lib/pick` and `D3Vme.ini`. |
| mvBase | mvBase applications and the mvBase Workstation can connect to D3. | Expect mvBase-style `input var,0` behavior (see below). |
| OS | Linux: RHEL/CentOS/Rocky/Alma 8.x or 9.x. | Keep the office RHEL 8 host in the supported matrix. |

## Known issues worth encoding as rules

- Shell execution (`!`, `cd`, `ls`, `sh`) runs in the **server-side `d3vme`**
  process, so it affects all threads/users. `!tty` prints the server TTY.
- `PID` shows the thread id, not the `d3vme` process id.
- Python from BASIC must be Flash-compiled.
- Numeric indexes in the VME are **integer only** (scaled storage for decimals).
- FSI-to-FSI communication is 10.4-UNIX-or-later only, and 10.4 UNIX cannot talk
  to 10.4 Windows (different RPC).
- Do not run `set-dptr` on an encrypted file.
- Uninstalling removes the whole install dir — never place house files there.

## Lifecycle

D3 10.3.4 GA was Apr 2023; D3 10.4.0 GA Jul 2023; D3 10.4.1 ~Q1 2026. Under the
policy taking effect 1 Oct 2026, older 10.3.x move to Limited/Upgrade Support and
eventually End of Version Life, with 20–25% legacy charges on maintenance. This is
the commercial argument for migration slices D3Code produces from 10.3 estates.
