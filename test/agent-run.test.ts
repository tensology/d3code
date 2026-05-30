import assert from "node:assert/strict"
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import type { D3CodeConfig } from "../src/config/config.js"
import { renderAgentRunReport, runAgentTask } from "../src/agents/run.js"

async function fakeConfig(): Promise<D3CodeConfig> {
  const home = await mkdtemp(join(tmpdir(), "d3code-agent-run-"))
  const script = join(home, "fake-d3.sh")
  await writeFile(script, [
    "#!/bin/sh",
    "input=$(cat)",
    "case \"$input\" in",
    "  *'LIST DICT CUSTOMERS'*) printf '@ID\\nNAME\\nPHONE\\n' ;;",
    "  *'CT DICT CUSTOMERS @ID'*) printf '001 A\\n002 0\\n003 ID\\n' ;;",
    "  *'CT DICT CUSTOMERS NAME'*) printf '001 A\\n002 1\\n003 Name\\n' ;;",
    "  *'CT DICT CUSTOMERS PHONE'*) printf '001 A\\n002 2\\n003 Phone\\n' ;;",
    "  *'LIST-INDEX CUSTOMERS'*) printf 'NAME\\n' ;;",
    "  *'SELECT CUSTOMERS SAMPLE 2'*) printf '100\\n101\\n' ;;",
    "  *'CT CUSTOMERS 100'*) printf 'Aliceþ555-0100\\n' ;;",
    "  *'CT CUSTOMERS 101'*) printf 'Bobþ555-0101\\n' ;;",
    "  *'CT BP GET.CUSTOMER'*) printf 'SUBROUTINE GET.CUSTOMER(ID)\\nOPEN \"CUSTOMERS\" TO F ELSE STOP\\nRETURN\\n' ;;",
    "  *'BASIC BP GET.CUSTOMER'*) printf 'BASIC OK\\n' ;;",
    "  *'CATALOG BP GET.CUSTOMER'*) printf 'CATALOG OK\\n' ;;",
    "  *) printf 'UNKNOWN\\n' ;;",
    "esac",
    "",
  ].join("\n"), { mode: 0o755 })
  return {
    version: 1,
    defaultModel: "openai/gpt-5",
    defaultSafety: "ask",
    defaultProfile: "fake",
    profiles: [{ name: "fake", type: "local", account: "SALES", entryCommand: script }],
    modelSecrets: {},
  }
}

test("agent-run basic-check reads, lints, compiles, and catalogs with evidence", async () => {
  const report = await runAgentTask(await fakeConfig(), {
    task: "basic-check",
    file: "BP",
    item: "GET.CUSTOMER",
    compile: true,
    catalog: true,
    confirm: true,
  })

  assert.equal(report.ready, true)
  assert.deepEqual(report.steps.map((step) => step.id), ["read-item", "lint-basic", "compile-basic", "catalog-basic"])
  assert.equal(report.steps.find((step) => step.id === "compile-basic")?.status, "ok")
  assert.match(renderAgentRunReport(report), /D3 Agent Run: basic-check/)
  assert.match(renderAgentRunReport(report), /CATALOG OK/)
})

test("agent-run file-audit inventories dictionary, indexes, and samples", async () => {
  const report = await runAgentTask(await fakeConfig(), {
    task: "file-audit",
    file: "CUSTOMERS",
    sampleLimit: 2,
  })

  assert.equal(report.agent, "d3-data-mapper")
  assert.equal(report.ready, true)
  assert.deepEqual(report.steps.map((step) => step.id), ["dictionary-inventory", "dictionary-validation", "index-inventory", "index-validation", "sample-records", "data-shape-validation"])
  assert.match(renderAgentRunReport(report), /dictionary items:3/)
  assert.match(renderAgentRunReport(report), /validated dictionary items:3/)
  assert.match(renderAgentRunReport(report), /observed indexes:NAME/)
  assert.match(renderAgentRunReport(report), /all observed indexes have sampled dictionary items/)
  assert.match(renderAgentRunReport(report), /100:attrs=2/)
  assert.match(renderAgentRunReport(report), /data-shape-validation/)
  assert.match(renderAgentRunReport(report), /shape consistency ok/)
})

test("agent-run file-audit flags inconsistent sampled data shapes", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-agent-shape-audit-"))
  const script = join(home, "fake-d3.sh")
  await writeFile(script, [
    "#!/bin/sh",
    "input=$(cat)",
    "case \"$input\" in",
    "  *'LIST DICT ORDERS'*) printf '@ID\\nDATE\\nTOTAL\\n' ;;",
    "  *'CT DICT ORDERS @ID'*) printf '001 A\\n002 0\\n003 ID\\n' ;;",
    "  *'CT DICT ORDERS DATE'*) printf '001 A\\n002 1\\n003 Date\\n' ;;",
    "  *'CT DICT ORDERS TOTAL'*) printf '001 A\\n002 2\\n003 Total\\n' ;;",
    "  *'LIST-INDEX ORDERS'*) printf 'DATE\\n' ;;",
    "  *'SELECT ORDERS SAMPLE 2'*) printf 'A1\\nA2\\n' ;;",
    "  *'CT ORDERS A1'*) printf '2026-05-28þ100.00\\n' ;;",
    "  *'CT ORDERS A2'*) printf '2026-05-28þ100.00þEXTRA\\n' ;;",
    "  *) printf 'UNKNOWN\\n' ;;",
    "esac",
    "",
  ].join("\n"), { mode: 0o755 })
  const report = await runAgentTask({
    version: 1,
    defaultModel: "openai/gpt-5",
    defaultSafety: "ask",
    defaultProfile: "fake",
    profiles: [{ name: "fake", type: "local", account: "SALES", entryCommand: script }],
    modelSecrets: {},
  }, {
    task: "file-audit",
    file: "ORDERS",
    sampleLimit: 2,
  })

  assert.equal(report.ready, false)
  assert.equal(report.steps.find((step) => step.id === "data-shape-validation")?.status, "warning")
  assert.match(renderAgentRunReport(report), /inconsistent attribute counts/)
})

test("agent-run file-audit flags invalid dictionary attributes", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-agent-dict-audit-"))
  const script = join(home, "fake-d3.sh")
  await writeFile(script, [
    "#!/bin/sh",
    "input=$(cat)",
    "case \"$input\" in",
    "  *'LIST DICT CUSTOMERS'*) printf '@ID\\nAGE\\n' ;;",
    "  *'CT DICT CUSTOMERS @ID'*) printf '001 A\\n002 0\\n003 ID\\n' ;;",
    "  *'CT DICT CUSTOMERS AGE'*) printf '001 A\\n002 -1\\n003 Age\\n' ;;",
    "  *'LIST-INDEX CUSTOMERS'*) printf 'AGE\\n' ;;",
    "  *'SELECT CUSTOMERS SAMPLE 1'*) printf '100\\n' ;;",
    "  *'CT CUSTOMERS 100'*) printf 'Aliceþ42\\n' ;;",
    "  *) printf 'UNKNOWN\\n' ;;",
    "esac",
    "",
  ].join("\n"), { mode: 0o755 })
  const report = await runAgentTask({
    version: 1,
    defaultModel: "openai/gpt-5",
    defaultSafety: "ask",
    defaultProfile: "fake",
    profiles: [{ name: "fake", type: "local", account: "SALES", entryCommand: script }],
    modelSecrets: {},
  }, {
    task: "file-audit",
    file: "CUSTOMERS",
    sampleLimit: 1,
  })

  assert.equal(report.ready, false)
  assert.equal(report.steps.find((step) => step.id === "dictionary-validation")?.status, "warning")
  assert.match(renderAgentRunReport(report), /Dictionary attribute number must be a non-negative integer/)
})

test("agent-run file-audit flags indexes without sampled dictionary items", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-agent-index-audit-"))
  const script = join(home, "fake-d3.sh")
  await writeFile(script, [
    "#!/bin/sh",
    "input=$(cat)",
    "case \"$input\" in",
    "  *'LIST DICT CUSTOMERS'*) printf '@ID\\nNAME\\n' ;;",
    "  *'CT DICT CUSTOMERS @ID'*) printf '001 A\\n002 0\\n003 ID\\n' ;;",
    "  *'CT DICT CUSTOMERS NAME'*) printf '001 A\\n002 1\\n003 Name\\n' ;;",
    "  *'LIST-INDEX CUSTOMERS'*) printf 'NAME\\nPHONE\\n' ;;",
    "  *'SELECT CUSTOMERS SAMPLE 1'*) printf '100\\n' ;;",
    "  *'CT CUSTOMERS 100'*) printf 'Aliceþ555-0100\\n' ;;",
    "  *) printf 'UNKNOWN\\n' ;;",
    "esac",
    "",
  ].join("\n"), { mode: 0o755 })
  const report = await runAgentTask({
    version: 1,
    defaultModel: "openai/gpt-5",
    defaultSafety: "ask",
    defaultProfile: "fake",
    profiles: [{ name: "fake", type: "local", account: "SALES", entryCommand: script }],
    modelSecrets: {},
  }, {
    task: "file-audit",
    file: "CUSTOMERS",
    sampleLimit: 1,
  })

  assert.equal(report.ready, false)
  assert.equal(report.steps.find((step) => step.id === "index-validation")?.status, "warning")
  assert.match(renderAgentRunReport(report), /PHONE:Observed index has no sampled dictionary item/)
})

test("agent-run basic-check reports compile as blocked without confirmation", async () => {
  const report = await runAgentTask(await fakeConfig(), {
    task: "basic-check",
    file: "BP",
    item: "GET.CUSTOMER",
    compile: true,
    catalog: true,
  })

  assert.equal(report.ready, false)
  assert.equal(report.steps.find((step) => step.id === "compile-basic")?.status, "blocked")
  assert.equal(report.steps.find((step) => step.id === "catalog-basic")?.status, "skipped")
  assert.match(renderAgentRunReport(report), /Confirmation required/)
})

test("agent-run migration-slice writes and checks web/API artifacts", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-agent-migration-slice-"))
  const bundleFile = join(home, "bundle.json")
  const out = join(home, "out")
  await writeFile(bundleFile, JSON.stringify({
    account: "SALES",
    profile: "prod",
    files: [{
      name: "CUSTOMERS",
      suggestedResource: "customers",
      dictionary: [{ id: "@ID", attribute: 0 }, { id: "NAME", attribute: 1 }],
      records: [{ id: "100", raw: "Alice" }],
      observedIndexes: ["NAME"],
    }],
    programs: [{ file: "BP", item: "GET.CUSTOMER", source: "SUBROUTINE GET.CUSTOMER(ID)\nRETURN\n" }],
  }))

  const report = await runAgentTask({
    version: 1,
    defaultModel: "openai/gpt-5",
    defaultSafety: "ask",
    profiles: [],
    modelSecrets: {},
  }, {
    task: "migration-slice",
    file: bundleFile,
    outDir: out,
  })

  assert.equal(report.ready, true)
  assert.deepEqual(report.steps.map((step) => step.id), ["parse-bundle", "write-artifacts", "webapp-check", "webapp-smoke", "qa-evidence", "refresh-proof"])
  assert.ok(report.steps.find((step) => step.id === "webapp-check")?.evidence.some((entry) => /items:[1-9][0-9]/.test(entry)))
  assert.equal(report.steps.find((step) => step.id === "qa-evidence")?.status, "ok")
  assert.equal(report.steps.find((step) => step.id === "refresh-proof")?.status, "ok")
  assert.match(renderAgentRunReport(report), /written:/)
  assert.match(renderAgentRunReport(report), /api-smoke-tests:ok/)
  await access(join(out, "src/server.ts"))
  await access(join(out, "test/api-smoke.test.mjs"))
  assert.match(await readFile(join(out, "qa-evidence.md"), "utf8"), /Ready: yes/)
  assert.match(await readFile(join(out, "goal-evidence.md"), "utf8"), /qa-evidence=ready/)
  assert.match(await readFile(join(out, "completion-audit.md"), "utf8"), /qa-evidence:ok/)
})
