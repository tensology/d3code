import { spawn } from "node:child_process"
import { formatDurationMs } from "./session-surface.js"

export interface LocalShellResult {
  command: string
  shell: string
  cwd: string
  exitCode: number | null
  signal: NodeJS.Signals | null
  stdout: string
  stderr: string
  truncated: boolean
  durationMs: number
}

export interface LocalShellOptions {
  cwd?: string
  signal?: AbortSignal
  timeoutMs?: number
  maxOutputChars?: number
  onStdout?: (chunk: string) => void
  onStderr?: (chunk: string) => void
}

function appendLimited(current: string, chunk: Buffer, maxChars: number): { value: string; truncated: boolean } {
  if (current.length >= maxChars) return { value: current, truncated: true }
  const next = current + chunk.toString("utf8")
  if (next.length <= maxChars) return { value: next, truncated: false }
  return { value: next.slice(0, maxChars), truncated: true }
}

export function renderLocalShellResult(result: LocalShellResult): string {
  const lines = [
    `exit ${result.exitCode ?? "signal"}${result.signal ? ` (${result.signal})` : ""} in ${formatDurationMs(result.durationMs)}`,
    result.stdout.trimEnd(),
    result.stderr.trimEnd() ? `stderr:\n${result.stderr.trimEnd()}` : "",
    result.truncated ? "... output truncated" : "",
  ].filter(Boolean)
  return lines.join("\n")
}

export async function runLocalShellCommand(command: string, options: LocalShellOptions = {}): Promise<LocalShellResult> {
  const shell = process.env.SHELL || "/bin/sh"
  const cwd = options.cwd ?? process.cwd()
  const timeoutMs = options.timeoutMs ?? 120_000
  const maxOutputChars = options.maxOutputChars ?? 20_000
  return await new Promise((resolve, reject) => {
    const started = Date.now()
    const child = spawn(shell, ["-lc", command], {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    let truncated = false
    const timer = setTimeout(() => {
      truncated = true
      child.kill("SIGTERM")
    }, timeoutMs)
    const abort = () => {
      child.kill("SIGTERM")
    }
    options.signal?.addEventListener("abort", abort, { once: true })
    child.stdout.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8")
      const next = appendLimited(stdout, chunk, maxOutputChars)
      stdout = next.value
      truncated = truncated || next.truncated
      options.onStdout?.(text)
    })
    child.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString("utf8")
      const next = appendLimited(stderr, chunk, maxOutputChars)
      stderr = next.value
      truncated = truncated || next.truncated
      options.onStderr?.(text)
    })
    child.on("error", (error) => {
      clearTimeout(timer)
      options.signal?.removeEventListener("abort", abort)
      reject(error)
    })
    child.on("close", (exitCode, signal) => {
      clearTimeout(timer)
      options.signal?.removeEventListener("abort", abort)
      resolve({ command, shell, cwd, exitCode, signal, stdout, stderr, truncated, durationMs: Date.now() - started })
    })
  })
}
