import assert from "node:assert/strict"
import test from "node:test"
import { renderLocalShellResult, runLocalShellCommand } from "../src/tui/local-shell.js"

test("local shell command captures stdout and exit code", async () => {
  const result = await runLocalShellCommand("printf d3code-shell")

  assert.equal(result.exitCode, 0)
  assert.equal(result.stdout, "d3code-shell")
  assert.ok(result.durationMs >= 0)
  assert.match(renderLocalShellResult(result), /exit 0 in \d+ms/)
})

test("local shell command captures stderr", async () => {
  const result = await runLocalShellCommand("printf d3code-error >&2; exit 7")

  assert.equal(result.exitCode, 7)
  assert.equal(result.stderr, "d3code-error")
  assert.match(renderLocalShellResult(result), /stderr:\nd3code-error/)
})

test("local shell command streams output chunks before completion", async () => {
  let streamed = ""
  const result = await runLocalShellCommand("printf one; sleep 0.05; printf two", {
    onStdout: (chunk) => {
      streamed += chunk
    },
  })

  assert.equal(result.stdout, "onetwo")
  assert.equal(streamed, "onetwo")
})
