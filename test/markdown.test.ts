import assert from "node:assert/strict"
import test from "node:test"
import { parseMarkdownBlocks, renderMarkdownTable } from "../src/tui/markdown.js"

test("terminal markdown parser preserves response structure", () => {
  const blocks = parseMarkdownBlocks([
    "# Result",
    "",
    "A **useful** response with `code`.",
    "",
    "- first",
    "- second",
    "",
    "```basic",
    "CRT \"HELLO\"",
    "```",
  ].join("\n"))

  assert.deepEqual(blocks.map((block) => block.type), ["heading", "paragraph", "list", "code"])
  assert.equal(blocks[2]?.type === "list" ? blocks[2].items.length : 0, 2)
  assert.equal(blocks[3]?.type === "code" ? blocks[3].language : undefined, "basic")
})

test("terminal markdown tables stay within the available width", () => {
  const table = renderMarkdownTable([
    ["Very long heading", "Status", "Evidence"],
    ["A long project context description", "Pass", "A long evidence description"],
  ], 36)
  assert.ok(table.width <= 36)
  assert.ok(table.lines.every((line) => line.length <= 36))
  assert.match(table.lines.join("\n"), /…/)
})

test("terminal markdown parser formats tables, quotes, ordered lists, and rules", () => {
  const blocks = parseMarkdownBlocks([
    "Name | Status",
    "--- | ---",
    "D3 | Ready",
    "",
    "> Evidence first.",
    "",
    "1. Inspect",
    "2. Verify",
    "",
    "---",
  ].join("\n"))

  assert.deepEqual(blocks.map((block) => block.type), ["table", "quote", "list", "rule"])
})
