import assert from "node:assert/strict"
import test from "node:test"
import { backspace, deleteForward, insertText, moveEnd, moveHome, moveLeft, moveRight, renderPromptDraft } from "../src/tui/prompt-state.js"

test("prompt state inserts and edits at cursor", () => {
  let draft = { text: "helo", cursor: 2 }
  draft = insertText(draft, "l")
  assert.deepEqual(draft, { text: "hello", cursor: 3 })
  draft = moveLeft(draft)
  draft = backspace(draft)
  assert.deepEqual(draft, { text: "hllo", cursor: 1 })
  draft = deleteForward(draft)
  assert.deepEqual(draft, { text: "hlo", cursor: 1 })
})

test("prompt state supports home/end and visible cursor slices", () => {
  let draft = { text: "LIST MD", cursor: 20 }
  draft = moveHome(draft)
  assert.equal(draft.cursor, 0)
  draft = moveRight(draft)
  draft = moveEnd(draft)
  assert.equal(draft.cursor, 7)
  assert.deepEqual(renderPromptDraft(draft, true), { before: "LIST MD", cursor: " ", after: "" })
})
