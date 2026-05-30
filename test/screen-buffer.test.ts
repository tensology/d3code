import assert from "node:assert/strict"
import test from "node:test"
import { parseD3ScreenTranscript, renderD3ScreenBuffer } from "../src/d3/screen-buffer.js"

test("parses D3 symbolic screen cursor controls into a stable buffer", () => {
  const buffer = parseD3ScreenTranscript("@(-1)CUSTOMER MENU@(10,2)Name:@(16,2)Alice@(16,2)@(-4)Bob", { width: 32, height: 8 })
  assert.equal(buffer.lines[0]?.trim(), "CUSTOMER MENU")
  assert.match(buffer.lines[2] ?? "", /Name:\s+Bob/)
  assert.ok(buffer.events.some((event) => event.type === "clear-screen"))
  assert.ok(buffer.events.some((event) => event.type === "cursor" && event.value === "@(10,2)"))
  assert.match(renderD3ScreenBuffer(buffer), /D3 Screen Buffer/)
})

test("parses ANSI cursor controls used by terminal emulators", () => {
  const buffer = parseD3ScreenTranscript("\x1b[2J\x1b[3;5HORDER\x1b[K\nTOTAL", { width: 20, height: 6 })
  assert.match(buffer.lines[2] ?? "", /\s{4}ORDER/)
  assert.match(buffer.lines[3] ?? "", /TOTAL/)
  assert.ok(buffer.events.some((event) => event.type === "clear-line"))
})
