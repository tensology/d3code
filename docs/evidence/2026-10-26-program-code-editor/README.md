# Program code editor checkpoint

Status: application commit `04f88f1` deployed and the bounded program workflow verified in production. This is one program-editing component, not completion of the full IDE.

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

Final captures are retained in [local-editor](local-editor), [local-actions](local-actions) and [shared-colors](shared-colors). Search match foreground/background, close-button overlap, go-to-line sizing and syntax contrast were corrected before the final capture matrix. No page overflow or clipping found in that matrix. Small inherited metadata text remains a wider typography limitation; this is not a whole-product accessibility sign-off.

## Production result

- Existing single checkout updated, dependencies installed with `npm ci`, browser bundle built, both TypeScript checks passed and all 53 focused tests passed on the server before restarting only `d3code@51`. Service active at application commit `04f88f1`.
- Fresh capacity: root 8.8GB free (87% used), approximately 1406MiB available RAM before build. No local model or second runtime installed.
- Branded tickets domain: anonymous 401 and active unflagged other-customer 403. Enabled Crystal Logic director opens the shared editor.
- Real office demo `dm`: all program actions reject missing/stale connection snapshots (409); owned program found by prefix search and opened in CodeMirror. Dirty Run sends no execution request. Cancelled Save preserves original bytes. Approved Save matches independent native readback exactly.
- Native Compile returns successful compilation; each Run review can be cancelled without a confirmed execution. One approved Run returns `D3CODE UI RUN BUTTON VERIFIED` in the editor output. Original owned sandbox source restored by comparison-and-replace and its original program recompiled afterward.
- [Production captures](production): source, search panel, Run review and output at 390/768/1280/1440, 16 screens inspected individually after deployment. No page overflow, clipped action controls, support-widget overlap or extra page scrollbar found. Long source lines scroll within the code editor.
- [Model and startup captures](model-startup): error, Retry recovery and actual OpenRouter D3 `WHO` response at 390/1440, six screens inspected individually. Retry preserves the draft; final model response contains native `7 dm dm` output. Temporary authentication sessions and headless browsers removed in `finally` blocks.
- Current process cwd verified as `/var/lib/d3code/customer-51`; its `D3CODE.md` is present in the generated system prompt. Private configuration permissions verified. Current config asserts Office demo, host `office.crystallogic.org`, `dm` allowlist only, model `openrouter/deepseek/deepseek-v4.1-flash`. No instruction or credential contents printed.

In total this checkpoint retains 94 individually inspected screenshots. [Native result record](production/result.json) lists the exact program checks. The fixture is a D3CODE-prefixed test program, not customer application source.

## Bounded component review

| Area | Score | Limitation |
|---|---:|---|
| States | 17/20 | Program loaded, dirty, saved, read-only and asset failure exercised; full product states remain outside this checkpoint. |
| Safety and flow | 12/15 | Existing guarded writes retained; New item and structural CRUD remain pending. |
| Forms | 8/10 | Search and line navigation work; broader form consistency unfinished. |
| Hierarchy | 12/15 | Editor receives the workspace; inherited small metadata still needs review. |
| Tokens | 8/10 | Shared colours and editor surfaces use existing tokens; existing spacing/type values remain. |
| Accessibility | 10/15 | Keyboard escape, labels, read-only behavior and colour pairing checked; no screen-reader certification. |
| Responsive | 9/10 | Four widths and both themes inspected; physical mobile keyboard not tested. |
| Rationale | 5/5 | Significant interactions explained below. |

Component score: 81/100. Full-product completion gates remain incomplete, including create/delete journeys, framework-aware editing, operations and full accessibility review. This score does not make the full IDE production-ready.

## Interaction rationale

- Familiar code editing commands and line navigation: Jakob's law; avoid inventing a custom editing model.
- Existing native Save and approval path retained: Nielsen #5, error prevention; no second write mechanism.
- New read resets undo history and unsaved changes require a decision: prevent source leaking between items or silently losing a draft.
- Search lives inside the editor and output opens only for actions: Gestalt proximity; preserve working space.
- Esc then Tab exits indentation mode: keyboard access without trapping focus (WCAG 2.1.2).

## Limits and remaining verification

The branded-domain program journey is now evidenced above. Other workflows cannot inherit that verification merely because they use the same editor.

No native mobile hardware keyboard, Safari, screen reader or full IDE accessibility certification was performed. Native writes remain limited to the verified D3CODE sandbox and existing byte/encoding limits. Structural record editing, New item, framework builders and operations are separate incomplete work.

At this editor checkpoint, `npm audit` reported an existing high-severity Zod advisory (GHSA-mrhx-c7xc-m3w5). It was subsequently fixed and production-verified in the separate [native v4 validation upgrade](../2026-10-26-validation-upgrade.md). No added CodeMirror or esbuild advisory was reported.

## Deployment requirement

Run `npm ci`, `npm run build:ide` and the TypeScript build in the existing production checkout before restarting `d3code@51`. A TypeScript-only deployment does not generate the browser asset. The main build now includes this step.
