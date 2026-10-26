# Workspace startup recovery (local, incomplete verification)

Acceptance: delayed or failed core startup keeps drafts and attachments, prevents premature sending, offers Retry, keeps Stop available, and does not wait for optional model choices. Older startup results must not replace newer state.

## Evidence

- TypeScript compilation passed.
- node --test dist/test/workspace-state.test.js dist/test/ide-server.test.js: 49 passed.
- Headless Chrome: delayed status, HTTP failure, retained draft, Retry recovery, optional provider metadata failure, no page errors or horizontal overflow at 390, 768, 1280 and 1440 in light and dark themes.
- Screenshots: local/ (24 main-chat captures and 16 side-panel captures).
- All 40 captures individually inspected. Main loading/error/ready and editor/terminal error states were readable at all four widths in both themes. Side-panel Send initially fell below the viewport because fixed panels inherited height:100%; using top/bottom with automatic height corrected it. Both side composers then passed retained attachment and exactly one submission after Retry.

## Interaction rationale

- Status and Retry beside the composer: Nielsen visibility of system status and recovery.
- Keep input editable but prevent premature Send: error prevention without draft loss.
- Optional metadata loads separately: configured chat remains usable when settings discovery fails.

## Remaining gates

Deploy and verify through the authenticated branded production site. Broader IDE polish and full accessibility remain outside this component proof. No production readiness claim. No D3 data writes in these local checks.
