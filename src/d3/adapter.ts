import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process"
import type { ConnectionProfile, D3CommandResult, D3Session } from "../domain/types.js"

function runProcess(command: string, args: string[], input: string | undefined, timeoutMs: number): Promise<D3CommandResult> {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["pipe", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""
    const timer = setTimeout(() => {
      child.kill("SIGTERM")
      reject(new Error(`Command timed out after ${timeoutMs}ms: ${command} ${args.join(" ")}`))
    }, timeoutMs)

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString()
    })
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    child.on("error", (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on("close", (exitCode) => {
      clearTimeout(timer)
      resolve({ command: [command, ...args].join(" "), stdout, stderr, exitCode, durationMs: Date.now() - started })
    })
    if (input) child.stdin.write(input)
    child.stdin.end()
  })
}

export class LocalD3Session implements D3Session {
  constructor(readonly profile: ConnectionProfile) {}

  async run(command: string, timeoutMs = 30_000): Promise<D3CommandResult> {
    const entry = this.profile.entryCommand ?? "sh"
    if (entry === "sh") return runProcess("sh", ["-lc", command], undefined, timeoutMs)
    return runProcess("sh", ["-lc", `${entry} <<'D3CODE_EOF'\n${command}\nD3CODE_EOF`], undefined, timeoutMs)
  }

  async close(): Promise<void> {}
}

export class PersistentLocalD3Session implements D3Session {
  private child?: ChildProcessWithoutNullStreams
  private stdout = ""
  private stderr = ""
  private sequence = 0

  constructor(readonly profile: ConnectionProfile) {}

  private start(): void {
    if (this.child) return
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
  }

  async run(command: string, timeoutMs = 30_000): Promise<D3CommandResult> {
    this.start()
    const started = Date.now()
    if (!this.child) throw new Error("Persistent D3 session did not start")
    const stdoutStart = this.stdout.length
    const stderrStart = this.stderr.length
    const promptPattern = this.profile.promptPattern ? new RegExp(this.profile.promptPattern) : undefined
    const marker = `__D3CODE_DONE_${Date.now().toString(36)}_${this.sequence++}__`
    const payload = promptPattern ? `${command}\n` : `${command}\nprintf '\\n${marker}:%s\\n' "$?"\n`
    this.child.stdin.write(payload)

    const wait = promptPattern
      ? () => promptPattern.test(this.stdout.slice(stdoutStart))
      : () => this.stdout.slice(stdoutStart).includes(marker)
    await waitFor(wait, timeoutMs, `Command timed out after ${timeoutMs}ms: ${command}`)

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

function waitFor(predicate: () => boolean, timeoutMs: number, timeoutMessage: string): Promise<void> {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      if (predicate()) {
        clearInterval(timer)
        resolve()
        return
      }
      if (Date.now() - started > timeoutMs) {
        clearInterval(timer)
        reject(new Error(timeoutMessage))
      }
    }, 10)
  })
}

function stripPrompt(output: string, promptPattern: RegExp): string {
  return output
    .split(/\r?\n/)
    .filter((line) => !promptPattern.test(line))
    .join("\n")
    .trim()
}

export class SshD3Session implements D3Session {
  constructor(readonly profile: ConnectionProfile) {
    if (!profile.host || !profile.username) throw new Error("SSH profiles require host and username")
  }

  async run(command: string, timeoutMs = 30_000): Promise<D3CommandResult> {
    const target = `${this.profile.username}@${this.profile.host}`
    const port = this.profile.port ? ["-p", String(this.profile.port)] : []
    const remote = this.profile.entryCommand
      ? `${this.profile.entryCommand} <<'D3CODE_EOF'\n${command}\nD3CODE_EOF`
      : command
    return runProcess("ssh", [...port, target, remote], undefined, timeoutMs)
  }

  async close(): Promise<void> {}
}

export function createD3Session(profile: ConnectionProfile): D3Session {
  if (profile.type === "ssh") return new SshD3Session(profile)
  if (profile.sessionMode === "persistent") return new PersistentLocalD3Session(profile)
  return new LocalD3Session(profile)
}
