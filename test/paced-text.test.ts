import assert from "node:assert/strict"
import test from "node:test"
import { nextPacedText, pacedStep } from "../src/tui/paced-text.js"

test("paced text reveals small chunks and snaps to natural boundaries", () => {
  assert.equal(pacedStep(8), 2)
  assert.equal(pacedStep(40), 4)
  assert.equal(nextPacedText("hello there friend", 0), "hello ")
})

test("paced text finishes once the shown cursor reaches the source", () => {
  assert.equal(nextPacedText("done", 4), "done")
})
