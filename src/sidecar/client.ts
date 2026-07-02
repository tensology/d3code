import { constants } from "node:fs"
import { existsSync } from "node:fs"
import { access } from "node:fs/promises"
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { effectiveSafety, selectProfile, type D3CodeConfig } from "../config/config.js"
import type { ConnectionProfile, SafetyMode } from "../domain/types.js"

export interface SidecarProfileContext {
  enabled: boolean
  model: string
  mode: string
  safety: SafetyMode
  profile?: Pick<ConnectionProfile, "name" | "type" | "host" | "port" | "account" | "entryCommand" | "promptPattern" | "sessionMode" | "allowedAccounts">
}

export interface SidecarCheck {
  id: string
  status: "ok" | "warning" | "missing" | "error" | "disabled"
  message: string
}

export interface SidecarStatusReport {
  enabled: boolean
  autoStart: boolean
  binary: string
  ready: boolean
  fallback: boolean
  engine?: string
  version?: string
  checks: SidecarCheck[]
}

export interface SidecarStartResult {
  started: boolean
  ready: boolean
  fallback: boolean
  binary: string
  process?: ChildProcessWithoutNullStreams
  engine?: string
  version?: string
  reason?: string
}

interface SidecarOptions {
  binary?: string
}

interface SidecarStartOptions extends SidecarOptions {
  profileName?: string
  mode?: string
  timeoutMs?: number
}

function packageRoot(): string {
  const candidates = [
    new URL("../../package.json", import.meta.url),
    new URL("../../../package.json", import.meta.url),
  ]
  const found = candidates.find((candidate) => existsSync(fileURLToPath(candidate)))
  return found ? dirname(fileURLToPath(found)) : fileURLToPath(new URL("../..", import.meta.url))
}

export function resolveSidecarBinary(config: D3CodeConfig, override?: string): string {
  return override ?? config.sidecar?.binary ?? process.env.D3CODE_SIDECAR_BIN ?? join(packageRoot(), "sidecar", "target", "release", "d3code-sidecar")
}

async function executableExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK)
    return true
  } catch {
    return false
  }
}

function sanitizeProfile(profile: ConnectionProfile | undefined): SidecarProfileContext["profile"] {
  if (!profile) return undefined
  return {
    name: profile.name,
    type: profile.type,
    host: profile.host,
    port: profile.port,
    account: profile.account,
    entryCommand: profile.entryCommand,
    promptPattern: profile.promptPattern,
    sessionMode: profile.sessionMode,
    allowedAccounts: profile.allowedAccounts,
  }
}

export function createSidecarProfileContext(config: D3CodeConfig, profileName?: string, mode = "chat"): SidecarProfileContext {
  const profile = selectProfile(config, profileName)
  return {
    enabled: config.sidecar?.enabled ?? true,
    model: config.defaultModel,
    mode,
    safety: effectiveSafety(config, undefined, profile),
    profile: sanitizeProfile(profile),
  }
}

function parseHealthLine(line: string): { ready?: boolean; engine?: string; version?: string; type?: string } {
  try {
    const parsed = JSON.parse(line) as { ready?: boolean; engine?: string; version?: string; type?: string }
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function sidecarHealth(binary: string, timeoutMs = 1500): Promise<{ ready: boolean; engine?: string; version?: string; error?: string }> {
  return new Promise((resolve) => {
    const child = spawn(binary, ["health"], { stdio: ["ignore", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    const timeout = setTimeout(() => {
      child.kill("SIGTERM")
      resolve({ ready: false, error: "health check timed out" })
    }, timeoutMs)
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk)
    })
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk)
    })
    child.on("error", (error) => {
      clearTimeout(timeout)
      resolve({ ready: false, error: error.message })
    })
    child.on("close", (code) => {
      clearTimeout(timeout)
      const health = parseHealthLine(stdout.trim().split(/\r?\n/)[0] ?? "")
      resolve({
        ready: code === 0 && health.ready === true,
        engine: health.engine,
        version: health.version,
        error: code === 0 ? undefined : stderr.trim() || `health exited ${code}`,
      })
    })
  })
}

export async function createSidecarStatus(config: D3CodeConfig, options: SidecarOptions = {}): Promise<SidecarStatusReport> {
  const enabled = config.sidecar?.enabled ?? true
  const autoStart = config.sidecar?.autoStart ?? true
  const binary = resolveSidecarBinary(config, options.binary)
  const checks: SidecarCheck[] = []

  if (!enabled) {
    checks.push({ id: "enabled", status: "disabled", message: "Rust sidecar disabled in config." })
    return { enabled, autoStart, binary, ready: false, fallback: true, checks }
  }

  if (!await executableExists(binary)) {
    checks.push({ id: "binary", status: "missing", message: `Sidecar binary not executable at ${binary}.` })
    checks.push({ id: "fallback", status: "ok", message: "D3Code will use the TypeScript path." })
    return { enabled, autoStart, binary, ready: false, fallback: true, checks }
  }

  checks.push({ id: "binary", status: "ok", message: `Sidecar binary is executable at ${binary}.` })
  const health = await sidecarHealth(binary)
  if (!health.ready) {
    checks.push({ id: "health", status: "error", message: health.error ?? "Sidecar health check did not report ready." })
    checks.push({ id: "fallback", status: "ok", message: "D3Code will use the TypeScript path." })
    return { enabled, autoStart, binary, ready: false, fallback: true, engine: health.engine, version: health.version, checks }
  }

  checks.push({ id: "health", status: "ok", message: "Sidecar health check passed." })
  return { enabled, autoStart, binary, ready: true, fallback: false, engine: health.engine, version: health.version, checks }
}

export function renderSidecarStatus(report: SidecarStatusReport): string {
  const lines = [
    "D3Code sidecar",
    `Enabled: ${report.enabled ? "yes" : "no"}`,
    `Auto-start: ${report.autoStart ? "yes" : "no"}`,
    `Ready: ${report.ready ? "yes" : "no"}`,
    `TypeScript fallback: ${report.fallback ? "yes" : "no"}`,
    `Binary: ${report.binary}`,
  ]
  if (report.engine) lines.push(`Engine: ${report.engine}`)
  if (report.version) lines.push(`Version: ${report.version}`)
  lines.push("", "Checks:")
  for (const check of report.checks) lines.push(`- ${check.id}: ${check.status} - ${check.message}`)
  return lines.join("\n")
}

export async function ensureSidecarStarted(config: D3CodeConfig, options: SidecarStartOptions = {}): Promise<SidecarStartResult> {
  const binary = resolveSidecarBinary(config, options.binary)
  const enabled = config.sidecar?.enabled ?? true
  const autoStart = config.sidecar?.autoStart ?? true
  if (!enabled) return { started: false, ready: false, fallback: true, binary, reason: "sidecar disabled" }
  if (!autoStart) return { started: false, ready: false, fallback: true, binary, reason: "sidecar auto-start disabled" }
  if (!await executableExists(binary)) return { started: false, ready: false, fallback: true, binary, reason: "sidecar binary missing" }

  const context = createSidecarProfileContext(config, options.profileName, options.mode)
  return new Promise((resolve) => {
    let timeout: NodeJS.Timeout
    const child = spawn(binary, ["serve"], {
      cwd: dirname(binary),
      env: {
        ...process.env,
        D3CODE_SIDECAR_CONTEXT: JSON.stringify(context),
      },
      stdio: ["pipe", "pipe", "pipe"],
    })
    let stdout = ""
    let resolved = false
    const finish = (result: SidecarStartResult) => {
      if (resolved) return
      resolved = true
      clearTimeout(timeout)
      resolve(result)
    }
    timeout = setTimeout(() => {
      child.kill("SIGTERM")
      finish({ started: false, ready: false, fallback: true, binary, reason: "sidecar startup timed out" })
    }, options.timeoutMs ?? 1500)

    child.on("error", (error) => {
      finish({ started: false, ready: false, fallback: true, binary, reason: error.message })
    })
    child.on("close", (code) => {
      if (!resolved) finish({ started: false, ready: false, fallback: true, binary, reason: `sidecar exited ${code}` })
    })
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk)
      const newline = stdout.indexOf("\n")
      if (newline === -1) return
      const health = parseHealthLine(stdout.slice(0, newline).trim())
      if (health.ready === true || health.type === "ready") {
        finish({ started: true, ready: true, fallback: false, binary, process: child, engine: health.engine, version: health.version })
        return
      }
      child.kill("SIGTERM")
      finish({ started: false, ready: false, fallback: true, binary, reason: "sidecar did not emit a ready event" })
    })
  })
}
