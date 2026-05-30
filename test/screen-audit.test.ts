import assert from "node:assert/strict"
import test from "node:test"
import { auditBasicScreen } from "../src/d3/screen-audit.js"

test("audits D3 BASIC screen operations and classifies input plus cursor work as high risk", () => {
  const audit = auditBasicScreen([
    "SUBROUTINE MENU()",
    "CRT @(-1):@(10,2):\"Customer\"",
    "INPUT CUSTOMER.ID",
    "PRINT \"Done\"",
    "RETURN",
  ].join("\n"))

  assert.equal(audit.risk, "high")
  assert.deepEqual(audit.operations.map((operation) => operation.kind), ["clear", "input", "display"])
  assert.ok(audit.recommendations.some((recommendation) => recommendation.includes("screen-parse")))
})

test("audits screen-neutral BASIC as no legacy screen risk", () => {
  const audit = auditBasicScreen("SUBROUTINE GET.CUSTOMER(ID)\nRETURN\n")
  assert.equal(audit.risk, "none")
  assert.equal(audit.operations.length, 0)
  assert.match(audit.recommendations[0] ?? "", /No legacy screen operations/)
})
