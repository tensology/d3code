# D3Code production checkpoint, 25 October 2026

Verdict: **Incomplete for the requested full developer IDE.** The deployed connection, read/browse workflow and command approval changes have live evidence. This checkpoint does not approve the legacy record writer for production data.

Application revision: `8cfaf90`. Shared standalone and Tensology application, deployed at `/var/www/d3code`, serving Crystal Logic through `d3code@51.service` and the authenticated Tensology proxy.

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
| Appropriate object actions | Sandbox `D3CODE.CUSTOMERS` data and dictionary selection hid BASIC compile/catalog actions. Their editors are still raw text. |
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

1. Lossless reads and lock-protected, conflict-aware record replacement. The prepared helper is not installed or live-verified. The legacy text-editor replacement path can lose record structure or concurrent edits.
2. Structured data/dictionary editors and a complete create, save, compile, catalog and run workflow, including errors and recovery.
3. Verified per-account discovery of native D3, SB and SB+ facilities, with relevant screen-building tools only when supported.
4. Usable phantom, scheduler, spooler, lock and operational workflows with explicit mutation controls.
5. Broader multi-user and multiple-enabled-customer verification. Runtime state is currently shared within a customer's service; per-user D3 sessions are not proven isolated.
6. Full developer usability review and final acceptance across those workflows, including standalone as well as embedded use.

Plan My Charter, wider Tensology mobile work and Decisions AI fixes are separate unfinished tracks. D3 backup reliability remains unresolved.
