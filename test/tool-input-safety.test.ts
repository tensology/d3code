import assert from "node:assert/strict"
import test from "node:test"
import type { D3CommandResult, D3Session, ToolContext } from "../src/domain/types.js"
import { d3Tools } from "../src/d3/tools.js"

function fakeContext(commands: string[]): ToolContext {
  const session: D3Session = {
    profile: { name: "fake", type: "local", entryCommand: "fake-d3" },
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

test("read-only AQL refuses printing and shell chaining in every safety mode", async () => {
  const commands: string[] = []
  for (const safety of ["plan", "ask", "trust"] as const) {
    const context = { ...fakeContext(commands), safety }
    for (const query of ["LIST ORDERS (P", "LIST ORDERS TO PRINTER", "LIST ORDERS LPTR", "LIST ORDERS; echo TEST"]) {
      await assert.rejects(tool("d3_query_aql").execute({ query, confirmed: true }, context), /read-only without printer output/)
    }
  }
  assert.deepEqual(commands, [])
})

test("unapproved run and operation commands never reach a session", async () => {
  const commands: string[] = []
  for (const safety of ["plan", "ask"] as const) {
    const context = { ...fakeContext(commands), safety }
    for (const command of ["RUN BP TEST", "Z B.DAYEND", "FILE-SAVE (b", "set-device /backup/d3/sunday", "SP-KILL 1", "WHO\n! echo TEST"]) {
      await assert.rejects(tool("d3_tcl").execute({ command }, context), /Denied by|Confirmation required/)
    }
  }
  const context = { ...fakeContext(commands), safety: "trust" as const }
  await assert.rejects(tool("d3_tcl").execute({ command: "FILE-SAVE (b" }, context), /Confirmation required/)
  assert.deepEqual(commands, [])
})

test("item reads quote complete item IDs without admitting TCL injection", async () => {
  const commands:string[]=[]
  const context=fakeContext(commands)
  await tool("d3_read_item").execute({file:"CUSTOMERS",item:"CUSTOMER 100"},context)
  await tool("d3_read_dict").execute({file:"CUSTOMERS",item:"FULL NAME"},context)
  await assert.rejects(tool("d3_read_item").execute({file:"CUSTOMERS",item:'100" (N DELETE CUSTOMERS'},context),/without quotes/)
  assert.deepEqual(commands,['CT CUSTOMERS "CUSTOMER 100" (N','CT DICT CUSTOMERS "FULL NAME" (N'])
})

test("compile, catalog, and call tools validate command identifiers", async () => {
  const context = fakeContext([])

  await assert.rejects(tool("d3_compile_basic").execute({ file: "BP\nWHO", item: "TEST", confirmed: true }, context), /file must contain only/)
  await assert.rejects(tool("d3_catalog").execute({ file: "BP", item: "TEST\nWHO", confirmed: true }, context), /item must contain only/)
  await assert.rejects(tool("d3_call_subroutine").execute({ name: "TEST\nWHO", confirmed: true }, context), /subroutine name must contain only/)
})


test("AQL comparisons execute only through native transport and never self-confirm shell fallback", async () => {
  const commands: string[] = []
  const query = "LIST ORDERS WITH TOTAL > 100 AND TOTAL < 200"
  await tool("d3_query_aql").execute({ query }, { ...fakeContext(commands), safety: "plan" })
  assert.deepEqual(commands, [query])
  commands.length = 0
  for (const safety of ["plan", "ask", "trust"] as const) {
    const context = fakeContext(commands)
    context.session!.profile.entryCommand = undefined
    await assert.rejects(tool("d3_query_aql").execute({ query, confirmed: true }, { ...context, safety }), /read-only without printer output/)
  }
  assert.deepEqual(commands, [])
})


test("structured writes preflight later chunks before deleting the old item", async () => {
  const commands: string[] = []
  const context = { ...fakeContext(commands), safety: "trust" as const }
  const body = [...Array(40).fill("X".repeat(100)), "! echo UNAPPROVED"].join("\n")
  await assert.rejects(tool("d3_write_item").execute({ file: "BP", item: "TEST", body }, context), /Confirmation required/)
  assert.deepEqual(commands, [])
})
