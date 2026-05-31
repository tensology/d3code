import type { D3CodeConfig } from "../config/config.js"
import { selectProfile } from "../config/config.js"
import type { ProfileDoctorReport } from "./profile-doctor.js"
import { D3_TCL_PROMPT_PATTERN } from "./prompts.js"

export interface LiveProofStep {
  id: string
  status: "ok" | "action" | "missing"
  title: string
  evidence: string[]
  commands: string[]
}

export interface LiveProofReport {
  ready: boolean
  profile?: string
  account?: string
  steps: LiveProofStep[]
}

export function profileDoctorGoalEvidence(report: ProfileDoctorReport): string {
  const checks = report.checks.map((check) => `${check.name}:${check.ok ? "ok" : "fail"}`).join(",")
  return `profile-doctor ${report.ready ? "passed" : "failed"} for ${report.profile}: account=${report.account ?? "unknown"}; session=${report.sessionMode}; checks=${checks}`
}

function step(values: LiveProofStep): LiveProofStep {
  return values
}

function rank(status: LiveProofStep["status"]): number {
  return { missing: 0, action: 1, ok: 2 }[status]
}

export function createLiveProofReport(config: D3CodeConfig, profileName?: string, doctor?: ProfileDoctorReport): LiveProofReport {
  const profile = selectProfile(config, profileName)
  const doctorReady = doctor?.ready ?? false
  const steps: LiveProofStep[] = [
    step({
      id: "profile-config",
      status: profile ? "ok" : "missing",
      title: "Configure a D3 connection profile",
      evidence: profile
        ? [`profile:${profile.name}`, `type:${profile.type}`, `account:${profile.account ?? "not pinned"}`, `session:${profile.sessionMode ?? "oneshot"}`]
        : ["no configured D3 profile"],
      commands: [
        `d3code profile-add-local --name prod --account <account> --entry "d3" --prompt "${D3_TCL_PROMPT_PATTERN}" --session persistent`,
        `d3code profile-add-ssh --name prod --host <host> --user <user> --account <account> --entry "d3" --prompt "${D3_TCL_PROMPT_PATTERN}" --session persistent`,
      ],
    }),
    step({
      id: "terminal-session",
      status: profile?.sessionMode === "persistent" ? "ok" : profile ? "action" : "missing",
      title: "Use a terminal-like persistent session for account-stateful D3 work",
      evidence: profile ? [`session:${profile.sessionMode ?? "oneshot"}`, `prompt:${profile.promptPattern ?? "not configured"}`] : ["profile required first"],
      commands: profile ? [`d3code profile-add-${profile.type === "ssh" ? "ssh" : "local"} --name ${profile.name} --session persistent --prompt "<prompt-pattern>"`] : ["Create the profile with --session persistent and --prompt <pattern>."],
    }),
    step({
      id: "read-only-smoke",
      status: doctor ? doctorReady ? "ok" : "missing" : profile ? "action" : "missing",
      title: "Run read-only D3 smoke checks",
      evidence: doctor
        ? doctor.checks.map((check) => `${check.name}:${check.ok ? "ok" : "fail"}`)
        : ["WHO, VERSION, and LIST MD have not been executed in this report"],
      commands: [profile ? `d3code profile-doctor --profile ${profile.name}` : "d3code profile-doctor --profile <name>", profile ? `d3code live-proof --profile ${profile.name} --run` : "d3code live-proof --profile <name> --run"],
    }),
    step({
      id: "goal-evidence",
      status: doctorReady ? "ok" : "action",
      title: "Attach live proof to the active GSD goal",
      evidence: doctorReady && doctor ? [profileDoctorGoalEvidence(doctor)] : ["live proof output has not been recorded against a goal"],
      commands: [profile ? `d3code live-proof --profile ${profile.name} --run --goal <goal-id> --phase verify` : "d3code goal-evidence <goal-id> --phase verify --evidence \"profile-doctor passed for <profile>: WHO, VERSION, LIST MD\""],
    }),
  ]

  const sorted = steps.sort((a, b) => rank(a.status) - rank(b.status) || a.id.localeCompare(b.id))
  return {
    ready: sorted.every((entry) => entry.status === "ok"),
    profile: profile?.name,
    account: profile?.account,
    steps: sorted,
  }
}

export function renderLiveProofReport(report: LiveProofReport): string {
  return [
    "# D3 Live Proof Plan",
    "",
    `Ready: ${report.ready ? "yes" : "no"}`,
    `Profile: ${report.profile ?? "none"}`,
    `Account: ${report.account ?? "unknown"}`,
    "",
    ...report.steps.flatMap((entry, index) => [
      `${index + 1}. [${entry.status}] ${entry.id}: ${entry.title}`,
      "   Evidence:",
      ...entry.evidence.map((evidence) => `   - ${evidence}`),
      "   Commands:",
      ...entry.commands.map((command) => `   - \`${command}\``),
      "",
    ]),
  ].join("\n")
}
