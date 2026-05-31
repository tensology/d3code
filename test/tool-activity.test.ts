import assert from "node:assert/strict"
import test from "node:test"
import { formatToolActivity, formatToolResultTitle } from "../src/tui/tool-activity.js"

test("tool activity renders D3 tool starts as human terminal work", () => {
  assert.equal(formatToolActivity({
    name: "d3_read_item",
    input: { file: "CUSTOMERS", item: "100" },
    reason: "inspect the customer record",
  }), [
    "Reading D3 item CUSTOMERS 100",
    "inspect the customer record",
  ].join("\n"))

  assert.equal(formatToolActivity({
    name: "d3_query_aql",
    input: { query: "LIST ORDERS CUSTOMER TOTAL (N" },
  }), "Running AQL LIST ORDERS CUSTOMER TOTAL (N")

  assert.equal(formatToolActivity({
    name: "d3_manual_search",
    input: { query: "VME file dictionary" },
  }), "Searching D3 manuals VME file dictionary")
})

test("tool result titles stay compact and human after D3 work completes", () => {
  assert.equal(formatToolResultTitle("d3_list_files"), "Listed D3 files")
  assert.equal(formatToolResultTitle("d3_compile_basic"), "Compiled BASIC")
  assert.equal(formatToolResultTitle("d3_unknown_custom"), "D3 tool d3_unknown_custom")
})
