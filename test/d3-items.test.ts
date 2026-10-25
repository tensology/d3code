import assert from "node:assert/strict"
import test from "node:test"
import { listD3Items } from "../src/d3/items.js"
import type { D3Session } from "../src/domain/types.js"

function fakeSession(output: string, onCommand?: (command: string, timeout?: number, signal?: AbortSignal) => void): D3Session {
  return {
    profile: { name: "items", type: "local" },
    async run(command, timeout, options) {
      onCommand?.(command, timeout, options?.signal)
      return { command, stdout: output, stderr: "", exitCode: null, durationMs: 0 }
    },
    async close() {},
  }
}

test("item listing sends one bounded read, preserving filename case and cancellation", async () => {
  const signal = new AbortController().signal
  let calls = 0
  const session = fakeSession("43303031\n43303032\n[4052] 2 items listed out of 2 sampling items.", (command, timeout, actualSignal) => {
    calls++
    assert.equal(command, 'LIST bp A0 CONV "MX" FMT "L#200" SAMPLING 2 (CINE')
    assert.equal(timeout, 9000)
    assert.equal(actualSignal, signal)
  })
  assert.deepEqual(await listD3Items(session, "bp", { limit: 2, timeoutMs: 9000, signal }), {
    file: "bp", section: "data", items: ["C001", "C002"], limit: 2, mayHaveMore: true,
  })
  assert.equal(calls, 1)
})

test("dictionary listing caps the server-side sampling limit at 200", async () => {
  const session = fakeSession("4E414D45\n[4052] 1 items listed out of 1 sampling items.", command => {
    assert.equal(command, 'LIST DICT D3CODE.CUSTOMERS A0 CONV "MX" FMT "L#200" SAMPLING 200 (CINE')
  })
  assert.deepEqual(await listD3Items(session, "D3CODE.CUSTOMERS", { section: "dict", limit: 1000 }), {
    file: "D3CODE.CUSTOMERS", section: "dict", items: ["NAME"], limit: 200, mayHaveMore: false,
  })
})

test("prefix search uses the documented A0 match and rejects query syntax in user input", async () => {
  const session=fakeSession("4433434F44452E50524F4245\n[4052] 1 items listed out of 727 sampling items.", command=>{
    assert.equal(command,'LIST bp WITH A0 = "D3CODE.]" A0 CONV "MX" FMT "L#200" SAMPLING 100 (CINE')
  })
  assert.deepEqual((await listD3Items(session,"bp",{prefix:"D3CODE."})).items,["D3CODE.PROBE"])
  const forbidden=fakeSession("",()=>assert.fail("unsafe prefix must not execute"))
  for(const prefix of ['D3CODE.]','x" OR A0','x\\','x\nWHO',"x".repeat(101)]) {
    await assert.rejects(()=>listD3Items(forbidden,"bp",{prefix}),/prefix must/)
  }
})

test("item parser preserves complete IDs, spaces and punctuation while ignoring terminal/report noise", async () => {
  const ids = ["A".repeat(100), " leading and trailing ", "mixed.Case*$:/?[]", "Page 1", ":", "A0"]
  const session = fakeSession([
    "spawn ssh -tt root@example d3", "Enter your user id: dm", "[1301] The Speller is off.",
    ':LIST bp A0 CONV "MX" FMT "L#200" SAMPLING 100 (CINE', "Page 1 bp", "A0....................",
    ...ids.map(id => `\0${Buffer.from(id, "latin1").toString("hex").padEnd(200)}`),
    `[4052] ${ids.length} items listed out of ${ids.length} sampling items.`, "\u001b[25;01H:", ":OFF", "Enter your user id:",
  ].join("\r\n"))
  assert.deepEqual((await listD3Items(session, "bp")).items, ids)
})

test("empty file is distinguished from a failed command", async () => {
  const empty = await listD3Items(fakeSession("LIST ...\n[401] no items present.\n:"), "EMPTY")
  assert.deepEqual(empty.items, [])
  assert.equal(empty.mayHaveMore, false)
  await assert.rejects(() => listD3Items(fakeSession("[201] 'MISSING' is not a file name."), "MISSING"), /completion summary/)
  await assert.rejects(() => listD3Items(fakeSession("Too many users"), "BP"), /too many users/i)
})

test("malformed, truncated and excessive listings are rejected", async () => {
  for (const output of [
    "414\n[4052] 1 items listed out of 1 sampling items.",
    "41\n[4052] 2 items listed out of 2 sampling items.",
    "41\n42\n[4052] 2 items listed out of 2 sampling items.",
  ]) await assert.rejects(() => listD3Items(fakeSession(output), "BP", { limit: 1 }), /incomplete|exceeded/)
  await assert.rejects(() => listD3Items(fakeSession("4142"), "BP"), /completion summary/)
})

test("invalid filenames, sections and limits never reach the session", async () => {
  const session = fakeSession("", () => assert.fail("invalid input must not execute"))
  for (const file of ["", "BP\nDELETE-FILE BP", "BP (P", "OTHER,BP", "BP;WHO", 'BP"']) {
    await assert.rejects(() => listD3Items(session, file), /Invalid file name/)
  }
  for (const limit of [0, -1, 1.2, NaN, Infinity]) await assert.rejects(() => listD3Items(session, "BP", { limit }), /positive integer/)
  await assert.rejects(() => listD3Items(session, "BP", { section: "other" as "data" }), /section/)
})
