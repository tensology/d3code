import type { ConnectionProfile, SafetyMode } from "../domain/types.js"

export type PermissionAction = "allow" | "ask" | "deny" | "confirm"
export type D3CommandRisk = "read" | "write" | "compile" | "destructive" | "shell"

export class D3ConfirmationRequiredError extends Error {
  constructor(mode: SafetyMode, command: string) {
    super(`Confirmation required by ${mode} safety policy: ${command}`)
    this.name = "D3ConfirmationRequiredError"
  }
}

const riskOrder: D3CommandRisk[] = ["read", "write", "compile", "destructive", "shell"]
const destructiveVerbs = new Set([
  "CLEAR-FILE", "DELETE-FILE", "DELETE-ACCOUNT", "ACCOUNT-RESTORE", "FILE-RESTORE",
  "LOCK-BREAK", "PHANTOM-RESET", "TRANSACTION", "SP-KILL", "SHUTDOWN",
  // Saves may overwrite media and clear dirty bits before a usable backup exists.
  "FILE-SAVE", "ACCOUNT-SAVE", "T-WEOF",
])
const compileVerbs = new Set(["BASIC", "COMPILE", "CATALOG", "COMPILE-CATALOG"])
const readReports = new Set(["LIST", "SORT", "SELECT", "SSELECT", "COUNT"])
const readDiagnostics = new Set([
  "WHO", "VERSION", "TIME", "DATE", "TERM", "STTY", "WHERE", "LIST-LOCKS",
  "LIST-ITEM-LOCKS", "LIST-JOBS", "LIST-VERBS", "LIST-DEVICE", "T-STAT", "SP-STATUS", "LISTPEQS",
])

type TransportProfile = Pick<ConnectionProfile, "type" | "entryCommand">

function usesShellTransport(profile?: TransportProfile): boolean {
  if (!profile) return false
  const entry = profile.entryCommand?.trim()
  if (!entry) return profile.type === "local"
  return /^(?:exec\s+)?(?:(?:\/[^\s]+\/)?env\s+)?(?:\/[^\s]+\/)?(?:bash|dash|ksh|zsh|fish|sh)(?:\s|$)/i.test(entry)
}

function classifyLine(line: string): D3CommandRisk {
  const command = line.trim()
  const unquoted = command.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, "Q")
  if (/^(?:!|SH\b|UNIX\b)/i.test(command) || /[;|&]/.test(unquoted) || /`|\$\(/.test(command)) return "shell"
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(command) || /["']/.test(unquoted)) return "write"
  const verb = command.split(/\s+/)[0].toUpperCase()
  if (destructiveVerbs.has(verb) || /^DELETE\b.*\bALL\b/i.test(unquoted) || /^ED\s+(?:DICT\s+)?MD(?:\s|$)/i.test(command)) return "destructive"
  if (compileVerbs.has(verb)) return "compile"
  // Printer destinations and P options are side effects, even on LIST/CT.
  if (/\bTO\s+PRINTER\b|\bLPTR\b|\([^()]*P[^()]*(?:\)|$)/i.test(unquoted)) return "write"
  if (readReports.has(verb) && command.length > verb.length) return "read"
  if (verb === "CT" && /^CT\s+(?:DICT\s+)?[^\s()]+\s+[^()]+?(?:\s+\(N\)?)?$/i.test(unquoted)) return "read"
  if (verb === "LIST-INDEX" && /^LIST-INDEX\s+[^\s()]+(?:\s+\(N\)?)?$/i.test(unquoted)) return "read"
  if (readDiagnostics.has(verb) && new RegExp(`^${verb}(?:\\s+\\(N\\)?)?$`, "i").test(command)) return "read"
  return "write"
}

export function classifyD3Command(command: string, profile?: TransportProfile): D3CommandRisk {
  if (usesShellTransport(profile)) return "shell"
  const lines = command.split(/\r\n?|\n/).filter(line => line.trim())
  if (!lines.length) return "write"
  return lines.map(classifyLine).reduce((highest, risk) => riskOrder.indexOf(risk) > riskOrder.indexOf(highest) ? risk : highest, "read")
}

export function evaluateD3Permission(mode: SafetyMode, command: string, profile?: TransportProfile): PermissionAction {
  const risk = classifyD3Command(command, profile)
  if (mode === "plan") return risk === "read" ? "allow" : "deny"
  if (mode === "ask") return risk === "read" ? "allow" : "ask"
  if (risk === "destructive" || risk === "shell") return "confirm"
  return "allow"
}

export function assertD3Allowed(mode: SafetyMode, command: string, confirmed = false, allowedAccounts?: string[], profile?: TransportProfile): void {
  for (const match of command.matchAll(/^\s*(?:TO|LOGTO)\s+(\S+)/gim)) {
    if (allowedAccounts?.length && !allowedAccounts.includes(match[1])) {
      throw new Error(`Account ${match[1]} is outside the allowed accounts for this profile.`)
    }
  }
  const action = evaluateD3Permission(mode, command, profile)
  if (action === "deny") throw new Error(`Denied by ${mode} safety policy: ${command}`)
  if ((action === "ask" || action === "confirm") && !confirmed) {
    throw new D3ConfirmationRequiredError(mode, command)
  }
}
