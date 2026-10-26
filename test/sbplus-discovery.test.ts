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

test("failed discovery is an error rather than evidence of no SB+", async () => {
  await assert.rejects(discoverSbplus({ profile: { name: "demo", type: "local" }, async close() {}, async run(command) { return { command, stdout: "", stderr: "connection failed", exitCode: 1, durationMs: 0 } } }), /connection failed/)
})
