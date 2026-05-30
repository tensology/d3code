import assert from "node:assert/strict"
import test from "node:test"
import { createModernizationProof, renderModernizationProof } from "../src/app/modernization-proof.js"
import { extractBasicSymbols, lintBasic, parseCompileErrors } from "../src/d3/basic.js"

const source = `SUBROUTINE MAKE.ORDER(ID)
COMMON /STATE/ X
OPEN "ORDERS" TO F.ORD ELSE STOP
READU REC FROM F.ORD, ID ELSE REC = ""
CALL PRICE.ORDER(ID)
EXECUTE "LIST ORDERS"
WRITE REC ON F.ORD, ID
DONE:
RETURN
`

test("extracts pragmatic D3 BASIC symbols", () => {
  const symbols = extractBasicSymbols(source)
  assert.equal(symbols.subroutine, "MAKE.ORDER")
  assert.deepEqual(symbols.calls, ["PRICE.ORDER"])
  assert.deepEqual(symbols.opens, ["ORDERS"])
  assert.deepEqual(symbols.labels, ["DONE"])
})

test("finds lock and write hazards", () => {
  const findings = lintBasic(source)
  assert.ok(findings.some((finding) => finding.code === "D3_READU_NO_RELEASE"))
  assert.ok(findings.some((finding) => finding.code === "D3_WRITE_NO_ERROR_PATH"))
})

test("parses compiler errors", () => {
  const findings = parseCompileErrors("LINE 42 ERROR: Variable has not been assigned")
  assert.deepEqual(findings, [
    { severity: "error", code: "D3_COMPILE", message: "Variable has not been assigned", line: 42 },
  ])
})

test("creates BASIC modernization proof from before and after source", () => {
  const before = `SUBROUTINE GET.CUSTOMER(ID)
OPEN "CUSTOMERS" TO F ELSE STOP
READ REC FROM F, ID ELSE RETURN
RETURN
`
  const after = before.replace("RETURN\n", "REC<9> = TRIM(REC<9>)\nRETURN\n")
  const clean = createModernizationProof({ before, after, compileOutput: "BASIC OK" })
  assert.equal(clean.ready, true)
  assert.ok(clean.checks.some((entry) => entry.id === "symbols-writes" && entry.status === "ok"))
  assert.match(renderModernizationProof(clean), /Ready: yes/)

  const risky = createModernizationProof({ before, after: `${after}\nEXECUTE "CLEAR-FILE CUSTOMERS"\n`, compileOutput: "LINE 9 ERROR: Bad command" })
  assert.equal(risky.ready, false)
  assert.ok(risky.checks.some((entry) => entry.id === "symbols-executes" && entry.status === "blocked"))
  assert.ok(risky.checks.some((entry) => entry.id === "compile-proof" && entry.status === "blocked"))
  assert.match(renderModernizationProof(risky), /blocking modernization regression/)
})
