import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { ProfileDoctorReport } from "./profile-doctor.js"
import type { D3TerminalCapture } from "./terminal-capture.js"
import type { D3ScreenBuffer } from "./screen-buffer.js"

export interface LiveProofArtifactCheck {
  id: "manifest" | "profile-doctor" | "terminal-capture" | "screen-buffer" | "operator-notes" | "compile-catalog" | "rollback"
  status: "ok" | "missing" | "failed"
  evidence: string[]
}

export interface LiveProofArtifactReport {
  ready: boolean
  dir: string
  checks: LiveProofArtifactCheck[]
}

export interface LiveProofScaffoldResult {
  dir: string
  written: string[]
}

export interface LiveProofManifest {
  profile: string
  account: string
  screenCommand: string
  basicFile: string
  basicItem: string
  requiredArtifacts: string[]
  safety: {
    terminalSends: "blocked-until-D3CODE_TERMINAL_ENABLED"
    mutations: "blocked-until-D3CODE_ALLOW_WRITES"
    transcriptRecording: "redacted-unless-D3CODE_TERMINAL_RECORD_TRANSCRIPT"
  }
}

async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8")
  } catch {
    return undefined
  }
}

function check(values: LiveProofArtifactCheck): LiveProofArtifactCheck {
  return values
}

function mentions(text: string | undefined, patterns: RegExp[]): boolean {
  return Boolean(text && patterns.every((pattern) => pattern.test(text)))
}

function parseJson<T>(text: string | undefined): T | undefined {
  if (!text) return undefined
  try {
    return JSON.parse(text) as T
  } catch {
    return undefined
  }
}

export async function checkLiveProofArtifacts(dir: string): Promise<LiveProofArtifactReport> {
  const manifestText = await readOptional(join(dir, "live-proof-manifest.json"))
  const manifest = parseJson<LiveProofManifest>(manifestText)
  const profileDoctorText = await readOptional(join(dir, "profile-doctor.json"))
  const profileDoctor = parseJson<ProfileDoctorReport>(profileDoctorText)
  const terminalCaptureText = await readOptional(join(dir, "terminal-capture.json"))
  const terminalCapture = parseJson<D3TerminalCapture>(terminalCaptureText)
  const screenBufferText = await readOptional(join(dir, "screen-buffer.json"))
  const screenBuffer = parseJson<D3ScreenBuffer>(screenBufferText)
  const transcript = await readOptional(join(dir, "terminal-transcript.txt"))
  const notes = await readOptional(join(dir, "operator-notes.md")) ?? await readOptional(join(dir, "operator-notes.txt"))
  const compileCatalog = await readOptional(join(dir, "compile-catalog-transcript.txt")) ?? await readOptional(join(dir, "compile-catalog.md"))
  const rollback = await readOptional(join(dir, "rollback.md")) ?? await readOptional(join(dir, "rollback.txt")) ?? await readOptional(join(dir, "rollback.json"))
  const manifestArtifacts = ["profile-doctor.json", "terminal-capture.json", "screen-buffer.json", "operator-notes.md", "compile-catalog-transcript.txt", "rollback.md"]
  const manifestMatches = Boolean(
    manifest
      && manifest.profile
      && manifest.account
      && manifest.screenCommand
      && manifest.basicFile
      && manifest.basicItem
      && manifestArtifacts.every((artifact) => manifest.requiredArtifacts?.includes(artifact))
      && (!profileDoctor?.profile || profileDoctor.profile === manifest.profile)
      && (!profileDoctor?.account || profileDoctor.account === manifest.account)
      && (!terminalCapture?.profile || terminalCapture.profile === manifest.profile)
      && (!terminalCapture?.account || terminalCapture.account === manifest.account)
      && (!terminalCapture?.command || terminalCapture.command === manifest.screenCommand)
  )

  const checks = [
    check({
      id: "manifest",
      status: manifestMatches ? "ok" : manifestText ? "failed" : "missing",
      evidence: manifest
        ? [`profile:${manifest.profile}`, `account:${manifest.account}`, `screen:${manifest.screenCommand}`, `basic:${manifest.basicFile} ${manifest.basicItem}`, `artifacts:${manifest.requiredArtifacts?.join(",") ?? "missing"}`]
        : [manifestText ? "live-proof-manifest.json is not valid JSON or does not match collected artifacts" : "missing live-proof-manifest.json"],
    }),
    check({
      id: "profile-doctor",
      status: profileDoctor?.ready && profileDoctor.checks.every((item) => item.ok) ? "ok" : profileDoctorText ? "failed" : "missing",
      evidence: profileDoctor
        ? [`profile:${profileDoctor.profile}`, `account:${profileDoctor.account ?? "unknown"}`, `checks:${profileDoctor.checks.map((item) => `${item.name}:${item.ok ? "ok" : "fail"}`).join(",")}`]
        : [profileDoctorText ? "profile-doctor.json is not valid JSON or is incomplete" : "missing profile-doctor.json"],
    }),
    check({
      id: "terminal-capture",
      status: terminalCapture && (terminalCapture.result.stdout.length > 0 || (transcript?.length ?? 0) > 0) ? "ok" : terminalCaptureText ? "failed" : "missing",
      evidence: terminalCapture
        ? [`profile:${terminalCapture.profile}`, `command:${terminalCapture.command}`, `risk:${terminalCapture.risk}`, `stdout:${terminalCapture.result.stdout.length}`]
        : [terminalCaptureText ? "terminal-capture.json is not valid JSON or has no transcript" : "missing terminal-capture.json"],
    }),
    check({
      id: "screen-buffer",
      status: screenBuffer && screenBuffer.events.length > 0 && screenBuffer.lines.some((line) => line.trim()) ? "ok" : screenBufferText ? "failed" : "missing",
      evidence: screenBuffer
        ? [`size:${screenBuffer.width}x${screenBuffer.height}`, `events:${screenBuffer.events.length}`, `visible-lines:${screenBuffer.lines.filter((line) => line.trim()).length}`]
        : [screenBufferText ? "screen-buffer.json is not valid JSON or has no visible screen events" : "missing screen-buffer.json"],
    }),
    check({
      id: "operator-notes",
      status: mentions(notes, [/operator|user|admin/i, /approved|verified|parity|accepted/i]) ? "ok" : notes ? "failed" : "missing",
      evidence: notes ? [`bytes:${notes.length}`] : ["missing operator-notes.md"],
    }),
    check({
      id: "compile-catalog",
      status: mentions(compileCatalog, [/\b(BASIC|COMPILE)\b/i, /\bCATALOG\b/i, /\b(OK|SUCCESS|NO ERRORS|CATALOGED|CATALOGUED)\b/i]) ? "ok" : compileCatalog ? "failed" : "missing",
      evidence: compileCatalog ? [`bytes:${compileCatalog.length}`] : ["missing compile-catalog-transcript.txt"],
    }),
    check({
      id: "rollback",
      status: mentions(rollback, [/rollback|restore|revert/i, /before|backup|saved|disposable/i]) ? "ok" : rollback ? "failed" : "missing",
      evidence: rollback ? [`bytes:${rollback.length}`] : ["missing rollback.md"],
    }),
  ]

  return {
    ready: checks.every((item) => item.status === "ok"),
    dir,
    checks,
  }
}

export function renderLiveProofArtifactReport(report: LiveProofArtifactReport): string {
  return [
    "# D3 Live Proof Artifact Check",
    "",
    `Ready: ${report.ready ? "yes" : "no"}`,
    `Directory: ${report.dir}`,
    "",
    ...report.checks.map((item) => `- [${item.status}] ${item.id}: ${item.evidence.join("; ")}`),
    "",
  ].join("\n")
}

export async function writeLiveProofScaffold(dir: string, options: { profile?: string; account?: string; screenCommand?: string; basicFile?: string; basicItem?: string } = {}): Promise<LiveProofScaffoldResult> {
  await mkdir(dir, { recursive: true })
  const profile = options.profile ?? "<profile>"
  const account = options.account ?? "<account>"
  const screenCommand = options.screenCommand ?? "<screen command or menu entry>"
  const basicFile = options.basicFile ?? "<file>"
  const basicItem = options.basicItem ?? "<item>"
  const written: string[] = []

  async function put(name: string, content: string): Promise<void> {
    const path = join(dir, name)
    await writeFile(path, content)
    written.push(path)
  }

  await put("README.md", [
    "# D3 Live Proof Folder",
    "",
    "Collect these files from a real Rocket D3 account before claiming live D3 readiness.",
    "",
    "Required files:",
    "- `live-proof-manifest.json`: pinned profile/account/screen/disposable item declaration for this proof folder.",
    "- `profile-doctor.json`: `d3code profile-doctor --profile <profile> --json > live-proof/profile-doctor.json`",
    `- terminal capture: \`d3code terminal-capture --profile ${profile} --out live-proof '${screenCommand}'\``,
    "- `operator-notes.md`: D3 operator approval of terminal/screen parity.",
    "- `compile-catalog-transcript.txt`: disposable BASIC compile/catalog transcript.",
    "- `rollback.md`: exact restore/revert instructions for changed disposable items.",
    "",
    "Verify:",
    "- `d3code live-proof-check live-proof`",
    "- `d3code product-audit --live-proof-dir live-proof --allow-incomplete`",
    "",
  ].join("\n"))

  await put("live-proof-manifest.json", `${JSON.stringify({
    profile,
    account,
    screenCommand,
    basicFile,
    basicItem,
    requiredArtifacts: [
      "profile-doctor.json",
      "terminal-capture.json",
      "screen-buffer.json",
      "operator-notes.md",
      "compile-catalog-transcript.txt",
      "rollback.md",
    ],
    safety: {
      terminalSends: "blocked-until-D3CODE_TERMINAL_ENABLED",
      mutations: "blocked-until-D3CODE_ALLOW_WRITES",
      transcriptRecording: "redacted-unless-D3CODE_TERMINAL_RECORD_TRANSCRIPT",
    },
  }, null, 2)}\n`)

  await put("profile-doctor.json", `${JSON.stringify({
    profile,
    type: "local",
    account,
    sessionMode: "persistent",
    ready: false,
    checks: [
      { name: "who", command: "WHO", ok: false, exitCode: null, durationMs: 0, output: "" },
      { name: "version", command: "VERSION", ok: false, exitCode: null, durationMs: 0, output: "" },
      { name: "md-list", command: "LIST MD (N", ok: false, exitCode: null, durationMs: 0, output: "" },
    ],
  }, null, 2)}\n`)
  await put("operator-notes.md", [
    "# Operator Notes",
    "",
    `Profile: ${profile}`,
    `Account: ${account}`,
    "",
    "Record the D3 operator name, date, emulator/terminal type, and whether the captured screen flow was approved.",
    "",
    "- Operator:",
    "- Emulator/terminal:",
    "- Approved/verified parity:",
    "- Notes:",
    "",
  ].join("\n"))
  await put("compile-catalog-transcript.txt", [
    `BASIC ${basicFile} ${basicItem}`,
    "<paste BASIC/COMPILE output here>",
    `CATALOG ${basicFile} ${basicItem}`,
    "<paste CATALOG output here>",
    "",
  ].join("\n"))
  await put("rollback.md", [
    "# Rollback Proof",
    "",
    `Disposable item: ${basicFile} ${basicItem}`,
    "",
    "Document the before backup, restore command, and operator verification.",
    "",
    "- Before backup:",
    "- Rollback/restore command:",
    "- Verification:",
    "",
  ].join("\n"))

  return { dir, written }
}

export function renderLiveProofScaffold(result: LiveProofScaffoldResult): string {
  return [
    "# D3 Live Proof Scaffold",
    "",
    `Directory: ${result.dir}`,
    "",
    "Written:",
    ...result.written.map((file) => `- ${file}`),
    "",
    "Next:",
    "- run profile-doctor and terminal-capture against the real D3 profile",
    "- fill operator notes, compile/catalog transcript, and rollback proof",
    "- run `d3code live-proof-check <dir>`",
  ].join("\n")
}
