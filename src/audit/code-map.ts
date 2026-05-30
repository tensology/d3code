import { extractBasicSymbols, lintBasic, type BasicSymbols, type LintFinding } from "../d3/basic.js"

export interface D3ProgramSource {
  file: string
  item: string
  source: string
}

export interface D3ProgramMapEntry {
  program: string
  subroutine?: string
  symbols: BasicSymbols
  findings: LintFinding[]
  risk: "low" | "medium" | "high"
  recommendations: string[]
}

export interface D3FileUsage {
  file: string
  readers: string[]
  writers: string[]
  openers: string[]
}

export interface D3CodeMap {
  programs: D3ProgramMapEntry[]
  fileUsage: D3FileUsage[]
  unresolvedCalls: Array<{ from: string; call: string }>
  executes: Array<{ program: string; command: string }>
  modernizationRecommendations: string[]
}

function programID(program: D3ProgramSource): string {
  return `${program.file}/${program.item}`
}

function riskFor(findings: LintFinding[], symbols: BasicSymbols): D3ProgramMapEntry["risk"] {
  if (findings.some((finding) => finding.severity === "error")) return "high"
  if (findings.some((finding) => finding.severity === "warning") || symbols.writes.length > 0 || symbols.executes.length > 0) return "medium"
  return "low"
}

function recommendationsFor(symbols: BasicSymbols, findings: LintFinding[]): string[] {
  const recommendations: string[] = []
  if (symbols.writes.length > 0) recommendations.push("Wrap write behavior with explicit lock, validation, and rollback policy before exposing REST mutations.")
  if (symbols.executes.length > 0) recommendations.push("Review EXECUTE commands for TCL side effects and replace shell-style flows with typed service calls where practical.")
  if (symbols.commons.length > 0) recommendations.push("Document COMMON state before splitting this logic into stateless web/API services.")
  if (findings.some((finding) => finding.code === "D3_READU_NO_RELEASE")) recommendations.push("Add or verify RELEASE behavior before modernizing locked record flows.")
  if (recommendations.length === 0) recommendations.push("Candidate for read-first extraction or adapter wrapping.")
  return recommendations
}

function openAliases(source: string): Map<string, string> {
  const aliases = new Map<string, string>()
  for (const match of source.matchAll(/\bOPEN\s+['"]?([^'",\r\n]+)['"]?\s+TO\s+([A-Z0-9_.-]+)/gim)) {
    const file = match[1]?.replace(/['"]/g, "").trim()
    const variable = match[2]?.trim()
    if (file && variable) aliases.set(variable.toUpperCase(), file)
  }
  return aliases
}

function resolveFile(name: string, aliases: Map<string, string>): string {
  return aliases.get(name.toUpperCase()) ?? name
}

export function createD3CodeMap(programs: D3ProgramSource[]): D3CodeMap {
  const entries = programs.map((program) => {
    const symbols = extractBasicSymbols(program.source)
    const findings = lintBasic(program.source)
    return {
      program: programID(program),
      subroutine: symbols.subroutine,
      symbols,
      findings,
      risk: riskFor(findings, symbols),
      recommendations: recommendationsFor(symbols, findings),
    }
  })

  const knownSubroutines = new Set(entries.map((entry) => entry.subroutine).filter(Boolean).map((name) => name!.toUpperCase()))
  const usage = new Map<string, D3FileUsage>()
  function touch(file: string): D3FileUsage {
    const key = file.toUpperCase()
    const current = usage.get(key) ?? { file, readers: [], writers: [], openers: [] }
    usage.set(key, current)
    return current
  }

  const unresolvedCalls: D3CodeMap["unresolvedCalls"] = []
  const executes: D3CodeMap["executes"] = []

  for (const entry of entries) {
    const source = programs.find((program) => programID(program) === entry.program)?.source ?? ""
    const aliases = openAliases(source)
    for (const file of entry.symbols.opens) touch(file).openers.push(entry.program)
    for (const file of entry.symbols.reads) touch(resolveFile(file, aliases)).readers.push(entry.program)
    for (const file of entry.symbols.writes) touch(resolveFile(file, aliases)).writers.push(entry.program)
    for (const command of entry.symbols.executes) executes.push({ program: entry.program, command })
    for (const call of entry.symbols.calls) {
      if (!knownSubroutines.has(call.toUpperCase())) unresolvedCalls.push({ from: entry.program, call })
    }
  }

  const modernizationRecommendations = [
    ...(executes.length ? ["Isolate EXECUTE/TCL behavior before web extraction; these commands often hide reporting, delete, or account-level side effects."] : []),
    ...(Array.from(usage.values()).some((file) => file.writers.length > 0) ? ["Start REST migration with read endpoints, then add mutation endpoints only after lock/write policies are explicit."] : []),
    ...(unresolvedCalls.length ? ["Resolve external CALL targets before extracting services so hidden dependencies are not dropped."] : []),
    "Use the code map to choose vertical slices: one resource file, its reader/writer programs, and the smallest safe API surface.",
  ]

  return {
    programs: entries,
    fileUsage: Array.from(usage.values()).map((file) => ({
      file: file.file,
      readers: [...new Set(file.readers)],
      writers: [...new Set(file.writers)],
      openers: [...new Set(file.openers)],
    })),
    unresolvedCalls,
    executes,
    modernizationRecommendations,
  }
}
