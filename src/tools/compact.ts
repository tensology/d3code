import { parseListOutputIds } from "../capture/parsers.js"
import type { D3CommandResult } from "../domain/types.js"

export interface CompactOptions {
  maxLines?: number
  maxChars?: number
}

const noiseLine = /^(?:\*{2}\s|spawn\s|expect\s|set\s|if\s*\{|foreach\s|close|wait|exit\s+\d|command:\s*expect|Enter your user id|WARNING:|\/dev\/pts|Connected to Virtual|terminal name:|product name:|terminal width:|depth:|lineskip:|lf delay:|ff delay:|back space:|\[1301\]|master dictionary:|<<<|Copyright|reserved\.|lx\d{2}\s|^dm$|>\s*$)/i

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

export function sanitizeD3TerminalOutput(output: string): string {
  const lines = output.split(/\r?\n/)
  const kept = lines.filter((line) => {
    const trimmed = line.trim()
    if (!trimmed) return false
    if (noiseLine.test(trimmed)) return false
    if (/^Connect time=|^< logged off|^< Connect time=/i.test(trimmed)) return false
    return true
  })
  return kept.join("\n").trim()
}

function extractTclCommand(output: string): string | undefined {
  const match = output.match(/^:([A-Z][^\n]{0,120})/im)
  if (match) return match[0]!.trim()
  const list = output.match(/\b(LIST|SELECT|CT|WHO|VERSION|LOGTO|ED|BASIC|CATALOG)\b[^\n]*/i)
  return list?.[0]?.trim()
}

function summarizeListOutput(output: string): string | undefined {
  if (!/\bitems?\s+listed\b/i.test(output) && !/\bLIST\s+MD\b/i.test(output)) return undefined
  const ids = parseListOutputIds(output).filter((id) => !/^MD\.+$/i.test(id) && !/^PAGE\b/i.test(id))
  if (ids.length === 0) return undefined
  const listed = output.match(/(\d+)\s+items?\s+listed(?:\s+out of\s+(\d+)\s+items?)?/i)
  const preview = ids.slice(0, 10).join(", ")
  const more = ids.length > 10 ? ` (+${ids.length - 10} more)` : ""
  if (listed) {
    const total = listed[2] ? ` out of ${listed[2]} MD entries` : ""
    return `${listed[1]} data files listed${total}: ${preview}${more}`
  }
  return `${ids.length} files: ${preview}${more}`
}

function compactD3CommandResult(result: D3CommandResult, toolName?: string): string {
  const body = result.stdout || result.stderr || ""
  const sanitized = sanitizeD3TerminalOutput(body)
  const listSummary = toolName === "d3_list_files"
    ? summarizeListOutput(body) ?? summarizeListOutput(sanitized)
    : undefined
  if (listSummary) return listSummary

  const tcl = extractTclCommand(body) ?? extractTclCommand(sanitized)
  const header = tcl
    ? `TCL: ${tcl}`
    : toolName === "d3_list_files"
      ? "Listed account data files"
      : undefined

  const core = sanitized || body.trim()
  if (!core) {
    return [
      header,
      `exit ${result.exitCode ?? "unknown"} · ${result.durationMs}ms`,
    ].filter(Boolean).join("\n")
  }

  return [
    header,
    `exit ${result.exitCode ?? "unknown"} · ${result.durationMs}ms`,
    compactText(core, { maxLines: 18, maxChars: 3500 }),
  ].filter(Boolean).join("\n")
}

export function compactToolOutput(output: unknown, toolName?: string): string {
  if (hasCompact(output)) return compactText(output.compact, { maxLines: 24, maxChars: 4000 })
  if (isD3CommandResult(output)) return compactD3CommandResult(output, toolName)
  if (typeof output === "string") return compactText(sanitizeD3TerminalOutput(output), { maxLines: 24, maxChars: 4000 })
  return compactText(JSON.stringify(output, null, 2), { maxLines: 24, maxChars: 4000 })
}

function hasCompact(value: unknown): value is { compact: string } {
  return Boolean(value && typeof value === "object" && "compact" in value && typeof (value as { compact?: unknown }).compact === "string")
}

function isD3CommandResult(value: unknown): value is D3CommandResult {
  return Boolean(value && typeof value === "object" && "stdout" in value && "stderr" in value && "command" in value)
}
