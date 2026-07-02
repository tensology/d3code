import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { promisify } from "node:util"
import { createScreenAudit, renderScreenAudit } from "../src/screens/audit.js"
import { createSbplusScreenPlan, renderSbplusScreenPlan } from "../src/screens/sbplus-plan.js"
import { skillCoverageReport } from "../src/skills/coverage.js"
import { getMode, skills } from "../src/skills/modes.js"

const execFileAsync = promisify(execFile)

test("screen workflow audits BASIC and transcript evidence into migration UI spec", () => {
  const audit = createScreenAudit({
    name: "ORDER.ENTRY",
    basicSource: [
      "CRT @(-1):@(10,2):'Order Entry'",
      "CRT @(5,5):'Customer:'",
      "INPUT CUSTOMER.ID",
      "CRT @(5,6):'Amount:'",
      "INPUT ORDER.AMOUNT",
      "IF ORDER.AMOUNT = '' THEN PRINT 'Required'",
    ].join("\n"),
    transcript: "@(-1)Order Entry@(5,5)Customer:@(5,6)Amount:",
    width: 40,
    height: 10,
  })

  assert.equal(audit.screenType, "input-form")
  assert.equal(audit.mutationRisk, "transaction")
  assert.ok(audit.fields.some((field) => field.name === "CUSTOMER.ID" && field.source === "basic-input"))
  assert.ok(audit.actions.some((action) => action.kind === "enter-submit"))
  assert.ok(audit.uiSpec.fields.some((field) => field.label === "Customer"))
  assert.ok(audit.proofChecklist.some((item) => item.includes("screen-buffer")))
  assert.match(renderScreenAudit(audit), /D3 Screen Audit: ORDER\.ENTRY/)
  assert.match(renderScreenAudit(audit), /input-form/)
})

test("SB+ screen plan is explicit about no direct definition-record writes", () => {
  const plan = createSbplusScreenPlan({
    system: "SALES",
    process: "ORDER.ENTRY",
    kind: "input process",
    file: "ORDERS",
    fields: ["CUSTOMER", "ORDER.DATE", "TOTAL"],
    notes: "F3 accepts, F1 help required.",
  })

  assert.equal(plan.system, "SALES")
  assert.equal(plan.writePolicy, "no-direct-definition-record-writes")
  assert.ok(plan.fieldMap.some((field) => field.name === "CUSTOMER" && field.validation.includes("confirm dictionary item")))
  assert.ok(plan.actions.some((action) => action.key === "F3"))
  assert.ok(plan.referenceFamilies.includes("system-builder"))
  assert.match(renderSbplusScreenPlan(plan), /SB\+ Screen Plan: SALES\/ORDER\.ENTRY/)
  assert.match(renderSbplusScreenPlan(plan), /No direct SB\+ definition-record writes/)
})

test("CLI exposes screen-audit and sbplus-screen-plan", async () => {
  const dir = await mkdtemp(join(tmpdir(), "d3code-screen-workflow-"))
  const basic = join(dir, "ORDER.SCREEN.b")
  const transcript = join(dir, "screen.txt")
  await writeFile(basic, "CRT @(-1):'Order Entry'\nCRT @(5,5):'Customer:'\nINPUT CUSTOMER.ID\n")
  await writeFile(transcript, "@(-1)Order Entry@(5,5)Customer:")

  const audit = await execFileAsync("node", ["dist/src/cli.js", "screen-audit", basic, "--transcript", transcript, "--json"], { cwd: process.cwd() })
  const parsedAudit = JSON.parse(audit.stdout) as { screenType: string; uiSpec: { fields: Array<{ name: string }> } }
  assert.equal(parsedAudit.screenType, "input-form")
  assert.ok(parsedAudit.uiSpec.fields.some((field) => field.name === "CUSTOMER.ID"))

  const plan = await execFileAsync("node", ["dist/src/cli.js", "sbplus-screen-plan", "--system", "SALES", "--process", "ORDER.ENTRY", "--file", "ORDERS", "--field", "CUSTOMER", "--field", "TOTAL"], { cwd: process.cwd() })
  assert.match(plan.stdout, /SB\+ Screen Plan: SALES\/ORDER\.ENTRY/)
  assert.match(plan.stdout, /No direct SB\+ definition-record writes/)
})

test("D3 screen workflow is a baked migration and modernization skill", () => {
  assert.ok(skills.some((skill) => skill.id === "d3-screen-workflow" && skill.appliesToD3))
  assert.ok(getMode("migrate")?.skills.includes("d3-screen-workflow"))
  assert.ok(getMode("modernize")?.skills.includes("d3-screen-workflow"))
  assert.ok(skillCoverageReport().items.some((item) => item.evidence.includes("command:screen-audit") && item.evidence.includes("command:sbplus-screen-plan") && item.covered))
})
