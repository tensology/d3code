import type { D3CodeConfig } from "../config/config.js"
import { selectProfile } from "../config/config.js"
import { createIdeTerminalContract, type IdeTerminalContract } from "../d3/ide-terminal.js"
import { createLiveProofReport } from "../d3/live-proof.js"
import type { SafetyMode } from "../domain/types.js"
import { activePhase, type D3Goal } from "../goal/goal.js"
import { listGoals } from "../goal/store.js"
import { getMode } from "../skills/modes.js"
import { createReadinessReport } from "./readiness.js"

export interface IdeStatusState {
  model?: string
  safety?: SafetyMode
  profile?: string
  mode?: string
}

export interface IdeStatusReport {
  model: string
  safety: SafetyMode
  mode: string
  profile?: string
  account?: string
  ready: boolean
  readiness: Array<{ id: string; status: string; next: string }>
  liveProof: Array<{ id: string; status: string; command: string }>
  goals: Array<{ id: string; mode: string; title: string; activePhase: string; nextCommand?: string }>
  terminal: IdeTerminalContract
  nextCommands: string[]
}

function firstPhaseCommand(goal: D3Goal): string | undefined {
  const phase = activePhase(goal)
  return phase?.commands?.[0]
}

export async function createIdeStatusReport(config: D3CodeConfig, state: IdeStatusState = {}, goalOverride?: D3Goal[]): Promise<IdeStatusReport> {
  const profile = selectProfile(config, state.profile)
  const mode = getMode(state.mode ?? "chat") ?? getMode("chat")!
  const readiness = await createReadinessReport(config)
  const liveProof = createLiveProofReport(config, state.profile)
  const terminal = createIdeTerminalContract(profile)
  const goals = goalOverride ?? await listGoals()
  const activeGoals = goals.filter((goal) => activePhase(goal)).slice(0, 5)
  const firstGoalCommand = activeGoals.map(firstPhaseCommand).find(Boolean)
  const firstReadinessCommand = readiness.gates.find((gate) => gate.status !== "ok")?.next
  const firstLiveProofCommand = liveProof.steps.find((step) => step.status !== "ok")?.commands[0]
  const modeCommand = mode.id === "migrate"
    ? "d3code recipe migrate"
    : mode.id === "audit"
      ? "d3code recipe audit"
      : mode.id === "api"
        ? "d3code recipe api"
        : mode.id === "modernize"
          ? "d3code recipe modernize"
          : `d3code runbook ${mode.id}`
  const nextCommands = Array.from(new Set([
    firstGoalCommand,
    firstReadinessCommand,
    firstLiveProofCommand,
    modeCommand,
  ].filter((command): command is string => Boolean(command)))).slice(0, 6)

  return {
    model: state.model ?? config.defaultModel,
    safety: state.safety ?? config.defaultSafety,
    mode: mode.id,
    profile: profile?.name,
    account: profile?.account,
    ready: readiness.ready && liveProof.ready,
    readiness: readiness.gates.map((gate) => ({ id: gate.id, status: gate.status, next: gate.next })),
    liveProof: liveProof.steps.map((step) => ({ id: step.id, status: step.status, command: step.commands[0] ?? "" })),
    terminal,
    goals: activeGoals.map((goal) => ({
      id: goal.id,
      mode: goal.mode,
      title: goal.title,
      activePhase: activePhase(goal)?.id ?? "none",
      nextCommand: firstPhaseCommand(goal),
    })),
    nextCommands,
  }
}

export function renderIdeStatusReport(report: IdeStatusReport): string {
  return [
    "# D3 Code IDE Status",
    "",
    `Ready: ${report.ready ? "yes" : "no"}`,
    `Model: ${report.model}`,
    `Safety: ${report.safety}`,
    `Mode: ${report.mode}`,
    `Profile: ${report.profile ?? "none"}`,
    `Account: ${report.account ?? "unknown"}`,
    "",
    "## Next Commands",
    ...(report.nextCommands.length > 0 ? report.nextCommands.map((command) => `- ${command}`) : ["- d3code help"]),
    "",
    "## Readiness",
    ...report.readiness.map((gate) => `- [${gate.status}] ${gate.id}: ${gate.next}`),
    "",
    "## Live D3 Proof",
    ...report.liveProof.map((step) => `- [${step.status}] ${step.id}: ${step.command}`),
    "",
    "## IDE Terminal",
    `- attach: ${report.terminal.attachMode}`,
    `- model: ${report.terminal.terminalModel}`,
    ...report.terminal.features.map((feature) => `- [${feature.status}] ${feature.id}: ${feature.title}`),
    "",
    "## Active Goals",
    ...(report.goals.length > 0
      ? report.goals.map((goal) => `- ${goal.id} (${goal.mode}/${goal.activePhase}): ${goal.title}${goal.nextCommand ? ` -> ${goal.nextCommand}` : ""}`)
      : ["- none; create one with `d3code goal --mode migrate <title>`"]),
    "",
  ].join("\n")
}
