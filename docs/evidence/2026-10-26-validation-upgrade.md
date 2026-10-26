# Validation dependency upgrade

Status: local checks pass; production verification pending.

The installed Zod 3.25.76 is affected by [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5). The upstream advisory identifies 4.6.6 as the first patched version. This change pins 4.6.7 and uses its native API, without importing the legacy v3 implementation.

Affected callers were inventoried: configuration loading/saving, D3 tool input validation and application-bundle parsing. The [upstream migration guide](https://zod.dev/v4/changelog) requires explicit key/value schemas for `z.record` and replaces `ZodTypeAny` with `ZodType`. Those are the only application declarations changed. Strict object validation, native connection guards and user-owned approval remain intact.

## Acceptance evidence

- `npm run typecheck`: both server and browser checks pass.
- `npm audit --json`: zero reported vulnerabilities after the upgrade. This is an advisory-database result, not a complete security audit.
- 116 targeted tests pass: config, tool-input, tool-input-safety, bundle, agent-loop, agent-approval, ide-server, ide-approval and cli-ide-options.
- New configuration regression: JSONC loading, existing defaults, profile account restrictions, secret-reference string maps, empty nested option defaults and load/save round trip. Invalid secret references and fractional ports are rejected; failed saves leave the current file unchanged.
- New collection regression: 10,000 invalid subroutine arguments produce a bounded error rather than accumulating an issue for every element; one invalid element still fails, and the valid 100-argument boundary still passes.

Production must compare the current parsed configuration before/after the dependency change in memory, verify the raw production file remains unchanged, rerun the relevant tests and audit, then exercise live authenticated D3/model requests. No production configuration replacement is authorized or required by this change.
