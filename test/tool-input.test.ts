import assert from "node:assert/strict"
import test from "node:test"
import { parseD3ToolInput, toolInputContracts } from "../src/d3/tool-input.js"
import { d3Tools } from "../src/d3/tools.js"

test("every D3 tool has a schema-first input contract", () => {
  for (const tool of d3Tools) assert.ok(toolInputContracts[tool.name], tool.name)
})

test("tool schemas reject unknown fields and malformed identifiers", () => {
  assert.throws(() => parseD3ToolInput("d3_read_item", { file: "CUSTOMERS\nWHO", item: "100" }), /Invalid d3_read_item input/)
  assert.throws(() => parseD3ToolInput("d3_list_files", { surprise: true }), /Unrecognized key/)
  assert.deepEqual(parseD3ToolInput("d3_read_item", { file: "CUSTOMERS", item: "100" }), { file: "CUSTOMERS", item: "100" })
})
