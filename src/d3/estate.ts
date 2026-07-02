import type { D3CommandResult, D3Session } from "../domain/types.js"

export interface D3EstateFile {
  name: string
  kind: "data" | "program" | "dictionary" | "screen" | "system" | "unknown"
  detail?: string
  typeCode?: string
}

export interface D3BrowserCategory {
  id: "data" | "programs" | "screens" | "system" | "other"
  label: string
  files: D3EstateFile[]
}

export interface D3BrowserReport {
  who?: string
  fileCount: number
  files: D3EstateFile[]
  categories: D3BrowserCategory[]
}

export interface D3EstateReport {
  profile: string
  account?: string
  who?: string
  fileCount: number
  files: D3EstateFile[]
  nextQuestions: string[]
  compact: string
}

function outputOf(result: D3CommandResult): string {
  return (result.stdout || result.stderr || "").replace(/\0/g, "").trim()
}

function classifyFile(name: string, detail = "", typeCode = ""): D3EstateFile["kind"] {
  const normalized = `${name} ${detail}`.toLowerCase()
  const upper = name.toUpperCase()
  if (/^(bp|pgm|prog|progs|programs|basic|fbp|source|catalog)$/i.test(upper) || /program|basic|subroutine/.test(normalized)) return "program"
  if (/^(voc|screens|screen|menu|forms|form|proc|paragraphs|pterm)$/i.test(upper) || /screen|terminal|menu|form|display/.test(normalized)) return "screen"
  if (/^(md|dict|accounts|savedlists|f-?list|pdx|synonym|q-pointers|files|master)$/i.test(upper)) return "system"
  if (/^dict\b| dictionary\b/.test(normalized)) return "dictionary"
  if (typeCode === "D" || / customer|order|invoice|sales|stock|product|ledger|data|file/.test(normalized)) return "data"
  return "unknown"
}

export function parseFileListing(output: string, limit = 40): D3EstateFile[] {
  const files: D3EstateFile[] = []
  const seen = new Set<string>()
  for (const rawLine of output.replace(/\0/g, "").split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || /^Page\s+\d+/i.test(line) || /^MD\.+/i.test(line) || /^\[\d+\]/.test(line)) continue
    const match = line.match(/^([A-Za-z0-9_.:$-]+)\s+(\S)\s*(.*)$/) ?? line.match(/^([A-Za-z0-9_.:$-]+)\s+(.*)$/)
    if (!match) continue
    const name = match[1]!
    if (seen.has(name)) continue
    seen.add(name)
    const typeCode = match[2]?.length === 1 ? match[2]! : ""
    const detail = (match[2]?.length === 1 ? match[3] : match[2])?.trim()
    files.push({ name, kind: classifyFile(name, detail, typeCode), detail, typeCode: typeCode || undefined })
    if (files.length >= limit) break
  }
  return files
}

function countSummary(files: D3EstateFile[]): string {
  const counts = files.reduce<Record<string, number>>((acc, file) => {
    acc[file.kind] = (acc[file.kind] ?? 0) + 1
    return acc
  }, {})
  return `shown=${files.length}, data=${counts.data ?? 0}, program=${counts.program ?? 0}, screen=${counts.screen ?? 0}, system=${counts.system ?? 0}, dictionary=${counts.dictionary ?? 0}, unknown=${counts.unknown ?? 0}`
}

const browserCategoryLabels: Record<D3BrowserCategory["id"], string> = {
  data: "Data files",
  programs: "Programs",
  screens: "Screens",
  system: "System",
  other: "Other",
}

export function groupFilesIntoCategories(files: D3EstateFile[]): D3BrowserCategory[] {
  const buckets: Record<D3BrowserCategory["id"], D3EstateFile[]> = {
    data: [],
    programs: [],
    screens: [],
    system: [],
    other: [],
  }
  for (const file of files) {
    if (file.kind === "program") buckets.programs.push(file)
    else if (file.kind === "screen") buckets.screens.push(file)
    else if (file.kind === "system" || file.kind === "dictionary") buckets.system.push(file)
    else if (file.kind === "data") buckets.data.push(file)
    else buckets.other.push(file)
  }
  return (Object.keys(browserCategoryLabels) as D3BrowserCategory["id"][])
    .map((id) => ({
      id,
      label: browserCategoryLabels[id],
      files: buckets[id].sort((left, right) => left.name.localeCompare(right.name)),
    }))
    .filter((category) => category.files.length > 0)
}

export function renderEstateReport(report: Omit<D3EstateReport, "compact">): string {
  const rows = [
    `D3 Estate: ${report.profile}${report.account ? ` / ${report.account}` : ""}`,
    report.who ? `Logged in as: ${report.who}` : undefined,
    `Files: ${report.fileCount ? `${report.fileCount} detected/displayed` : "not detected"} (${countSummary(report.files)})`,
    "",
    "First files:",
    ...report.files.slice(0, 20).map((file) => `- ${file.name} [${file.kind}]${file.detail ? ` - ${file.detail}` : ""}`),
    "",
    "What I can help with next:",
    ...report.nextQuestions.map((question) => `- ${question}`),
  ].filter((line): line is string => line !== undefined)
  return rows.join("\n")
}

export async function inspectD3Browser(session: D3Session, options: { limit?: number; signal?: AbortSignal; timeoutMs?: number } = {}): Promise<D3BrowserReport> {
  const timeoutMs = options.timeoutMs ?? 0
  const whoResult = await session.run("WHO", timeoutMs, { signal: options.signal })
  const filesResult = await session.run("LIST MD A0 A1 A2 (N", timeoutMs, { signal: options.signal })
  const who = outputOf(whoResult).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).at(-1)
  const filesOutput = outputOf(filesResult)
  const files = parseFileListing(filesOutput, options.limit ?? 200)
  const listedCount = Number(filesOutput.match(/\[(?:\d+)\]\s+(\d+)\s+items listed/i)?.[1])
  const fileCount = Number.isFinite(listedCount) && listedCount > 0 ? listedCount : files.length
  return { who, fileCount, files, categories: groupFilesIntoCategories(files) }
}

export async function inspectD3Estate(session: D3Session, options: { limit?: number; signal?: AbortSignal; timeoutMs?: number } = {}): Promise<D3EstateReport> {
  const profile = session.profile
  const timeoutMs = options.timeoutMs ?? 0
  const whoResult = await session.run("WHO", timeoutMs, { signal: options.signal })
  const filesResult = await session.run("LIST MD WITH A1 = \"D\" A0 A1 A2 (N", timeoutMs, { signal: options.signal })
  const who = outputOf(whoResult).split(/\r?\n/).map((line) => line.trim()).filter(Boolean).at(-1)
  const filesOutput = outputOf(filesResult)
  const files = parseFileListing(filesOutput, options.limit ?? 40)
  const listedCount = Number(filesOutput.match(/\[(?:\d+)\]\s+(\d+)\s+items listed/i)?.[1])
  const fileCount = Number.isFinite(listedCount) && listedCount > 0 ? listedCount : files.length
  const nextQuestions = [
    "Ask: 'show me the dictionary for FILE' and I will explain the fields as a table.",
    "Ask: 'sample FILE' and I will read safe records and map attributes where possible.",
    "Ask: 'find programs that touch FILE' and I will build a BASIC/file-access map.",
    "Ask: 'draw the schema' after sampling a few files and I will produce a relationship diagram.",
  ]
  const report = { profile: profile.name, account: profile.account, who, fileCount, files, nextQuestions }
  return { ...report, compact: renderEstateReport(report) }
}
