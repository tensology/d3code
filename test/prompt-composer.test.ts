import assert from "node:assert/strict"
import test from "node:test"
import { formatComposerHint, formatComposerTitle } from "../src/tui/prompt-composer.js"

test("composer hint invites queued input while a turn is running", () => {
  assert.equal(formatComposerHint({ busy: true, draftText: "", queuedCount: 0 }), "type the next instruction while this runs; Enter queues it, Esc interrupts")
})

test("composer hint explains draft queueing before interruption", () => {
  assert.equal(formatComposerHint({ busy: true, draftText: "inspect ORDERS", queuedCount: 0 }), "Enter queues this prompt; Esc clears the draft first")
})

test("composer hint summarizes queued work without command-list noise", () => {
  assert.equal(formatComposerHint({ busy: true, draftText: "", queuedCount: 2 }), "2 queued; they run automatically after this turn unless you interrupt")
})

test("composer title names D3 terminal input separately from agent chat", () => {
  assert.equal(formatComposerTitle({ mode: "chat", busy: false }), "Message D3 Code")
  assert.equal(formatComposerTitle({ mode: "d3", busy: false }), "D3 TCL")
  assert.equal(formatComposerTitle({ mode: "d3", busy: true }), "D3 TCL queued input")
})
