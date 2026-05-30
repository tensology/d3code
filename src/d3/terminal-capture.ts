import { mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { classifyD3Command, type D3CommandRisk } from "../core/permissions.js"
import type { D3CommandResult, D3Session } from "../domain/types.js"
import { parseD3ScreenTranscript, renderD3ScreenBuffer, type D3ScreenBuffer } from "./screen-buffer.js"

export interface D3TerminalCapture {
  profile: string
  account?: string
  command: string
  risk: D3CommandRisk
  result: D3CommandResult
  screen: D3ScreenBuffer
}

export interface D3TerminalCaptureWriteResult {
  written: string[]
}

export async function captureD3Terminal(
  session: D3Session,
  command: string,
  options: { width?: number; height?: number; timeoutMs?: number; onStdout?: (chunk: string) => void; onStderr?: (chunk: string) => void } = {},
): Promise<D3TerminalCapture> {
  const result = await session.run(command, options.timeoutMs, { onStdout: options.onStdout, onStderr: options.onStderr })
  return {
    profile: session.profile.name,
    account: session.profile.account,
    command,
    risk: classifyD3Command(command),
    result,
    screen: parseD3ScreenTranscript(result.stdout, { width: options.width, height: options.height }),
  }
}

export async function writeD3TerminalCapture(outDir: string, capture: D3TerminalCapture): Promise<D3TerminalCaptureWriteResult> {
  await mkdir(outDir, { recursive: true })
  const written: string[] = []

  const transcriptPath = join(outDir, "terminal-transcript.txt")
  await writeFile(transcriptPath, capture.result.stdout)
  written.push(transcriptPath)

  if (capture.result.stderr) {
    const stderrPath = join(outDir, "terminal-stderr.txt")
    await writeFile(stderrPath, capture.result.stderr)
    written.push(stderrPath)
  }

  const screenJsonPath = join(outDir, "screen-buffer.json")
  await writeFile(screenJsonPath, `${JSON.stringify(capture.screen, null, 2)}\n`)
  written.push(screenJsonPath)

  const screenMarkdownPath = join(outDir, "screen-buffer.md")
  await writeFile(screenMarkdownPath, renderD3ScreenBuffer(capture.screen))
  written.push(screenMarkdownPath)

  const captureJsonPath = join(outDir, "terminal-capture.json")
  await writeFile(captureJsonPath, `${JSON.stringify(capture, null, 2)}\n`)
  written.push(captureJsonPath)

  const captureMarkdownPath = join(outDir, "terminal-capture.md")
  await writeFile(captureMarkdownPath, renderD3TerminalCapture(capture, written))
  written.push(captureMarkdownPath)

  return { written }
}

export function renderD3TerminalCapture(capture: D3TerminalCapture, written: string[] = []): string {
  const visibleLines = capture.screen.lines.filter((line) => line.trim().length > 0)
  return [
    "# D3 Terminal Capture",
    "",
    `Profile: ${capture.profile}`,
    `Account: ${capture.account ?? "unknown"}`,
    `Command: ${capture.command}`,
    `Risk: ${capture.risk}`,
    `Exit: ${capture.result.exitCode ?? "unknown"}`,
    `Duration: ${capture.result.durationMs}ms`,
    `Transcript bytes: ${capture.result.stdout.length}`,
    `Screen events: ${capture.screen.events.length}`,
    `Visible lines: ${visibleLines.length}`,
    "",
    "Screen:",
    ...capture.screen.lines.map((line) => `|${line.padEnd(capture.screen.width, " ")}|`),
    ...(written.length ? ["", "Artifacts:", ...written.map((file) => `- ${file}`)] : []),
  ].join("\n")
}
