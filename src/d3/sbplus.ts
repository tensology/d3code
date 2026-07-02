import type { D3CommandResult, D3Session } from "../domain/types.js"
import { parseFileListing, type D3EstateFile } from "./estate.js"

export interface SbplusDiscovery {
  profile: string
  account?: string
  detected: boolean
  files: D3EstateFile[]
  systems: string[]
  processFiles: D3EstateFile[]
  screenFiles: D3EstateFile[]
  menuFiles: D3EstateFile[]
  driverFiles: D3EstateFile[]
  nextSteps: string[]
  compact: string
}

function outputOf(result: D3CommandResult): string {
  return (result.stdout || result.stderr || "").replace(/\0/g, "").trim()
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right))
}

function hasAny(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value))
}

function detailOf(file: D3EstateFile): string {
  return `${file.name} ${file.detail ?? ""}`.toLowerCase()
}

function likelySystems(files: D3EstateFile[]): string[] {
  const prefixes = files
    .map((file) => file.name.match(/^([A-Z0-9]{2,8})[._-](?:PROC|PROCESS|SCR|SCREEN|MENU|MNU|DRV|DRIVER)/i)?.[1]?.toUpperCase() ?? "")
    .filter(Boolean)
  return unique(prefixes)
}

export function createSbplusDiscovery(profile: string, account: string | undefined, files: D3EstateFile[]): SbplusDiscovery {
  const processFiles = files.filter((file) => hasAny(detailOf(file), [/\bprocess\b/, /\bproc\b/, /\bpd\b/, /\binput\b/, /\boutput\b/]) || /(^|[._-])(PROC|PROCESS|PD)([._-]|$)/i.test(file.name))
  const screenFiles = files.filter((file) => hasAny(detailOf(file), [/\bscreen\b/, /\bfield\b/, /\bprompt\b/, /\bdefinition\b/]) || /(^|[._-])(SCR|SCREEN|SD|FIELD|PROMPT)([._-]|$)/i.test(file.name))
  const menuFiles = files.filter((file) => hasAny(detailOf(file), [/\bmenu\b/]) || /(^|[._-])(MENU|MNU)([._-]|$)/i.test(file.name))
  const driverFiles = files.filter((file) => hasAny(detailOf(file), [/\bdriver\b/]) || /(^|[._-])(DRV|DRIVER)([._-]|$)/i.test(file.name))
  const detected = processFiles.length + screenFiles.length + menuFiles.length + driverFiles.length > 0
  const systems = likelySystems([...processFiles, ...screenFiles, ...menuFiles, ...driverFiles])
  const nextSteps = [
    "Confirm the SB+ system and naming convention with the operator or account owner.",
    "Read the likely screen/process/menu definition items before writing any SB+ records.",
    "Use d3_sbplus_plan for an input/output/menu process plan, then execute through SB+ maintenance screens or account-specific write tools.",
    "Run the process once after changes so SB+ can build or refresh drivers, then capture terminal/screen proof.",
  ]
  const compact = renderSbplusDiscovery({ profile, account, detected, files, systems, processFiles, screenFiles, menuFiles, driverFiles, nextSteps })
  return { profile, account, detected, files, systems, processFiles, screenFiles, menuFiles, driverFiles, nextSteps, compact }
}

export function renderSbplusDiscovery(discovery: Omit<SbplusDiscovery, "compact">): string {
  const lines = [
    `SB+ Discovery: ${discovery.profile}${discovery.account ? ` / ${discovery.account}` : ""}`,
    `Detected: ${discovery.detected ? "yes" : "not yet"}`,
    discovery.systems.length ? `Likely systems: ${discovery.systems.join(", ")}` : "Likely systems: none inferred",
    "",
    "Likely definition files:",
    ...[
      ["process", discovery.processFiles],
      ["screen", discovery.screenFiles],
      ["menu", discovery.menuFiles],
      ["driver", discovery.driverFiles],
    ].flatMap(([label, files]) => [
      `- ${label}: ${Array.isArray(files) && files.length ? files.slice(0, 8).map((file) => file.name).join(", ") : "none"}`,
    ]),
    "",
    "Next steps:",
    ...discovery.nextSteps.map((step) => `- ${step}`),
  ]
  return lines.join("\n")
}

export async function discoverSbplus(session: D3Session, options: { limit?: number; signal?: AbortSignal; timeoutMs?: number } = {}): Promise<SbplusDiscovery> {
  const timeoutMs = options.timeoutMs ?? 0
  const filesResult = await session.run("LIST MD A0 A1 A2 (N", timeoutMs, { signal: options.signal })
  const files = parseFileListing(outputOf(filesResult), options.limit ?? 300)
  return createSbplusDiscovery(session.profile.name, session.profile.account, files)
}
