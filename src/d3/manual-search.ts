import { access } from "node:fs/promises"
import { basename } from "node:path"
import { defaultD3ReferenceManual, defaultD3UserGuide } from "../config/paths.js"
import { readManualText } from "./manual.js"

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

function defaultManualCandidates(): string[] {
  return [
    defaultD3ReferenceManual,
    defaultD3UserGuide,
    "../reference/d3_reference_manual_10.3.4_5-28-2026.txt",
    "../reference/d3_reference_manual_10_3_4.md",
    "../reference/d3_user_guide_10_3_4.md",
    "../reference/d3_reference_manual_10.3.4_5-28-2026.pdf",
    "../reference/d3_user_guide_version_10_3_4.pdf",
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

export function formatManualSearchResult(result: ManualSearchResult): string {
  const rows = [`Manual search: ${result.query}`, `Searched: ${result.searched.map((path) => basename(path)).join(", ") || "none"}`]
  for (const hit of result.hits) {
    rows.push(`- ${hit.path}:${hit.line} score=${hit.score} ${hit.snippet}`)
  }
  if (result.hits.length === 0) rows.push("- no manual hits")
  return rows.join("\n")
}
