import assert from "node:assert/strict"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import {
  buildRagIndex,
  formatRagSearchResult,
  loadSystemBuilderManifest,
  routeReferenceQuery,
  searchRagIndex,
  shouldIndexImportedReferenceSkill,
} from "../src/rag/reference-rag.js"
import {
  appendOperatorMemory,
  assertSanitizedMemory,
  createOperatorMemoryEntry,
  readOperatorMemory,
} from "../src/operator/memory.js"

test("loads System Builder manifest and resolves manual paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "d3code-rag-manifest-"))
  await writeFile(join(root, "sb.pdf.txt"), "System Builder menu template report")
  await writeFile(join(root, "manifest.json"), JSON.stringify({
    manuals: [{
      title: "SB/XA SB+ Solutions Developer Guide",
      version: "6.5.6",
      localPath: "sb.pdf.txt",
      gitTracked: true,
      ingestionStatus: "present-not-indexed",
      topics: ["System Builder", "menus"],
    }],
  }))

  const manifest = await loadSystemBuilderManifest(join(root, "manifest.json"))

  assert.equal(manifest.manuals.length, 1)
  assert.equal(manifest.manuals[0]?.title, "SB/XA SB+ Solutions Developer Guide")
  assert.equal(manifest.manuals[0]?.resolvedPath, join(root, "sb.pdf.txt"))
})

test("routes queries to D3, MV BASIC, System Builder, and operator references", () => {
  assert.equal(routeReferenceQuery("How does OPENSEQ write files?").primary, "d3")
  assert.equal(routeReferenceQuery("PICK BASIC EXECUTE curl command").primary, "mvbasic")
  assert.equal(routeReferenceQuery("System Builder menu template screen").primary, "system-builder")
  assert.equal(routeReferenceQuery("SB+ input process screen definition").primary, "system-builder")
  assert.equal(routeReferenceQuery("pick0 systemd service failed").primary, "operator")
})

test("RAG imported skill gating accepts only D3-relevant or explicitly mapped skills", () => {
  assert.equal(shouldIndexImportedReferenceSkill("unknown/skills/spotify/SKILL.md", "Control Spotify playback from chat."), false)
  assert.equal(shouldIndexImportedReferenceSkill("unknown/skills/d3-audit/SKILL.md", "Audit Rocket D3 dictionaries and PICK BASIC code."), true)
  assert.equal(shouldIndexImportedReferenceSkill("skills/gstack/ship/SKILL.md", "Ship verified work."), true)
})

test("builds local RAG chunks and ranks System Builder hits for System Builder questions", async () => {
  const root = await mkdtemp(join(tmpdir(), "d3code-rag-index-"))
  const d3 = join(root, "d3.txt")
  const sb = join(root, "sb.txt")
  await writeFile(d3, "EXECUTE runs TCL and shell commands from BASIC.\nREADNEXT gets selected ids.")
  await writeFile(sb, "System Builder menu templates define generated screens and reports.\nSB+ screen fields can be maintained in the application builder.")

  const index = await buildRagIndex({
    sources: [
      { id: "d3-ref", title: "D3 Reference", path: d3, kind: "d3" },
      { id: "sb-guide", title: "SB Guide", path: sb, kind: "system-builder" },
    ],
    chunkLines: 1,
  })
  const result = searchRagIndex(index, "System Builder generated menu screen", { limit: 2 })

  assert.equal(result.hits[0]?.sourceKind, "system-builder")
  assert.match(result.hits[0]?.text ?? "", /System Builder menu templates/)
  assert.match(formatRagSearchResult(result), /SB Guide/)
})

test("operator memory stores verified sanitized lessons by project", async () => {
  const file = join(await mkdtemp(join(tmpdir(), "d3code-memory-")), "memory.jsonl")
  const entry = createOperatorMemoryEntry({
    project: "crystallogic",
    kind: "fix",
    summary: "curl exit code 26 means the upload file was not readable by Unix curl",
    evidence: "Verified from D3 screen output and curl diagnostic.",
  })

  await appendOperatorMemory(file, entry)
  const entries = await readOperatorMemory(file, "crystallogic")

  assert.equal(entries.length, 1)
  assert.equal(entries[0]?.kind, "fix")
  assert.match((await readFile(file, "utf8")), /curl exit code 26/)
})

test("operator memory rejects private paths and secrets", () => {
  assert.throws(() => assertSanitizedMemory(createOperatorMemoryEntry({
    project: "crystallogic",
    kind: "lesson",
    summary: "Read /Users/paul/private/file.txt",
    evidence: "verified",
  })), /private path/i)

  assert.throws(() => assertSanitizedMemory(createOperatorMemoryEntry({
    project: "crystallogic",
    kind: "lesson",
    summary: "Token handling",
    evidence: "Bearer abc123",
  })), /secret/i)
})
