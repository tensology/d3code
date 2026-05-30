import assert from "node:assert/strict"
import test from "node:test"
import { auditDatabaseSamples } from "../src/audit/database.js"
import { validateDictionary } from "../src/audit/dictionary.js"

test("validates D3 dictionary samples", () => {
  const findings = validateDictionary("CUSTOMERS", [
    { id: "NAME", type: "A", attribute: 1 },
    { id: "AGE", type: "A", attribute: -1 },
    { id: "TOTAL", type: "A", attribute: 3, conversion: "CALL CALC.TOTAL" },
  ])
  assert.ok(findings.some((finding) => finding.message.includes("No obvious ID")))
  assert.ok(findings.some((finding) => finding.severity === "error" && finding.item === "AGE"))
  assert.ok(findings.some((finding) => finding.message.includes("procedural logic")))
})

test("audits database samples for shape and index issues", () => {
  const report = auditDatabaseSamples([
    {
      file: "CUSTOMERS",
      dictionary: [{ id: "@ID", type: "A", attribute: 0 }, { id: "NAME", type: "A", attribute: 1 }],
      records: [
        { id: "1", raw: "Alice\u00feRetail" },
        { id: "2", raw: "Bob\u00feWholesale\u00feA\u00fdB" },
      ],
      expectedIndexes: ["NAME", "STATUS"],
      observedIndexes: ["NAME", "LEGACY.IDX"],
    },
  ])
  const file = report.files[0]
  assert.equal(file?.file, "CUSTOMERS")
  assert.ok(file?.shapeFindings.some((finding) => finding.message.includes("inconsistent attribute counts")))
  assert.ok(file?.indexFindings.some((finding) => finding.message.includes("STATUS")))
  assert.ok(file?.indexFindings.some((finding) => finding.message.includes("LEGACY.IDX")))
})
