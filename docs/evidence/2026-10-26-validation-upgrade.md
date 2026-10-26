# Validation dependency upgrade

Status: application commit `9c42d43` deployed and production verification passed for this dependency change. Full IDE completion remains outstanding.

The installed Zod 3.25.76 is affected by [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). The upstream advisory identifies 4.6.6 as the first patched version. This change pins 4.6.7 and uses its native API, without importing the legacy v3 implementation.

Affected callers were inventoried: configuration loading/saving, D3 tool input validation and application-bundle parsing. The [upstream migration guide](https://zod.dev/v4/changelog) requires explicit key/value schemas for `z.record` and replaces `ZodTypeAny` with `ZodType`. Those are the only application declarations changed. Strict object validation, native connection guards and user-owned approval remain intact.

## Acceptance evidence

- `npm run typecheck`: both server and browser checks pass.
- `npm audit --json`: zero reported vulnerabilities after the upgrade. This is an advisory-database result, not a complete security audit.
- 116 targeted tests pass: config, tool-input, tool-input-safety, bundle, agent-loop, agent-approval, ide-server, ide-approval and cli-ide-options.
- New configuration regression: JSONC loading, existing defaults, profile account restrictions, secret-reference string maps, empty nested option defaults and load/save round trip. Invalid secret references and fractional ports are rejected; failed saves leave the current file unchanged.
- New collection regression: 10,000 invalid subroutine arguments produce a bounded error rather than accumulating an issue for every element; one invalid element still fails, and the valid 100-argument boundary still passes.

## Production verification

- Captured the current parsed configuration in process memory before updating dependencies. Compared it with a fresh process using the new native v4 validator after building. Parsed values match exactly; raw configuration bytes are unchanged. No production configuration replacement or disk export occurred.
- Existing checkout updated to `9c42d43`, dependencies installed, browser asset rebuilt, server/browser type checks passed. All 116 targeted tests passed on the server and `npm audit --audit-level=low` reported zero vulnerabilities before restarting only `d3code@51`.
- Running service active; installed dependency confirmed `zod@4.6.7`, automatic restart count zero, approximately 49.5MB service memory immediately after restart.
- Actual branded-domain browser journey after restart: anonymous 401, active unflagged other-customer 403; enabled Crystal Logic director recovers from a simulated startup failure without losing the draft. Actual OpenRouter model invokes `d3_tcl` with `WHO` and receives `7 dm dm` at both 390 and 1440 widths.
- Six [final screenshots](2026-10-26-validation-upgrade) inspected individually: error, Retry recovery and native model response on mobile and desktop. No clipping, page overflow or obscured composer found. No UI layout changed in this dependency patch, so this recheck supplements the preceding complete editor capture matrix.
- Temporary login sessions and headless browsers removed. No D3 records, accounts, printers, jobs, backup devices or production-edited content changed in the live verification.

No new feature scope, v3 compatibility layer or general dependency refresh was added. Zero reported npm advisories is not proof of full security or full product readiness.
