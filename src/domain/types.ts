export type SafetyMode = "ask" | "plan" | "trust"

export type ProfileType = "local" | "ssh"

export interface ConnectionProfile {
  name: string
  type: ProfileType
  host?: string
  port?: number
  username?: string
  account?: string
  entryCommand?: string
  promptPattern?: string
  sessionMode?: "oneshot" | "persistent"
  safetyDefault?: SafetyMode
  allowedAccounts?: string[]
  passwordSecretRef?: string
  sshKeySecretRef?: string
  d3PasswordSecretRef?: string
}

export interface D3CommandResult {
  command: string
  stdout: string
  stderr: string
  exitCode: number | null
  durationMs: number
}

export interface D3RunOptions {
  onStdout?: (chunk: string) => void
  onStderr?: (chunk: string) => void
}

export interface D3Session {
  profile: ConnectionProfile
  run(command: string, timeoutMs?: number, options?: D3RunOptions): Promise<D3CommandResult>
  close(): Promise<void>
}

export interface ToolContext {
  safety: SafetyMode
  session?: D3Session
  profile?: ConnectionProfile
}

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string
  description: string
  mutates: boolean
  execute(input: TInput, context: ToolContext): Promise<TOutput>
}
