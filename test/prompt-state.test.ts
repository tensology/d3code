import assert from "node:assert/strict"
import test from "node:test"
import { applyRawPromptControlInput, applyRawPromptInput, backspace, deleteForward, insertText, moveEnd, moveHome, moveLeft, moveRight, renderPromptDraft } from "../src/tui/prompt-state.js"

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

test("prompt state treats terminal backspace bytes as edits, not text", () => {
  assert.deepEqual(applyRawPromptInput({ text: "/", cursor: 1 }, "\u007F"), { text: "", cursor: 0 })
  assert.deepEqual(applyRawPromptInput({ text: "/", cursor: 1 }, "\b"), { text: "", cursor: 0 })
  assert.deepEqual(applyRawPromptInput({ text: "/help", cursor: 2 }, "\u001B[3~"), { text: "/hlp", cursor: 2 })
})

test("prompt state recognizes raw terminal control chunks without inserting text", () => {
  assert.deepEqual(applyRawPromptControlInput({ text: "dfg", cursor: 3 }, "\u007F"), { text: "df", cursor: 2 })
  assert.deepEqual(applyRawPromptControlInput({ text: "dfg", cursor: 1 }, "\u001B[3~"), { text: "dg", cursor: 1 })
  assert.deepEqual(applyRawPromptControlInput({ text: "dfg", cursor: 2 }, "\u001B[D"), { text: "dfg", cursor: 1 })
  assert.deepEqual(applyRawPromptControlInput({ text: "dfg", cursor: 2 }, "\u001B[C"), { text: "dfg", cursor: 3 })
  assert.equal(applyRawPromptControlInput({ text: "dfg", cursor: 3 }, "x"), undefined)
})
