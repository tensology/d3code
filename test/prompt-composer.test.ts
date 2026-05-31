import assert from "node:assert/strict"
import test from "node:test"
import { formatComposerHint, formatComposerPrompt, formatComposerTitle } from "../src/tui/prompt-composer.js"

test("composer hint invites queued input while a turn is running", () => {
  assert.equal(formatComposerHint({ busy: true, draftText: "", queuedCount: 0 }), "type ahead queues · esc interrupts")
})

test("composer hint explains draft queueing before interruption", () => {
  assert.equal(formatComposerHint({ busy: true, draftText: "inspect ORDERS", queuedCount: 0 }), "enter queues next turn · esc clears draft")
})

test("composer hint summarizes queued work without command-list noise", () => {
  assert.equal(formatComposerHint({ busy: true, draftText: "", queuedCount: 2 }), "2 queued · esc interrupts")
})

test("composer hint keeps the idle footer compact", () => {
  assert.equal(formatComposerHint({ busy: false, draftText: "", queuedCount: 0 }), "enter send · ! unix · /d3 D3 · /help")
})

test("composer title stays empty so the prompt well feels like Claude/OpenCode input", () => {
  assert.equal(formatComposerTitle({ mode: "chat", busy: false }), "")
  assert.equal(formatComposerTitle({ mode: "d3", busy: false }), "")
  assert.equal(formatComposerTitle({ mode: "d3", busy: true }), "")
})

test("composer prompt glyph never leaves the input lane while busy", () => {
  assert.deepEqual(formatComposerPrompt({ mode: "chat", busy: false }), { glyph: "›", color: "cyan" })
  assert.deepEqual(formatComposerPrompt({ mode: "chat", busy: true }), { glyph: "›", color: "cyan" })
  assert.deepEqual(formatComposerPrompt({ mode: "d3", busy: false }), { glyph: ":", color: "yellow" })
  assert.deepEqual(formatComposerPrompt({ mode: "d3", busy: true }), { glyph: ":", color: "yellow" })
})
