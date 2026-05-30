import type { SafetyMode } from "../domain/types.js"

export type PermissionAction = "allow" | "ask" | "deny" | "confirm"
export type D3CommandRisk = "read" | "write" | "compile" | "destructive" | "shell"

const destructivePatterns = [
  /\bCLEAR-FILE\b/i,
  /\bDELETE-ACCOUNT\b/i,
  /\bACCOUNT-RESTORE\b/i,
  /\bLOCK-BREAK\b/i,
  /\bPHANTOM-RESET\b/i,
  /\bTRANSACTION\b/i,
  /\bDELETE\b.*\bALL\b/i,
  /\bED\b.*\bMD\b/i,
]

const shellPatterns = [/^\s*SH\b/i, /^\s*!\s*/, /^\s*UNIX\b/i]
const compilePatterns = [/\bBASIC\b/i, /\bCOMPILE\b/i, /\bCATALOG\b/i, /\bCOMPILE-CATALOG\b/i]
const writePatterns = [/\bLOGTO\b/i, /\bCALL\b/i, /\bCOPY\b/i, /\bDELETE\b/i, /\bED\b/i, /\bUPDATE\b/i, /\bCREATE-FILE\b/i, /\bRESIZE\b/i]

export function classifyD3Command(command: string): D3CommandRisk {
  if (shellPatterns.some((pattern) => pattern.test(command))) return "shell"
  if (destructivePatterns.some((pattern) => pattern.test(command))) return "destructive"
  if (compilePatterns.some((pattern) => pattern.test(command))) return "compile"
  if (writePatterns.some((pattern) => pattern.test(command))) return "write"
  return "read"
}

export function evaluateD3Permission(mode: SafetyMode, command: string): PermissionAction {
  const risk = classifyD3Command(command)
  if (mode === "plan") return risk === "read" ? "allow" : "deny"
  if (mode === "ask") return risk === "read" ? "allow" : "ask"
  if (risk === "destructive" || risk === "shell") return "confirm"
  return "allow"
}

export function assertD3Allowed(mode: SafetyMode, command: string, confirmed = false): void {
  const action = evaluateD3Permission(mode, command)
  if (action === "deny") throw new Error(`Denied by ${mode} safety policy: ${command}`)
  if ((action === "ask" || action === "confirm") && !confirmed) {
    throw new Error(`Confirmation required by ${mode} safety policy: ${command}`)
  }
}
