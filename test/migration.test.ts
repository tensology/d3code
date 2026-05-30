import assert from "node:assert/strict"
import test from "node:test"
import { auditD3Application } from "../src/audit/audit.js"
import { createMigrationPlan } from "../src/migration/planner.js"

const program = `SUBROUTINE GET.CUSTOMER(ID)
OPEN "CUSTOMERS" TO F.CUSTOMERS ELSE STOP
CALL NORMALIZE.NAME(ID)
READ REC FROM F.CUSTOMERS, ID ELSE REC = ""
RETURN
`

test("creates REST resource and service migration plan", () => {
  const plan = createMigrationPlan({
    account: "SALES",
    files: [{ file: "CUSTOMERS", suggestedResource: "customers", dictionaryItems: [{ id: "@ID", attribute: 0 }, { id: "NAME", attribute: 1 }, { id: "TOTAL.VALUE", attribute: 2, conversion: "MR2" }] }],
    programs: [{ file: "BP", item: "GET.CUSTOMER", source: program }],
  })
  assert.equal(plan.strategy, "strangler")
  assert.deepEqual(plan.resources[0]?.endpoints, ["GET /customers", "GET /customers/{id}", "POST /customers", "PATCH /customers/{id}"])
  assert.deepEqual(plan.resources[0]?.fields?.map((field) => field.name), ["name", "totalValue"])
  assert.equal(plan.resources[0]?.fields?.[1]?.type, "number")
  assert.deepEqual(plan.services[0]?.calls, ["NORMALIZE.NAME"])
  assert.deepEqual(plan.services[0]?.opens, ["CUSTOMERS"])
})

test("audits dictionaries and program findings", () => {
  const report = auditD3Application({
    account: "SALES",
    dictionaries: [{ file: "CUSTOMERS", items: [] }],
    programs: [{ file: "BP", item: "SAVE.CUSTOMER", source: 'READU REC FROM F, ID ELSE REC=""\nWRITE REC ON F, ID\n' }],
  })
  assert.ok(report.dictionaryFindings.some((finding) => finding.severity === "warning"))
  assert.ok(report.programFindings.some((finding) => finding.finding.code === "D3_READU_NO_RELEASE"))
  assert.ok(report.callGraph.some((entry) => entry.program === "BP/SAVE.CUSTOMER"))
  assert.ok(report.codeMap.programs.some((entry) => entry.program === "BP/SAVE.CUSTOMER"))
  assert.ok(report.codeMap.fileUsage.some((usage) => usage.writers.length > 0))
})
