import { analyzeD3Record } from "../src/d3/shape.js"
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

test("operations inspection uses only fixed nonprinting commands and preserves native results", async () => {
  const commands: string[] = [], context = fakeContext(commands), controller = new AbortController()
  const output = { command: "", stdout: "Native report\n\nNo invented rows", stderr: "native warning", exitCode: 0, durationMs: 7 }
  const seen: Array<[number | undefined, AbortSignal | undefined]> = []
  context.signal = controller.signal
  context.session!.run = async (command, timeout, options) => { commands.push(command);seen.push([timeout, options?.signal]);return { ...output, command } }
  assert.equal(tool("d3_operations_status").mutates, false)
  for (const safety of ["plan", "ask", "trust"] as const) {
    for (const [area, command] of [["jobs", "LIST-JOBS (N"], ["printers", "SP-STATUS (N"], ["queue", "LISTPEQS (N"]]) {
      assert.deepEqual(await tool("d3_operations_status").execute({ area }, { ...context, safety, commandTimeoutMs: 60_000 }), { ...output, command, status: "warning" })
    }
  }
  assert.equal(commands.length, 9)
  assert.ok(seen.every(([timeout, signal]) => timeout === 15_000 && signal === controller.signal))
  await tool("d3_operations_status").execute({ area: "jobs" }, { ...context, commandTimeoutMs: 500 })
  assert.equal(seen.at(-1)?.[0], 500)
  for (const commandTimeoutMs of [undefined, 0]) {
    await tool("d3_operations_status").execute({ area: "printers" }, { ...context, commandTimeoutMs })
    assert.equal(seen.at(-1)?.[0], 15_000)
  }
  commands.length = 0
  for (const area of [undefined, "toString", "jobs\nZ TEST", "queue (P"]) await assert.rejects(tool("d3_operations_status").execute({ area }, context), /Operations area/)
  const shell = { ...context, safety: "plan" as const, profile: { ...context.profile!, entryCommand: "sh" } }
  await assert.rejects(tool("d3_operations_status").execute({ area: "jobs" }, shell), /Denied by/)
  assert.deepEqual(commands, [])
  for (const native of [{ stdout: "denied", stderr: "", exitCode: 1 }, { stdout: "[3] Verb not defined in MD", stderr: "", exitCode: null }]) {
    context.session!.run = async command => ({ ...output, ...native, command })
    assert.equal((await tool("d3_operations_status").execute({ area: "queue" }, context) as { status: string }).status, "warning")
  }
  context.session!.run = async command => ({ ...output, command, stderr: "" })
  assert.equal((await tool("d3_operations_status").execute({ area: "queue" }, context) as { status: string }).status, "success")
  const failure = new Error("Report timed out; do not treat it as an empty queue.")
  context.session!.run = async () => { throw failure }
  await assert.rejects(tool("d3_operations_status").execute({ area: "queue" }, context), error => error === failure)
})

test("create-only tool refuses unapproved, out-of-scope and invalid payloads before transport", async () => {
  const commands: string[] = []
  const context = fakeContext(commands)
  const input = { file: "D3CODE.RECORD.TEST", item: "NEW", body: "one\ntwo" }
  await assert.rejects(tool("d3_create_item").execute(input, context), /Confirmation required/)
  await assert.rejects(tool("d3_create_item").execute({ ...input, confirmed: true }, { ...context, safety: "plan" }), /blocked|Plan|plan/)
  await assert.rejects(tool("d3_create_item").execute({ ...input, file: "CUSTOMERS", confirmed: true }, context), /outside the verified sandbox/)
  await assert.rejects(tool("d3_create_item").execute({ ...input, item: "NEW\nWHO", confirmed: true }, context), /item must contain only/)
  await assert.rejects(tool("d3_create_item").execute({ ...input, body: "\u0100", confirmed: true }, context), /byte|character|Latin/i)
  assert.deepEqual(commands, [])
})

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
    for (const command of ["RUN BP TEST", "RUN DM SB.INITIATE", "SB.INITIATE", "Z B.DAYEND", "FILE-SAVE (b", "set-device /backup/d3/sunday", "SP-KILL 1", "WHO\n! echo TEST"]) {
      await assert.rejects(tool("d3_tcl").execute({ command }, context), /Denied by|Confirmation required/)
    }
  }
  const context = { ...fakeContext(commands), safety: "trust" as const }
  await assert.rejects(tool("d3_tcl").execute({ command: "FILE-SAVE (b" }, context), /Confirmation required/)
  await assert.rejects(tool("d3_tcl").execute({ command: "RUN DM SB.INITIATE" }, context), /Confirmation required/)
  await assert.rejects(tool("d3_run_basic").execute({ file: "DM", item: "SB.INITIATE" }, context), /Confirmation required/)
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


test("structured writes without a baseline never execute line-editor commands", async () => {
  const commands: string[] = []
  const context = { ...fakeContext(commands), safety: "trust" as const }
  const body = [...Array(40).fill("X".repeat(100)), "! echo UNAPPROVED"].join("\n")
  await assert.rejects(tool("d3_write_item").execute({ file: "BP", item: "TEST", body }, context), /supply its baseline/)
  assert.deepEqual(commands, [])
})


test("all replacement tools reject missing or stale baselines before running D3 commands", async () => {
  const commands: string[] = []
  const context = { ...fakeContext(commands), safety: "ask" as const }
  for (const name of ["d3_write_item", "d3_write_dict", "d3_build_basic_program"]) {
    const input = { file: "D3CODE.TEST", item: "ITEM", body: "A\n\nB\xfdC\xfcD  ", source: "STOP", confirmed: true }
    await assert.rejects(tool(name).execute(input, context), /supply its baseline/)
    await assert.rejects(tool(name).execute({ ...input, baseline: { profile: "fake", connection: "stale", original: "" } }, context), /Connection settings changed/)
  }
  assert.deepEqual(commands, [])
})

test("lossless shape evidence counts trailing empty attributes", () => {
  assert.deepEqual(analyzeD3Record("MARKS", "A\xfe\xfeB\xfdC\xfcD  \xfe"), {id:"MARKS",attributeCount:4,multivalueAttributes:[3],subvalueAttributes:[3]})
})
