import assert from "node:assert/strict"
import test from "node:test"
import { createD3CodeMap } from "../src/audit/code-map.js"

const saveOrder = `SUBROUTINE SAVE.ORDER(ID)
COMMON /STATE/ X
OPEN "ORDERS" TO F.ORD ELSE STOP
READU REC FROM F.ORD, ID ELSE REC = ""
CALL PRICE.ORDER(ID)
EXECUTE "LIST ORDERS"
WRITE REC ON F.ORD, ID
RETURN
`

const priceOrder = `SUBROUTINE PRICE.ORDER(ID)
OPEN "ORDERS" TO F.ORD ELSE STOP
READ REC FROM F.ORD, ID ELSE RETURN
RETURN
`

test("creates D3 code map with file usage, unresolved calls, executes, and modernization guidance", () => {
  const map = createD3CodeMap([
    { file: "BP", item: "SAVE.ORDER", source: saveOrder },
    { file: "BP", item: "PRICE.ORDER", source: priceOrder },
    { file: "BP", item: "POST.ORDER", source: 'CALL GL.POST(ID)\nRETURN\n' },
  ])

  assert.equal(map.programs.find((program) => program.program === "BP/SAVE.ORDER")?.risk, "medium")
  assert.ok(map.fileUsage.some((usage) => usage.file === "ORDERS" && usage.writers.includes("BP/SAVE.ORDER")))
  assert.ok(map.executes.some((entry) => entry.command === "LIST ORDERS"))
  assert.ok(map.unresolvedCalls.some((entry) => entry.call === "GL.POST"))
  assert.ok(map.modernizationRecommendations.some((item) => item.includes("read endpoints")))
})
