import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
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
  supersedeOperatorMemory,
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
  assert.equal(routeReferenceQuery("SB Builder input process screen definition").primary, "system-builder")
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
  assert.deepEqual(searchRagIndex(index, "ZEBRA.NONEXISTENT").hits, [])
  assert.deepEqual(searchRagIndex(index, " ").hits, [])
  assert.deepEqual(searchRagIndex(index, "SB Guide").hits, [])
})

test("RAG excludes superseded, malformed, and secret-bearing operator memory", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "d3code-rag-memory-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  const path = join(root, "memory.jsonl")
  const evidence = "Verified against the active D3 account."
  const old = createOperatorMemoryEntry({ project: "test", kind: "lesson", summary: "ObsoleteHook", evidence })
  await appendOperatorMemory(path, old)
  await supersedeOperatorMemory(path, old.id, createOperatorMemoryEntry({ project: "test", kind: "lesson", summary: "ConfirmedHook", evidence }))
  const saved = await readFile(path, "utf8")
  await writeFile(path, saved + "MalformedLine\n" + JSON.stringify({
    ...old, status: "active", summary: "SecretMarker", evidence: "API_KEY: example-secret",
  }) + "\n")
  const index = await buildRagIndex({ sources: [{ id: "mem", title: "Operator memory", path, kind: "memory" }] })
  assert.equal(searchRagIndex(index, "ConfirmedHook").hits.length, 1)
  assert.equal(searchRagIndex(index, "ConfirmedHook", { memoryEnabled: false }).hits.length, 0)
  for (const term of ["ObsoleteHook", "MalformedLine", "SecretMarker"]) assert.deepEqual(searchRagIndex(index, term).hits, [])
  await assert.rejects(buildRagIndex({ sources: [], chunkLines: 0 }), /positive integer/)
})

test("a compact reference includes matches near the end of a long chunk and its source", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "d3code-rag-excerpt-"))
  t.after(() => rm(root, { recursive: true, force: true }))
  const path = join(root, "screen-guide.txt")
  await writeFile(path, `Obsolete VALIDATE.CREDIT.OLD. ${"Background on installation. ".repeat(45)}\nUse VALIDATE.CREDIT in the screen validation hook.\n`)
  const index = await buildRagIndex({ sources: [{ id: "guide", title: "SB+ Guide", path, kind: "system-builder" }] })
  const result = searchRagIndex(index, "VALIDATE.CREDIT")
  const compact = formatRagSearchResult(result)
  assert.match(compact, /Use VALIDATE\.CREDIT in the screen validation hook/)
  assert.match(compact, /SB\+ Guide.*screen-guide\.txt:1-/)
  assert.doesNotMatch(compact, /VALIDATE\.CREDIT\.OLD/)
  assert.ok(compact.split("\n").find((line) => line.startsWith("1. "))!.indexOf("VALIDATE.CREDIT") < 100)
  assert.ok(compact.split("\n").find((line) => line.startsWith("1. "))!.length <= 403)
})

test("Office SB Builder coding references preserve the observed account, file, item, and attribute count", async () => {
  const index = await buildRagIndex()
  const result = searchRagIndex(index, "SB Builder DMPROCESS TEST.P Office account", { limit: 3, memoryEnabled: false })
  const firstHit = formatRagSearchResult({ ...result, hits: result.hits.slice(0, 1) })

  assert.equal(result.route.primary, "system-builder")
  assert.match(firstHit, /office-sbplus-definition-items\.md/)
  assert.match(firstHit, /D3 account.*D3 file.*Item ID.*`SB\+\.DEFN`.*`DMPROCESS`.*`TEST\.P`.*seven numbered attributes/)
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
