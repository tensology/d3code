import { appendFile, chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

export type OperatorMemoryKind = "lesson" | "workflow" | "reference" | "fix"

export interface OperatorMemoryInput {
  project: string
  kind: OperatorMemoryKind
  summary: string
  evidence: string
}

export interface OperatorMemoryEntry extends OperatorMemoryInput {
  id: string
  createdAt: string
  status?: "active" | "superseded"
  supersedes?: string
}

const privatePathPattern = /(?:^|\s)(?:\/Users\/|\/home\/[^/\s]+\/|~\/)/i
const secretPattern = /\b(Bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9_-]+|password\s*[:=]|token\s*[:=])\b/i

function stableID(input: OperatorMemoryInput, createdAt: string): string {
  const basis = `${createdAt}:${input.project}:${input.kind}:${input.summary}`
  let hash = 0
  for (const char of basis) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0
  return `mem_${Math.abs(hash).toString(36)}`
}

export function createOperatorMemoryEntry(input: OperatorMemoryInput): OperatorMemoryEntry {
  const createdAt = new Date().toISOString()
  return {
    ...input,
    project: input.project.trim(),
    summary: input.summary.trim(),
    evidence: input.evidence.trim(),
    id: stableID(input, createdAt),
    createdAt,
    status: "active",
  }
}

export function assertSanitizedMemory(entry: OperatorMemoryEntry): void {
  const haystack = `${entry.project}\n${entry.summary}\n${entry.evidence}`
  if (privatePathPattern.test(haystack)) throw new Error("Operator memory contains a private path")
  if (secretPattern.test(haystack)) throw new Error("Operator memory contains a secret-like value")
  if (!entry.project) throw new Error("Operator memory requires a project")
  if (!entry.summary) throw new Error("Operator memory requires a summary")
  if (!entry.evidence) throw new Error("Operator memory requires evidence")
}

export async function appendOperatorMemory(path: string, entry: OperatorMemoryEntry): Promise<void> {
  assertSanitizedMemory(entry)
  await mkdir(dirname(path), { recursive: true })
  await appendFile(path, `${JSON.stringify(entry)}\n`, { encoding: "utf8", mode: 0o600 })
  await chmod(path, 0o600)
}

function validMemoryEntry(value: unknown): value is OperatorMemoryEntry {
  if (!value || typeof value !== "object") return false
  const entry = value as Partial<OperatorMemoryEntry>
  if (typeof entry.id !== "string" || typeof entry.createdAt !== "string") return false
  if (!(["lesson", "workflow", "reference", "fix"] as unknown[]).includes(entry.kind)) return false
  if (entry.status && entry.status !== "active" && entry.status !== "superseded") return false
  try {
    assertSanitizedMemory(entry as OperatorMemoryEntry)
    return true
  } catch {
    return false
  }
}

export async function readOperatorMemory(path: string, project?: string, includeSuperseded = false): Promise<OperatorMemoryEntry[]> {
  let raw = ""
  try {
    raw = await readFile(path, "utf8")
  } catch {
    return []
  }
  const entries = raw.split(/\r?\n/).filter(Boolean).flatMap((line) => {
    try {
      const entry = JSON.parse(line) as unknown
      return validMemoryEntry(entry) ? [entry] : []
    } catch {
      return []
    }
  }).filter((entry) => includeSuperseded || entry.status !== "superseded")
  return project ? entries.filter((entry) => entry.project === project) : entries
}

export async function supersedeOperatorMemory(path: string, id: string, replacement: OperatorMemoryEntry): Promise<void> {
  assertSanitizedMemory(replacement)
  const entries = await readOperatorMemory(path, undefined, true)
  const index = entries.findIndex((entry) => entry.id === id && entry.status !== "superseded")
  if (index < 0) throw new Error(`Active operator memory not found: ${id}`)
  entries[index] = { ...entries[index]!, status: "superseded" }
  const next = { ...replacement, status: "active" as const, supersedes: id }
  const temp = `${path}.${process.pid}.tmp`
  await writeFile(temp, `${[...entries, next].map((entry) => JSON.stringify(entry)).join("\n")}\n`, { encoding: "utf8", mode: 0o600 })
  await rename(temp, path)
  await chmod(path, 0o600)
}
