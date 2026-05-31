import type { TranscriptEntry } from "./transcript.js"

export type SubmittedTurnKind = "chat" | "shell" | "d3" | "slash"
export type SubmittedTurnRole = "user" | "shell-input" | "d3-input"

export interface SubmittedTurn {
  role: SubmittedTurnRole
  content: string
  kind: SubmittedTurnKind
}

export interface SubmittedTurnView extends SubmittedTurn {
  label: string
}

function compactTaskLabel(label: string, maxLength = 30): string {
  if (label.length <= maxLength) return label
  return `${label.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`
}

function slashName(line: string): string {
  return line.trim().split(/\s+/)[0] ?? line.trim()
}

export function inputRoleForLine(line: string, mode: string): SubmittedTurn {
  if (line.startsWith("!")) return { role: "shell-input", content: line.slice(1).trim(), kind: "shell" }
  if (mode === "d3" && !line.startsWith("/")) return { role: "d3-input", content: line, kind: "d3" }
  if (line.startsWith("/")) return { role: "user", content: line, kind: "slash" }
  return { role: "user", content: line, kind: "chat" }
}

export function formatSubmittedTurn(turn: SubmittedTurn): SubmittedTurnView {
  const labels: Record<SubmittedTurnKind, string> = {
    chat: "You",
    shell: "Unix shell",
    d3: "D3 TCL",
    slash: "Slash command",
  }
  return { ...turn, label: labels[turn.kind] }
}

export function formatLiveTurnLabel(input: { kind: SubmittedTurnKind; detail: string }): string {
  const detail = input.kind === "slash" ? slashName(input.detail) : input.detail.trim()
  if (input.kind === "chat") return "Thinking"
  if (input.kind === "shell") return compactTaskLabel(detail ? `Bash: ${detail}` : "Bash")
  if (input.kind === "d3") return compactTaskLabel(detail ? `D3 TCL: ${detail}` : "D3 TCL")
  return compactTaskLabel(detail ? `Command: ${detail}` : "Command")
}

export function initialTaskForSubmittedTurn(turn: SubmittedTurn): string {
  return formatLiveTurnLabel({ kind: turn.kind, detail: turn.content })
}

export function toolStartEntryForLine(line: string, mode: string): TranscriptEntry | undefined {
  const turn = inputRoleForLine(line, mode)
  if (turn.kind === "chat") return undefined
  return { role: "tool-start", content: formatLiveTurnLabel({ kind: turn.kind, detail: turn.content }) }
}
