# Office D3 demo order programs

Observed read-only on 2026-11-20 in the Office demo profile, account `dm`.
The `bp` file contains 38 items matching the `D3CODE.` prefix, including
`D3CODE.SALE`, `D3CODE.STATEMENT`, `D3CODE.CREDIT`, `D3CODE.RUN`, and
`D3CODE.BULK`. Some items are D3Code test or transport helpers. Use the
maintained, synthetic order sandbox under `sandbox/d3-order-app/basic`
for examples and read the exact live item before making a change.

Order, stock, and payment BASIC examples use separate files
`D3CODE.ORDERS`, `D3CODE.LINES`, `D3CODE.PRODUCTS`, `D3CODE.MOVES`,
and `D3CODE.PAYMENTS`. Check the active dictionary for attribute numbers,
and trace error, lock, and release paths before editing the related programs.
Example source and names belong to this demo and can differ across accounts.

The Office demo `dm` scan returned 46 data-file pointers and did not
establish an SB, SB+, or SB/XA installation. Treat `backgrounds.output`
as an unverified candidate from a name heuristic. For SB Builder work,
confirm the actual account and framework, then inspect its process, screen,
or menu definition alongside the legacy SB+ Solutions guide.

On 2026-11-22, a read-only lookup from Office `dm` found the account
entries `SB+` and `SB+.DEFN`, both with the `DX` type, in `MDS`.
The legacy SB+ Solutions guide names these as its software accounts.
A separate read-only session confirmed `SB+.DEFN` with `WHO`.
Its plain master-dictionary listing exposed `DMPROCESS` and `TUDEFN`.
`COUNT DMPROCESS` returned 666 items, and `COUNT TUDEFN` returned six.
`CT TUDEFN BOOKMARK.DOC` returned a definition item. In Office
`SB+.DEFN`, `CT DMPROCESS TEST.P` displayed seven numbered attributes.
The plain AQL file listing returned nine direct file pointers. The
formatted listing and documented installer source lookup returned
native errors.
Verify the target application's own process, definition, and program
files before applying a layout or generating code for it.
