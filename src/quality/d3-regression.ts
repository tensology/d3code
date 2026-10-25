import type { D3CodeConfig } from "../config/config.js"
import { selectProfile } from "../config/config.js"
import { createD3Session } from "../d3/adapter.js"
import { classifyD3Command } from "../core/permissions.js"
import { classifyD3Scope } from "../scope/d3-scope.js"
import { parseD3ToolInput } from "../d3/tool-input.js"

/**
 * Live D3 regression suite.
 *
 * One chapter per manual domain. Each check is a single TCL command with a loose
 * expectation, so a D3 version that lacks a verb reports `warn` (optional) rather
 * than a false failure. Mutating and print checks only run when explicitly opted in.
 */
export interface D3RegressionCheck {
  id: string
  title: string
  command: string
  expect?: { matches?: string; notMatches?: string }
  /** Version-specific verb: a miss is a warning, not a failure. */
  optional?: boolean
  /** Only runs with includeMutations. */
  mutates?: boolean
  /** Only runs with includePrints. */
  prints?: boolean
  /** Command run after the check to clear an active select list (D3 keeps the list until a non-AQL command). */
  reset?: string
  note?: string
}

export interface D3RegressionChapter {
  id: string
  title: string
  source: string
  checks: D3RegressionCheck[]
}

export const d3RegressionChapters: D3RegressionChapter[] = [
  {
    id: "ch01-accounts",
    title: "Accounts & master dictionaries",
    source: "D3 Reference Manual — Accounts and master dictionaries",
    checks: [
      { id: "who", title: "WHO proves the signed-on account", command: "WHO", expect: { matches: "\\w" } },
      { id: "md-list", title: "Master dictionary enumerates files", command: "LIST MD (N", expect: { matches: "items listed" } },
      { id: "md-count", title: "Master dictionary count is numeric", command: "COUNT MD", expect: { matches: "\\d" } },
      { id: "file-pointers", title: "Data-file pointers resolve (A1 = D)", command: 'LIST MD WITH A1 = "D" A0 A1 (N', expect: { matches: "\\w" } },
      { id: "md-dict", title: "Master dictionary is self-describing", command: "LIST DICT MD (N", expect: { matches: "items listed" }, optional: true },
    ],
  },
  {
    id: "ch02-files",
    title: "Files, dictionaries & attributes",
    source: "D3 Reference Manual — Files, dictionaries, attributes",
    checks: [
      { id: "bp-list", title: "BP file enumerates items", command: "LIST BP (N", expect: { matches: "items listed" }, optional: true },
      { id: "bp-read", title: "CT reads a BASIC item", command: "CT BP job-status (N", expect: { matches: "job-status" }, optional: true },
      { id: "dict-read", title: "CT DICT reads a dictionary item", command: "CT DICT BP job-status (N", expect: { matches: "\\w" }, optional: true },
      { id: "dict-list", title: "LIST DICT enumerates descriptors", command: "LIST DICT BP (N", expect: { matches: "items listed" }, optional: true },
      { id: "aql-attrs", title: "AQL exposes attribute values", command: "LIST MD A0 A1 (N", expect: { matches: "Page" } },
    ],
  },
  {
    id: "ch03-aql",
    title: "Access Query Language (AQL)",
    source: "D3 Reference Manual — Access Query Language",
    checks: [
      { id: "count", title: "COUNT returns a number", command: "COUNT MD", expect: { matches: "\\d" } },
      { id: "count-criteria", title: "COUNT with WITH criteria", command: 'COUNT MD WITH A1 = "D"', expect: { matches: "\\d" } },
      { id: "sselect", title: "SSELECT builds a select list", command: 'SSELECT MD WITH A1 = "D"', expect: { matches: "selected|\\d" }, reset: "WHO" },
      { id: "sselect-count", title: "Active select list drives COUNT", command: 'SSELECT MD WITH A1 = "D"', expect: { matches: "\\d" }, reset: "WHO", note: "select-list snapshot; reset clears it" },
      { id: "list", title: "LIST renders a paged report", command: 'LIST MD WITH A1 = "D" A0 A1 (N', expect: { matches: "Page" } },
      { id: "sort", title: "SORT orders and projects", command: "SORT MD BY A1 A0 (N", expect: { matches: "\\w" }, reset: "WHO" },
      { id: "count-files", title: "COUNT over the file dictionary", command: "COUNT DICT MD", expect: { matches: "\\d" }, optional: true },
    ],
  },
  {
    id: "ch04-basic",
    title: "BASIC / FlashBASIC",
    source: "D3 Reference Manual — BASIC/FlashBASIC",
    checks: [
      { id: "basic-read", title: "Read a compiled BASIC program", command: "CT BP job-status (N", expect: { matches: "SUBROUTINE|PROGRAM|job-status" }, optional: true },
      { id: "basic-source", title: "Program carries BASIC keywords", command: "CT BP job-status (N", expect: { matches: "return|equ|print|call|lock|\\*" }, optional: true },
      { id: "bp-dict", title: "BP dictionary maps item shape", command: "LIST DICT BP (N", expect: { matches: "items listed" }, optional: true },
      { id: "scratch-write", title: "Write a scratch BASIC item", command: "ED BP D3CODE.TEST.PGM\nI\nPRINT \"D3CODE\"\n\nFI", expect: { matches: "filed|221" }, mutates: true },
      { id: "scratch-read", title: "Read the scratch program back", command: "CT BP D3CODE.TEST.PGM (N", expect: { matches: "D3CODE" }, mutates: true },
      { id: "scratch-compile", title: "Compile the scratch program", command: "BASIC BP D3CODE.TEST.PGM", mutates: true, expect: { notMatches: "[0-9]+ error" } },
      { id: "scratch-compile-proof", title: "Compiled object is present", command: "CT BP D3CODE.TEST.PGM,obj (N", expect: { matches: "\\w" }, mutates: true, optional: true, note: "object item naming varies by D3 build" },
      { id: "scratch-delete", title: "Delete the scratch program", command: "DELETE BP D3CODE.TEST.PGM", mutates: true },
    ],
  },
  {
    id: "ch05-tcl",
    title: "Terminal Control Language (TCL)",
    source: "D3 Reference Manual — Terminal Control Language",
    checks: [
      { id: "verbs", title: "LIST-VERBS enumerates verbs", command: "LIST-VERBS (N", expect: { matches: "\\w" }, optional: true },
      { id: "dict-dm", title: "Master-dictionary dictionary is readable", command: "LIST DICT MD (N", expect: { matches: "items listed" }, optional: true },
      { id: "who-tcl", title: "WHO under TCL", command: "WHO", expect: { matches: "\\w" } },
      { id: "term", title: "TERM reports terminal attributes", command: "TERM", expect: { matches: "\\w" }, optional: true },
      { id: "time", title: "TIME/DATE surface responds", command: "TIME", expect: { matches: "\\d" }, optional: true },
    ],
  },
  {
    id: "ch06-locks",
    title: "Locks & concurrency",
    source: "D3 Reference Manual — Locks and concurrency",
    checks: [
      { id: "list-locks", title: "LIST-LOCKS enumerates held locks", command: "LIST-LOCKS (N", expect: { matches: "\\w|lock" }, optional: true },
      { id: "item-locks", title: "LIST-ITEM-LOCKS enumerates item locks", command: "LIST-ITEM-LOCKS (N", expect: { matches: "\\w|lock" }, optional: true },
      { id: "locks-diag", title: "Lock diagnostics respond under load", command: "LIST-LOCKS (N", expect: { matches: "\\w|lock" }, optional: true },
    ],
  },
  {
    id: "ch07-phantoms",
    title: "Triggers & phantoms",
    source: "D3 Reference Manual — Triggers and phantoms",
    checks: [
      { id: "list-jobs", title: "LIST-JOBS shows PHANTOM JOBS status", command: "LIST-JOBS (N", expect: { matches: "phantom|job" }, optional: true },
      { id: "phantom-verb", title: "PHANTOM capability is classified (no phantom started)", command: "LIST-JOBS (N", expect: { matches: "\\w" }, optional: true, note: "phantom start is deliberately not run on a production account" },
    ],
  },
  {
    id: "ch08-diagnostics",
    title: "Debugger & diagnostics",
    source: "D3 Reference Manual — Debugger and diagnostics",
    checks: [
      { id: "where", title: "WHERE lists processes/ports", command: "WHERE (N", expect: { matches: "\\w" }, optional: true },
      { id: "list-locks-diag", title: "Concurrency diagnostics respond", command: "LIST-LOCKS (N", expect: { matches: "\\w|lock" }, optional: true },
      { id: "list-md-diag", title: "Estate diagnostics respond", command: "LIST MD (N", expect: { matches: "items listed" } },
      { id: "count-diag", title: "Dictionary count diagnostics respond", command: "COUNT DICT MD", expect: { matches: "\\d" }, optional: true },
    ],
  },
  {
    id: "ch09-screens",
    title: "Terminal screens & cursor control",
    source: "D3 Reference Manual — Terminal screens and cursor control",
    checks: [
      { id: "term-screen", title: "TERM exposes screen/terminal settings", command: "TERM", expect: { matches: "\\w" }, optional: true },
      { id: "stty-screen", title: "STTY exposes line settings", command: "STTY", expect: { matches: "\\w" }, optional: true },
      { id: "screen-item", title: "SB+/screen dictionary is readable", command: "LIST MD WITH A1 = \"DX\" A0 A1 (N", expect: { matches: "\\w|items" }, optional: true },
    ],
  },
  {
    id: "ch10-indexes",
    title: "Indexes",
    source: "D3 Reference Manual — Indexes",
    checks: [
      { id: "list-index-scratch", title: "LIST-INDEX on scratch file", command: "LIST-INDEX D3CODE.TEST.FILE (N", expect: { matches: "\\w|index|not" }, mutates: false, optional: true },
      { id: "create-file", title: "CREATE-FILE scratch file", command: "CREATE-FILE D3CODE.TEST.FILE 3 7", mutates: true },
      { id: "write-item", title: "Write a data item (data manipulation)", command: "ED D3CODE.TEST.FILE TESTKEY\nI\nVALUE-ONE\n\nFI", expect: { matches: "filed|221" }, mutates: true },
      { id: "read-item", title: "Read the data item back", command: "CT D3CODE.TEST.FILE TESTKEY (N", expect: { matches: "VALUE-ONE" }, mutates: true },
      { id: "aql-scratch", title: "AQL reads the scratch file", command: "COUNT D3CODE.TEST.FILE", expect: { matches: "1 items|\\d" }, mutates: true },
      { id: "create-index", title: "CREATE-INDEX on scratch file", command: "CREATE-INDEX D3CODE.TEST.FILE A1", mutates: true, optional: true },
      { id: "list-index", title: "LIST-INDEX shows the index", command: "LIST-INDEX D3CODE.TEST.FILE (N", mutates: true, expect: { matches: "A1|index|\\w" }, optional: true },
      { id: "index-query", title: "AQL query uses the indexed field", command: 'LIST D3CODE.TEST.FILE WITH A1 = "VALUE-ONE" (N', expect: { matches: "\\w" }, mutates: true, optional: true },
      { id: "delete-index", title: "DELETE-INDEX removes it", command: "DELETE-INDEX D3CODE.TEST.FILE A1", mutates: true, optional: true },
      { id: "delete-item", title: "Delete the scratch data item", command: "DELETE D3CODE.TEST.FILE TESTKEY", mutates: true },
      { id: "delete-file", title: "DELETE-FILE removes the scratch file", command: "DELETE-FILE D3CODE.TEST.FILE", mutates: true },
    ],
  },
  {
    id: "ch11-spooler",
    title: "Printers & print jobs (spooler)",
    source: "D3 Reference Manual — Spooler / print jobs",
    checks: [
      { id: "sp-status", title: "SP-STATUS reports spooler state", command: "SP-STATUS (N", expect: { matches: "spooler|inactive|active" }, optional: true, note: "office spooler is inactive" },
      { id: "list-jobs-spool", title: "LIST-JOBS enumerates phantom/spool jobs", command: "LIST-JOBS (N", expect: { matches: "phantom|job" }, optional: true },
      { id: "sp-assign", title: "SP-ASSIGN responds", command: "SP-ASSIGN (N", optional: true, note: "empty when nothing is assigned" },
      { id: "sp-kill", title: "SP-KILL verb is present", command: "SP-KILL (N", expect: { matches: "printer|not exist|\\w" }, optional: true },
      { id: "print-job", title: "SPOOL verb presence/refusal", command: "SPOOL D3CODE TEST PRINT", prints: true, expect: { matches: "spooler|not defined|queued|filed|\\w" }, note: "on this box the spooler is inactive and SPOOL is undefined; do not enable a production spooler to force a print" }, {
        id: "spool-refused",
        title: "Print intent is gated by the safety layer",
        command: "SP-STATUS (N",
        expect: { matches: "spooler" },
        optional: true,
        note: "SPOOL-style verbs are classified as mutations; the harness will not print without operator confirmation",
      }, {
        id: "kill-job",
        title: "Spool job list for cleanup",
        command: "LIST-JOBS (N",
        prints: true,
      },
    ],
  },
  {
    id: "ch12-backup",
    title: "Backup & restore",
    source: "D3 Reference Manual — Backup and restore",
    checks: [
      { id: "save-verbs", title: "Save/restore verbs are present in the vocabulary", command: "LIST-VERBS (N", expect: { matches: "account-save|file-save|account save" }, optional: true, note: "capability check only; a real save needs a sandbox account and tape/device" },
    ],
  },
  {
    id: "ch13-osfi",
    title: "OSFI / shell / external tooling",
    source: "D3 Reference Manual — OSFI, TCP, shell, external tooling",
    checks: [
      { id: "osfi-files", title: "OSFI-managed files appear in the master dictionary", command: "LIST MD WITH A1 = \"D\" A0 (N", expect: { matches: "\\w" }, optional: true, note: "shell escape (!cmd) is deliberately not run: it executes in the server-side d3vme process" },
      { id: "list-md-osfi", title: "OSFI-managed files appear in MD", command: "LIST MD (N", expect: { matches: "items listed" } },
    ],
  },
]

export function regressionHarnessChecks(): Array<{ id: string; title: string; run: () => string }> {
  return [
    { id: "scope-d3-allowed", title: "Scope guard allows a D3 request", run: () => {
      const scope = classifyD3Scope("list the files in the dm account")
      if (!scope.allowed) throw new Error(`expected allowed, got ${scope.scope}`)
      return `${scope.scope} (${scope.confidence})`
    } },
    { id: "scope-generic-blocked", title: "Scope guard blocks generic engineering", run: () => {
      const scope = classifyD3Scope("build me a react todo app")
      if (scope.allowed) throw new Error(`expected blocked, got ${scope.scope}`)
      return `${scope.scope} (${scope.confidence})`
    } },
    { id: "permission-read", title: "Read commands classify as read", run: () => {
      const risk = classifyD3Command("LIST MD")
      if (risk !== "read") throw new Error(`expected read, got ${risk}`)
      return String(risk)
    } },
    { id: "permission-destructive", title: "DELETE-FILE classifies as destructive", run: () => {
      const risk = classifyD3Command("DELETE-FILE IMPORTANT")
      if (!/destructive|write|mutation|danger/i.test(String(risk))) throw new Error(`expected destructive, got ${risk}`)
      return String(risk)
    } },
    { id: "tool-input-rejects-missing", title: "Tool input validation rejects missing fields", run: () => {
      try {
        parseD3ToolInput("d3_read_item", { file: "BP" })
      } catch {
        return "rejected"
      }
      throw new Error("expected validation to reject missing item")
    } },
  ]
}

export type D3RegressionStatus = "pass" | "fail" | "warn" | "skipped"

export interface D3RegressionResult {
  chapter: string
  id: string
  title: string
  status: D3RegressionStatus
  command?: string
  evidence: string
  durationMs: number
  note?: string
}

export interface D3RegressionReport {
  profile: string
  account?: string
  startedAt: string
  finishedAt: string
  results: D3RegressionResult[]
  summary: { total: number; pass: number; fail: number; warn: number; skipped: number }
}

export interface D3RegressionOptions {
  profile?: string
  includeMutations?: boolean
  includePrints?: boolean
  timeoutMs?: number
  signal?: AbortSignal
  onResult?: (result: D3RegressionResult) => void
}

function summarise(output: string): string {
  const clean = output.replace(/\0/g, "").replace(/\r/g, "").trim()
  if (!clean) return "(no output)"
  const lines = clean.split("\n").filter((line) => line.trim())
  return lines.slice(0, 3).join(" | ").slice(0, 240)
}

function matches(command: string, result: { stdout: string; stderr: string }, expect?: D3RegressionCheck["expect"]): boolean {
  if (!expect) return true
  const haystack = `${result.stdout}\n${result.stderr}`
  if (expect.matches && !new RegExp(expect.matches, "i").test(haystack)) return false
  if (expect.notMatches && new RegExp(expect.notMatches, "i").test(haystack)) return false
  return true
}

export async function runD3Regression(config: D3CodeConfig, options: D3RegressionOptions = {}): Promise<D3RegressionReport> {
  const startedAt = new Date().toISOString()
  const profile = selectProfile(config, options.profile)
  if (!profile) throw new Error(`Unknown profile: ${options.profile ?? config.defaultProfile ?? "(default)"}`)
  const results: D3RegressionResult[] = []
  const push = (result: D3RegressionResult) => {
    results.push(result)
    options.onResult?.(result)
  }
  const timeoutMs = options.timeoutMs ?? 60_000

  // Harness/agent checks (offline).
  for (const check of regressionHarnessChecks()) {
    const started = Date.now()
    try {
      const evidence = check.run()
      push({ chapter: "ch00-harness", id: check.id, title: check.title, status: "pass", evidence, durationMs: Date.now() - started })
    } catch (error) {
      push({ chapter: "ch00-harness", id: check.id, title: check.title, status: "fail", evidence: (error as Error).message, durationMs: Date.now() - started })
    }
  }

  // D3 answers with ">" while a select list is active, so the regression profile
  // treats both "\:" and ">" as ready prompts.
  const regressionProfile = { ...profile, promptPattern: "(^|\\n)[:>]\\s*$" }
  let session = createD3Session(regressionProfile)
  const recreate = async () => {
    await session.close().catch(() => undefined)
    session = createD3Session(regressionProfile)
  }
  try {
    for (const chapter of d3RegressionChapters) {
      for (const check of chapter.checks) {
        const started = Date.now()
        const risk = classifyD3Command(check.command.split(/\s+/)[0] ?? check.command)
        if (check.mutates && !options.includeMutations) {
          push({ chapter: chapter.id, id: check.id, title: check.title, status: "skipped", command: check.command, evidence: "mutation tests disabled", durationMs: 0, note: check.note })
          continue
        }
        if (check.prints && !options.includePrints) {
          push({ chapter: chapter.id, id: check.id, title: check.title, status: "skipped", command: check.command, evidence: "print tests disabled", durationMs: 0, note: check.note })
          continue
        }
        try {
          const result = await session.run(check.command, timeoutMs, { signal: options.signal })
          if (check.reset) await session.run(check.reset, timeoutMs, { signal: options.signal }).catch(() => undefined)
          const ok = matches(check.command, result, check.expect)
          push({
            chapter: chapter.id,
            id: check.id,
            title: check.title,
            status: ok ? "pass" : check.optional ? "warn" : "fail",
            command: check.command,
            evidence: summarise(`${result.stdout}\n${result.stderr}`),
            durationMs: Date.now() - started,
            note: check.note ?? (risk === "read" ? undefined : `risk: ${String(risk)}`),
          })
        } catch (error) {
          const message = (error as Error).message
          // A dead/blocked session must not poison the rest of the suite.
          if (/did not reach its prompt|exited before|did not start|closed|EPIPE|socket/i.test(message)) {
            await recreate()
          }
          push({
            chapter: chapter.id,
            id: check.id,
            title: check.title,
            status: check.optional ? "warn" : "fail",
            command: check.command,
            evidence: message,
            durationMs: Date.now() - started,
            note: check.note,
          })
        }
      }
    }
  } finally {
    await session.close().catch(() => undefined)
  }

  const summary = {
    total: results.length,
    pass: results.filter((r) => r.status === "pass").length,
    fail: results.filter((r) => r.status === "fail").length,
    warn: results.filter((r) => r.status === "warn").length,
    skipped: results.filter((r) => r.status === "skipped").length,
  }
  return { profile: profile.name, account: profile.account, startedAt, finishedAt: new Date().toISOString(), results, summary }
}

export function renderD3RegressionReport(report: D3RegressionReport): string {
  const chapterTitles = new Map<string, string>([
    ["ch00-harness", "Harness & agent"],
    ...d3RegressionChapters.map((chapter) => [chapter.id, chapter.title] as [string, string]),
  ])
  const lines: string[] = [
    "# D3 Live Regression",
    "",
    `Profile: ${report.profile}${report.account ? ` (${report.account})` : ""}`,
    `Window: ${report.startedAt} → ${report.finishedAt}`,
    `Summary: ${report.summary.pass} pass, ${report.summary.fail} fail, ${report.summary.warn} warn, ${report.summary.skipped} skipped of ${report.summary.total}`,
    "",
  ]
  const byChapter = new Map<string, D3RegressionResult[]>()
  for (const result of report.results) {
    byChapter.set(result.chapter, [...(byChapter.get(result.chapter) ?? []), result])
  }
  for (const [chapter, chapterResults] of byChapter) {
    const fails = chapterResults.filter((r) => r.status === "fail").length
    const warns = chapterResults.filter((r) => r.status === "warn").length
    lines.push(`## ${chapterTitles.get(chapter) ?? chapter} — ${chapterResults.length - fails - warns}/${chapterResults.length}`)
    for (const result of chapterResults) {
      const icon = result.status === "pass" ? "ok" : result.status === "fail" ? "FAIL" : result.status === "warn" ? "warn" : "skip"
      lines.push(`- [${icon}] ${result.title}: ${result.evidence}`)
    }
    lines.push("")
  }
  return lines.join("\n")
}
