import assert from "node:assert/strict"
import test from "node:test"
import { createSbplusDiscovery, discoverSbplus } from "../src/d3/sbplus.js"

test("native menu and screen names do not prove SB+ is installed", () => {
  for (const files of [[], [{ name: "MENU", kind: "screen" as const }], [{ name: "SALES.SCREEN", kind: "screen" as const }, { name: "SALES.PROC", kind: "screen" as const }]]) {
    const result = createSbplusDiscovery("demo", "dm", files)
    assert.equal(result.detected, false)
    assert.match(result.compact, /installation: unverified/i)
    assert.doesNotMatch(result.compact, /Detected: yes/)
    assert.match(result.nextSteps.join(" "), /not prove|do not prove/)
  }
})

test("discovery uses bounded validated file listing and preserves candidate names", async () => {
  let command = ""
  const result = await discoverSbplus({ profile: { name: "demo", type: "local", entryCommand: "d3" }, async close() {}, async run(value) { command = value;return { command, stdout: "53414C45532E4D454E55 D\n[4052] 1 items listed.", stderr: "", exitCode: 0, durationMs: 0 } } }, { limit: 1 })
  assert.match(command, /SAMPLING 1/)
  assert.equal(result.menuFiles[0]?.name, "SALES.MENU")
  assert.equal(result.detected, false)
  assert.match(result.compact, /limited/i)
})

test("legacy System Builder detects grouped file roles without claiming a runtime installation", async () => {
  const names = ["custCONTROL", "custDEFN", "CUSTDRIVERS", "CUSTHELP", "CUSTMENUS", "CUSTPROCESS", "custPROGS", "OTHERPROGS", "SINGLEDEFN", "singledefn"]
  const listing = names.map((name) => `${Buffer.from(name, "latin1").toString("hex")} D`).join("\n")
  const result = await discoverSbplus({
    profile: { name: "demo", type: "local", account: "demo" },
    async close() {},
    async run(command) { return { command, stdout: `${listing}\n[405] ${names.length} items listed.`, stderr: "", exitCode: 0, durationMs: 0 } },
  })
  assert.deepEqual(result.systems, ["CUST"])
  assert.deepEqual(result.processFiles.map((file) => file.name), ["CUSTPROCESS"])
  assert.deepEqual(result.screenFiles.map((file) => file.name), ["custDEFN"])
  assert.deepEqual(result.menuFiles.map((file) => file.name), ["CUSTMENUS"])
  assert.deepEqual(result.driverFiles.map((file) => file.name), ["CUSTDRIVERS"])
  assert.deepEqual(result.programFiles.map((file) => file.name), ["custPROGS"])
  assert.equal(result.verification, "unverified")
  assert.match(result.compact, /program: custPROGS/)
  const longer = createSbplusDiscovery("demo", "demo", ["INVENTORY2026DEFN", "INVENTORY2026PROGS"].map((name) => ({ name, kind: "data" })))
  assert.deepEqual(longer.systems, ["INVENTORY2026"])
})

test("failed discovery is an error rather than evidence of no SB+", async () => {
  await assert.rejects(discoverSbplus({ profile: { name: "demo", type: "local" }, async close() {}, async run(command) { return { command, stdout: "", stderr: "connection failed", exitCode: 1, durationMs: 0 } } }), /connection failed/)
})
