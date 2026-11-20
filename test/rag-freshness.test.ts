import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { buildRagIndex, isRagIndexStale, loadFreshRagIndex, saveRagIndex, searchRagIndex, type RagIndex } from "../src/rag/reference-rag.js"
import { cacheDir } from "../src/config/paths.js"

test("RAG index becomes stale when source evidence changes", async () => {
  const root = join(tmpdir(), `d3code-rag-freshness-${Date.now()}`)
  const path = join(root, "source.md")
  await mkdir(root, { recursive: true })
  await writeFile(path, "old")
  const index: RagIndex = {
    builtAt: new Date(Date.now() - 5000).toISOString(),
    sources: [{ id: "source", title: "Source", path, kind: "operator" }],
    chunks: [],
  }
  assert.equal(await isRagIndexStale(index), true)
  assert.equal(await isRagIndexStale({ ...index, builtAt: new Date(Date.now() + 5000).toISOString() }), false)
})

test("custom RAG rebuild sees a newly added source and keeps the custom path", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "d3code-rag-discovery-"))
  const name = `rag-discovery-${process.pid}`
  t.after(async () => {
    await rm(root, { recursive: true, force: true })
    await rm(join(cacheDir, `${name}.json`), { force: true })
  })
  const operations = join(root, "operations")
  await mkdir(operations)
  const original = await buildRagIndex({ referenceDir: root })
  await saveRagIndex(original, name)
  await writeFile(join(operations, "crystallogic-d3-pick0-service.md"), "OFFICE.RECONNECT.CHECK validates a fresh login.")
  assert.equal(await isRagIndexStale(original), true)
  const rebuilt = await loadFreshRagIndex(name)
  assert.equal(rebuilt.discovery?.referenceDir, root)
  assert.equal(searchRagIndex(rebuilt, "OFFICE.RECONNECT.CHECK").hits[0]?.sourceId, "crystallogic-pick0")
  await assert.rejects(loadFreshRagIndex("../invalid"), /Invalid RAG index name/)
})
