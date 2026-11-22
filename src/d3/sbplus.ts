import type { D3Session } from "../domain/types.js"
import { listD3Files, type D3EstateFile } from "./estate.js"

export interface SbplusDiscovery {
  profile: string
  account?: string
  detected: boolean
  verification: "unverified"
  limited: boolean
  files: D3EstateFile[]
  systems: string[]
  processFiles: D3EstateFile[]
  screenFiles: D3EstateFile[]
  menuFiles: D3EstateFile[]
  driverFiles: D3EstateFile[]
  programFiles: D3EstateFile[]
  nextSteps: string[]
  compact: string
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

// The legacy SB+ guide documents contiguous names such as CUSTDEFN and CUSTPROCESS.
// Require different roles under one prefix so an isolated native filename is insufficient.
const legacySystemFile = /^([A-Z0-9]{2,})(CONTROL|DEFN|DRIVERS|HELP|MENUS|PROCESS|PROGS)$/

export function createSbplusDiscovery(profile: string, account: string | undefined, files: D3EstateFile[], limited = false): SbplusDiscovery {
  const legacyFiles = files.flatMap((file) => {
    const match = file.name.toUpperCase().match(legacySystemFile)
    return match ? [{ file, prefix: match[1]!, role: match[2]! }] : []
  })
  const legacyRoles = new Map<string, Set<string>>()
  for (const { prefix, role } of legacyFiles) {
    const roles = legacyRoles.get(prefix) ?? new Set<string>()
    roles.add(role)
    legacyRoles.set(prefix, roles)
  }
  const legacyPrefixes = new Set([...legacyRoles].filter(([, roles]) => roles.size >= 2).map(([prefix]) => prefix))
  const groupedRoles = new Map(legacyFiles.filter(({ prefix }) => legacyPrefixes.has(prefix))
    .map(({ file, role }) => [file.name, role]))
  const processFiles = files.filter((file) => groupedRoles.get(file.name) === "PROCESS" || hasAny(detailOf(file), [/\bprocess\b/, /\bproc\b/, /\bpd\b/, /\binput\b/, /\boutput\b/]) || /(^|[._-])(PROC|PROCESS|PD)([._-]|$)/i.test(file.name))
  const screenFiles = files.filter((file) => groupedRoles.get(file.name) === "DEFN" || hasAny(detailOf(file), [/\bscreen\b/, /\bfield\b/, /\bprompt\b/, /\bdefinition\b/]) || /(^|[._-])(SCR|SCREEN|SD|FIELD|PROMPT)([._-]|$)/i.test(file.name))
  const menuFiles = files.filter((file) => groupedRoles.get(file.name) === "MENUS" || hasAny(detailOf(file), [/\bmenu\b/]) || /(^|[._-])(MENU|MNU)([._-]|$)/i.test(file.name))
  const driverFiles = files.filter((file) => groupedRoles.get(file.name) === "DRIVERS" || hasAny(detailOf(file), [/\bdriver\b/]) || /(^|[._-])(DRV|DRIVER)([._-]|$)/i.test(file.name))
  const programFiles = files.filter((file) => groupedRoles.get(file.name) === "PROGS")
  // File naming is a search hint, never installation evidence.
  const detected = false
  const verification = "unverified" as const
  const systems = unique([...legacyPrefixes, ...likelySystems([...processFiles, ...screenFiles, ...menuFiles, ...driverFiles])])
  const nextSteps = [
    "File names alone do not prove SB+ is installed. Confirm installation, system and naming convention with the account owner.",
    "Read the likely screen/process/menu definition items before writing any SB+ records.",
    "After installation is verified, use d3_sbplus_plan before making changes through the appropriate maintenance tools.",
    "After approved changes, verify the process through its installed runtime and capture terminal/screen proof.",
  ]
  const discovery = { profile, account, detected, verification, limited, files, systems, processFiles, screenFiles, menuFiles, driverFiles, programFiles, nextSteps }
  return { ...discovery, compact: renderSbplusDiscovery(discovery) }
}

export function renderSbplusDiscovery(discovery: Omit<SbplusDiscovery, "compact">): string {
  const lines = [
    `SB+ Discovery: ${discovery.profile}${discovery.account ? ` / ${discovery.account}` : ""}`,
    "SB+ installation: unverified",
    discovery.limited ? "File scan limited; more files may exist." : "Only visible file pointers were inspected; no runtime probe was performed.",
    discovery.systems.length ? `Candidate naming prefixes: ${discovery.systems.join(", ")}` : "Candidate naming prefixes: none inferred",
    "",
    "Candidate definition files (may belong to native D3 or another framework):",
    ...[
      ["process", discovery.processFiles],
      ["screen", discovery.screenFiles],
      ["menu", discovery.menuFiles],
      ["driver", discovery.driverFiles],
      ["program", discovery.programFiles],
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
  const listing = await listD3Files(session, { ...options, limit: options.limit ?? 300 })
  return createSbplusDiscovery(session.profile.name, session.profile.account, listing.files, listing.mayHaveMore)
}
