import type { D3CodeConfig } from "../config/config.js"
import { selectProfile } from "../config/config.js"
import { classifyD3Command, evaluateD3Permission, type D3CommandRisk, type PermissionAction } from "../core/permissions.js"
import type { SafetyMode } from "../domain/types.js"
import type { D3ApplicationBundle } from "./bundle.js"

export interface SafetyGuardCommand {
  command: string
  source: "user" | "bundle" | "program-execute" | "release"
  risk: D3CommandRisk
  action: PermissionAction
  confirmation: string
}

export interface SafetyGuardReport {
  ready: boolean
  profile?: string
  account?: string
  safety: SafetyMode
  commands: SafetyGuardCommand[]
  blockers: string[]
  confirmations: string[]
  nextCommands: string[]
}

const executePattern = /\bEXECUTE\s+["']([^"']+)["']/gi

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function commandConfirmation(command: string, action: PermissionAction, risk: D3CommandRisk): string {
  if (action === "allow") return "not required"
  if (action === "deny") return `denied by safety mode before execution: ${command}`
  if (risk === "destructive" || risk === "shell") return `typed confirmation required for ${risk} D3 command: ${command}`
  return `confirmation required before running: ${command}`
}

function extractBundleCommands(bundle?: D3ApplicationBundle): Array<{ command: string; source: SafetyGuardCommand["source"] }> {
  if (!bundle) return []
  const commands: Array<{ command: string; source: SafetyGuardCommand["source"] }> = []
  commands.push({ command: `LOGTO ${bundle.account}`, source: "bundle" })
  for (const program of bundle.programs) {
    commands.push({ command: `BASIC ${program.file} ${program.item}`, source: "bundle" })
    commands.push({ command: `CATALOG ${program.file} ${program.item}`, source: "bundle" })
    for (const match of program.source.matchAll(executePattern)) {
      if (match[1]) commands.push({ command: match[1], source: "program-execute" })
    }
  }
  return commands
}

export function createSafetyGuardReport(config: D3CodeConfig, options: { safety: SafetyMode; profile?: string; bundle?: D3ApplicationBundle; commands?: string[] }): SafetyGuardReport {
  const profile = selectProfile(config, options.profile)
  const commandInputs = [
    ...extractBundleCommands(options.bundle),
    ...(options.commands ?? []).map((command) => ({ command, source: "user" as const })),
  ]
  const commands = commandInputs.map(({ command, source }) => {
    const risk = classifyD3Command(command)
    const action = evaluateD3Permission(options.safety, command)
    return {
      command,
      source,
      risk,
      action,
      confirmation: commandConfirmation(command, action, risk),
    }
  })
  const denied = commands.filter((command) => command.action === "deny")
  const highRisk = commands.filter((command) => command.action === "confirm")
  const ask = commands.filter((command) => command.action === "ask")
  const blockers = [
    ...denied.map((command) => `${command.command} is denied in ${options.safety} safety mode.`),
    ...(profile ? [] : ["No D3 profile selected or configured."]),
    ...(options.bundle && profile?.allowedAccounts?.length && !profile.allowedAccounts.includes(options.bundle.account) ? [`Bundle account ${options.bundle.account} is outside profile ${profile.name} allowedAccounts.`] : []),
  ]
  const confirmations = [
    ...highRisk.map((command) => command.confirmation),
    ...ask.map((command) => command.confirmation),
  ]
  return {
    ready: blockers.length === 0 && confirmations.length === 0,
    profile: profile?.name ?? options.profile,
    account: options.bundle?.account ?? profile?.account,
    safety: options.safety,
    commands,
    blockers,
    confirmations,
    nextCommands: [
      "d3code doctor",
      profile ? `d3code profile-doctor --profile ${profile.name}` : "d3code setup --d3 local|ssh",
      options.bundle ? "d3code bundle-readiness d3-app-bundle.json --artifacts-dir ./migration-output" : "d3code safety-guard --command 'LIST MD'",
      options.safety === "plan" ? "d3code --safety ask" : "d3code --safety ask --profile <profile>",
    ],
  }
}

export function renderSafetyGuardReport(report: SafetyGuardReport): string {
  return [
    "# D3 Safety Guard",
    "",
    `Ready: ${report.ready ? "yes" : "no"}`,
    `Profile: ${report.profile ?? "none"}`,
    `Account: ${report.account ?? "unknown"}`,
    `Safety: ${report.safety}`,
    "",
    "Commands:",
    ...(report.commands.length ? report.commands.map((command) => `- [${command.action}] ${command.risk} ${command.source}: \`${command.command}\` (${command.confirmation})`) : ["- none"]),
    "",
    "Blockers:",
    ...(report.blockers.length ? report.blockers.map((blocker) => `- ${blocker}`) : ["- none"]),
    "",
    "Confirmations:",
    ...(report.confirmations.length ? unique(report.confirmations).map((confirmation) => `- ${confirmation}`) : ["- none"]),
    "",
    "Next Commands:",
    ...unique(report.nextCommands).map((command) => `- \`${command}\``),
  ].join("\n")
}
