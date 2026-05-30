import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export interface WorkspaceFileState {
  code: string
  path: string
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

export function parseGitStatus(raw: string): Map<string, WorkspaceFileState> {
  const files = new Map<string, WorkspaceFileState>()
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue
    const code = line.slice(0, 2)
    const rawPath = line.slice(3)
    const path = rawPath.includes(" -> ") ? rawPath.split(" -> ").at(-1) ?? rawPath : rawPath
    files.set(path, { code, path })
  }
  return files
}

function statusChanged(before: WorkspaceSnapshot, after: WorkspaceSnapshot, path: string): boolean {
  return before.files.get(path)?.code !== after.files.get(path)?.code
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
  const details = [
    summary.modified ? `${summary.modified} modified` : "",
    summary.added ? `${summary.added} added` : "",
    summary.removed ? `${summary.removed} removed` : "",
  ].filter(Boolean).join(", ")
  return [
    `Files changed: ${summary.filesChanged}${details ? ` (${details})` : ""}`,
    ...summary.files.slice(0, 8).map((file) => `${workspaceStatusLabel(file.code).padEnd(8)} ${file.path}`),
    summary.files.length > 8 ? `... ${summary.files.length - 8} more files` : undefined,
  ].filter(Boolean).join("\n")
}

export function formatWorkspaceChangeFooter(summary: WorkspaceChangeSummary | undefined): string {
  if (!summary) return "files --"
  return `files ${summary.filesChanged}${summary.added ? ` +${summary.added}` : ""}${summary.removed ? ` -${summary.removed}` : ""}`
}

export async function snapshotWorkspace(cwd = process.cwd()): Promise<WorkspaceSnapshot> {
  try {
    const { stdout } = await execFileAsync("git", ["status", "--porcelain=v1"], { cwd, maxBuffer: 1024 * 1024 })
    return { available: true, files: parseGitStatus(stdout) }
  } catch {
    return { available: false, files: new Map() }
  }
}
