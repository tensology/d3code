import assert from "node:assert/strict"
import test from "node:test"
import { renderLocalShellResult, runLocalShellCommand } from "../src/tui/local-shell.js"

test("local shell command captures stdout and exit code", async () => {
  const result = await runLocalShellCommand("printf d3code-shell")

  assert.equal(result.exitCode, 0)
  assert.equal(result.stdout, "d3code-shell")
  assert.match(renderLocalShellResult(result), /exit 0/)
})

test("local shell command captures stderr", async () => {
  const result = await runLocalShellCommand("printf d3code-error >&2; exit 7")

  assert.equal(result.exitCode, 7)
  assert.equal(result.stderr, "d3code-error")
  assert.match(renderLocalShellResult(result), /stderr:\nd3code-error/)
})
