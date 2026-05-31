import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export interface WorkspaceFileState {
  code: string
  path: string
  additions?: number
  deletions?: number
}

export interface WorkspaceSnapshot {
  available: boolean
  files: Map<string, WorkspaceFileState>
}

export interface WorkspaceChangeSummary {
  filesChanged: number
  added: number
  removed: number
  modified: number
  files: WorkspaceFileState[]
}

export function parseGitNumstat(raw: string): Map<string, Pick<WorkspaceFileState, "additions" | "deletions">> {
  const stats = new Map<string, Pick<WorkspaceFileState, "additions" | "deletions">>()
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue
    const [added, deleted, ...pathParts] = line.split("\t")
    const rawPath = pathParts.join("\t")
    const path = rawPath.includes(" => ") ? rawPath.split(" => ").at(-1)?.replace(/[{}]/g, "") ?? rawPath : rawPath
    const additions = added === "-" ? undefined : Number.parseInt(added ?? "", 10)
    const deletions = deleted === "-" ? undefined : Number.parseInt(deleted ?? "", 10)
    stats.set(path, {
      additions: Number.isFinite(additions) ? additions : undefined,
      deletions: Number.isFinite(deletions) ? deletions : undefined,
    })
  }
  return stats
}

export function parseGitStatus(raw: string, stats = new Map<string, Pick<WorkspaceFileState, "additions" | "deletions">>()): Map<string, WorkspaceFileState> {
  const files = new Map<string, WorkspaceFileState>()
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue
    const code = line.slice(0, 2)
    const rawPath = line.slice(3)
    const path = rawPath.includes(" -> ") ? rawPath.split(" -> ").at(-1) ?? rawPath : rawPath
    files.set(path, { code, path, ...stats.get(path) })
  }
  return files
}

function statusChanged(before: WorkspaceSnapshot, after: WorkspaceSnapshot, path: string): boolean {
  const beforeFile = before.files.get(path)
  const afterFile = after.files.get(path)
  return beforeFile?.code !== afterFile?.code ||
    beforeFile?.additions !== afterFile?.additions ||
    beforeFile?.deletions !== afterFile?.deletions
}

export function summarizeWorkspaceChanges(before: WorkspaceSnapshot, after: WorkspaceSnapshot): WorkspaceChangeSummary | undefined {
  if (!before.available || !after.available) return undefined
  const changed = [...after.files.values()]
    .filter((file) => statusChanged(before, after, file.path))
    .sort((a, b) => {
      if (a.code === "??" && b.code !== "??") return 1
      if (a.code !== "??" && b.code === "??") return -1
      return a.path.localeCompare(b.path)
    })
  if (changed.length === 0) return undefined
  return {
    filesChanged: changed.length,
    added: changed.filter((file) => file.code.includes("A") || file.code === "??").length,
    removed: changed.filter((file) => file.code.includes("D")).length,
    modified: changed.filter((file) => file.code.includes("M")).length,
    files: changed,
  }
}

export function workspaceStatusLabel(code: string): string {
  if (code === "??" || code.includes("A")) return "added"
  if (code.includes("D")) return "deleted"
  if (code.includes("R")) return "renamed"
  if (code.includes("M")) return "modified"
  if (code.includes("U")) return "conflict"
  return "changed"
}

export function renderWorkspaceChangeSummary(summary: WorkspaceChangeSummary): string {
  const totalAdditions = summary.files.reduce((sum, file) => sum + (file.additions ?? 0), 0)
  const totalDeletions = summary.files.reduce((sum, file) => sum + (file.deletions ?? 0), 0)
  const details = [
    summary.modified ? `${summary.modified} modified` : "",
    summary.added ? `${summary.added} added` : "",
    summary.removed ? `${summary.removed} removed` : "",
    totalAdditions ? `+${totalAdditions}` : "",
    totalDeletions ? `-${totalDeletions}` : "",
  ].filter(Boolean).join(", ")
  return [
    `Files changed: ${summary.filesChanged}${details ? ` (${details})` : ""}`,
    ...summary.files.slice(0, 8).map((file) => {
      const stat = file.additions !== undefined || file.deletions !== undefined
        ? ` +${file.additions ?? 0}/-${file.deletions ?? 0}`
        : ""
      return `${workspaceStatusLabel(file.code).padEnd(8)} ${file.path}${stat}`
    }),
    summary.files.length > 8 ? `... ${summary.files.length - 8} more files` : undefined,
  ].filter(Boolean).join("\n")
}

export function renderWorkspaceChangeWithDiff(summary: WorkspaceChangeSummary, diff: string, maxDiffLines = 60): string {
  const base = renderWorkspaceChangeSummary(summary)
  const compact = diff.split(/\r?\n/)
    .filter((line) => line.trim() && !line.startsWith("index ") && !line.startsWith("--- ") && !line.startsWith("+++ "))
    .map((line) => {
      const match = /^diff --git a\/(.+) b\/(.+)$/.exec(line)
      return match ? `diff ${match[2]}` : line
    })
  if (compact.length === 0) return base
  const visible = compact.slice(0, maxDiffLines)
  const overflow = compact.length - visible.length
  const lines = [
    base,
    "",
    "Diff preview:",
    ...visible,
  ]
  if (overflow > 0) lines.push(`... ${overflow} more diff lines`)
  return lines.join("\n")
}

export async function renderWorkspaceChangeDetails(summary: WorkspaceChangeSummary, cwd = process.cwd()): Promise<string> {
  const diffablePaths = summary.files
    .filter((file) => file.code !== "??")
    .slice(0, 6)
    .map((file) => file.path)
  if (diffablePaths.length === 0) return renderWorkspaceChangeSummary(summary)
  try {
    const { stdout } = await execFileAsync("git", ["diff", "--no-ext-diff", "--unified=2", "HEAD", "--", ...diffablePaths], { cwd, maxBuffer: 1024 * 1024 })
    return renderWorkspaceChangeWithDiff(summary, stdout)
  } catch {
    return renderWorkspaceChangeSummary(summary)
  }
}

export function formatWorkspaceChangeFooter(summary: WorkspaceChangeSummary | undefined): string {
  if (!summary) return "files --"
  const additions = summary.files.reduce((sum, file) => sum + (file.additions ?? 0), 0)
  const deletions = summary.files.reduce((sum, file) => sum + (file.deletions ?? 0), 0)
  const stat = additions || deletions ? ` +${additions}/-${deletions}` : ""
  return `files ${summary.filesChanged}${summary.added ? ` +${summary.added}` : ""}${summary.removed ? ` -${summary.removed}` : ""}${stat}`
}

export async function snapshotWorkspace(cwd = process.cwd()): Promise<WorkspaceSnapshot> {
  try {
    const [{ stdout: status }, { stdout: numstat }] = await Promise.all([
      execFileAsync("git", ["status", "--porcelain=v1"], { cwd, maxBuffer: 1024 * 1024 }),
      execFileAsync("git", ["diff", "--numstat", "HEAD", "--"], { cwd, maxBuffer: 1024 * 1024 }),
    ])
    return { available: true, files: parseGitStatus(status, parseGitNumstat(numstat)) }
  } catch {
    return { available: false, files: new Map() }
  }
}
