import assert from "node:assert/strict"
import test from "node:test"
import { getTool } from "../src/d3/tools.js"
import { formatToolActivity, formatToolResultTitle } from "../src/tui/tool-activity.js"
import type { ToolContext } from "../src/domain/types.js"

test("login verification uses WHO without assuming a VERSION verb", async () => {
  const commands: string[] = []
  const profile = { name: "demo", type: "local" as const, entryCommand: "d3", sessionMode: "persistent" as const, allowedAccounts: ["dm"] }
  const context: ToolContext = { safety: "ask", profile, session: { profile,
    async run(command) { commands.push(command);return { command, stdout: "7 dm dm", stderr: "", exitCode: 0, durationMs: 0 } }, async close() {},
  } }
  const tool = getTool("d3_login")!
  await tool.execute({}, context)
  assert.deepEqual(commands, ["WHO"])
  await assert.rejects(tool.execute({ account: "dm" }, context), /Confirmation required/)
  await assert.rejects(tool.execute({ account: "OTHER", confirmed: true }, context), /not allowed/)
  assert.deepEqual(commands, ["WHO"])
  await tool.execute({ account: "dm", confirmed: true }, context)
  assert.deepEqual(commands, ["WHO", "LOGTO dm\nWHO"])
  await tool.execute({}, { ...context, safety: "plan" })
  await assert.rejects(tool.execute({ account: "dm", confirmed: true }, { ...context, safety: "plan" }), /Denied by plan/)
  assert.deepEqual(commands, ["WHO", "LOGTO dm\nWHO", "WHO"])
})

test("login activity does not claim an account was switched", () => {
  assert.equal(formatToolActivity({ name: "d3_login" }), "Checking D3 account")
  assert.equal(formatToolResultTitle("d3_login"), "Checked D3 account")
})
