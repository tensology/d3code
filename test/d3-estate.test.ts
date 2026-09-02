import assert from "node:assert/strict"
import test from "node:test"
import { inspectD3Browser, parseFileListing, renderEstateReport } from "../src/d3/estate.js"
import type { D3Session } from "../src/domain/types.js"

test("estate parser extracts and classifies D3 file pointers", () => {
  const files = parseFileListing([
    "Page   1     MD",
    "CUSTOMERS D Customer file",
    "BP D Programs",
    "VOC D Screens",
    "ORDERS D Order data",
    "[405] 3 items listed out of 3 items.",
  ].join("\n"))

  assert.deepEqual(files.map((file) => [file.name, file.kind]), [
    ["CUSTOMERS", "data"],
    ["BP", "program"],
    ["VOC", "screen"],
    ["ORDERS", "data"],
  ])
})

test("estate report explains next investigation steps", () => {
  const rendered = renderEstateReport({
    profile: "prod",
    account: "DM",
    who: "2 dm dm",
    fileCount: 2,
    files: [{ name: "CUSTOMERS", kind: "data", detail: "Customer file" }],
    nextQuestions: ["Ask: 'show me the dictionary for CUSTOMERS'."],
  })

  assert.match(rendered, /D3 Estate: prod \/ DM/)
  assert.match(rendered, /Logged in as: 2 dm dm/)
  assert.match(rendered, /CUSTOMERS \[data\]/)
  assert.match(rendered, /What I can help with next/)
})

test("browser inspection rejects connection output instead of treating it as D3 files", async () => {
  const session: D3Session = {
    profile: { name: "broken", type: "ssh", host: "missing.example", account: "DM" },
    async run(command) {
      return {
        command,
        stdout: "",
        stderr: "ssh: Could not resolve hostname missing.example: Name or service not known",
        exitCode: null,
        durationMs: 4,
      }
    },
    async close() {},
  }

  await assert.rejects(() => inspectD3Browser(session), /Could not complete the SSH D3 connection/)
})
