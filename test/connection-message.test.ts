import assert from "node:assert/strict"
import test from "node:test"
import { formatD3ToolResultForDisplay, humanD3SessionError, humanizeD3ConnectError } from "../src/d3/connection-message.js"

test("humanizeD3ConnectError hides internal expect script noise", () => {
  const message = humanizeD3ConnectError("Command timed out after 15000ms: expect -c set timeout $env(D3CODE_TIMEOUT) spawn ssh", {
    host: "office.crystallogic.org",
  })
  assert.match(message, /D3 connection timed out/i)
  assert.doesNotMatch(message, /expect -c/)
  assert.doesNotMatch(message, /spawn ssh/)
})

test("humanD3SessionError explains stopped D3 virtual machine", () => {
  const message = humanD3SessionError("", "Virtual Machine 'pick0:LINUX' is not running\nConnection closed.")
  assert.match(message ?? "", /virtual machine is not running/i)
  assert.match(message ?? "", /d3_pick0\.service/)
  assert.doesNotMatch(message ?? "", /expect -c/)
})

test("humanD3SessionError explains exhausted D3 user slots", () => {
  const message = humanD3SessionError("Connected to Virtual Machine 'pick0:LINUX'.\nToo many users\nDisconnected", "")

  assert.match(message ?? "", /D3 login blocked: too many users/i)
  assert.match(message ?? "", /server and SSH connection are available/i)
  assert.match(message ?? "", /Release an existing D3 session/i)
})

test("formatD3ToolResultForDisplay prefers connection hint over compact noise", () => {
  const display = formatD3ToolResultForDisplay({
    compact: "command: expect -c ...\nexit: 0",
    raw: {
      command: "expect",
      stdout: "",
      stderr: "Virtual Machine 'pick0:LINUX' is not running",
      exitCode: 1,
      durationMs: 10,
    },
  })
  assert.match(display, /virtual machine is not running/i)
})
