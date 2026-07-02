import { mkdir, readFile, writeFile } from "node:fs/promises"
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
  let existing = ""
  try {
    existing = await readFile(path, "utf8")
  } catch {
    // Missing memory file is normal on first write.
  }
  await writeFile(path, `${existing}${JSON.stringify(entry)}\n`)
}

export async function readOperatorMemory(path: string, project?: string): Promise<OperatorMemoryEntry[]> {
  let raw = ""
  try {
    raw = await readFile(path, "utf8")
  } catch {
    return []
  }
  const entries = raw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as OperatorMemoryEntry)
  return project ? entries.filter((entry) => entry.project === project) : entries
}
