import type { D3CodeConfig } from "../config/config.js"
import type { SafetyMode } from "../domain/types.js"
import { modeSystemPrompt } from "../skills/modes.js"
import type { ProjectContext } from "./project-context.js"
import { renderProjectInstructions } from "./project-context.js"

export interface ChatRuntimeContext {
  model: string
  safety: SafetyMode
  profile?: string
  mode: string
  project?: ProjectContext
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
    "- D3 Code is an interactive coding-agent harness, not only a slash-command launcher. Treat normal user requests as intent to inspect D3 or build application pieces when the active profile and safety mode allow it.",
    "- Treat D3 files, dictionaries, BASIC programs, indexes, locks, terminal sessions, and generated migration artifacts as first-class project state.",
    "- Prefer D3-aware tools and slash commands before guessing from generic code assumptions.",
    "- For application-build requests, gather or use D3 bundle evidence, derive screens/actions/data/access, generate or update the runnable app/API slice, and name proof commands. If evidence is missing, ask for the account/files/programs needed to capture it.",
    "- In plan safety, describe exact commands and evidence instead of mutating D3 state.",
    "- In ask safety, reads/searches are fine; writes, compile/catalog, terminal mutation, lock work, account changes, and destructive TCL need confirmation.",
    "- In trust safety, keep destructive account/file operations behind explicit confirmation.",
    "- Preserve D3 multivalue/subvalue shape, dictionary meaning, account boundaries, and compile/catalog proof when modernizing.",
    "- For migration work, produce bundle, audit, API, UI, connector, QA, readiness, and goal evidence before claiming completion.",
    "",
    "Useful D3 Code Commands:",
    "- /status, /readiness, /setup-proof, /connector-strategy, /terminal-plan, /ide-terminal",
    "- /agent-run file-audit <file>, /agent-run basic-check <file> <item>, /agent-run migration-slice <bundle.json> --out <dir>",
    "- /bundle-capture, /bundle-artifacts, /bundle-readiness, /bundle-completion-audit, /bundle-evidence",
    "- /goal, /goal-plan, /goal-next, /goal-verify, /goal-audit-bundle",
    "",
    "Natural Requests D3 Code Should Understand:",
    "- \"show me the files\", \"read item 100 from CUSTOMERS\", \"read dictionary NAME from CUSTOMERS\"",
    "- \"build an app from bundle d3-app-bundle.json to ./app-output\"",
    "- \"build an application from files CUSTOMERS,ORDERS programs BP to ./app-output\"",
    "",
    context.project ? renderProjectInstructions(context.project) : "Project Folder Instructions:\n- not loaded yet",
  ].join("\n")
}
