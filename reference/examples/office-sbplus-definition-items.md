# Office SB+ definition items

| D3 account | D3 file | Item ID | Read-only observation |
| --- | --- | --- | --- |
| `SB+.DEFN` | `DMPROCESS` | `TEST.P` | `CT DMPROCESS TEST.P` displayed seven numbered attributes. |
| `SB+.DEFN` | `TUDEFN` | `BOOKMARK.DOC` | `CT TUDEFN BOOKMARK.DOC` returned a definition item. |

On 2026-11-22, a read-only Office D3 session confirmed its active account
as `SB+.DEFN` with `WHO`. The legacy SB+ Solutions guide documents
`SB+.DEFN` and `SB+` as software accounts.

In `SB+.DEFN`, the plain AQL master-dictionary listing returned nine
direct file pointers. `COUNT DMPROCESS` returned 666 items, and
`COUNT TUDEFN` returned six. The formatted listing and documented
installer source lookup returned native errors.

Verify the target application's own process, definition, and program
files before applying a layout or generating code for it.
