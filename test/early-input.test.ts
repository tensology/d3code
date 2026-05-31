import assert from "node:assert/strict"
import test from "node:test"
import { createEarlyInputBuffer } from "../src/tui/early-input.js"

test("early input buffer preserves prompt text typed before the TUI is ready", () => {
  const buffer = createEarlyInputBuffer()

  buffer.accept("inspect ORDERX")
  buffer.accept("\u007f")
  buffer.accept("S\n")

  assert.equal(buffer.peek(), "inspect ORDERS\n")
  assert.equal(buffer.consume(), "inspect ORDERS")
  assert.equal(buffer.peek(), "")
})

test("early input buffer ignores terminal escape sequences but keeps printable input", () => {
  const buffer = createEarlyInputBuffer()

  buffer.accept("hello")
  buffer.accept("\u001B[D")
  buffer.accept(" D3")

  assert.equal(buffer.consume(), "hello D3")
})
