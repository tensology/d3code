import { extractBasicSymbols, lintBasic, parseCompileErrors, type BasicSymbols, type LintFinding } from "../d3/basic.js"

export interface ModernizationProofInput {
  before: string
  after: string
  compileOutput?: string
}

export interface ModernizationProofCheck {
  id: string
  status: "ok" | "warning" | "blocked"
  evidence: string[]
}

export interface ModernizationProofReport {
  ready: boolean
  summary: string
  checks: ModernizationProofCheck[]
}

function check(id: string, status: ModernizationProofCheck["status"], evidence: string[]): ModernizationProofCheck {
  return { id, status, evidence }
}

function compareList(label: keyof Pick<BasicSymbols, "calls" | "chains" | "opens" | "reads" | "writes" | "executes" | "commons">, before: BasicSymbols, after: BasicSymbols): ModernizationProofCheck {
  const beforeSet = new Set(before[label].map((item) => item.toUpperCase()))
  const added = after[label].filter((item) => !beforeSet.has(item.toUpperCase()))
  const status = added.length > 0 && (label === "writes" || label === "executes" || label === "chains") ? "blocked" : added.length > 0 ? "warning" : "ok"
  return check(`symbols-${label}`, status, added.length > 0 ? [`added:${added.join(",")}`] : ["no new symbols"])
}

function lintDelta(before: LintFinding[], after: LintFinding[]): ModernizationProofCheck {
  const beforeKeys = new Set(before.map((finding) => `${finding.code}:${finding.line}:${finding.message}`))
  const added = after.filter((finding) => !beforeKeys.has(`${finding.code}:${finding.line}:${finding.message}`))
  const status = added.some((finding) => finding.severity === "error") ? "blocked" : added.some((finding) => finding.severity === "warning") ? "warning" : "ok"
  return check("lint-delta", status, added.length > 0 ? added.map((finding) => `${finding.severity}:${finding.code}:line ${finding.line}:${finding.message}`) : ["no new lint findings"])
}

function compileCheck(output?: string): ModernizationProofCheck {
  if (!output) return check("compile-proof", "warning", ["compile output not provided"])
  const findings = parseCompileErrors(output)
  const errors = findings.filter((finding) => finding.severity === "error")
  if (errors.length > 0) return check("compile-proof", "blocked", errors.map((finding) => `error:line ${finding.line}:${finding.message}`))
  if (findings.length > 0) return check("compile-proof", "warning", findings.map((finding) => `${finding.severity}:line ${finding.line}:${finding.message}`))
  return check("compile-proof", "ok", [output.replace(/\s+/g, " ").trim().slice(0, 180) || "compile output has no parsed errors"])
}

export function createModernizationProof(input: ModernizationProofInput): ModernizationProofReport {
  const beforeSymbols = extractBasicSymbols(input.before)
  const afterSymbols = extractBasicSymbols(input.after)
  const beforeLint = lintBasic(input.before)
  const afterLint = lintBasic(input.after)
  const checks = [
    check("source-changed", input.before === input.after ? "warning" : "ok", [input.before === input.after ? "source is unchanged" : "source changed"]),
    compareList("calls", beforeSymbols, afterSymbols),
    compareList("chains", beforeSymbols, afterSymbols),
    compareList("opens", beforeSymbols, afterSymbols),
    compareList("reads", beforeSymbols, afterSymbols),
    compareList("writes", beforeSymbols, afterSymbols),
    compareList("executes", beforeSymbols, afterSymbols),
    compareList("commons", beforeSymbols, afterSymbols),
    lintDelta(beforeLint, afterLint),
    compileCheck(input.compileOutput),
  ]
  const blocked = checks.filter((entry) => entry.status === "blocked")
  const warnings = checks.filter((entry) => entry.status === "warning")
  return {
    ready: blocked.length === 0 && warnings.length === 0,
    summary: blocked.length > 0 ? `${blocked.length} blocking modernization regression${blocked.length === 1 ? "" : "s"}` : warnings.length > 0 ? `${warnings.length} modernization proof warning${warnings.length === 1 ? "" : "s"}` : "modernization proof is clean",
    checks,
  }
}

export function renderModernizationProof(report: ModernizationProofReport): string {
  return [
    "# D3 BASIC Modernization Proof",
    "",
    `Ready: ${report.ready ? "yes" : "no"}`,
    `Summary: ${report.summary}`,
    "",
    ...report.checks.flatMap((entry) => [
      `- [${entry.status}] ${entry.id}`,
      ...entry.evidence.map((evidence) => `  evidence: ${evidence}`),
    ]),
    "",
  ].join("\n")
}
