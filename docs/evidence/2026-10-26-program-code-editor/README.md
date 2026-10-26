# Program code editor checkpoint

Status: local verification passed; production verification pending. This is one program-editing component, not completion of the full IDE.

## Scope and acceptance

The shared standalone and embedded app replaces the program textarea with a self-hosted CodeMirror editor. Programs receive syntax colouring, line numbers, indentation, undo/redo, search/replace, go-to-line and the existing guarded Save/Compile/Catalog/Run actions. Data and dictionaries keep their structured editors. An unloaded selection does not expose an editor. The native compiler remains the syntax authority; highlighting is lexical, not a language server.

Save still uses the existing connection-pinned native record protocol, approval and exact baseline. A different record or fresh read resets undo history. Unsaved content reaches the selected-item chat context and prevents accidental page unload. Read-only records cannot be edited or replaced. A failed script download explicitly offers the existing plain-text fallback.

## Automated and browser evidence

- `npm run build:ide`: browser bundle generated locally with all 15 bundled package licenses, no external CDN.
- `npm run typecheck`: server and browser TypeScript checks pass.
- `node --test dist/test/program-editor.test.js dist/test/basic-language.test.js dist/test/ide-records.test.js dist/test/ide-server.test.js`: 53 pass. Covers lexical progress, asset authentication/fixed path, native record safety, user isolation, job limits and existing IDE routes.
- Local Chrome program matrix: four widths (390, 768, 1280, 1440), light and dark. Source, go-to-line, search/replace, saved source, read-only and failed-asset fallback: 48 final captures, inspected individually at readable resolution.
- Local program-action matrix: same widths/themes, approved Run review and output: 16 final captures, inspected individually. Save Cancel preserves the native baseline; approved Save matches exact readback; dirty Run is refused; Compile and approved Run produce expected fixture output.
- Shared button-colour review: settings and terminal at 390/1440, both themes, eight captures inspected individually. Computed terminal Send contrast is at least 4.5:1. Blue fills use a separate token so white button text stays readable without darkening link and syntax foregrounds.

Local captures: `/tmp/d3-codemirror-evidence`, `/tmp/d3-codemirror-actions-evidence`, `/tmp/d3-editor-shared-colors`. Search match foreground/background, close-button overlap, go-to-line sizing and syntax contrast were corrected before the final capture matrix. No page overflow or clipping found in that matrix. Small inherited metadata text remains a wider typography limitation; this is not a whole-product accessibility sign-off.

## Interaction rationale

- Familiar code editing commands and line navigation: Jakob's law; avoid inventing a custom editing model.
- Existing native Save and approval path retained: Nielsen #5, error prevention; no second write mechanism.
- New read resets undo history and unsaved changes require a decision: prevent source leaking between items or silently losing a draft.
- Search lives inside the editor and output opens only for actions: Gestalt proximity; preserve working space.
- Esc then Tab exits indentation mode: keyboard access without trapping focus (WCAG 2.1.2).

## Limits and remaining verification

Production must independently prove branded-domain authentication, program browsing, native Save/Compile/Run, exact readback and restoration of the owned sandbox fixture. Local fixture success does not prove that path.

No native mobile hardware keyboard, Safari, screen reader or full IDE accessibility certification was performed. Native writes remain limited to the verified D3CODE sandbox and existing byte/encoding limits. Structural record editing, New item, framework builders and operations are separate incomplete work.

`npm audit` reports an existing high-severity Zod advisory (GHSA-mrhx-c7xc-m3w5). Its advertised fix is a major-version migration, which is not silently included in this editor change. No added CodeMirror or esbuild advisory was reported. Dependency security remains an open production risk.

## Deployment requirement

Run `npm ci`, `npm run build:ide` and the TypeScript build in the existing production checkout before restarting `d3code@51`. A TypeScript-only deployment does not generate the browser asset. The main build now includes this step.
