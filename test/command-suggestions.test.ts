import assert from "node:assert/strict"
import test from "node:test"
import { commandSuggestions } from "../src/tui/command-suggestions.js"

test("command suggestions appear only for slash input", () => {
  assert.deepEqual(commandSuggestions("hello"), [])
  assert.equal(commandSuggestions("/").at(0)?.name, "/setup")
})

test("command suggestions filter by typed command prefix", () => {
  assert.deepEqual(commandSuggestions("/pr").map((item) => item.name), ["/profile"])
  assert.deepEqual(commandSuggestions("  /d").map((item) => item.name), ["/d3", "/dict"])
})

test("command suggestions respect the visible limit", () => {
  assert.equal(commandSuggestions("/", 3).length, 3)
})
