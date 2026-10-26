import assert from "node:assert/strict"
import test from "node:test"
import type { D3Session } from "../src/domain/types.js"
import { readDictionaryFields } from "../src/d3/dictionary-fields.js"

function session(records: Record<string, string[]>, options: { ids?: string[]; output?: string; stderr?: string; shell?: boolean } = {}) {
  const calls: string[] = [], ids = options.ids ?? Object.keys(records)
  const value: D3Session = {
    profile: { name: "office", type: "local", entryCommand: options.shell ? "sh" : "d3" },
    async run(command, timeout) {
      calls.push(command);assert.equal(timeout, 15_000)
      const stdout = command.startsWith("LIST ")
        ? ids.map(id => Buffer.from(id).toString("hex")).join("\n") + `\n[4052] ${ids.length} items listed out of ${ids.length} sampling items.`
        : options.output ?? Object.entries(records).map(([id, attrs]) => `    ${id}\n` + attrs.map((a, i) => String(i + 1).padStart(3, "0") + " " + a).join("\n")).join("\n\n")
      return { command, stdout, stderr: command.startsWith("CT ") ? options.stderr ?? "" : "", exitCode: null, durationMs: 1 }
    },
    async close() {},
  }
  return { value, calls }
}

test("bounded dictionary metadata prefers the primary definition and does not execute conversions", async () => {
  const { value, calls } = session({ ALIAS: ["S", "1", "Alias"], NAME: ["A descriptive text", "1", "Customer Name"], EMAIL: ["A", "2", "", "", "", "Not a heading"], COMPUTED: ["A", "3", "Computed", "", "", "", "", "F;1;2;+"], KEY: ["A", "0", "Key"], MENU: ["PA", "4", "Menu"] })
  assert.deepEqual(await readDictionaryFields(value, "D3CODE.CUSTOMERS", "plan"), {
    fields: [{ attribute: 1, label: "Customer Name", ids: ["ALIAS", "NAME"] }, { attribute: 2, label: "EMAIL", ids: ["EMAIL"] }], partial: false,
  })
  assert.match(calls[0], /SAMPLING 32 \(CINE$/)
  assert.equal(calls[1], "CT DICT D3CODE.CUSTOMERS ALIAS NAME EMAIL COMPUTED KEY MENU (N")
})

test("conflicting primary definitions use their IDs rather than guessing a heading", async () => {
  const { value } = session({ SECOND: ["A", "1", "Second"], FIRST: ["A", "1", "First"], HIDDEN: ["X", "2", "\\"] })
  assert.deepEqual((await readDictionaryFields(value, "F", "ask")).fields, [{ attribute: 1, label: "FIRST / SECOND", ids: ["FIRST", "SECOND"] }, { attribute: 2, label: "HIDDEN", ids: ["HIDDEN"] }])
})

test("unsafe IDs never enter the command and missing definitions mark metadata partial", async () => {
  const { value, calls } = session({ NAME: ["A", "1", "Name"] }, { ids: ["NAME", "MISSING", "*", "BAD;WHO", 'BAD"'] })
  assert.equal((await readDictionaryFields(value, "F", "plan")).partial, true)
  assert.equal(calls[1], "CT DICT F NAME MISSING (N")
})

test("unknown native output and transport warnings do not become verified empty metadata", async () => {
  for (const options of [{ output: "[201] not a file name" }, { stderr: "connection failed" }]) {
    await assert.rejects(() => readDictionaryFields(session({ NAME: ["A", "1", "Name"] }, options).value, "F", "plan"), /could not be verified|Could not read/)
  }
})

test("empty dictionaries avoid a CT and numeric item IDs cannot be confused with empty attributes", async () => {
  const empty = session({});assert.deepEqual(await readDictionaryFields(empty.value, "F", "plan"), { fields: [], partial: false });assert.equal(empty.calls.length, 1)
  const numeric = session({ "001": ["", "1", "Do not map"], NAME: ["A", "1", "Name"] })
  assert.deepEqual((await readDictionaryFields(numeric.value, "F", "plan")).fields, [{ attribute: 1, label: "Name", ids: ["NAME"] }])
})

test("invalid file names and shell transport are rejected before execution", async () => {
  for (const file of ["F\nWHO", "F;WHO", "F (P", ""]) { const s = session({});await assert.rejects(() => readDictionaryFields(s.value, file, "plan"));assert.equal(s.calls.length, 0) }
  const shell = session({}, { shell: true });await assert.rejects(() => readDictionaryFields(shell.value, "F", "plan"));assert.equal(shell.calls.length, 0)
})
