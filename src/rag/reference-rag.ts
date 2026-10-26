import { access, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises"
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path"
import { cacheDir, defaultD3ReferenceManual, defaultD3UserGuide, defaultReferenceDir, defaultRocketMvBasicDir, memoryPath } from "../config/paths.js"
import { readManualText } from "../d3/manual.js"
import type { OperatorMemoryEntry } from "../operator/memory.js"
import { eccHermesImports } from "../operator/ecc-hermes.js"
import { classifyReferenceSkill } from "../skills/reference-scout.js"

export type RagSourceKind = "d3" | "mvbasic" | "system-builder" | "operator" | "project" | "memory" | "hermes" | "ecc"

export interface RagSource {
  id: string
  title: string
  path: string
  kind: RagSourceKind
  version?: string
  topics?: string[]
}

export interface RagChunk {
  id: string
  sourceId: string
  sourceTitle: string
  sourcePath: string
  sourceKind: RagSourceKind
  startLine: number
  endLine: number
  text: string
  terms: string[]
}

export interface RagIndex {
  builtAt: string
  sources: RagSource[]
  chunks: RagChunk[]
}

export interface RagSearchHit extends RagChunk {
  score: number
  matchedTerms: string[]
}

export interface RagSearchResult {
  query: string
  route: ReferenceRoute
  hits: RagSearchHit[]
}

export interface RagIndexStatus {
  builtAt?: string
  sources: Array<{ id: string; title: string; kind: RagSourceKind; path: string; present: boolean; chunks?: number }>
  chunks: number
  ready: boolean
}

export interface SystemBuilderManifestManual {
  title: string
  version?: string
  localPath: string
  resolvedPath: string
  gitTracked?: boolean
  ingestionStatus?: string
  topics?: string[]
}

export interface SystemBuilderManifest {
  manuals: SystemBuilderManifestManual[]
  notes?: string[]
}

export interface ReferenceRoute {
  primary: RagSourceKind
  sources: RagSourceKind[]
  rationale: string
}

export function shouldIndexImportedReferenceSkill(path: string, text: string): boolean {
  const decision = classifyReferenceSkill(path, text).decision
  return decision === "adopt" || decision === "adapt"
}

const stopwords = new Set(["the", "and", "for", "with", "from", "that", "this", "into", "does", "what", "when", "where", "then", "than", "have", "will", "file"])

export async function loadSystemBuilderManifest(path = join(defaultReferenceDir, "system-builder/manifest.json")): Promise<SystemBuilderManifest> {
  const raw = await readFile(path, "utf8")
  const parsed = JSON.parse(raw) as { manuals?: Array<Omit<SystemBuilderManifestManual, "resolvedPath">>; notes?: string[] }
  const base = dirname(path)
  return {
    manuals: (parsed.manuals ?? []).map((manual) => ({
      ...manual,
      resolvedPath: isAbsolute(manual.localPath) ? manual.localPath : resolve(base, manual.localPath),
    })),
    notes: parsed.notes,
  }
}

function tokenize(value: string): string[] {
  const normalized = value.toLowerCase().replace(/sb\/xa|sb\+/g, "systembuilder")
  const terms = normalized.split(/[^a-z0-9_.-]+/).filter((term) => term.length > 2 && !stopwords.has(term))
  return [...new Set(terms)]
}

function splitChunks(source: RagSource, text: string, chunkLines: number): RagChunk[] {
  const lines = text.split(/\r?\n/)
  const chunks: RagChunk[] = []
  for (let start = 0; start < lines.length; start += chunkLines) {
    const selected = lines.slice(start, start + chunkLines)
    const chunkText = selected.join("\n").trim()
    if (!chunkText) continue
    chunks.push({
      id: `${source.id}:${start + 1}`,
      sourceId: source.id,
      sourceTitle: source.title,
      sourcePath: source.path,
      sourceKind: source.kind,
      startLine: start + 1,
      endLine: start + selected.length,
      text: chunkText,
      terms: tokenize(`${source.title} ${source.topics?.join(" ") ?? ""} ${chunkText}`),
    })
  }
  return chunks
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

async function markdownFiles(root: string): Promise<string[]> {
  const found: string[] = []
  try {
    const entries = await readdir(root, { withFileTypes: true })
    for (const entry of entries) {
      const path = join(root, entry.name)
      if (entry.isDirectory()) found.push(...await markdownFiles(path))
      else if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") found.push(path)
    }
  } catch {
    // Optional reference folders may be absent.
  }
  return found
}

async function readSourceText(source: RagSource): Promise<string> {
  if (source.kind !== "memory") return readManualText(source.path)
  const raw = await readFile(source.path, "utf8")
  return raw.split(/\r?\n/).filter(Boolean).map((line) => {
    try {
      const entry = JSON.parse(line) as OperatorMemoryEntry
      return [
        `Project: ${entry.project}`,
        `Kind: ${entry.kind}`,
        `Summary: ${entry.summary}`,
        `Evidence: ${entry.evidence}`,
        `Created: ${entry.createdAt}`,
      ].join("\n")
    } catch {
      return line
    }
  }).join("\n\n")
}

export async function defaultRagSources(referenceDir = defaultReferenceDir, eccRoot = process.env.D3CODE_ECC_REPO): Promise<RagSource[]> {
  const candidates: RagSource[] = [
    { id: "d3-reference", title: "Rocket D3 Reference Manual", path: defaultD3ReferenceManual, kind: "d3", version: "10.3.4" },
    { id: "d3-user-guide", title: "Rocket D3 User Guide", path: defaultD3UserGuide, kind: "d3", version: "10.3.4" },
    { id: "crystallogic-pick0", title: "Crystal Logic D3 pick0 service notes", path: join(referenceDir, "operations/crystallogic-d3-pick0-service.md"), kind: "operator" },
    { id: "operator-memory", title: "Hermes-style D3Code operator memory", path: memoryPath.replace(/\.md$/i, ".jsonl"), kind: "memory" },
    { id: "ecc-hermes-d3-harness", title: "D3Code adapted ECC/Hermes harness skill", path: "skills/ecc-hermes-d3-harness/SKILL.md", kind: "hermes" },
    { id: "d3-practical", title: "Practical D3 operator lessons (match the active profile)", path: "skills/d3-practical/SKILL.md", kind: "operator" },
  ]
  for (const path of await markdownFiles(join(defaultRocketMvBasicDir, "docs"))) {
    const relativeTitle = path.replace(`${defaultRocketMvBasicDir}/docs/`, "")
    candidates.push({ id: `rocket-mvbasic-${relativeTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`, title: `Rocket MV BASIC ${relativeTitle}`, path, kind: "mvbasic" })
  }
  try {
    const manifest = await loadSystemBuilderManifest(join(referenceDir, "system-builder/manifest.json"))
    for (const [index, manual] of manifest.manuals.entries()) {
      candidates.push({
        id: `system-builder-${index + 1}`,
        title: manual.title,
        path: manual.resolvedPath,
        kind: "system-builder",
        version: manual.version,
        topics: manual.topics,
      })
    }
  } catch {
    // System Builder references are optional in fresh clones.
  }
  if (eccRoot) {
    for (const entry of eccHermesImports.filter((item) => item.status === "adapted")) {
      candidates.push({
        id: `${entry.sourceFamily}-${entry.sourceSkill}`,
        title: `${entry.sourceFamily.toUpperCase()} ${entry.sourceSkill}`,
        path: join(eccRoot, entry.sourcePath),
        kind: entry.sourceFamily,
        topics: [entry.d3Skill ?? entry.sourceSkill, "D3Code harness import"],
      })
    }
  }
  const sources: RagSource[] = []
  for (const candidate of candidates) {
    if ((await exists(candidate.path)) && (await stat(candidate.path)).isFile()) sources.push(candidate)
  }
  return sources
}

export async function buildRagIndex(options: { sources?: RagSource[]; chunkLines?: number; referenceDir?: string; eccRoot?: string } = {}): Promise<RagIndex> {
  const chunkLines = options.chunkLines ?? 18
  const sources = options.sources ?? await defaultRagSources(options.referenceDir, options.eccRoot)
  const chunks: RagChunk[] = []
  for (const source of sources) {
    const text = await readSourceText(source)
    chunks.push(...splitChunks(source, text, chunkLines))
  }
  return { builtAt: new Date().toISOString(), sources, chunks }
}

export async function saveRagIndex(index: RagIndex, name = "reference-rag"): Promise<string> {
  await mkdir(cacheDir, { recursive: true })
  const path = join(cacheDir, `${name}.json`)
  await writeFile(path, `${JSON.stringify(index, null, 2)}\n`)
  return path
}

export async function loadRagIndex(name = "reference-rag"): Promise<RagIndex> {
  const raw = await readFile(join(cacheDir, `${name}.json`), "utf8")
  return JSON.parse(raw) as RagIndex
}

export async function isRagIndexStale(index: RagIndex): Promise<boolean> {
  const builtAt = Date.parse(index.builtAt)
  if (!Number.isFinite(builtAt)) return true
  for (const source of index.sources) {
    try {
      if ((await stat(source.path)).mtimeMs > builtAt) return true
    } catch {
      return true
    }
  }
  return false
}

export async function loadFreshRagIndex(name = "reference-rag"): Promise<RagIndex> {
  try {
    const index = await loadRagIndex(name)
    if (!await isRagIndexStale(index)) return index
  } catch {
    // Missing or invalid indexes are rebuilt below.
  }
  const index = await buildRagIndex()
  await saveRagIndex(index, name)
  return index
}

export async function ragIndexStatus(name = "reference-rag", referenceDir = defaultReferenceDir, eccRoot = process.env.D3CODE_ECC_REPO): Promise<RagIndexStatus> {
  let index: RagIndex | undefined
  try {
    index = await loadRagIndex(name)
  } catch {
    // Missing index is reported through ready=false.
  }
  const sources = index?.sources ?? await defaultRagSources(referenceDir, eccRoot)
  return {
    builtAt: index?.builtAt,
    sources: await Promise.all(sources.map(async (source) => ({
      id: source.id,
      title: source.title,
      kind: source.kind,
      path: source.path,
      present: await exists(source.path),
      chunks: index?.chunks.filter((chunk) => chunk.sourceId === source.id).length,
    }))),
    chunks: index?.chunks.length ?? 0,
    ready: Boolean(index && index.chunks.length > 0),
  }
}

export function routeReferenceQuery(query: string): ReferenceRoute {
  const lower = query.toLowerCase()
  if (/\b(system builder|sb\/xa|template|templates|application builder|generated screen|menu generator)\b|sb\+/i.test(lower)) {
    return { primary: "system-builder", sources: ["system-builder", "d3", "mvbasic"], rationale: "System Builder/SB+ terms require the SB/XA manuals first, then D3/MV BASIC for runtime behavior." }
  }
  if (/\b(pick basic|mv basic|flashbasic|openseq|writeseq|readnext|execute|catalog|subroutine|curl)\b/i.test(lower)) {
    const primary: RagSourceKind = /\bexecute|curl|flashbasic|pick basic|mv basic\b/i.test(lower) ? "mvbasic" : "d3"
    return { primary, sources: [primary, "d3", "mvbasic", "operator", "memory"], rationale: "BASIC/PICK language questions need language references and local operator lessons." }
  }
  if (/\b(pick0|systemd|service|office\.crystallogic|operator|profile|ssh)\b/i.test(lower)) {
    return { primary: "operator", sources: ["operator", "memory", "d3"], rationale: "Host and service questions need local Crystal Logic operator notes before generic manuals." }
  }
  return { primary: "d3", sources: ["d3", "mvbasic", "system-builder", "operator", "memory", "hermes", "ecc"], rationale: "Default D3 route searches core D3 references and adjacent manuals." }
}

function scoreChunk(chunk: RagChunk, queryTerms: string[], route: ReferenceRoute): { score: number; matchedTerms: string[] } {
  const matchedTerms = queryTerms.filter((term) => chunk.terms.includes(term) || chunk.text.toLowerCase().includes(term))
  let score = matchedTerms.length * 4
  if (chunk.sourceKind === route.primary) score += 8
  else if (route.sources.includes(chunk.sourceKind)) score += 3
  if (matchedTerms.length > 1) score += matchedTerms.length
  return { score, matchedTerms }
}

export function searchRagIndex(index: RagIndex, query: string, options: { limit?: number } = {}): RagSearchResult {
  const route = routeReferenceQuery(query)
  const queryTerms = tokenize(query)
  const hits = index.chunks
    .map((chunk) => ({ chunk, scored: scoreChunk(chunk, queryTerms, route) }))
    .filter((entry) => entry.scored.score > 0)
    .map(({ chunk, scored }) => ({ ...chunk, score: scored.score, matchedTerms: scored.matchedTerms }))
    .sort((a, b) => b.score - a.score || a.sourceTitle.localeCompare(b.sourceTitle) || a.startLine - b.startLine)
    .slice(0, options.limit ?? 8)
  return { query, route, hits }
}

export function formatRagSearchResult(result: RagSearchResult): string {
  const rows = [
    `RAG query: ${result.query}`,
    `Route: ${result.route.primary} (${result.route.rationale})`,
  ]
  for (const hit of result.hits) {
    rows.push(`- ${hit.sourceTitle} [${hit.sourceKind}] ${basename(hit.sourcePath)}:${hit.startLine}-${hit.endLine} score=${hit.score}`)
    rows.push(`  ${hit.text.replace(/\s+/g, " ").slice(0, 300)}`)
  }
  if (result.hits.length === 0) rows.push("- no RAG hits")
  return rows.join("\n")
}

export function formatRagIndexStatus(status: RagIndexStatus): string {
  const rows = [
    "# D3Code Reference RAG Status",
    "",
    `Ready: ${status.ready ? "yes" : "no"}`,
    `Built: ${status.builtAt ?? "not built"}`,
    `Chunks: ${status.chunks}`,
    "",
    "Sources:",
  ]
  for (const source of status.sources) {
    rows.push(`- ${source.present ? "present" : "missing"} ${source.kind}: ${source.title} (${source.chunks ?? 0} chunks) ${source.path}`)
  }
  return rows.join("\n")
}
