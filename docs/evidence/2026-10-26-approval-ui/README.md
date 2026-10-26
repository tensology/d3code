# Agent approval UI checkpoint

Local fixture verification, 2026-10-26. This is not production write evidence.

Acceptance: a model-requested mutation pauses at an owned approval card. Review shows the authoritative target and before/after text. Cancel preserves the pending action; Decline performs no write. Approval submits only action identifiers and a boolean. Reload restores the same pending action without a misleading Working indicator. Tool failure remains blocked even after approval.

Checks completed:

- TypeScript compilation passed.
- 113 tests passed across approval-ui, ide-approval, agent-approval, agent-loop, ide-server, permissions, ide-records, d3-record-protocol and d3-record-session.
- Headless Chrome fixture journey passed at 390, 768, 1280 and 1440 in light and dark themes: review, cancel, reload, single execution, literal source rendering and no horizontal page overflow.
- Separate fixture paths passed decline, replacement preview, replacement success and conflict without a write.
- Individually inspected approved and reloaded screens at all eight viewport/theme combinations, plus mobile decline, conflict, replacement review and replacement success. Pending/review screens were inspected in the preceding checkpoint. Final pending/review screens were individually reinspected; wider modal button spacing was corrected and all eight affected modal views rendered and reinspected.

Interaction rationale:

- Review remains in the originating chat and opens only on request: preserves context and prevents unexpected interruption (Nielsen #3).
- The existing confirmation modal presents the exact target and readable source: reuses the product interaction and prevents mistakes (Nielsen #5).
- Pending and execution outcomes have separate labels: approval does not imply a successful write (Nielsen #1).
- Source is text, with invisible controls escaped: makes the actual action reviewable without executing markup (Nielsen #5).

Remaining: additional expiry/background-thread recovery checks, editing-mode configuration, deployment and a real OpenRouter-to-office-DM approval/write/readback journey. Production remains on the previously deployed version. The fixture performs no D3 writes and is not evidence of live record integrity.
