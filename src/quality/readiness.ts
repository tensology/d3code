import type { D3CodeConfig } from "../config/config.js"
import { createModelProofReport } from "../providers/proof.js"
import type { SecretStore } from "../security/secrets.js"
import { createSetupProofReport } from "../setup/proof.js"
import { skillCoverageReport } from "../skills/coverage.js"

export type ReadinessStatus = "ok" | "action" | "missing"

export interface ReadinessGate {
  id: string
  title: string
  status: ReadinessStatus
  evidence: string[]
  next: string
}

export interface ReadinessReport {
  ready: boolean
  gates: ReadinessGate[]
}

function statusRank(status: ReadinessStatus): number {
  if (status === "ok") return 0
  if (status === "action") return 1
  return 2
}

function formatStatus(status: ReadinessStatus): string {
  if (status === "ok") return "ok"
  if (status === "action") return "needs proof"
  return "missing"
}

export async function createReadinessReport(config: D3CodeConfig, secrets?: SecretStore): Promise<ReadinessReport> {
  const coverage = skillCoverageReport()
  const profiles = config.profiles
  const selectedProfile = config.defaultProfile
    ? profiles.find((profile) => profile.name === config.defaultProfile)
    : profiles[0]
  const persistentProfiles = profiles.filter((profile) => profile.sessionMode === "persistent")
  const modelProof = await createModelProofReport(config, secrets, { mode: "migrate", bias: "balanced" })
  const modelIssueItems = modelProof.items.filter((item) => item.status !== "ok")
  const defaultProviderID = config.defaultModel.split("/")[0]
  const defaultModelItem = modelProof.items.find((item) => item.id === "default-model")
  const defaultProviderItem = modelProof.items.find((item) => item.id === `provider-${defaultProviderID}`)
  const routingItem = modelProof.items.find((item) => item.id === "routing-readiness")
  const setupProof = createSetupProofReport(config)
  const setupMissing = setupProof.items.filter((item) => item.status === "missing")
  const setupAction = setupProof.items.filter((item) => item.status === "action")

  const gates = ([
    {
      id: "reference-skills",
      title: "Reference Skill Coverage",
      status: coverage.ready ? "ok" : "missing",
      evidence: [
        `${coverage.items.filter((item) => item.covered).length}/${coverage.items.length} coverage items implemented`,
        "covers GSD, superpowers, gstack, rtk, D3 audit, migration, API, and modernization surfaces",
      ],
      next: "Run `d3code skill-coverage` for the detailed map.",
    },
    {
      id: "setup-proof",
      title: "First-run Setup Proof",
      status: setupMissing.length ? "missing" : setupAction.length ? "action" : "ok",
      evidence: [
        `items:${setupProof.items.length}`,
        `missing:${setupMissing.length}`,
        `needs-proof:${setupAction.length}`,
        `profile:${setupProof.profile ?? "none"}`,
      ],
      next: setupProof.ready ? "Keep setup-proof output with operator handoff notes." : "Run `d3code setup-proof` and address missing/action items before live D3 work.",
    },
    {
      id: "model-selection",
      title: "Model Selection",
      status: modelProof.ready ? "ok" : defaultModelItem?.status === "missing" ? "missing" : "action",
      evidence: [
        `default model: ${config.defaultModel || "unset"}`,
        `model-proof-ready: ${modelProof.ready ? "yes" : "no"}`,
        `default-provider: ${defaultProviderID || "unset"}:${defaultProviderItem?.status ?? "missing"}`,
        `routing: ${routingItem?.status ?? "missing"}`,
        `issues: ${modelIssueItems.map((item) => item.id).join(", ") || "none"}`,
      ],
      next: modelProof.ready
        ? "Run `d3code model-proof` before launch handoff and keep the provider evidence."
        : "Run `d3code model-proof` and configure the missing provider env/keychain reference, or switch to a proven Ollama model.",
    },
    {
      id: "d3-profile",
      title: "D3 Profile",
      status: selectedProfile ? "ok" : "missing",
      evidence: selectedProfile
        ? [
          `selected profile: ${selectedProfile.name}`,
          `type: ${selectedProfile.type}`,
          `account: ${selectedProfile.account ?? "not pinned"}`,
          `session: ${selectedProfile.sessionMode ?? "oneshot"}`,
          `allowed accounts: ${selectedProfile.allowedAccounts?.join(", ") ?? "not restricted"}`,
        ]
        : ["no local or SSH D3 profile configured"],
      next: selectedProfile
        ? "Run `d3code profile-doctor --profile <name>` against the target D3 account."
        : "Create one with `d3code profile-add-local` or `d3code profile-add-ssh`.",
    },
    {
      id: "terminal-session",
      title: "Terminal-like Session Behavior",
      status: persistentProfiles.length > 0 ? "ok" : "action",
      evidence: persistentProfiles.length > 0
        ? [`persistent profiles: ${persistentProfiles.map((profile) => profile.name).join(", ")}`]
        : ["profiles default to one-shot command execution unless sessionMode is persistent"],
      next: persistentProfiles.length > 0
        ? "Use the persistent profile for account-stateful D3 work."
        : "For Claude Code-like D3 interaction, add `--session persistent --prompt <pattern>` to the local profile.",
    },
    {
      id: "terminal-bridge",
      title: "D3 Terminal Bridge Plan",
      status: "action",
      evidence: ["terminal-plan separates persistent PTY, typed TCL, UOPY research, and legacy screen-buffer work"],
      next: selectedProfile ? `Run \`d3code terminal-plan --profile ${selectedProfile.name}\`.` : "Run `d3code terminal-plan` after creating a D3 profile.",
    },
    {
      id: "live-d3-proof",
      title: "Live D3 Proof",
      status: "action",
      evidence: ["static readiness does not execute WHO, VERSION, or LIST MD"],
      next: selectedProfile
        ? `Run \`d3code live-proof --profile ${selectedProfile.name} --run\` and keep the output as readiness evidence.`
        : "Run `d3code live-proof` for exact profile setup and proof commands.",
    },
    {
      id: "manual-scope",
      title: "D3 10.3 Manual Scope",
      status: "action",
      evidence: ["manual-scope regression is available for repo-local PDF or extracted text manuals"],
      next: "Run `d3code manual-scope reference/d3_reference_manual_10.3.4_5-28-2026.pdf` and `d3code manual-scope reference/d3_user_guide_version_10_3_4_2026-05-28-20-56-09.pdf`.",
    },
    {
      id: "regression",
      title: "Regression Suite",
      status: "action",
      evidence: ["package script `npm run regression` builds, tests, runs doctor, and scopes the D3 manual"],
      next: "Run `npm run regression` before claiming the build is ready.",
    },
  ] satisfies ReadinessGate[]).sort((a, b) => statusRank(a.status) - statusRank(b.status))

  return {
    ready: gates.every((gate) => gate.status === "ok"),
    gates,
  }
}

export function renderReadinessReport(report: ReadinessReport): string {
  return [
    "# D3 Code Readiness",
    "",
    `Ready: ${report.ready ? "yes" : "no"}`,
    "",
    ...report.gates.map((gate) => [
      `- [${formatStatus(gate.status)}] ${gate.title}`,
      `  evidence: ${gate.evidence.join("; ")}`,
      `  next: ${gate.next}`,
    ].join("\n")),
    "",
  ].join("\n")
}
