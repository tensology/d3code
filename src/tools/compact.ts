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

function filePointerNames(output: string): string[] {
  const names: string[] = []
  const seen = new Set<string>()
  for (const line of output.replace(/\0/g, "").split(/\r?\n/)) {
    const match = line.trim().match(/^([A-Za-z0-9_.:$-]+)\s+D$/i)
      ?? line.trim().match(/^([A-Za-z0-9_.:$-]+)\s+\S+\s+D\s+\d+/i)
    const name = match?.[1]
    if (!name || seen.has(name)) continue
    seen.add(name)
    names.push(name)
  }
  return names
}

function summarizeListOutput(output: string): string | undefined {
  const names = filePointerNames(output)
  if (names.length === 0) return undefined
  const listed = output.match(/(\d+)\s+items?\s+listed(?:\s+out of\s+(\d+)\s+items?)?/i)
  const count = listed?.[1] ?? String(names.length)
  const total = listed?.[2] ? ` out of ${listed[2]} master dictionary entries` : ""
  const limited = /more may exist/i.test(output) ? " Listing stopped at the sample limit, so there may be more." : ""
  return [`${count} data files listed${total}.${limited}`, ...names].join("\n")
}

function compactD3CommandResult(result: D3CommandResult, toolName?: string): string {
  const body = toolName === "d3_operations_status" ? [result.stdout, result.stderr].filter(Boolean).join("\n") : result.stdout || result.stderr || ""
  const sanitized = sanitizeD3TerminalOutput(body)
  const listSummary = toolName === "d3_list_files"
    ? summarizeListOutput(body) ?? summarizeListOutput(sanitized)
    : undefined
  if (listSummary) return listSummary

  const tcl = toolName === "d3_operations_status" ? result.command : extractTclCommand(body) ?? extractTclCommand(sanitized)
  const header = tcl
    ? `TCL: ${tcl}`
    : toolName === "d3_list_files"
      ? "Listed account data files"
      : undefined

  const core = sanitized || body.trim()
  const status = result.exitCode === null
    ? `completed · ${result.durationMs}ms`
    : `exit ${result.exitCode} · ${result.durationMs}ms`
  if (!core) {
    return [
      header,
      status,
    ].filter(Boolean).join("\n")
  }

  return [
    header,
    status,
    compactText(core, { maxLines: 18, maxChars: 3500 }),
  ].filter(Boolean).join("\n")
}

export function compactToolOutput(output: unknown, toolName?: string): string {
  if ((toolName === "d3_read_item" || toolName === "d3_read_dict") && output && typeof output === "object" && "baseline" in output) {
    const { baseline: _baseline, ...visible } = output
    return compactText(JSON.stringify(visible, null, 2), { maxLines: 24, maxChars: 4000 })
  }
  if (["d3_write_item", "d3_create_item", "d3_write_dict", "d3_build_basic_program"].includes(toolName ?? "") && output && typeof output === "object" && "saved" in output && "original" in output) {
    const { original: _original, ...visible } = output
    return compactText(JSON.stringify(visible, null, 2), { maxLines: 24, maxChars: 4000 })
  }
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
