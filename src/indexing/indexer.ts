import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { cacheDir } from "../config/paths.js"
import type { ConnectionProfile, D3Session } from "../domain/types.js"

export interface IndexedDocument {
  uri: string
  title: string
  body: string
  metadata: Record<string, string>
}

export interface SearchHit {
  uri: string
  title: string
  line: number
  excerpt: string
}

export async function saveIndex(name: string, documents: IndexedDocument[]): Promise<void> {
  await mkdir(cacheDir, { recursive: true })
  await writeFile(join(cacheDir, `${name}.json`), `${JSON.stringify({ documents }, null, 2)}\n`)
}

export async function loadIndex(name: string): Promise<IndexedDocument[]> {
  const raw = await readFile(join(cacheDir, `${name}.json`), "utf8")
  return (JSON.parse(raw) as { documents: IndexedDocument[] }).documents
}

export function searchDocuments(documents: IndexedDocument[], query: string): SearchHit[] {
  const needle = query.toLowerCase()
  const hits: SearchHit[] = []
  for (const doc of documents) {
    const lines = doc.body.split(/\r?\n/)
    lines.forEach((line, index) => {
      if (line.toLowerCase().includes(needle)) {
        hits.push({ uri: doc.uri, title: doc.title, line: index + 1, excerpt: line.trim() })
      }
    })
  }
  return hits
}

export async function indexD3Account(session: D3Session, profile: ConnectionProfile): Promise<IndexedDocument[]> {
  const listing = await session.run("LIST MD WITH A1 = \"D\" A0 A1 A2 (N")
  const body = listing.stdout || listing.stderr
  return [
    {
      uri: `d3://${profile.name}/${profile.account ?? "unknown"}/MD/__file_pointers__`,
      title: `${profile.account ?? profile.name} file pointers`,
      body,
      metadata: { profile: profile.name, account: profile.account ?? "" },
    },
  ]
}

export async function indexManualText(path: string): Promise<IndexedDocument> {
  const body = await readFile(path, "utf8")
  return {
    uri: "manual://d3-reference-10.3.4",
    title: "D3 Reference Manual 10.3.4",
    body,
    metadata: { kind: "manual", version: "10.3.4" },
  }
}
