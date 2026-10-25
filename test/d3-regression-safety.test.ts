import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { classifyD3Command } from "../src/core/permissions.js"
import { runD3Regression } from "../src/quality/d3-regression.js"

test("default regression never executes nonread operations", async () => {
  const dir = await mkdtemp(join(tmpdir(), "d3-regression-safe-"))
  try {
    const log = join(dir, "commands.jsonl")
    const script = join(dir, "fake-d3.mjs")
    await writeFile(script, `import{appendFileSync}from'node:fs';let input='';process.stdin.on('data',chunk=>input+=chunk);process.stdin.on('end',()=>{appendFileSync(${JSON.stringify(log)},JSON.stringify(input)+'\\n');console.log('Page 1 MD\\n1 items listed\\n1 items counted\\nWHO VERSION job-status phantom spooler index');});`)
    const report = await runD3Regression({
      version: 1, defaultModel: "unused", defaultSafety: "ask", defaultProfile: "fake", modelSecrets: {},
      profiles: [{ name: "fake", type: "local", entryCommand: `${process.execPath} "${script}"`, sessionMode: "oneshot" }],
    }, { profile: "fake" })
    for (const id of ["sp-assign", "sp-kill", "scratch-write", "create-index", "print-job"]) {
      assert.equal(report.results.find(result => result.id === id)?.status, "skipped", id)
    }
    const commands: string[] = (await readFile(log, "utf8")).trim().split("\n").map(line => JSON.parse(line))
    assert.ok(commands.length > 20)
    assert.ok(commands.every(command => classifyD3Command(command) === "read"), JSON.stringify(commands))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
