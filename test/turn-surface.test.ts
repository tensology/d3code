import assert from "node:assert/strict"
import test from "node:test"
import { formatActiveTurnEcho, formatLiveTurnLabel, formatSubmittedTurn, inputRoleForLine, toolStartEntryForLine } from "../src/tui/turn-surface.js"

test("turn surface classifies submitted input consistently across chat, Unix, D3, and slash commands", () => {
  assert.deepEqual(inputRoleForLine("inspect ORDERS", "chat"), { role: "user", content: "inspect ORDERS", kind: "chat" })
  assert.deepEqual(inputRoleForLine("! npm test", "chat"), { role: "shell-input", content: "npm test", kind: "shell" })
  assert.deepEqual(inputRoleForLine("LIST MD", "d3"), { role: "d3-input", content: "LIST MD", kind: "d3" })
  assert.deepEqual(inputRoleForLine("/status", "d3"), { role: "user", content: "/status", kind: "slash" })
})

test("turn surface names the live turn without leaking implementation language", () => {
  assert.equal(formatSubmittedTurn({ role: "shell-input", content: "npm test", kind: "shell" }).label, "Unix shell")
  assert.equal(formatSubmittedTurn({ role: "d3-input", content: "LIST MD", kind: "d3" }).label, "D3 TCL")
  assert.equal(formatSubmittedTurn({ role: "user", content: "/profile", kind: "slash" }).label, "Slash command")
  assert.equal(formatSubmittedTurn({ role: "user", content: "show files", kind: "chat" }).label, "You")
  assert.equal(formatLiveTurnLabel({ kind: "shell", detail: "npm test" }), "Bash: npm test")
  assert.equal(formatLiveTurnLabel({ kind: "d3", detail: "LIST MD" }), "D3 TCL: LIST MD")
  assert.equal(formatLiveTurnLabel({ kind: "slash", detail: "/status --json" }), "Command: /status")
  assert.equal(formatLiveTurnLabel({ kind: "chat", detail: "show me the files in this account" }), "Thinking")
})

test("turn surface creates one tool-start label for work that actually runs", () => {
  assert.deepEqual(toolStartEntryForLine("! npm test", "chat"), { role: "tool-start", content: "Bash: npm test" })
  assert.deepEqual(toolStartEntryForLine("LIST MD", "d3"), { role: "tool-start", content: "D3 TCL: LIST MD" })
  assert.deepEqual(toolStartEntryForLine("/status --json", "chat"), { role: "tool-start", content: "Command: /status" })
  assert.equal(toolStartEntryForLine("show me files", "chat"), undefined)
})

test("active turn echo keeps submitted input in the prompt well while work runs", () => {
  assert.deepEqual(formatActiveTurnEcho(inputRoleForLine("build order app", "chat")), {
    glyph: "›",
    content: "build order app",
    label: "You",
    color: "cyan",
  })
  assert.deepEqual(formatActiveTurnEcho(inputRoleForLine("! npm test", "chat")), {
    glyph: "› !",
    content: "npm test",
    label: "Unix shell",
    color: "cyan",
  })
  assert.deepEqual(formatActiveTurnEcho(inputRoleForLine("LIST MD", "d3")), {
    glyph: ":",
    content: "LIST MD",
    label: "D3 TCL",
    color: "yellow",
  })
})
