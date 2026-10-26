import assert from "node:assert/strict"
import test from "node:test"
import { parseD3ToolInput, toolInputContracts } from "../src/d3/tool-input.js"
import { d3Tools } from "../src/d3/tools.js"
import { d3ToolSchemas } from "../src/d3/tool-schema.js"

test("every D3 tool has a schema-first input contract", () => {
  for (const tool of d3Tools) assert.ok(toolInputContracts[tool.name], tool.name)
})

test("tool schemas reject unknown fields and malformed identifiers", () => {
  assert.throws(() => parseD3ToolInput("d3_read_item", { file: "CUSTOMERS\nWHO", item: "100" }), /Invalid d3_read_item input/)
  assert.throws(() => parseD3ToolInput("d3_list_files", { surprise: true }), /Unrecognized key/)
  assert.deepEqual(parseD3ToolInput("d3_read_item", { file: "CUSTOMERS", item: "100" }), { file: "CUSTOMERS", item: "100" })
})

test("create-only tool requires explicit content and a supported section", () => {
  const input = { file: "D3CODE.RECORD.TEST", item: "NEW", body: "" }
  assert.deepEqual(parseD3ToolInput("d3_create_item", input), input)
  assert.throws(() => parseD3ToolInput("d3_create_item", { ...input, section: "program" }), /Invalid/)
  assert.throws(() => parseD3ToolInput("d3_create_item", { file: input.file, item: input.item }), /Invalid/)
  assert.throws(() => parseD3ToolInput("d3_create_item", { ...input, baseline: {} }), /Unrecognized key/)
})

test("oversized invalid tool collections fail without accumulating per-element errors", () => {
  assert.throws(() => parseD3ToolInput("d3_call_subroutine", { name: "TEST", args: Array(10_000).fill(null) }), (error: unknown) => {
    assert.ok(error instanceof Error)
    assert.match(error.message, /Invalid d3_call_subroutine input/)
    assert.ok(error.message.length < 1000, "collection bounds must reject before collecting thousands of element issues")
    return true
  })
  assert.throws(() => parseD3ToolInput("d3_call_subroutine", { name: "TEST", args: [null] }), /Invalid/)
  assert.deepEqual(parseD3ToolInput("d3_call_subroutine", { name: "TEST", args: Array(100).fill("value") }), { name: "TEST", args: Array(100).fill("value") })
})

test("operations schema accepts only an explicit known report area", () => {
  for (const area of ["jobs", "printers", "queue"]) assert.deepEqual(parseD3ToolInput("d3_operations_status", { area }), { area })
  for (const input of [{}, { area: "toString" }, { area: "queue (P" }, { area: "jobs", confirmed: true }, { area: "jobs", command: "Z TEST" }]) assert.throws(() => parseD3ToolInput("d3_operations_status", input), /Invalid/)
  const schema = d3ToolSchemas.find(tool => tool.name === "d3_operations_status")!.parameters
  assert.deepEqual(schema.required, ["area"])
  assert.equal(schema.additionalProperties, false)
  assert.deepEqual((schema.properties as Record<string, { enum: string[] }>).area!.enum, ["jobs", "printers", "queue"])
})
