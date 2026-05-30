import { createD3Session } from "./adapter.js"
import type { ConnectionProfile } from "../domain/types.js"
import { compactText } from "../tools/compact.js"

export interface ProfileDoctorCheck {
  name: string
  command: string
  ok: boolean
  exitCode: number | null
  durationMs: number
  output: string
  error?: string
}

export interface ProfileDoctorReport {
  profile: string
  type: ConnectionProfile["type"]
  account?: string
  sessionMode: "oneshot" | "persistent"
  ready: boolean
  checks: ProfileDoctorCheck[]
}

const checks = [
  { name: "who", command: "WHO" },
  { name: "version", command: "VERSION" },
  { name: "md-list", command: "LIST MD (N" },
]

export async function diagnoseProfile(profile: ConnectionProfile, timeoutMs = 10_000): Promise<ProfileDoctorReport> {
  const session = createD3Session(profile)
  const results: ProfileDoctorCheck[] = []
  try {
    for (const check of checks) {
      try {
        const result = await session.run(check.command, timeoutMs)
        const output = compactText(result.stdout || result.stderr || "", { maxLines: 20, maxChars: 2_000 })
        results.push({
          name: check.name,
          command: check.command,
          ok: result.exitCode === 0 || result.exitCode === null ? output.trim().length > 0 : false,
          exitCode: result.exitCode,
          durationMs: result.durationMs,
          output,
        })
      } catch (error) {
        results.push({
          name: check.name,
          command: check.command,
          ok: false,
          exitCode: null,
          durationMs: 0,
          output: "",
          error: (error as Error).message,
        })
      }
    }
  } finally {
    await session.close()
  }
  return {
    profile: profile.name,
    type: profile.type,
    account: profile.account,
    sessionMode: profile.sessionMode ?? "oneshot",
    ready: results.every((result) => result.ok),
    checks: results,
  }
}

export function renderProfileDoctor(report: ProfileDoctorReport): string {
  return [
    `# D3 Profile Doctor: ${report.profile}`,
    "",
    `Type: ${report.type}`,
    `Account: ${report.account ?? "unknown"}`,
    `Session: ${report.sessionMode}`,
    `Ready: ${report.ready ? "yes" : "no"}`,
    "",
    "## Checks",
    ...report.checks.flatMap((check) => [
      `- [${check.ok ? "ok" : "fail"}] ${check.name}: \`${check.command}\` exit=${check.exitCode ?? "unknown"} durationMs=${check.durationMs}`,
      ...(check.error ? [`  error: ${check.error}`] : []),
      ...(check.output ? [`  output: ${check.output.replace(/\r?\n/g, " | ")}`] : []),
    ]),
    "",
  ].join("\n")
}
