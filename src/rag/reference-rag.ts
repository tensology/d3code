import { access, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { basename, dirname, extname, isAbsolute, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { cacheDir, configHome, defaultD3ReferenceManual, defaultD3UserGuide, defaultReferenceDir, memoryPath } from "../config/paths.js"
import { readManualText } from "../d3/manual.js"
import { readOperatorMemory } from "../operator/memory.js"
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
  version?: number
  discovery?: { referenceDir: string; eccRoot?: string }
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
const indexVersion = 2
const bundledRoot = fileURLToPath(new URL(import.meta.url.endsWith(".ts") ? "../../" : "../../../", import.meta.url))

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
  const normalized = value.toLowerCase().replace(/\b(?:sb\s+builder|system\s+builder|sb\/xa|sb\+)/g, "systembuilder")
  const terms = normalized.split(/[^a-z0-9_.-]+/)
    .map((term) => term.replace(/^[._-]+|[._-]+$/g, ""))
    .filter((term) => (term.length > 2 || /^(?:d3|md|bp|f[1-9])$/.test(term)) && !stopwords.has(term))
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
      terms: tokenize(chunkText),
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
  const entries = await readOperatorMemory(source.path)
  return entries.map((entry) => [
    `Project: ${entry.project}`,
    `Kind: ${entry.kind}`,
    `Summary: ${entry.summary}`,
    `Evidence: ${entry.evidence}`,
  ].join("\n")).join("\n\n")
}

export async function defaultRagSources(referenceDir = defaultReferenceDir, eccRoot = process.env.D3CODE_ECC_REPO): Promise<RagSource[]> {
  const mvBasicDir = join(referenceDir, "rocket-mvbasic", "docs")
  const examplesDir = join(referenceDir, "examples")
  const notesDir = join(configHome, "reference-notes")
  const candidates: RagSource[] = [
    { id: "d3-reference", title: "Rocket D3 Reference Manual", path: join(referenceDir, basename(defaultD3ReferenceManual)), kind: "d3", version: "10.3.4" },
    { id: "d3-user-guide", title: "Rocket D3 User Guide", path: join(referenceDir, basename(defaultD3UserGuide)), kind: "d3", version: "10.3.4" },
    { id: "crystallogic-pick0", title: "Crystal Logic D3 pick0 service notes", path: join(referenceDir, "operations/crystallogic-d3-pick0-service.md"), kind: "operator" },
    { id: "operator-memory", title: "Hermes-style D3Code operator memory", path: memoryPath.replace(/\.md$/i, ".jsonl"), kind: "memory" },
    { id: "ecc-hermes-d3-harness", title: "D3Code adapted ECC/Hermes harness skill", path: join(bundledRoot, "skills/ecc-hermes-d3-harness/SKILL.md"), kind: "hermes" },
    { id: "d3-practical", title: "Practical D3 operator lessons (match the active profile)", path: join(bundledRoot, "skills/d3-practical/SKILL.md"), kind: "operator" },
  ]
  for (const path of (await markdownFiles(mvBasicDir)).sort()) {
    const name = path.slice(mvBasicDir.length + 1)
    candidates.push({ id: `rocket-mvbasic:${name}`, title: `Rocket MV BASIC ${name}`, path, kind: "mvbasic" })
  }
  for (const path of (await markdownFiles(examplesDir)).sort()) {
    const name = path.slice(examplesDir.length + 1)
    candidates.push({ id: `bundled-example:${name}`, title: `D3 worked example ${name}`, path, kind: "project" })
  }
  for (const path of (await markdownFiles(notesDir)).sort()) {
    const name = path.slice(notesDir.length + 1)
    candidates.push({ id: `local-reference:${name}`, title: `Workspace reference ${name}`, path, kind: "project" })
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
  return sources.map((source) => ({ ...source, path: resolve(source.path) }))
}

export async function buildRagIndex(options: { sources?: RagSource[]; chunkLines?: number; referenceDir?: string; eccRoot?: string } = {}): Promise<RagIndex> {
  const chunkLines = options.chunkLines ?? 18
  if (!Number.isSafeInteger(chunkLines) || chunkLines < 1) throw new Error("RAG chunk size must be a positive integer")
  const eccRoot = options.eccRoot ?? process.env.D3CODE_ECC_REPO
  const referenceDir = options.referenceDir ?? (await exists(defaultReferenceDir) ? defaultReferenceDir : join(bundledRoot, defaultReferenceDir))
  const discovery = options.sources ? undefined : { referenceDir: resolve(referenceDir), eccRoot: eccRoot ? resolve(eccRoot) : undefined }
  const sources = options.sources ?? await defaultRagSources(discovery!.referenceDir, discovery!.eccRoot)
  const startedAt = new Date().toISOString()
  const chunks: RagChunk[] = []
  for (const source of sources) {
    const text = await readSourceText(source)
    chunks.push(...splitChunks(source, text, chunkLines))
  }
  return { version: indexVersion, discovery, builtAt: startedAt, sources, chunks }
}

function ragIndexPath(name: string): string {
  if (!/^[a-z0-9][a-z0-9_.-]*$/i.test(name)) throw new Error("Invalid RAG index name")
  return join(cacheDir, `${name}.json`)
}

export async function saveRagIndex(index: RagIndex, name = "reference-rag"): Promise<string> {
  await mkdir(cacheDir, { recursive: true })
  const path = ragIndexPath(name)
  const temporary = `${path}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, `${JSON.stringify(index)}\n`, { mode: 0o600 })
    await rename(temporary, path)
  } finally {
    await rm(temporary, { force: true })
  }
  return path
}

export async function loadRagIndex(name = "reference-rag"): Promise<RagIndex> {
  const raw = await readFile(ragIndexPath(name), "utf8")
  const index = JSON.parse(raw) as RagIndex
  if (!index || !Array.isArray(index.sources) || !Array.isArray(index.chunks)) throw new Error("Invalid RAG index")
  return index
}

export async function isRagIndexStale(index: RagIndex): Promise<boolean> {
  const builtAt = Date.parse(index.builtAt)
  if (!Number.isFinite(builtAt)) return true
  if (index.discovery) {
    const current = await defaultRagSources(index.discovery.referenceDir, index.discovery.eccRoot)
    if (JSON.stringify(current) !== JSON.stringify(index.sources)) return true
  }
  for (const source of index.sources) {
    try {
      if ((await stat(source.path)).mtimeMs > builtAt) return true
    } catch {
      return true
    }
  }
  return false
}

const pendingBuilds = new Map<string, Promise<RagIndex>>()

export async function loadFreshRagIndex(name = "reference-rag", eccRoot?: string): Promise<RagIndex> {
  ragIndexPath(name)
  let index: RagIndex | undefined
  try {
    index = await loadRagIndex(name)
    if (index.version === indexVersion && !await isRagIndexStale(index)) return index
  } catch {
    if (name !== "reference-rag") throw new Error(`RAG index "${name}" could not be read. Rebuild it with rag-build --index ${name}.`)
  }
  if (name !== "reference-rag" && index?.version !== indexVersion) {
    throw new Error(`RAG index "${name}" needs to be rebuilt with its original rag-build options.`)
  }
  const pending = pendingBuilds.get(name)
  if (pending) return pending
  const build = (async () => {
    const rebuilt = await buildRagIndex(index?.discovery ?? (index?.version === indexVersion ? { sources: index.sources } : { eccRoot }))
    await saveRagIndex(rebuilt, name)
    return rebuilt
  })().finally(() => pendingBuilds.delete(name))
  pendingBuilds.set(name, build)
  return build
}

export async function ragIndexStatus(name = "reference-rag", referenceDir = defaultReferenceDir, eccRoot = process.env.D3CODE_ECC_REPO): Promise<RagIndexStatus> {
  let index: RagIndex | undefined
  try {
    index = await loadRagIndex(name)
  } catch {
    // Missing index is reported through ready=false.
  }
  const sources = index?.sources ?? await defaultRagSources(await exists(referenceDir) ? referenceDir : join(bundledRoot, defaultReferenceDir), eccRoot)
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
    ready: Boolean(index?.version === indexVersion && index.chunks.length > 0 && !await isRagIndexStale(index)),
  }
}

export function routeReferenceQuery(query: string): ReferenceRoute {
  const lower = query.toLowerCase()
  if (/\b(system builder|sb builder|sb\/xa|template|templates|application builder|generated screen|menu generator)\b|sb\+/i.test(lower)) {
    return { primary: "system-builder", sources: ["system-builder", "project", "memory", "d3", "mvbasic"], rationale: "System Builder/SB+ terms favor the legacy SB+ guide, local examples, and D3/MV BASIC runtime evidence." }
  }
  if (/\b(pick basic|mv basic|flashbasic|openseq|writeseq|readnext|execute|catalog|subroutine|curl)\b/i.test(lower)) {
    const primary: RagSourceKind = /\bexecute|curl|flashbasic|pick basic|mv basic\b/i.test(lower) ? "mvbasic" : "d3"
    return { primary, sources: ["d3", "mvbasic", "project", "operator", "memory"], rationale: "BASIC/PICK language questions need language references and local operator lessons." }
  }
  if (/\b(pick0|systemd|service|office\.crystallogic|operator|profile|ssh)\b/i.test(lower)) {
    return { primary: "operator", sources: ["operator", "memory", "d3"], rationale: "Host and service questions need local Crystal Logic operator notes before generic manuals." }
  }
  return { primary: "d3", sources: ["d3", "mvbasic", "system-builder", "project", "operator", "memory", "hermes", "ecc"], rationale: "Default D3 route searches core D3 references and adjacent manuals." }
}

function scoreChunk(chunk: RagChunk, queryTerms: string[], route: ReferenceRoute): { score: number; matchedTerms: string[] } {
  const matchedTerms = queryTerms.filter((term) => chunk.terms.includes(term))
  if (matchedTerms.length === 0) return { score: 0, matchedTerms }
  let score = matchedTerms.length * 4
  if (chunk.sourceKind === route.primary) score += 2
  else if (route.sources.includes(chunk.sourceKind)) score += 1
  return { score, matchedTerms }
}

export function searchRagIndex(index: RagIndex, query: string, options: { limit?: number; memoryEnabled?: boolean } = {}): RagSearchResult {
  const route = routeReferenceQuery(query)
  const queryTerms = tokenize(query)
  const hits = index.chunks
    .filter((chunk) => options.memoryEnabled !== false || chunk.sourceKind !== "memory")
    .map((chunk) => ({ chunk, scored: scoreChunk(chunk, queryTerms, route) }))
    .filter((entry) => entry.scored.score > 0)
    .map(({ chunk, scored }) => ({ ...chunk, score: scored.score, matchedTerms: scored.matchedTerms }))
    .sort((a, b) => b.score - a.score || a.sourceTitle.localeCompare(b.sourceTitle) || a.startLine - b.startLine)
    .slice(0, options.limit ?? 8)
  return { query, route, hits }
}

export function formatRagSearchResult(result: RagSearchResult): string {
  const lines = [
    `RAG query — "${result.query}"`,
    `Route: ${result.route.primary} (${result.route.rationale})`,
    "",
  ]
  if (result.hits.length === 0) {
    lines.push("No RAG hits.")
    return lines.join("\n").trimEnd()
  }
  result.hits.forEach((hit, index) => {
    const text = hit.text.replace(/\s+/g, " ").trim()
    lines.push(`${index + 1}. ${referenceExcerpt(text, hit.matchedTerms)}`)
    lines.push(`   source: ${hit.sourceTitle} (${hit.sourceKind})  ·  ${basename(hit.sourcePath)}:${hit.startLine}-${hit.endLine}  ·  score ${hit.score}`)
    if (index < result.hits.length - 1) lines.push("")
  })
  return lines.join("\n")
}

function referenceExcerpt(text: string, matchedTerms: string[]): string {
  const limit = 400
  if (text.length <= limit) return text
  const terms = new Set(matchedTerms)
  let anchor = 0
  let longest = 0
  for (const token of text.matchAll(/\b(?:system builder|sb builder|sb\/xa|sb\+)|[a-z0-9][a-z0-9_.-]*/gi)) {
    const [term] = tokenize(token[0])
    if (!term || term.length <= longest || !terms.has(term)) continue
    longest = term.length
    anchor = token.index
  }
  const start = Math.max(0, anchor - 80)
  let end = Math.min(start + limit - (start > 0 ? 3 : 0), text.length)
  const clipped = end < text.length
  if (clipped) end -= 3
  const selected = text.slice(start, end)
  const beginning = start > 0 ? selected.replace(/^\S*\s/, "") : selected
  const excerpt = clipped ? beginning.replace(/\s+\S*$/, "") : beginning
  return `${start > 0 ? "..." : ""}${excerpt}${clipped ? "..." : ""}`
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
