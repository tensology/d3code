import type { D3CodeConfig } from "../config/config.js"
import { selectProfile } from "../config/config.js"

export type SetupProofStatus = "ok" | "action" | "missing"

export interface SetupProofItem {
  id: string
  status: SetupProofStatus
  title: string
  evidence: string[]
  next: string
}

export interface SetupProofReport {
  ready: boolean
  model: string
  profile?: string
  account?: string
  items: SetupProofItem[]
}

function item(values: SetupProofItem): SetupProofItem {
  return values
}

function providerOf(modelRef: string): string | undefined {
  return modelRef.includes("/") ? modelRef.split("/")[0] : undefined
}

function statusRank(status: SetupProofStatus): number {
  return { ok: 0, action: 1, missing: 2 }[status]
}

function formatStatus(status: SetupProofStatus): string {
  return status === "action" ? "needs proof" : status
}

export function createSetupProofReport(config: D3CodeConfig): SetupProofReport {
  const profile = selectProfile(config)
  const provider = providerOf(config.defaultModel)
  const secretRef = provider ? config.modelSecrets[provider] : undefined
  const items = [
    item({
      id: "model-ref",
      status: provider ? "ok" : "missing",
      title: "Default model reference",
      evidence: [`default model: ${config.defaultModel || "unset"}`],
      next: provider ? "Use `/model` or `d3code --model <provider/model>` to change per session." : "Run `d3code setup --provider <provider> --default-model <model>`.",
    }),
    item({
      id: "model-secret-reference",
      status: secretRef ? "ok" : "action",
      title: "Provider secret reference",
      evidence: secretRef ? [`${provider}: ${secretRef}`] : [`provider: ${provider ?? "unknown"}`, "no secret reference configured"],
      next: secretRef ? "Confirm the referenced env/keychain secret is present before live model calls." : "Run `d3code setup --api-key-env <ENV_NAME>` or configure keychain storage.",
    }),
    item({
      id: "selected-profile",
      status: profile ? "ok" : "missing",
      title: "Selected D3 profile",
      evidence: profile ? [`profile: ${profile.name}`, `type: ${profile.type}`] : ["no D3 profile configured"],
      next: profile ? "Run `d3code setup-proof` after any profile edit." : "Create a profile with `d3code profile-add-local` or `d3code profile-add-ssh`.",
    }),
    item({
      id: "profile-account",
      status: profile?.account ? "ok" : profile ? "action" : "missing",
      title: "Pinned D3 account",
      evidence: profile ? [`account: ${profile.account ?? "not pinned"}`] : ["no profile"],
      next: profile?.account ? "Keep one active D3 account per session unless explicitly switching with safety checks." : "Set `--account <account>` so D3 Code can bind sessions to a known account.",
    }),
    item({
      id: "persistent-session",
      status: profile?.sessionMode === "persistent" ? "ok" : profile ? "action" : "missing",
      title: "Persistent terminal session",
      evidence: profile ? [`session: ${profile.sessionMode ?? "oneshot"}`] : ["no profile"],
      next: profile?.sessionMode === "persistent" ? "Use this profile for Claude Code-like terminal continuity." : "Set `--session persistent` for account-stateful D3 work.",
    }),
    item({
      id: "prompt-pattern",
      status: profile?.promptPattern ? "ok" : profile ? "action" : "missing",
      title: "D3 prompt pattern",
      evidence: profile ? [`prompt: ${profile.promptPattern ?? "not configured"}`] : ["no profile"],
      next: profile?.promptPattern ? "Keep prompt pattern with profile-doctor/live-proof evidence." : "Set `--prompt <regex>` so PTY interactions can detect command completion.",
    }),
    item({
      id: "account-allowlist",
      status: profile?.allowedAccounts?.length ? "ok" : profile ? "action" : "missing",
      title: "Account allowlist",
      evidence: profile ? [`allowed accounts: ${profile.allowedAccounts?.join(", ") ?? "not restricted"}`] : ["no profile"],
      next: profile?.allowedAccounts?.length ? "Cross-account LOGTO remains constrained to this allowlist." : "Set `--allowed-accounts A,B` for production profiles.",
    }),
    item({
      id: "safety-default",
      status: config.defaultSafety ? "ok" : "missing",
      title: "Default safety mode",
      evidence: [`default safety: ${config.defaultSafety ?? "unset"}`, `profile safety: ${profile?.safetyDefault ?? "inherits default"}`],
      next: "Use `ask` for first-run D3 accounts; switch to `trust` only after proof on a disposable slice.",
    }),
  ].sort((a, b) => statusRank(a.status) - statusRank(b.status))

  return {
    ready: items.every((entry) => entry.status === "ok"),
    model: config.defaultModel,
    profile: profile?.name,
    account: profile?.account,
    items,
  }
}

export function renderSetupProofReport(report: SetupProofReport): string {
  return [
    "# D3 Code Setup Proof",
    "",
    `Ready: ${report.ready ? "yes" : "no"}`,
    `Model: ${report.model}`,
    `Profile: ${report.profile ?? "none"}`,
    `Account: ${report.account ?? "unknown"}`,
    "",
    ...report.items.map((entry) => [
      `- [${formatStatus(entry.status)}] ${entry.title}`,
      `  evidence: ${entry.evidence.join("; ")}`,
      `  next: ${entry.next}`,
    ].join("\n")),
    "",
  ].join("\n")
}
