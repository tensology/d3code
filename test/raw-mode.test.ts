import assert from "node:assert/strict"
import test from "node:test"
import { canEnableRawMode } from "../src/tui/raw-mode.js"

test("raw mode is enabled only for real TTY input streams", () => {
  assert.equal(canEnableRawMode({ isTTY: true } as NodeJS.ReadStream), true)
  assert.equal(canEnableRawMode({ isTTY: false } as NodeJS.ReadStream), false)
  assert.equal(canEnableRawMode({} as NodeJS.ReadStream), false)
})
