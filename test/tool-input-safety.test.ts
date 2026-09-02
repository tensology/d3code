import assert from "node:assert/strict"
import test from "node:test"
import type { D3CommandResult, D3Session, ToolContext } from "../src/domain/types.js"
import { d3Tools } from "../src/d3/tools.js"

function fakeContext(commands: string[]): ToolContext {
  const session: D3Session = {
    profile: { name: "fake", type: "local" },
    async run(command: string): Promise<D3CommandResult> {
      commands.push(command)
      return { command, stdout: "", stderr: "", exitCode: 0, durationMs: 0 }
    },
    async close() {},
  }
  return { safety: "ask", session, profile: session.profile }
}

function tool(name: string) {
  const found = d3Tools.find((entry) => entry.name === name)
  assert.ok(found)
  return found
}

test("read tools reject newline and control-character command injection", async () => {
  const commands: string[] = []
  const context = fakeContext(commands)

  await assert.rejects(tool("d3_read_item").execute({ file: "CUSTOMERS\nWHO", item: "100" }, context), /file must contain only/)
  await assert.rejects(tool("d3_read_dict").execute({ file: "CUSTOMERS", item: "NAME\rWHO" }, context), /dictionary item must contain only/)
  assert.deepEqual(commands, [])
})

test("AQL tool accepts only one read-only AQL statement", async () => {
  const commands: string[] = []
  const context = fakeContext(commands)

  await tool("d3_query_aql").execute({ query: "LIST CUSTOMERS NAME" }, context)
  await assert.rejects(tool("d3_query_aql").execute({ query: "WHO\nDELETE CUSTOMERS 100" }, context), /one line/)
  await assert.rejects(tool("d3_query_aql").execute({ query: "DELETE CUSTOMERS 100" }, context), /must begin with LIST/)
  assert.deepEqual(commands, ["LIST CUSTOMERS NAME"])
})

test("compile, catalog, and call tools validate command identifiers", async () => {
  const context = fakeContext([])

  await assert.rejects(tool("d3_compile_basic").execute({ file: "BP\nWHO", item: "TEST", confirmed: true }, context), /file must contain only/)
  await assert.rejects(tool("d3_catalog").execute({ file: "BP", item: "TEST\nWHO", confirmed: true }, context), /item must contain only/)
  await assert.rejects(tool("d3_call_subroutine").execute({ name: "TEST\nWHO", confirmed: true }, context), /subroutine name must contain only/)
})
