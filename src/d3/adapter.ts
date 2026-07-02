import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import type { ConnectionProfile, D3CommandResult, D3RunOptions, D3Session } from "../domain/types.js"
import { D3_TCL_PROMPT_PATTERN, normalizeD3PromptPattern } from "./prompts.js"

function timeoutEnabled(timeoutMs: number | undefined): timeoutMs is number {
  return typeof timeoutMs === "number" && timeoutMs > 0
}

function interruptedError(): Error {
  return new Error("Interrupted.")
}

function isD3EntryCommand(entry?: string): boolean {
  return Boolean(entry && /^(\S*\/)?d3(?:\s|$)/i.test(entry.trim()))
}

function d3Executable(entry?: string): string {
  const trimmed = entry?.trim()
  if (!trimmed) return "d3"
  return trimmed.split(/\s+/, 1)[0] || "d3"
}

export function d3StackedInput(startupInput: string | undefined, command: string): string {
  const parts = [startupInput ?? "", command, "OFF"]
    .join("\r")
    .replace(/\r?\n/g, "\r")
    .replace(/\r{2,}/g, "\r")
  const normalized = parts.endsWith("\r") ? parts : `${parts}\r`
  return normalized.replace(/\r/g, "\\r")
}

function commandTimeoutLabel(command: string, args: string[]): string {
  if (command === "expect" && args[0] === "-c") return "SSH D3 session"
  if (command === "ssh") return `ssh ${args.slice(-1)[0] ?? ""}`.trim()
  return [command, ...args].join(" ").slice(0, 120)
}

function runProcess(command: string, args: string[], input: string | undefined, timeoutMs: number | undefined, options: D3RunOptions = {}, env?: NodeJS.ProcessEnv): Promise<D3CommandResult> {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"], env })
    let stdout = ""
    let stderr = ""
    let settled = false
    const finishReject = (error: Error) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      options.signal?.removeEventListener("abort", onAbort)
      reject(error)
    }
    const finishResolve = (result: D3CommandResult) => {
      if (settled) return
      settled = true
      if (timer) clearTimeout(timer)
      options.signal?.removeEventListener("abort", onAbort)
      resolve(result)
    }
    const onAbort = () => {
      child.kill("SIGTERM")
      finishReject(interruptedError())
    }
    const timer = timeoutEnabled(timeoutMs) ? setTimeout(() => {
      child.kill("SIGTERM")
      finishReject(new Error(`Command timed out after ${timeoutMs}ms: ${commandTimeoutLabel(command, args)}`))
    }, timeoutMs) : undefined
    if (options.signal?.aborted) {
      onAbort()
      return
    }
    options.signal?.addEventListener("abort", onAbort, { once: true })

    child.stdout.on("data", (chunk) => {
      const text = chunk.toString()
      stdout += text
      options.onStdout?.(text)
    })
    child.stderr.on("data", (chunk) => {
      const text = chunk.toString()
      stderr += text
      options.onStderr?.(text)
    })
    child.on("error", (error) => {
      finishReject(error)
    })
    child.on("close", (exitCode) => {
      finishResolve({ command: [command, ...args].join(" "), stdout, stderr, exitCode, durationMs: Date.now() - started })
    })
    if (input) child.stdin.write(input)
    child.stdin.end()
  })
}

export class LocalD3Session implements D3Session {
  constructor(readonly profile: ConnectionProfile) {}

  async run(command: string, timeoutMs = 30_000, options: D3RunOptions = {}): Promise<D3CommandResult> {
    const entry = this.profile.entryCommand ?? "sh"
    if (isD3EntryCommand(entry)) return runProcess(d3Executable(entry), ["-d", d3StackedInput(this.profile.startupInput, command)], undefined, timeoutMs, options)
    if (entry === "sh") return runProcess("sh", ["-lc", command], undefined, timeoutMs, options)
    return runProcess("sh", ["-lc", `${entry} <<'D3CODE_EOF'\n${this.profile.startupInput ?? ""}${command}\nD3CODE_EOF`], undefined, timeoutMs, options)
  }

  async close(): Promise<void> {}
}

export class PersistentLocalD3Session implements D3Session {
  private child?: ChildProcessWithoutNullStreams
  private stdout = ""
  private stderr = ""
  private sequence = 0
  private startupSent = false
  private closedError?: Error

  constructor(readonly profile: ConnectionProfile) {}

  private start(): void {
    if (this.child) return
    this.closedError = undefined
    const entry = this.profile.entryCommand
    this.child = entry
      ? spawn("sh", ["-lc", entry], { stdio: ["pipe", "pipe", "pipe"] })
      : spawn("sh", [], { stdio: ["pipe", "pipe", "pipe"] })
    this.child.stdout.on("data", (chunk) => {
      this.stdout += chunk.toString()
    })
    this.child.stderr.on("data", (chunk) => {
      this.stderr += chunk.toString()
    })
    this.child.on("error", (error) => {
      this.closedError = error
    })
    this.child.on("close", (code, signal) => {
      this.closedError = new Error(`Persistent D3 session exited before the prompt was seen: code=${code ?? "null"} signal=${signal ?? "null"}`)
    })
    if (this.profile.startupInput && !this.startupSent) {
      this.child.stdin.write(this.profile.startupInput)
      this.startupSent = true
    }
  }

  async run(command: string, timeoutMs = 30_000, options: D3RunOptions = {}): Promise<D3CommandResult> {
    this.start()
    const started = Date.now()
    if (!this.child) throw new Error("Persistent D3 session did not start")
    const promptPattern = this.profile.promptPattern ? new RegExp(normalizeD3PromptPattern(this.profile.promptPattern) ?? this.profile.promptPattern) : undefined
    if (promptPattern && !promptPattern.test(normalizePromptOutput(this.stdout))) await absorbStartupPrompt(() => {
      if (this.closedError) throw this.closedError
      return promptPattern.test(normalizePromptOutput(this.stdout))
    }, timeoutEnabled(timeoutMs) ? Math.min(timeoutMs, 2_000) : 2_000)
    const stdoutStart = this.stdout.length
    const stderrStart = this.stderr.length
    let streamedStdout = 0
    let streamedStderr = 0
    const marker = `__D3CODE_DONE_${Date.now().toString(36)}_${this.sequence++}__`
    const d3Command = command.replace(/\r?\n/g, "\r")
    const payload = promptPattern ? `${d3Command}\r` : `${command}\nprintf '\\n${marker}:%s\\n' "$?"\n`
    this.child.stdin.write(payload)

    const wait = promptPattern
      ? () => {
        if (this.closedError) throw this.closedError
        const output = this.stdout.slice(stdoutStart)
        const stderr = this.stderr.slice(stderrStart)
        streamedStdout = streamDelta(output, streamedStdout, options.onStdout)
        streamedStderr = streamDelta(stderr, streamedStderr, options.onStderr)
        return promptPattern.test(normalizePromptOutput(output))
      }
      : () => {
        if (this.closedError) throw this.closedError
        const output = this.stdout.slice(stdoutStart)
        const stderr = this.stderr.slice(stderrStart)
        streamedStdout = streamDelta(output.replace(new RegExp(`\\n?${marker}:\\d+\\n?`), ""), streamedStdout, options.onStdout)
        streamedStderr = streamDelta(stderr, streamedStderr, options.onStderr)
        return output.includes(marker)
      }
    await waitFor(wait, timeoutMs, `Command timed out after ${timeoutMs}ms: ${command}`, options.signal)

    const stdout = this.stdout.slice(stdoutStart)
    const stderr = this.stderr.slice(stderrStart)
    const exitMatch = stdout.match(new RegExp(`\\n?${marker}:(\\d+)`))
    return {
      command,
      stdout: promptPattern ? stripPrompt(stdout, promptPattern) : stdout.replace(new RegExp(`\\n?${marker}:\\d+\\n?`), "").trim(),
      stderr,
      exitCode: exitMatch ? Number(exitMatch[1]) : null,
      durationMs: Date.now() - started,
    }
  }

  async close(): Promise<void> {
    if (!this.child) return
    this.child.stdin.end()
    this.child.kill("SIGTERM")
    this.child = undefined
  }
}

async function absorbStartupPrompt(predicate: () => boolean, timeoutMs = 150): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (predicate()) return
    await delay(10)
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function normalizePromptOutput(output: string): string {
  return output.replace(/\0/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n")
}

function waitFor(predicate: () => boolean, timeoutMs: number | undefined, timeoutMessage: string, signal?: AbortSignal): Promise<void> {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      clearInterval(timer)
      signal?.removeEventListener("abort", onAbort)
      callback()
    }
    const onAbort = () => finish(() => reject(interruptedError()))
    const timer = setInterval(() => {
      try {
        if (predicate()) {
          finish(resolve)
          return
        }
      } catch (error) {
        finish(() => reject(error))
        return
      }
      if (timeoutEnabled(timeoutMs) && Date.now() - started > timeoutMs) {
        finish(() => reject(new Error(timeoutMessage)))
      }
    }, 10)
    if (signal?.aborted) onAbort()
    else signal?.addEventListener("abort", onAbort, { once: true })
  })
}

function stripPrompt(output: string, promptPattern: RegExp): string {
  return normalizePromptOutput(output)
    .split(/\r?\n/)
    .filter((line) => !promptPattern.test(line))
    .join("\n")
    .trim()
}

function withSshLoginDefaults(profile: ConnectionProfile): ConnectionProfile {
  if (profile.type !== "ssh") return profile
  const login = (profile.account || "DM").trim().toLowerCase() || "dm"
  return {
    ...profile,
    startupInput: profile.startupInput?.trim() ? profile.startupInput : `${login}\n${login}\n`,
    promptPattern: profile.promptPattern ?? D3_TCL_PROMPT_PATTERN,
    entryCommand: profile.entryCommand ?? "d3",
    sessionMode: profile.sessionMode ?? "persistent",
  }
}

export class SshD3Session implements D3Session {
  readonly profile: ConnectionProfile

  constructor(profile: ConnectionProfile) {
    if (!profile.host || !profile.username) throw new Error("SSH profiles require host and username")
    this.profile = withSshLoginDefaults(profile)
  }

  async run(command: string, timeoutMs = 30_000, options: D3RunOptions = {}): Promise<D3CommandResult> {
    const target = `${this.profile.username}@${this.profile.host}`
    const port = String(this.profile.port ?? 22)
    if (this.profile.entryCommand || this.profile.startupInput || this.profile.promptPattern) {
      return runProcess("expect", ["-c", sshExpectScript()], undefined, timeoutMs, options, {
        ...process.env,
        D3CODE_TARGET: target,
        D3CODE_PORT: port,
        D3CODE_ENTRY: this.profile.entryCommand ?? "",
        D3CODE_STARTUP: normalizeStartupInput(this.profile.startupInput),
        D3CODE_COMMAND: command,
        D3CODE_TIMEOUT: String(expectTimeoutSeconds(timeoutMs)),
      })
    }
    return runProcess("ssh", ["-p", port, target, command], undefined, timeoutMs, options)
  }

  async close(): Promise<void> {}
}

export function normalizeStartupInput(startupInput?: string): string {
  if (!startupInput) return ""
  return startupInput.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim()
}

function expectTimeoutSeconds(timeoutMs?: number): number {
  if (typeof timeoutMs === "number" && timeoutMs > 0) return Math.max(5, Math.ceil(timeoutMs / 1000))
  return 120
}

function sshExpectScript(): string {
  return [
    "set timeout $env(D3CODE_TIMEOUT)",
    "set target $env(D3CODE_TARGET)",
    "set port $env(D3CODE_PORT)",
    "set entry $env(D3CODE_ENTRY)",
    "if {$entry eq \"\"} {",
    "  spawn ssh -tt -p $port $target",
    "} else {",
    "  spawn ssh -tt -p $port $target $entry",
    "}",
    "set loginPrompt {Enter your user id:|user password:|master dictionary:|Choose dictionary}",
    "set readyPrompt {(?n)(^|\\n):\\s*$}",
    "foreach line [split $env(D3CODE_STARTUP) \"\\n\"] {",
    "  if {$line eq \"\"} { continue }",
    "  expect {",
    "    -re $loginPrompt {}",
    "    -re $readyPrompt { break }",
    "    timeout {",
    "      puts \"Timed out waiting for D3 login prompt during startup input.\"",
    "      exit 2",
    "    }",
    "  }",
    "  if {[regexp $readyPrompt $expect_out(buffer)]} { break }",
    "  send -- \"$line\\r\"",
    "}",
    "expect {",
    "  -re $readyPrompt {}",
    "  -re $loginPrompt {",
    "    puts \"D3 login is incomplete. Set profile startup input with user id and master dictionary or password on separate lines.\"",
    "    exit 3",
    "  }",
    "  timeout {",
    "    puts \"Timed out waiting for the D3 TCL prompt after startup input.\"",
    "    exit 4",
    "  }",
    "}",
    "foreach line [split $env(D3CODE_COMMAND) \"\\n\"] {",
    "  if {$line eq \"\"} { continue }",
    "  send -- \"$line\\r\"",
    "  expect {",
    "    -re $readyPrompt {}",
    "    timeout {",
    "      puts \"Timed out waiting for the D3 TCL prompt after command.\"",
    "      exit 5",
    "    }",
    "  }",
    "}",
    "send -- \"OFF\\r\"",
    "expect eof",
    "close",
    "wait",
  ].join("\n")
}

function streamDelta(output: string, streamed: number, callback?: (chunk: string) => void): number {
  if (!callback || output.length <= streamed) return streamed
  callback(output.slice(streamed))
  return output.length
}

export function createD3Session(profile: ConnectionProfile): D3Session {
  if (profile.type === "ssh") return new SshD3Session(profile)
  if (profile.sessionMode === "persistent") return new PersistentLocalD3Session(profile)
  if (isD3EntryCommand(profile.entryCommand)) return new LocalD3Session(profile)
  return new LocalD3Session(profile)
}
