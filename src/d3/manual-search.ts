import { access } from "node:fs/promises"
import { basename, join } from "node:path"
import { defaultD3ReferenceManual, defaultD3UserGuide, defaultReferenceDir } from "../config/paths.js"
import { manualTopics, readManualText, scopeManual } from "./manual.js"

export interface ManualSearchHit {
  path: string
  line: number
  score: number
  snippet: string
}

export interface ManualSearchResult {
  query: string
  searched: string[]
  hits: ManualSearchHit[]
}

export interface ManualSearchStatusEntry {
  path: string
  basename: string
  present: boolean
  searchable: boolean
  lines?: number
  topics?: Array<{ id: string; status: "ok" | "thin" | "missing"; hits: number }>
  error?: string
}

export interface ManualSearchStatus {
  candidates: ManualSearchStatusEntry[]
  present: number
  searchable: number
  topics: Array<{ id: string; label: string; status: "ok" | "thin" | "missing"; hits: number }>
}

function defaultManualCandidates(): string[] {
  return [
    join(defaultReferenceDir, "operations/crystallogic-d3-pick0-service.md"),
    defaultD3ReferenceManual,
    defaultD3UserGuide,
    join(defaultReferenceDir, "d3_reference_manual_10.3.4_5-28-2026.txt"),
    join(defaultReferenceDir, "d3_reference_manual_10_3_4.md"),
    join(defaultReferenceDir, "d3_user_guide_10_3_4.md"),
    join(defaultReferenceDir, "d3_reference_manual_10.3.4_5-28-2026.pdf"),
    join(defaultReferenceDir, "d3_user_guide_version_10_3_4.pdf"),
  ]
}

async function existing(paths: string[]): Promise<string[]> {
  const found: string[] = []
  for (const path of paths) {
    try {
      await access(path)
      if (!found.includes(path)) found.push(path)
    } catch {
      // Missing reference material is normal in fresh clones.
    }
  }
  return found
}

function terms(query: string): string[] {
  return query.toLowerCase().split(/[^a-z0-9_.-]+/).filter((term) => term.length > 2)
}

function scoreLine(line: string, queryTerms: string[]): number {
  const lower = line.toLowerCase()
  return queryTerms.reduce((score, term) => score + (lower.includes(term) ? 1 : 0), 0)
}

function windowSnippet(lines: string[], index: number): string {
  const start = Math.max(0, index - 1)
  const end = Math.min(lines.length, index + 2)
  return lines.slice(start, end).map((line) => line.trim()).filter(Boolean).join(" ")
}

export async function searchManualPaths(paths: string[], query: string, limit = 8): Promise<ManualSearchResult> {
  const queryTerms = terms(query)
  if (queryTerms.length === 0) return { query, searched: [], hits: [] }
  const searched = await existing(paths)
  const hits: ManualSearchHit[] = []
  for (const path of searched) {
    const text = await readManualText(path)
    const lines = text.split(/\r?\n/)
    lines.forEach((line, index) => {
      const score = scoreLine(line, queryTerms)
      if (score > 0) hits.push({ path, line: index + 1, score, snippet: windowSnippet(lines, index) })
    })
  }
  hits.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path) || a.line - b.line)
  return { query, searched, hits: hits.slice(0, limit) }
}

export async function searchDefaultManuals(query: string, limit = 8, extraPaths: string[] = []): Promise<ManualSearchResult> {
  return searchManualPaths([...extraPaths, ...defaultManualCandidates()], query, limit)
}

export async function manualSearchStatus(extraPaths: string[] = []): Promise<ManualSearchStatus> {
  const paths = [...extraPaths, ...defaultManualCandidates()]
  const candidates: ManualSearchStatusEntry[] = []
  const topicTotals = new Map(manualTopics.map((topic) => [topic.id, { id: topic.id, label: topic.label, hits: 0, status: "missing" as const }]))
  for (const path of paths) {
    let present = false
    try {
      await access(path)
      present = true
    } catch {
      candidates.push({ path, basename: basename(path), present: false, searchable: false })
      continue
    }
    try {
      const text = await readManualText(path)
      const scoped = scopeManual(text)
      for (const topic of scoped.topics) {
        const total = topicTotals.get(topic.id)
        if (total) total.hits += topic.hits
      }
      candidates.push({
        path,
        basename: basename(path),
        present,
        searchable: true,
        lines: scoped.totalLines,
        topics: scoped.topics.map((topic) => ({ id: topic.id, status: topic.status, hits: topic.hits })),
      })
    } catch (error) {
      candidates.push({ path, basename: basename(path), present, searchable: false, error: (error as Error).message })
    }
  }
  const topics = manualTopics.map((topic) => {
    const total = topicTotals.get(topic.id)
    const hits = total?.hits ?? 0
    return {
      id: topic.id,
      label: topic.label,
      hits,
      status: hits === 0 ? "missing" as const : hits < topic.minimumHits ? "thin" as const : "ok" as const,
    }
  })
  return {
    candidates,
    present: candidates.filter((entry) => entry.present).length,
    searchable: candidates.filter((entry) => entry.searchable).length,
    topics,
  }
}

export function formatManualSearchResult(result: ManualSearchResult): string {
  const where = result.searched.map((path) => basename(path)).join(", ") || "none"
  const lines = [`Manual search — "${result.query}"`, `Searched: ${where}`, ""]
  if (result.hits.length === 0) {
    lines.push("No manual hits.")
    return lines.join("\n").trimEnd()
  }
  result.hits.forEach((hit, index) => {
    const snippet = (hit.snippet || "").replace(/\s+/g, " ").trim()
    lines.push(`${index + 1}. ${snippet || "(no text)"}`)
    lines.push(`   source: ${basename(hit.path)}:${hit.line}  ·  score ${hit.score}`)
    if (index < result.hits.length - 1) lines.push("")
  })
  return lines.join("\n")
}
