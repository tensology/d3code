import assert from "node:assert/strict"
import { mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { isRagIndexStale, type RagIndex } from "../src/rag/reference-rag.js"

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
