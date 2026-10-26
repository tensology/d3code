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

Production checkpoint: version 20cb86b was deployed and passed the same 113 tests on the server. Anonymous requests returned 401 and an active but unflagged user from another customer returned 403. The initial real-model create request was blocked in chat mode and performed no write. Investigation reproduced Commander consuming the IDE's mode option at the parent command, leaving the IDE default active. Positional command options and an actual CLI-to-HTTP runtime regression test correct this mismatch.

Customer 51 has a systemd override at `/etc/systemd/system/d3code@51.service.d/editing.conf` selecting `--mode migrate --safety ask`. It retains the office DM connection and the existing account allowlist. The override does not change other customer units. Verify `/api/status` after deployment, since process arguments alone did not prove the effective mode.

Remaining: additional expiry/background-thread recovery checks, deployment of the CLI correction and a real OpenRouter-to-office-DM approval/write/readback journey. The fixture performs no D3 writes and is not evidence of live record integrity.
