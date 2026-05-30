import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname } from "node:path"
import { promptHistoryPath } from "../config/paths.js"

export interface PromptHistoryEntry {
  input: string
  mode?: string
  profile?: string
  time: string
}

export const maxPromptHistoryEntries = 100

function normalizeInput(input: string): string {
  return input.trim()
}

function parseHistoryLine(line: string): PromptHistoryEntry | undefined {
  try {
    const value = JSON.parse(line) as Partial<PromptHistoryEntry>
    if (typeof value.input !== "string" || !value.input.trim()) return undefined
    return {
      input: normalizeInput(value.input),
      mode: typeof value.mode === "string" ? value.mode : undefined,
      profile: typeof value.profile === "string" ? value.profile : undefined,
      time: typeof value.time === "string" ? value.time : new Date(0).toISOString(),
    }
  } catch {
    return undefined
  }
}

export function compactPromptHistory(entries: PromptHistoryEntry[], maxEntries = maxPromptHistoryEntries): PromptHistoryEntry[] {
  const deduped: PromptHistoryEntry[] = []
  for (const entry of entries) {
    const input = normalizeInput(entry.input)
    if (!input) continue
    const previous = deduped.at(-1)
    if (previous?.input === input) {
      deduped[deduped.length - 1] = { ...entry, input }
      continue
    }
    deduped.push({ ...entry, input })
  }
  return deduped.slice(-maxEntries)
}

export async function loadPromptHistory(path = promptHistoryPath, maxEntries = maxPromptHistoryEntries): Promise<PromptHistoryEntry[]> {
  let text = ""
  try {
    text = await readFile(path, "utf8")
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }
  const entries = compactPromptHistory(text.split(/\r?\n/).filter(Boolean).map(parseHistoryLine).filter((entry): entry is PromptHistoryEntry => Boolean(entry)), maxEntries)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, entries.map((entry) => JSON.stringify(entry)).join("\n") + (entries.length ? "\n" : ""))
  return entries
}

export async function appendPromptHistory(input: string, metadata: { mode?: string; profile?: string } = {}, path = promptHistoryPath): Promise<PromptHistoryEntry | undefined> {
  const normalized = normalizeInput(input)
  if (!normalized) return undefined
  const entry: PromptHistoryEntry = {
    input: normalized,
    mode: metadata.mode,
    profile: metadata.profile,
    time: new Date().toISOString(),
  }
  await mkdir(dirname(path), { recursive: true })
  await appendFile(path, `${JSON.stringify(entry)}\n`)
  return entry
}
