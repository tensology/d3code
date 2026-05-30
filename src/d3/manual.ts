import { execFile } from "node:child_process"
import { readFile } from "node:fs/promises"
import { extname } from "node:path"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export interface ManualTopic {
  id: string
  label: string
  pattern: RegExp
  minimumHits: number
}

export interface ManualTopicResult {
  id: string
  label: string
  hits: number
  firstLine?: number
  status: "ok" | "thin" | "missing"
}

export interface ManualScopeReport {
  totalLines: number
  topics: ManualTopicResult[]
  capabilities: ManualCommandCapabilityResult[]
}

export type D3CommandSurface = "typed" | "raw-tcl-only" | "planned"

export interface ManualCommandCapability {
  id: string
  category: string
  label: string
  commands: string[]
  pattern: RegExp
  surface: D3CommandSurface
  cli: string[]
  notes: string
}

export interface ManualCommandCapabilityResult extends ManualCommandCapability {
  hits: number
  firstLine?: number
  manualStatus: "ok" | "missing"
}

export const manualTopics: ManualTopic[] = [
  { id: "aql", label: "Access Query Language", pattern: /\b(AQL|Access Query Language|LIST |SELECT |SORT )\b/i, minimumHits: 20 },
  { id: "basic", label: "BASIC/FlashBASIC", pattern: /\b(BASIC|FlashBASIC|SUBROUTINE|CATALOG|COMPILE)\b/i, minimumHits: 40 },
  { id: "tcl", label: "Terminal Control Language", pattern: /\b(TCL|Terminal Control Language|tcl-stack)\b/i, minimumHits: 20 },
  { id: "accounts", label: "Accounts and master dictionaries", pattern: /\b(account|master dictionary|mds|Q-pointer|D-pointer)\b/i, minimumHits: 30 },
  { id: "files", label: "Files, dictionaries, attributes", pattern: /\b(file reference|dictionary|attribute|item-ID|data section)\b/i, minimumHits: 40 },
  { id: "locks", label: "Locks and concurrency", pattern: /\b(lock|locked|READU|RELEASE|transaction)\b/i, minimumHits: 20 },
  { id: "triggers", label: "Triggers and phantoms", pattern: /\b(trigger|phantom|callx|callc|callo)\b/i, minimumHits: 10 },
  { id: "debugger", label: "Debugger and diagnostics", pattern: /\b(debugger|DEBUG|symbolic debugger|breakpoint)\b/i, minimumHits: 10 },
  { id: "screens", label: "Terminal screens and cursor control", pattern: /\b(screen\.display|screen\.input|screen\.init|screen\.erase|CRT|DISPLAY|INPUT|@\(-?\d+\)|cursor-control|terminal type|PROC processor)\b/i, minimumHits: 20 },
]

export const manualCommandCapabilities: ManualCommandCapability[] = [
  {
    id: "login-session",
    category: "login/session",
    label: "D3 account login and session proof",
    commands: ["LOGTO", "WHO", "VERSION", "OFF"],
    pattern: /\b(LOGTO|WHO|VERSION|OFF)\b/i,
    surface: "typed",
    cli: ["login", "profile-doctor", "live-proof"],
    notes: "Typed profile proof covers login/smoke checks; OFF remains available through guarded TCL when needed.",
  },
  {
    id: "files-dictionaries-items",
    category: "files/dictionaries/items",
    label: "Files, dictionaries, and item IO",
    commands: ["CREATE-FILE", "DELETE-FILE", "CT", "ED", "LIST MD", "DICT"],
    pattern: /\b(CREATE-FILE|DELETE-FILE|CT|ED|LIST\s+MD|DICT)\b/i,
    surface: "typed",
    cli: ["read-item", "write-item", "read-dict", "index-account", "bundle-capture", "tool d3_tcl"],
    notes: "Read/write/dictionary/listing workflows have typed surfaces; create/delete file are intentionally raw TCL only until live rollback proof exists.",
  },
  {
    id: "aql-query",
    category: "AQL/query",
    label: "AQL queries and select lists",
    commands: ["LIST", "SELECT", "SORT", "SAVE-LIST", "GET-LIST"],
    pattern: /\b(LIST|SELECT|SORT|SAVE-LIST|GET-LIST|saved list|select list)\b/i,
    surface: "typed",
    cli: ["query-aql", "tool d3_query_aql"],
    notes: "AQL execution is typed as a read-oriented query surface; saved-list workflows remain guarded TCL strings.",
  },
  {
    id: "basic-subroutines",
    category: "BASIC/subroutines",
    label: "BASIC compile, catalog, and subroutine calls",
    commands: ["BASIC", "COMPILE", "CATALOG", "CALL", "CALLX"],
    pattern: /\b(BASIC|COMPILE|CATALOG|CALL|CALLX|SUBROUTINE)\b/i,
    surface: "typed",
    cli: ["compile-basic", "catalog-basic", "call-subroutine", "agent-run basic-check"],
    notes: "BASIC/CATALOG/CALL have typed guarded wrappers; CALLX and debugger-specific flows remain raw or planned pending live proof.",
  },
  {
    id: "indexes-locks",
    category: "indexes/locks",
    label: "Indexes and locks",
    commands: ["LIST-INDEX", "CREATE-INDEX", "DELETE-INDEX", "LIST-LOCKS"],
    pattern: /\b(LIST-INDEX|CREATE-INDEX|DELETE-INDEX|LIST-LOCKS|index|lock)\b/i,
    surface: "raw-tcl-only",
    cli: ["locks", "bundle-capture", "bundle-index-plan", "tool d3_tcl"],
    notes: "Locks and observed index capture are surfaced; index mutation is deliberately raw TCL only and should stay confirmation-gated.",
  },
  {
    id: "backup-restore",
    category: "backup/restore",
    label: "Backup and restore operations",
    commands: ["SAVE", "FILE-SAVE", "ACCOUNT-SAVE", "RESTORE", "HOT-BACKUP"],
    pattern: /\b(FILE-SAVE|ACCOUNT-SAVE|RESTORE|HOT-BACKUP|SAVE)\b/i,
    surface: "raw-tcl-only",
    cli: ["safety-guard", "tool d3_tcl", "live-proof-check"],
    notes: "Backup/restore commands are high-risk infrastructure controls; CLI should classify and document them, not pretend mock tests prove live safety.",
  },
  {
    id: "screens-terminal",
    category: "screens/terminal",
    label: "Legacy screens and terminal flows",
    commands: ["CRT", "DISPLAY", "INPUT", "@()", "PROC", "MENU"],
    pattern: /\b(CRT|DISPLAY|INPUT|PROC|MENU|cursor-control|terminal type|@\(-?\d+)/i,
    surface: "typed",
    cli: ["terminal-capture", "screen-parse", "bundle-screen-plan", "cockpit-terminal"],
    notes: "Transcript capture and screen parsing are typed; real PowerTerm parity remains live-proof gated.",
  },
  {
    id: "osfi-tcp-tooling",
    category: "OSFI/TCP/tooling",
    label: "OSFI, TCP, shell, and external tool integration",
    commands: ["OSFI", "TCP", "TELNET", "D3TCL", "SHELL", "CURL"],
    pattern: /\b(OSFI|TCP|TELNET|D3TCL|SHELL|CURL|host file system)\b/i,
    surface: "raw-tcl-only",
    cli: ["connector-strategy", "terminal-plan", "profile-add-ssh", "safety-guard", "tool d3_tcl"],
    notes: "Connectivity is planned through local/SSH/PTTY strategy; shell/curl execution must remain explicit and safety-classified.",
  },
]

export async function readManualText(path: string): Promise<string> {
  if (extname(path).toLowerCase() !== ".pdf") return readFile(path, "utf8")
  try {
    const { stdout } = await execFileAsync("pdftotext", ["-layout", path, "-"], { maxBuffer: 64 * 1024 * 1024 })
    return stdout
  } catch (error) {
    throw new Error(`Could not extract PDF manual ${path}. Install pdftotext or pass an extracted .txt file. ${(error as Error).message}`)
  }
}

export function scopeManual(text: string): ManualScopeReport {
  const lines = text.split(/\r?\n/)
  const topics = manualTopics.map((topic) => {
    let hits = 0
    let firstLine: number | undefined
    lines.forEach((line, index) => {
      if (topic.pattern.test(line)) {
        hits += 1
        firstLine ??= index + 1
      }
    })
    return {
      id: topic.id,
      label: topic.label,
      hits,
      firstLine,
      status: hits === 0 ? "missing" : hits < topic.minimumHits ? "thin" : "ok",
    } satisfies ManualTopicResult
  })
  const capabilities = manualCommandCapabilities.map((capability) => {
    let hits = 0
    let firstLine: number | undefined
    lines.forEach((line, index) => {
      if (capability.pattern.test(line)) {
        hits += 1
        firstLine ??= index + 1
      }
    })
    return {
      ...capability,
      hits,
      firstLine,
      manualStatus: hits > 0 ? "ok" : "missing",
    } satisfies ManualCommandCapabilityResult
  })
  return { totalLines: lines.length, topics, capabilities }
}

export function formatManualScope(report: ManualScopeReport): string {
  const rows = [`Manual lines: ${report.totalLines}`, "Topic\tStatus\tHits\tFirst line"]
  for (const topic of report.topics) rows.push(`${topic.label}\t${topic.status}\t${topic.hits}\t${topic.firstLine ?? ""}`)
  rows.push("", "Command capability\tManual\tSurface\tHits\tCLI")
  for (const capability of report.capabilities) {
    rows.push(`${capability.category}: ${capability.label}\t${capability.manualStatus}\t${capability.surface}\t${capability.hits}\t${capability.cli.join(", ")}`)
  }
  return rows.join("\n")
}
