import type { D3CodeConfig } from "../config/config.js"
import type { SafetyMode } from "../domain/types.js"
import { modeSystemPrompt } from "../skills/modes.js"

export interface ChatRuntimeContext {
  model: string
  safety: SafetyMode
  profile?: string
  mode: string
}

export function createChatSystemPrompt(config: D3CodeConfig, context: ChatRuntimeContext): string {
  const profile = context.profile ? config.profiles.find((item) => item.name === context.profile) : undefined
  const account = profile?.account ?? "none"
  const profileLine = profile
    ? `${profile.name} (${profile.type}, account=${account}, session=${profile.sessionMode ?? "oneshot"})`
    : "none"
  const allowedAccounts = profile?.allowedAccounts?.length ? profile.allowedAccounts.join(", ") : account === "none" ? "none" : account

  return [
    modeSystemPrompt(context.mode),
    "",
    "Runtime D3 Code Context:",
    `- model: ${context.model}`,
    `- mode: ${context.mode}`,
    `- safety: ${context.safety}`,
    `- profile: ${profileLine}`,
    `- allowed accounts: ${allowedAccounts}`,
    "",
    "Agent Operating Rules:",
    "- Treat D3 files, dictionaries, BASIC programs, indexes, locks, terminal sessions, and generated migration artifacts as first-class project state.",
    "- Prefer D3-aware tools and slash commands before guessing from generic code assumptions.",
    "- In plan safety, describe exact commands and evidence instead of mutating D3 state.",
    "- In ask safety, reads/searches are fine; writes, compile/catalog, terminal mutation, lock work, account changes, and destructive TCL need confirmation.",
    "- In trust safety, keep destructive account/file operations behind explicit confirmation.",
    "- Preserve D3 multivalue/subvalue shape, dictionary meaning, account boundaries, and compile/catalog proof when modernizing.",
    "- For migration work, produce bundle, audit, API, UI, connector, QA, readiness, and goal evidence before claiming completion.",
    "",
    "Useful D3 Code Commands:",
    "- /status, /readiness, /setup-proof, /connector-strategy, /terminal-plan, /cockpit-terminal",
    "- /agent-run file-audit <file>, /agent-run basic-check <file> <item>, /agent-run migration-slice <bundle.json> --out <dir>",
    "- /bundle-capture, /bundle-artifacts, /bundle-readiness, /bundle-completion-audit, /bundle-evidence",
    "- /goal, /goal-plan, /goal-next, /goal-verify, /goal-audit-bundle",
  ].join("\n")
}
