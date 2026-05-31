import assert from "node:assert/strict"
import test from "node:test"
import { formatComposerHint, formatComposerPrompt, formatComposerTitle } from "../src/tui/prompt-composer.js"

test("composer hint invites queued input while a turn is running", () => {
  assert.equal(formatComposerHint({ busy: true, draftText: "", queuedCount: 0 }), "Type the next instruction while this runs · Enter queues · Esc interrupts")
})

test("composer hint explains draft queueing before interruption", () => {
  assert.equal(formatComposerHint({ busy: true, draftText: "inspect ORDERS", queuedCount: 0 }), "Enter queue · Esc clear draft")
})

test("composer hint summarizes queued work without command-list noise", () => {
  assert.equal(formatComposerHint({ busy: true, draftText: "", queuedCount: 2 }), "2 queued · runs after this turn · Esc interrupts")
})

test("composer hint keeps the idle footer compact", () => {
  assert.equal(formatComposerHint({ busy: false, draftText: "", queuedCount: 0 }), "Enter send · ! Unix · /d3 D3 terminal · /help")
})

test("composer title names D3 terminal input separately from agent chat", () => {
  assert.equal(formatComposerTitle({ mode: "chat", busy: false }), "Message D3 Code")
  assert.equal(formatComposerTitle({ mode: "d3", busy: false }), "D3 TCL")
  assert.equal(formatComposerTitle({ mode: "d3", busy: true }), "D3 TCL queued input")
})

test("composer prompt glyph makes queued input explicit while busy", () => {
  assert.deepEqual(formatComposerPrompt({ mode: "chat", busy: false }), { glyph: "›", color: "cyan" })
  assert.deepEqual(formatComposerPrompt({ mode: "chat", busy: true }), { glyph: "queued ›", color: "cyan" })
  assert.deepEqual(formatComposerPrompt({ mode: "d3", busy: false }), { glyph: ":", color: "yellow" })
  assert.deepEqual(formatComposerPrompt({ mode: "d3", busy: true }), { glyph: "queued :", color: "yellow" })
})
