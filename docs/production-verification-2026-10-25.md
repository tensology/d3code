# D3Code production checkpoint, 25 October 2026

Verdict: **Incomplete for the requested full developer IDE.** The deployed connection, read/browse workflow and command approval changes have live evidence. The 26 October typed-write checkpoint below replaces the old automated line-editor writers; broader production data use remains unapproved.

Application revision: `0f7b49d` (guarded creation checkpoint; timer guidance update follows) (26 October record editor and contextual output checkpoint). Shared standalone and Tensology application, deployed at `/var/www/d3code`, serving Crystal Logic through `d3code@51.service` and the authenticated Tensology proxy.

Entry point: https://tickets.crystallogic.co.za/dashboard/d3code

## Acceptance evidence

| Requirement | Evidence at this checkpoint |
| --- | --- |
| Existing enabled Crystal Logic director can enter | Temporary authenticated session for the existing director opened the branded tickets page and embedded application. |
| Anonymous and other customer access denied | Anonymous API returned 401; an active, unflagged employee from another customer returned 403; clearing the allowed session cookies returned 401. These checks do not prove isolation between two enabled customers because only Crystal Logic is configured. |
| Approved office connection | Connect and reconnect returned `WHO` for office `dm`; account discovery succeeded without switching; `TO MPSTORE` returned 403. |
| OpenRouter and instructions | Embedded DeepSeek v4.1 flash performed a native D3 tool request and returned office `dm`. The current deployed system prompt was previously checked for the account and mutation instructions; `/api/harness-context` was reachable. The endpoint alone does not prove project instructions. |
| File and item workflow | Live `bp` listing, explicit `D3CODE.` prefix search, opening `D3CODE.PROBE`, and the model identifying that selected item passed. |
| Selection and draft protection | No editor or output before item selection; Terminal-to-empty-Editor remained empty; Cancel preserved a local draft, and Discard reloaded the original without writing D3. |
| Appropriate object actions | Sandbox `D3CODE.CUSTOMERS` data and dictionary selection hid BASIC compile/catalog actions. The 26 October checkpoint below supersedes the original raw-text editors. |
| Approval boundary | Unit/API checks proved unconfirmed commands never reached the session, forbidden account switches remained denied even with confirmation, and plan mode refused operations. Local browser interception checked both Cancel and Approve with no destructive D3 command. Live unknown-command approval was cancelled without execution. |
| Visual inspection | Individual production captures were inspected at 390, 768, 1280 and 1440 pixels for chat, empty editor, opened program and approval. Desktop item search, unsaved dialog, selected-object chat, data and dictionary views were also inspected. No page overflow, bottom clipping, support-widget obstruction or toolbar collision was found in these captured states. Code lines use internal horizontal scrolling. |
| Capacity | Latest server check: 67 GB filesystem, 60 GB used, 6.9 GB available, 90% usage. Root npm cache was cleared; application data, databases and uploads were preserved. Disk headroom still needs monitoring. |

## Automated checks

- Local TypeScript compilation passed.
- Focused permissions, command, IDE API, tool-input and regression-safety tests: 94 passed.
- Command suite rerun after removing the remaining `/account` automatic confirmation: 40 passed.
- Local browser journey passed selection, prefix search, source loading, draft cancel/discard, approval cancel/approve, mobile dictionary actions and output visibility.
- Production browser journey passed the acceptance paths above with no browser JavaScript errors. Separate live approval check passed. Both closed their headless browsers and removed temporary login sessions.
- `git diff --check` passed before the implementation commit.

Python checks and native Rust sidecar builds were not run for this change. The production service uses the TypeScript runtime.

## Retained screenshots

Each link opens a full-resolution capture, not a montage.

| State | 390 | 768 | 1280 | 1440 |
| --- | --- | --- | --- | --- |
| Chat | [Phone](evidence/2026-10-25-d3code/chat-empty-390.png) | [Tablet](evidence/2026-10-25-d3code/chat-empty-768.png) | [Desktop](evidence/2026-10-25-d3code/chat-empty-1280.png) | [Wide](evidence/2026-10-25-d3code/chat-empty-1440.png) |
| No item selected | [Phone](evidence/2026-10-25-d3code/editor-empty-390.png) | [Tablet](evidence/2026-10-25-d3code/editor-empty-768.png) | [Desktop](evidence/2026-10-25-d3code/editor-empty-1280.png) | [Wide](evidence/2026-10-25-d3code/editor-empty-1440.png) |
| Program opened | [Phone](evidence/2026-10-25-d3code/editor-390.png) | [Tablet](evidence/2026-10-25-d3code/editor-768.png) | [Desktop](evidence/2026-10-25-d3code/editor-1280.png) | [Wide](evidence/2026-10-25-d3code/editor-1440.png) |
| Command approval | [Phone](evidence/2026-10-25-d3code/approval-390.png) | [Tablet](evidence/2026-10-25-d3code/approval-768.png) | [Desktop](evidence/2026-10-25-d3code/approval-1280.png) | [Wide](evidence/2026-10-25-d3code/approval-1440.png) |

Additional captures: [prefix search](evidence/2026-10-25-d3code/item-search-1440.png), [unsaved draft](evidence/2026-10-25-d3code/unsaved-1440.png), [selected-object chat](evidence/2026-10-25-d3code/chat-context-1440.png), [data](evidence/2026-10-25-d3code/data-record-1440.png), [dictionary](evidence/2026-10-25-d3code/dictionary-1440.png).

## Interaction rationale

- Keep the editor absent until an item loads: Paul's selection-first rule and Nielsen #1, visibility of system status.
- Keep output closed until requested or an editor action produces it: progressive disclosure and Paul's workspace rule.
- Name the exact command and focus Cancel in approval: Nielsen #5, error prevention.
- Preserve drafts before changing selections: Nielsen #3, user control and freedom.

## Outstanding product work

1. Finish the visible New item workflow and agent/CLI creation paths. The creation protocol and API now have sandbox evidence below; arbitrary production scopes are still unapproved. Generated migration adapter templates retain separate line-editor writers and require correction before use.
2. Complete record creation, structural attribute/value editing, dictionary-aware labels, code editing, catalog/run integration, and recovery. Existing-record source, structured data and dictionary saves have the bounded live evidence below.
3. Verified per-account discovery of native D3, SB and SB+ facilities, with relevant screen-building tools only when supported.
4. Usable phantom, scheduler, spooler, lock and operational workflows with explicit mutation controls.
5. Broader multi-user and multiple-enabled-customer verification. Runtime state is currently shared within a customer's service; per-user D3 sessions are not proven isolated.
6. Full developer usability review and final acceptance across those workflows, including standalone as well as embedded use.

Plan My Charter, wider Tensology mobile work and Decisions AI fixes are separate unfinished tracks. D3 backup reliability remains unresolved.

## Native record backend checkpoint

Revision `df43fc0` adds an acknowledged, hex-framed record protocol and a dedicated D3 session per operation. It does not install a helper automatically or change the current IDE's Save behavior.

The immutable helper was installed only in office `dm` as `bp D3CODE.RECORD.V1.2F23CA51D90EC824335956C3E67B052D86D60B20673989AEF6A64807105162FA`. Both the source and DICT object IDs were checked absent before installation. The source readback matched before native BASIC compilation reported `[241] Successful compile`. A narrow-terminal CT read initially truncated displayed source and correctly stopped compilation; a wider readback resolved that verification failure without replacing the item.

An isolated new `D3CODE.RECORD.TEST` file and uniquely named `D3CODE.RECORD.*` fixture programs were created. No pre-existing customer records were changed. Native checks passed:

- Version/build identity and exact capability handshake.
- Data and dictionary reads preserving attribute, value and subvalue marks, repeated empty attributes, and trailing bytes.
- Multi-frame compare-and-replace followed by independent readback.
- Stale expected content rejected as `CONFLICT`, without replacement.
- Numeric-looking records compared by bytes (`001` differs from `1`).
- Existing zero-byte records changed and restored to zero bytes while remaining present.
- Leading/trailing whitespace in both item IDs and record values preserved.
- Dictionary replacement preserving added empty attributes.
- Another session's `READU` lock returned `BUSY`; the original record remained unchanged.
- An ordinary native `WRITE` waited for that `READU` lock, completed after release, and a later compare-and-replace succeeded.
- Replacement of a missing item returned `NOT_FOUND` and did not create it.

The lock-test fixture first failed to compile because of its one-line LOCKED clause, then its default input prompt prevented the harness from detecting the held-lock marker. Both harness defects were corrected before the passing lock tests. They were not accepted as product evidence.

Local TypeScript compilation and 13 protocol/session tests passed. Tests cover bounds, identity, missing/duplicate/out-of-order frames, exact byte encoding, transport failure, cancelled/non-native requests, and closing a dedicated session before any later frame can run. Transport failures omit record-containing command text and require a reload before retrying a replacement.

After deployment, the dedicated `d3code-51` production identity independently passed the version handshake, exact read of the isolated sandbox `LOCKED` item, replacement with the identical expected bytes, and readback. This used the production profile and SSH identity, without changing the fixture's content.

Limits: 8 KiB records, single-byte text, existing-record replacement only, and writes restricted to `D3CODE.*` files. Binary D3 items, production file triggers, interrupted-write outcomes and arbitrary production files are not validated. The record backend is not yet connected to the public IDE/API; its native checks do not make the complete editor production-ready.

## 26 October: shared record editor checkpoint

The shared standalone and embedded app now reads records through the native protocol, renders data and dictionaries as attributes, values and subvalues, and saves existing sandbox items by exact-byte compare-and-replace. Source retains line editing and compile actions. Explicit approval names the target; stale content keeps the local draft and refuses replacement. A missing native bridge permits a labelled read-only preview only.

The installed helper is `bp D3CODE.RECORD.V1.2158024573A65355F3CB197A8951417E51042520C025B840B21A3FB700ABF60B`. Its write scope is existing items in `D3CODE.*` files and `D3CODE.*` source items in data `bp` or `BP`. Compiled DICT objects are excluded. The earlier backend section is historical and does not describe the current editor integration.

Automated and live evidence:

- 130 focused file-listing, command, capture, permissions and IDE checks passed. The test process omitted the local d3 wrapper from PATH, matching the repository test runner. Two stale fixture assertions were corrected before that passing run.
- 42 IDE/API checks passed after the contextual output change. Local browser checks exercised save cancellation, approval, conflict retention, edits during an in-flight save, unsupported text rejection, read-only fallback, missing records and output containment.
- The production record journey at `8ce6d6e` saved source, compiled it natively, ran the saved fixture, refused a concurrent stale save, and saved structured data and dictionary fixtures while preserving every other byte. The test restored its known fixture contents by compare-and-replace, recompiled the original source, closed sessions and reported no JavaScript errors.
- The general production journey at `8ce6d6e` passed office connect/reconnect, blocked account switching, anonymous and unflagged other-customer denial, OpenRouter D3 tool use, selected-object context, source browsing and dictionary actions.
- Full file IDs are now hex-encoded in the bounded D3 listing and decoded without display-column truncation. A native listing returned all 46 IDs. This fixed an actual production test failure where `D3CODE.RECORD.TEST` had been truncated.

Interaction rationale: contextual build output stays beside the selected source and remains independent of the terminal (Gestalt proximity and Nielsen #1). Structured fields preserve D3's hierarchy rather than flattening nested values (Nielsen #2). Conflict detection retains the draft (Nielsen #3 and #5).

Current capacity: production root filesystem 67 GB total, 61 GB used, 6.7 GB available, 91% usage. D3Code used 58,249,216 bytes under a 402,653,184-byte service limit when checked. This is a point-in-time capacity check, not a retention or growth forecast.

Limits remain: 8 KiB, single-byte text, existing-record replacement, sandbox-only writes, no second enabled customer proof, and shared runtime state within a customer service. Arbitrary production file triggers, interrupted-write outcomes and other code pages remain unverified. SB/SB+ discovery/builders and operational tools are unfinished. This checkpoint does not make the full IDE production-ready.

### Final contextual output check, revision 06d59e5

The authenticated branded-domain journey passed native compilation, editor-output containment at 390, 768, 1280 and 1440 pixels, and terminal independence: a subsequent terminal WHO did not replace the build result. Anonymous record access returned 401 and an unflagged employee from another customer returned 403. There were no browser JavaScript errors. The browser and temporary login sessions were closed and removed. Each final compile capture was inspected individually at readable resolution; no overlapping controls, page overflow or clipped bottom action was found. Internal code/output scrolling remains intentional for long lines.

| Production state | 390 | 768 | 1280 | 1440 |
| --- | --- | --- | --- | --- |
| Saved source | [390](evidence/2026-10-26-record-editor/source-saved-390.png) | [768](evidence/2026-10-26-record-editor/source-saved-768.png) | [1280](evidence/2026-10-26-record-editor/source-saved-1280.png) | [1440](evidence/2026-10-26-record-editor/source-saved-1440.png) |
| Conflict retains draft | [390](evidence/2026-10-26-record-editor/conflict-390.png) | [768](evidence/2026-10-26-record-editor/conflict-768.png) | [1280](evidence/2026-10-26-record-editor/conflict-1280.png) | [1440](evidence/2026-10-26-record-editor/conflict-1440.png) |
| Structured data saved | [390](evidence/2026-10-26-record-editor/data-saved-390.png) | [768](evidence/2026-10-26-record-editor/data-saved-768.png) | [1280](evidence/2026-10-26-record-editor/data-saved-1280.png) | [1440](evidence/2026-10-26-record-editor/data-saved-1440.png) |
| Dictionary saved | [390](evidence/2026-10-26-record-editor/dictionary-saved-390.png) | [768](evidence/2026-10-26-record-editor/dictionary-saved-768.png) | [1280](evidence/2026-10-26-record-editor/dictionary-saved-1280.png) | [1440](evidence/2026-10-26-record-editor/dictionary-saved-1440.png) |
| Final build output | [390](evidence/2026-10-26-record-editor/compile-390.png) | [768](evidence/2026-10-26-record-editor/compile-768.png) | [1280](evidence/2026-10-26-record-editor/compile-1280.png) | [1440](evidence/2026-10-26-record-editor/compile-1440.png) |

The source-save, conflict and saved-field captures are from the 8ce6d6e record journey; final build output is from 06d59e5. Older 25 October captures above are historical. Full-product rubric gates remain open for comprehensive keyboard, offline, theme, multi-user and complete IDE workflow coverage; this bounded checkpoint is not a full UI acceptance score.

The final field-sizing adjustment in `a562ed4` addresses a defect found during individual visual inspection: a long wrapped value exposed only part of its next line. Fields now grow with content up to a bounded height, retaining internal scrolling for longer values. The 42 IDE/API tests passed again, and a browser assertion checked a 130-character wrapped value at all four widths. An initial test invocation used the absent tsx loader; it was corrected to the repository TypeScript compiler and emitted JavaScript tests without installing a dependency.

Final production structured-data and dictionary captures at `a562ed4` were rendered and individually inspected at all four widths after the field-size change. The wrapped fixture value is readable, field boundaries and labels remain aligned, and Save stays visible within the workspace. Longer fields deliberately retain bounded internal scrolling. The initial strict height assertion failed at 390 pixels by two pixels at the configured maximum; diagnostic dimensions and full-resolution inspection confirmed readable text rather than accepting that assertion as a passing test. Browser errors remained empty and temporary sessions were removed.

| Final structured view | 390 | 768 | 1280 | 1440 |
| --- | --- | --- | --- | --- |
| Data | [390](evidence/2026-10-26-record-editor/data-current-390.png) | [768](evidence/2026-10-26-record-editor/data-current-768.png) | [1280](evidence/2026-10-26-record-editor/data-current-1280.png) | [1440](evidence/2026-10-26-record-editor/data-current-1440.png) |
| Dictionary | [390](evidence/2026-10-26-record-editor/dict-current-390.png) | [768](evidence/2026-10-26-record-editor/dict-current-768.png) | [1280](evidence/2026-10-26-record-editor/dict-current-1280.png) | [1440](evidence/2026-10-26-record-editor/dict-current-1440.png) |

Shared MemPalace filing failed with Transport closed. This committed report is the durable checkpoint; no successful memory write is claimed.

## Typed-write checkpoint, 26 October

Revisions `a66ef77`, `2b65ee0` and `0e63377` route item, dictionary and BASIC build replacements through the same native save service as the editor. The service moved from `src/ide/records.ts` to `src/d3/records.ts`; its connection fingerprint, byte comparison, scope checks, approval boundary and verified readback are shared. Automated typed writes no longer delete and reconstruct records through ED.

| Caller | Replacement contract | Evidence |
| --- | --- | --- |
| Item/dictionary tools | Prior `lossless:true` read returns profile, connection fingerprint and exact original bytes. Writes require that baseline and explicit approval. | Live sandbox exact replacement and stale refusal, both locally and through the production service identity. |
| BASIC build tool | Save first, then compile; catalog requires compile and only follows a successful native `[241]` result. | Live successful build and deliberate compile failure; catalog skipped on failure, source restored and original recompiled. |
| Legacy item/dictionary/build HTTP routes | Forward the baseline and reject its absence or stale connection. | Local API regression checks and branded production 409 rejection without a baseline. |
| CLI | `read-item`/`read-dict --lossless` emits full JSON; write/build accepts `--baseline-file`. | Two affected CLI regression journeys pass; the native CLI proof is recorded below after completion. |
| Agent tool feedback | Model receives exact baseline; visible read/write cards omit encoded original bytes. Lossless reads include the existing record-shape analysis. | Unit checks cover full baseline preservation and compact visible feedback. Production model verification is recorded below. |

Focused automated checks: 81 permission/input, compact-feedback, record API, IDE and agent-loop tests passed; 12 guidance/recipe tests passed. TypeScript compilation passed. The old shell-only CLI success fixtures were changed to require baseline rejection, because they cannot prove native replacement; real D3 evidence supplies that positive proof. A new HTTP regression initially sent a source field to item/dictionary routes and failed strict input validation; the fixture was corrected before the passing run.

Native checks used only existing `D3CODE.RECORD.TEST` items and the owned `D3CODE.EDIT.UI.*` source fixture. Data and dictionary replacements used the identical original bytes. The source test verified successful compilation, then deliberately saved invalid fixture source and requested compile plus catalog. Compilation failed and catalog did not run. Finally, the test compared known fixture versions, restored the exact original and recompiled it. The production identity repeated the same checks and closed all dedicated sessions.

The practical skill, built-in mode guidance and CLI recipes no longer recommend delete-first replacement. Automatic port allocation is documented. Missing helper or baseline, conflict, unsupported text, or scope denial stops a typed write. Literal CR/LF in an existing record is refused by the text tool to avoid confusing it with attribute marks; the byte-exact API remains the route for those records. New records and arbitrary production files remain outside this verified scope.

During the first live model review, the model successfully read the record but miscounted a trailing empty attribute. That answer was rejected as semantic evidence. Lossless results now include `analyzeD3Record` output, with a regression for four attributes including the trailing empty field. Full final model and visual results are recorded below, not inferred from successful tool execution.

The server temporary-login harness uses the existing `/opt/venvs/tensology/bin/python`, verified as Python 3.12.3 with Django 5.2.10. No local Python environment or new dependency was used.

### Final typed-write verification

The actual CLI completed `read-item --lossless`, loaded that JSON through `--baseline-file`, performed an approved identical-byte replacement and independently read back the exact original bytes. The production browser repeated anonymous 401 and unflagged other-customer 403 denial, plus baseline-required 409 rejection for the three legacy write routes. OpenRouter invoked a native lossless read and then reported the supplied attribute count of four. The tool card omitted baseline/original encodings, and no JavaScript errors occurred. All temporary browser/login sessions were cleaned up.

The four final production chat captures below were individually inspected at readable resolution. The composer and controls stay within the workspace; tool details and conversation history use contained scrolling. The visible tool result includes the record-shape evidence and no encoded baseline.

| Final lossless tool card | 390 | 768 | 1280 | 1440 |
| --- | --- | --- | --- | --- |
| Chat | [390](evidence/2026-10-26-record-editor/lossless-chat-390.png) | [768](evidence/2026-10-26-record-editor/lossless-chat-768.png) | [1280](evidence/2026-10-26-record-editor/lossless-chat-1280.png) | [1440](evidence/2026-10-26-record-editor/lossless-chat-1440.png) |

Semantic limit: although the final answer correctly reported four attributes, it added an unsupported "M" attribute label. That extra interpretation is not accepted as evidence. The verified claim is the native read, exact metadata count and baseline availability; general model data interpretation remains under review. This checkpoint does not approve arbitrary production writes, new-record creation, generated migration adapter writers, SB/SB+ builders, operational workflows or multiple-enabled-customer isolation.

Interaction rationale: retain exact baselines for optimistic concurrency while showing readable result summaries (Nielsen #1 and #5, visibility and error prevention). A failed compile keeps diagnostics and skips catalog instead of treating a saved source as a successful build (Nielsen #1 and #9).

## Customer routing and capacity checkpoint

Tensology revision `d033ae1` adds one real HTTP regression to `main.test_d3code_proxy`. Two enabled customer employees use separate loopback HTTP upstreams, each requiring a different Basic credential and retaining independent test state. The test verifies that a mismatched session customer ID, a forged query customer ID, a client Authorization header and a forged user header cannot select the other upstream. Changes to each upstream remain separate. Revoking the second employee denies that employee while the first remains usable. These are isolated test customers and HTTP fixtures, not a second live D3 account.

All 11 proxy tests passed both locally under `/Users/paul/.virtualenvs/tensology/bin/python` (Python 3.12.10, Django 5.2.4) and on the server under `/opt/venvs/tensology/bin/python` (Python 3.12.3, Django 5.2.10). Both used `core.settings_test`, an in-memory SQLite test database; production customer flags and workspace settings were not changed. Python file compilation, the local frontend build and the deployment frontend build passed. The deployment had no migrations to apply, and its service health checks passed. Only the regression test was committed in Tensology; held mobile UI work was excluded.

Read-only production checks found exactly one mapped customer route, customer 51 to loopback port 3737, with no upstream collision. D3Code listens on `127.0.0.1:3737` and returns 401 when accessed without credentials. The service runs as `d3code-51`, with `ProtectSystem=strict`, `NoNewPrivileges=yes` and write access limited to its customer configuration/runtime paths. Both customer directories are mode 700 and the configuration is mode 600. The service is active with zero automatic restarts. This does not provision or prove a second production customer.

After deploying the test, the branded browser check repeated anonymous 401, unflagged other-customer 403, enabled-director entry and live office `dm` WHO. It reported no JavaScript errors. Temporary login sessions, browser and test terminal session were closed. Four new production terminal captures were inspected individually at 390, 768, 1280 and 1440 pixels: command controls remain within the viewport, with no page overflow or support-widget obstruction. The mobile connection toolbar still wraps into multiple rows; full IDE polish is not accepted by this boundary check.

| Post-deploy terminal | 390 | 768 | 1280 | 1440 |
| --- | --- | --- | --- | --- |
| Enabled director, office dm | [390](evidence/2026-10-26-record-editor/customer-boundary-390.png) | [768](evidence/2026-10-26-record-editor/customer-boundary-768.png) | [1280](evidence/2026-10-26-record-editor/customer-boundary-1280.png) | [1440](evidence/2026-10-26-record-editor/customer-boundary-1440.png) |

Capacity inventory after deployment: 67 GB root filesystem, 61 GB used, 6.3 GB available (91% usage); two CPUs, 3,915 MiB RAM with 1,859 MiB available at the sample, and 8,191 MiB swap with 5,099 MiB used. D3Code has a 384 MiB cgroup limit; the sample showed roughly 3.4 MiB resident and 47.9 MiB swapped, not a 3.4 MiB total footprint. No automatic service restart was recorded.

Root-level allocated usage was 61,772 MiB: `/var` 39,770 MiB, `/opt` 5,992 MiB, `/root` 3,720 MiB and `/usr` 3,703 MiB. The largest website was Mailshot at 17,651 MiB, of which `storage` held 16,598 MiB. That storage is treated as production-owned data and was preserved. Containerd used 4,184 MiB and Docker 1,508 MiB; these are measured footprints, not a claim that they are safely reclaimable. Root npm cache was 136 MiB and `/var/cache` 149 MiB. No additional harness or model runtime was installed.

The repository-mandated `npx --no-install @Codex-flow/cli@latest security scan` could not run: npm returned 404 and rejected the uppercase package name. No package was installed. The proxy regressions and manual boundary review are the completed checks, not a substitute claim that this scanner passed.

## Guarded creation checkpoint

Revision `0f7b49d` adds a distinct `CREATE_ONLY` native operation, rather than treating an empty record as absence. All request frames arrive before the helper takes an item lock. It then refuses any existing item, including a zero-byte record; a permitted missing item is written once and independently read back before release. The verified write scope remains D3CODE sandbox files and D3CODE source IDs in data bp/BP, with an 8 KiB single-byte limit. Compiled DICT bp objects remain excluded.

The new immutable helper is `bp D3CODE.RECORD.V1.787E5E9F3DD467B4D0100A46FF41D84C7008B93808F31E29DC58311F9EB4E5AA`. Source and object IDs were checked absent, source readback matched before compilation, and native BASIC returned `[241] Successful compile`. Previous helper programs were retained for compatibility and rollback.

Manual grounding: the bundled [Rocket D3 reference](../reference/d3_reference_manual_10.3.4_5-28-2026.pdf), printed pages 420, 466 and 500, was extracted and each relevant page inspected individually. The manual describes the read/update lock and unconditional write behavior; live probes established the missing-item case. The first probe incorrectly looked for a custom prompt in normalized output. The next used a six-second input window (`FOR 60`) that could expire before checking the competing writer. Neither failure was accepted as product evidence. The corrected probe used `FOR 300` (30 seconds), observed the competing write still blocked after 8,456 ms, released the lock and then verified the write completed. The fixture was removed under an exact-byte lock and absence verified. Timer units are now recorded in practical and built-in agent guidance.

Native tests passed nested mark/empty/trailing-byte creation, dictionary creation, refusing an existing item, refusing an existing empty item, and simultaneous creation with exactly one successful creator and no overwrite. All acknowledged temporary data creations were removed under exact-byte locks and absence independently checked. Probe programs remain as D3CODE-prefixed verification artifacts; no phantoms, devices, backup commands or schedules were used.

The shared service now offers read-only `GET /api/record/new` preparation and approved `POST /api/record` creation. Preparation checks that the file opens and the item is missing. Its connection fingerprint prevents a changed connection from receiving a stale draft. Creation rechecks absence under the native item lock, so preparation is not treated as a lock or an authorization to overwrite. Existing items return 409 with the draft kept; success returns 201. Plan mode, unapproved requests, stale connections, oversized/invalid encodings and targets outside the sandbox are refused before native writes. Transport uncertainty requires reading the target before retrying.

Automated checks: 98 focused protocol/session, record API, IDE, tool input, compact feedback and agent-loop checks passed; eight permission checks passed separately. The timer-guidance and protocol suite passed 18 checks. TypeScript compilation and `git diff --check` passed. These counts are scoped checks, not a full-product acceptance result.

Production HTTP checks through Crystal Logic passed preparation, unapproved creation refusal, confirmed 201 creation, exact readback and subsequent compare-and-replace, duplicate refusal, preservation of another creator after a prepare/create race, and empty-item protection. The new native record opened in the real structured editor with no JavaScript errors. Temporary test records were removed under byte guards, and browser/login/session cleanup passed.

A separate production journey created a new BASIC source only after both source and compiled-object IDs were found absent. It opened the source through the file browser, approved native compilation in the UI, ran the saved program with approval, checked the expected output and confirmed the build output was independent of Terminal. The source and its compiled object are deliberately retained in office dm as `bp D3CODE.CREATE.PROGRAM.1D246D4441EAF499BD982E48`. This is a proof artifact, not a new customer application.

| Creation evidence | 390 | 768 | 1280 | 1440 |
| --- | --- | --- | --- | --- |
| New structured record | [390](evidence/2026-10-26-record-editor/create-api-390.png) | [768](evidence/2026-10-26-record-editor/create-api-768.png) | [1280](evidence/2026-10-26-record-editor/create-api-1280.png) | [1440](evidence/2026-10-26-record-editor/create-api-1440.png) |
| New source and successful compile | [390](evidence/2026-10-26-record-editor/create-program-390.png) | [768](evidence/2026-10-26-record-editor/create-program-768.png) | [1280](evidence/2026-10-26-record-editor/create-program-1280.png) | [1440](evidence/2026-10-26-record-editor/create-program-1440.png) |

All eight final captures were inspected individually at readable resolution for field hierarchy, source/build placement, actions, typography, clipping, overflow and overlap. No new containment defect was found in these states. The visible New item action has not been implemented; its draft-versus-immediate-creation choice is pending. The full IDE remains incomplete, including the richer source editor, agent application/approval flow, adaptive native/SB builders and operations.

### Terminal header checkpoint, 2026-10-26

Local shared header: connection marker grouped with status, redundant Connection label and repeated status target removed, account uses inherited typography, mobile target controls restored to 44px and selector to 16px. Connect contrast and mobile reconnect icon spacing corrected after visual inspection. Reconnect reset failure now marks disconnected, preserves previous transcript and appends the error.

Acceptance evidence: TypeScript compilation and 45 tests in ide-server and ide-records pass. Headless Chrome exercised idle, busy, connected and reset-failure states at 390, 768, 1280 and 1440 in light and dark. All 32 final screenshots individually inspected for header alignment, containment, status legibility, target sizing and button contrast. Mock terminal transport, not live D3, used for these state checks.

Interaction rationale: status dot and text share a group (Gestalt proximity); reconnect failure preserves history (Nielsen error recovery); mobile controls use 44px targets (UI/UX system responsive rule). Live branded iframe verification and publication remain pending for this checkpoint. Broader IDE acceptance remains incomplete.

Production follow-up: e9ec1d2 deployed, compiled and service active. Branded tickets domain denied anonymous record API requests with 401 and an unflagged other-customer actor with 403. Authorized director connected to Office demo dm and WHO returned 7 dm dm. No browser JavaScript errors. Final embedded screenshots at 390, 768, 1280 and 1440 individually inspected: grouped status, aligned controls, visible bottom input, no page overflow or support-widget intrusion. Temporary sessions and browser closed, terminal reset. These checks do not establish the remaining full IDE workflows.

### Agent create-only tool checkpoint, 2026-10-26

Added d3_create_item with strict native schema and runtime validation, explicit body and optional data/dict section. It uses the same approved create-only record protocol, connection fingerprint, sandbox scope, byte limit, acknowledgement and independent readback as the verified API. Migrate mode permits it; read-only modes do not. Encoded readback is omitted from compact activity summaries. Existing item and dictionary replacement paths are unchanged.

Native local agent-tool invocation on office dm required approval, created D3CODE.RECORD.TEST item D3CODE.CREATE.TOOL.59F4C0FCD061212E, preserved nested marks and trailing empty attribute, independently read back exact bytes and rejected a duplicate without replacement. This owned proof item remains present. Focused schema, permission, tool runner, scope, compact output, record API and activity tests passed (see log). No visible New item UI or standalone CLI creation command added. Production deployment/model invocation remains unverified for this checkpoint; migration adapter transport still requires correction before live writes.

Create-tool production follow-up: d472899 deployed, TypeScript compiled and all 41 focused checks passed on production before service restart. Dedicated d3code-51 identity repeated approval refusal, acknowledged creation, nested-mark and trailing-empty preservation, duplicate refusal and independent readback against office dm. Owned proof item D3CODE.CREATE.TOOL.E34A7B2DFFAEE627 remains in D3CODE.RECORD.TEST. Model-mediated invocation, visible New item workflow and CLI creation command remain unverified or absent.

### Production model and instruction boundary checkpoint, 2026-10-26

Fresh branded-domain OpenRouter journey passed anonymous 401, unflagged customer 403, rejection of legacy writes without lossless baseline, and model-driven lossless read of MARKS reporting four attributes including trailing empty attributes. Tool activity omitted baseline/original encoded bytes. Four final screenshots individually inspected at 390, 768, 1280 and 1440. Browser and temporary sessions removed.

A suspected history-injection defect in the server wrapper was disproved: compactAgentHistory removes supplied system messages and runD3AgentTurn rebuilds the authoritative workspace system prompt. Added a regression with forged initial and late system messages; both retain workspace memory and legitimate user history. No production behavior changed for that finding. Added regression proving model-originated creation cannot self-confirm in migrate mode or bypass chat/audit write restrictions. All 70 relevant IDE, tool runner and agent-loop tests pass.

Remaining creation gap: production chat is read-only and the agent strips model-supplied confirmed values. No trusted per-operation user approval/resume flow exists yet for agent writes. The deployed create-only tool is verified under direct trusted invocation, not usable model-mediated creation in current chat. Do not report that workflow as complete.
