import assert from "node:assert/strict"
import test from "node:test"
import { formatD3Uri, parseD3Uri } from "../src/d3/uri.js"

test("parses data URIs", () => {
  assert.deepEqual(parseD3Uri("d3://prod/SALES/BP/ORDERS.PROG"), {
    kind: "data",
    profile: "prod",
    account: "SALES",
    file: "BP",
    item: "ORDERS.PROG",
  })
})

test("round-trips catalog URIs", () => {
  const uri = { kind: "catalog" as const, profile: "prod", account: "DM", item: "MY.PROG" }
  assert.equal(formatD3Uri(uri), "d3catalog://prod/DM/MY.PROG")
  assert.deepEqual(parseD3Uri(formatD3Uri(uri)), uri)
})
