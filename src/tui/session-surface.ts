import type { ChatUsage } from "../llm/client.js"
import type { ProjectContext } from "./project-context.js"
import type { WorkspaceChangeSummary } from "./workspace-changes.js"
import { formatWorkspaceChangeFooter } from "./workspace-changes.js"
import { basename } from "node:path"

export function formatElapsedSeconds(seconds: number): string {
  if (seconds < 60) return `${Math.max(0, seconds)}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return `${minutes}m${remainder.toString().padStart(2, "0")}s`
}

export function formatDurationMs(milliseconds: number): string {
  if (milliseconds < 1000) return `${Math.max(0, Math.round(milliseconds))}ms`
  if (milliseconds < 60_000) return `${(milliseconds / 1000).toFixed(milliseconds < 10_000 ? 1 : 0)}s`
  return formatElapsedSeconds(Math.round(milliseconds / 1000))
}

export function formatTokenUsage(usage: ChatUsage | undefined): string {
  if (!usage) return "tok --"
  const extras = [
    usage.cacheReadInputTokens ? `${usage.cacheReadInputTokens}cr` : undefined,
    usage.cacheCreationInputTokens ? `${usage.cacheCreationInputTokens}cw` : undefined,
  ].filter(Boolean)
  return `tok ${usage.inputTokens}i/${usage.outputTokens}o/${usage.totalTokens}t${extras.length ? ` ${extras.join("/")}` : ""}`
}

export function formatInstructionCount(project: ProjectContext | undefined): string {
  const count = project?.instructions.length ?? 0
  return count ? `${count} instr` : "no instr"
}

export function formatProjectLocation(project: ProjectContext | undefined, fallback = process.cwd()): string {
  const cwd = project?.cwd ?? fallback
  const name = basename(cwd) || cwd
  return `cwd ${name}`
}

export function formatPromptMeta(input: {
  model: string
  profile?: string
  mode: string
  safety: string
  usage?: ChatUsage
  workspaceChanges?: WorkspaceChangeSummary
  project?: ProjectContext
}): string {
  return [
    input.model,
    input.profile ? `D3 ${input.profile}` : "D3 off",
    `${input.mode}/${input.safety}`,
    formatTokenUsage(input.usage),
    formatWorkspaceChangeFooter(input.workspaceChanges),
    formatProjectLocation(input.project),
    formatInstructionCount(input.project),
  ].join(" | ")
}

export function estimateStreamTokens(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return Math.max(1, Math.ceil(trimmed.length / 4))
}

export function formatBusyStatus(task: string, elapsedSeconds: number, progress?: string, interruptHint = "esc to interrupt"): string {
  const progressText = progress ? ` · ${progress}` : ""
  return `working: ${task || "agent"} ${formatElapsedSeconds(elapsedSeconds)}${progressText}  ${interruptHint.replace(" to ", " ")}`
}

export function formatTimelineProgress(frame: string, task: string, elapsedSeconds: number): string {
  return `${frame} ${task || "working"} ${formatElapsedSeconds(elapsedSeconds)}`
}
