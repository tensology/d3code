import { extractBasicSymbols, lintBasic, type LintFinding } from "../d3/basic.js"
import { createD3CodeMap, type D3CodeMap } from "./code-map.js"
import { auditDatabaseSamples, type DatabaseAuditReport, type DatabaseFileSample } from "./database.js"

export interface D3AuditInput {
  account: string
  dictionaries: Array<{ file: string; items: string[] }>
  programs: Array<{ file: string; item: string; source: string }>
  databaseSamples?: DatabaseFileSample[]
}

export interface D3AuditReport {
  account: string
  dictionaryFindings: Array<{ file: string; severity: "info" | "warning" | "error"; message: string }>
  programFindings: Array<{ program: string; finding: LintFinding }>
  callGraph: Array<{ program: string; calls: string[]; opens: string[]; writes: string[] }>
  codeMap: D3CodeMap
  database?: DatabaseAuditReport
}

export function auditD3Application(input: D3AuditInput): D3AuditReport {
  return {
    account: input.account,
    dictionaryFindings: input.dictionaries.flatMap((dict) => {
      const findings: D3AuditReport["dictionaryFindings"] = []
      if (dict.items.length === 0) findings.push({ file: dict.file, severity: "warning", message: "Dictionary has no sampled items." })
      if (!dict.items.some((item) => /^@?ID$/i.test(item) || item === "0")) findings.push({ file: dict.file, severity: "info", message: "No obvious ID dictionary item in sample." })
      return findings
    }),
    programFindings: input.programs.flatMap((program) => lintBasic(program.source).map((finding) => ({ program: `${program.file}/${program.item}`, finding }))),
    callGraph: input.programs.map((program) => {
      const symbols = extractBasicSymbols(program.source)
      return { program: `${program.file}/${program.item}`, calls: symbols.calls, opens: symbols.opens, writes: symbols.writes }
    }),
    codeMap: createD3CodeMap(input.programs),
    database: input.databaseSamples ? auditDatabaseSamples(input.databaseSamples) : undefined,
  }
}
