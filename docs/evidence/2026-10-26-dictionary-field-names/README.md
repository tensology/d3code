# Dictionary field names in the data editor

Status: application `ff6218a` deployed and this bounded component verified. The full record editor and IDE remain incomplete.

## Acceptance and scope

A developer opens a data file, selects a record and sees dictionary field names beside the existing attribute coordinates. Labels enrich the existing scalar/value/subvalue inputs. They do not change record structure, values, conversion rules, save baselines or approval behavior. Dictionary and BASIC items retain their existing editors. Missing or ambiguous mappings retain attribute coordinates rather than invented names.

The backend samples at most 32 dictionary IDs with the existing bounded item-listing helper, then issues one nonpaging CT for safe IDs on the same session. The commands are checked against native read safety; shell transports do not bypass approval. Requests must name the active profile, and sessions close in finally blocks. No new database, dependency, config, D3 helper program or production record write was needed.

Reference grounding: bundled Rocket D3 Reference Manual 10.3.4, printed pages 151-153 (A/S/X definitions, A2 attribute position, A3 heading, A8 correlative) and 1283 (CT item list and no-page option). Read the extracted manual text and confirmed the multi-item CT form against the office sandbox. These were source-text checks, not newly rendered manual-page inspections.

Only direct positive-integer mappings with no A8 correlative are used. A unique primary A definition supplies the heading; otherwise the item ID is the fallback. Conflicting primary definitions show their IDs, and synonyms remain discoverable in the label tooltip. A3 backslash suppresses heading text. Native output/input conversions are not executed or applied to the record values.

## Evidence

- TypeScript server and browser checks pass.
- 63 focused tests pass locally and on production: dictionary-fields, d3-items, ide-records and ide-server. Covers fixed bounded reads, unsafe IDs, missing definitions, ambiguous names, computed definitions, malformed native output, shell denial, mismatched profile, existing native record safety and user isolation.
- Native read-only probe through the dedicated production identity resolved NAME, EMAIL, LIMIT, BALANCE and TERMS from DICT D3CODE.CUSTOMERS. Its A3 headings are blank, so these are real field IDs, not fabricated friendly headings. The sandbox generator stores text at A6; the manual reserves that position. Neither the generator nor the existing dictionary records was changed.
- [Local captures](local): 32 final screens, each inspected individually. Loaded, loading, partial and failed metadata states at 390, 768, 1280 and 1440, both themes. Retry alignment was corrected before the final matrix. Draft text survives every metadata state and successful retry. Failed metadata leaves ordinary attribute inputs available.
- Additional browser assertions verify keyboard Retry, literal rendering of an HTML-like label, and rejection of a late metadata response after switching to a BASIC program. Program editing has no dictionary-name status or stale labels.
- [Production captures](production): eight final screens, each inspected individually at the same widths/themes. The real branded director journey opens C001 from the sandbox file browser, shows five resolved names, and leaves its unmapped A6 values intact. An unsaved local value and exact original baseline survive a real metadata refresh. The value was restored locally before capture; no record writes were attempted. Test code also blocks record write requests defensively.
- New endpoint access checks: anonymous 401, active unflagged other-customer 403, mismatched-profile 409. Browser page-error list empty; outer and embedded pages have no horizontal overflow.
- Temporary auth sessions and browsers removed; local preview stopped. Existing deployment configuration and instructions were untouched.

## Interaction rationale

- Names sit above existing inputs, with A-number coordinates preserved: Nielsen #6 recognition rather than recall and Gestalt proximity.
- Late metadata updates only labels and accessibility names, never input nodes or drafts: Nielsen #5 error prevention.
- Field-name loading or failure is separate from save status; inline Retry restores labels: Nielsen #1 visibility and #9 recovery.
- Partial metadata is explicit; unknown fields remain generic: preserve product truth, no guessed schema.
- Existing light/dark tokens and field layout reused: Jakob's law and the user's consistency rule.

## Bounded review

| Area | Score | Limit |
|---|---:|---|
| States | 18/20 | Loaded, loading, partial, failed, Retry and empty mapping tested; full CRUD absent. |
| Safety and flow | 14/15 | Read-only metadata; drafts/baselines preserved; structural editing pending. |
| Forms | 8/10 | Real names supplement attribute/value accessibility labels; no native conversion UI. |
| Hierarchy | 12/15 | Names grouped with values; existing editor toolbar still needs wider product review. |
| Tokens | 9/10 | Existing typography and theme tokens reused. |
| Accessibility | 11/15 | Keyboard Retry, literal labels and focus preservation checked; no screen-reader audit. |
| Responsive | 9/10 | Four widths, both themes, no clipping or page overflow; physical mobile not tested. |
| Rationale | 5/5 | Significant interactions explained. |

Bounded score: 86/100. Full-product completion gates remain incomplete.

## Limits and remaining work

This is a sample of up to 32 definitions, not an exhaustive dictionary browser. IDs outside the safe identifier subset, additional definitions and computed fields can remain unmapped. Metadata is refreshed when opening a file or retrying; external dictionary edits are not pushed into an already open record. Records continue to show raw stored values, not converted display values. Initial labels can arrive after the record and add a label line; draft content and focus are preserved.

No new record creation, structural add/remove controls, field-type validation, native conversion preview, framework screen building or operations controls are included. No production record writes, Safari, physical mobile device or screen-reader certification was performed in this checkpoint.
