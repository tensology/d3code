import type { D3CommandResult } from "../domain/types.js"

export interface CompactOptions {
  maxLines?: number
  maxChars?: number
}

export function compactText(text: string, options: CompactOptions = {}): string {
  const maxLines = options.maxLines ?? 80
  const maxChars = options.maxChars ?? 12_000
  const lines = text.split(/\r?\n/)
  const clipped = lines.length > maxLines
    ? [...lines.slice(0, Math.floor(maxLines * 0.7)), `... ${lines.length - maxLines} lines omitted ...`, ...lines.slice(-(maxLines - Math.floor(maxLines * 0.7)))]
    : lines
  const joined = clipped.join("\n")
  if (joined.length <= maxChars) return joined
  return `${joined.slice(0, maxChars)}\n... ${joined.length - maxChars} chars omitted ...`
}

export function compactToolOutput(output: unknown): string {
  if (isD3CommandResult(output)) {
    const body = output.stdout || output.stderr || ""
    return [
      `command: ${output.command}`,
      `exit: ${output.exitCode ?? "unknown"} durationMs: ${output.durationMs}`,
      compactText(body),
    ].filter(Boolean).join("\n")
  }
  if (typeof output === "string") return compactText(output)
  return compactText(JSON.stringify(output, null, 2))
}

function isD3CommandResult(value: unknown): value is D3CommandResult {
  return Boolean(value && typeof value === "object" && "stdout" in value && "stderr" in value && "command" in value)
}
