import assert from "node:assert/strict"
import test from "node:test"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { searchManualPaths } from "../src/d3/manual-search.js"
import { d3Tools } from "../src/d3/tools.js"

test("manual search returns snippets from local D3 reference text", async () => {
  const dir = await mkdtemp(join(tmpdir(), "d3code-manual-search-"))
  const manual = join(dir, "manual.txt")
  await writeFile(manual, [
    "Rocket D3 BASIC programs can be compiled with BASIC and made callable with CATALOG.",
    "LIST-LOCKS displays lock information for D3 operators.",
  ].join("\n"))

  const result = await searchManualPaths([manual], "compile catalog basic", 3)

  assert.equal(result.query, "compile catalog basic")
  assert.equal(result.hits.length, 1)
  assert.match(result.hits[0]?.snippet ?? "", /BASIC/)
  assert.match(result.hits[0]?.snippet ?? "", /CATALOG/)
})

test("D3 tool registry exposes manual search for model grounding", () => {
  assert.ok(d3Tools.some((tool) => tool.name === "d3_manual_search" && !tool.mutates))
})
