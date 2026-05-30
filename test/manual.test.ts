import assert from "node:assert/strict"
import test from "node:test"
import { manualCommandCapabilities, readManualText, scopeManual } from "../src/d3/manual.js"

test("manual scoping reports expected D3 domains", () => {
  const report = scopeManual(`
Access Query Language AQL LIST SELECT SORT
BASIC FlashBASIC SUBROUTINE CATALOG COMPILE
Terminal Control Language TCL tcl-stack
account master dictionary mds Q-pointer D-pointer
file reference dictionary attribute item-ID data section
lock locked READU RELEASE transaction
trigger phantom callx callc callo
debugger DEBUG symbolic debugger breakpoint
screen.display screen.input screen.init screen.erase CRT DISPLAY INPUT @(-1) cursor-control terminal type PROC processor
`)
  assert.equal(report.totalLines, 11)
  assert.equal(report.topics.length, 9)
  assert.equal(report.capabilities.length, manualCommandCapabilities.length)
  assert.ok(report.topics.every((topic) => topic.hits > 0))
  assert.ok(report.capabilities.some((capability) => capability.id === "backup-restore" && capability.surface === "raw-tcl-only"))
  assert.ok(report.capabilities.some((capability) => capability.id === "basic-subroutines" && capability.surface === "typed"))
})

test("manual scoping can read repo-local PDF manuals", async () => {
  const referenceManual = scopeManual(await readManualText("reference/d3_reference_manual_10.3.4_5-28-2026.pdf"))
  assert.ok(referenceManual.totalLines > 1000)
  assert.equal(referenceManual.capabilities.find((item) => item.id === "backup-restore")?.manualStatus, "ok")
  assert.equal(referenceManual.capabilities.find((item) => item.id === "screens-terminal")?.manualStatus, "ok")

  const userGuide = scopeManual(await readManualText("reference/d3_user_guide_version_10_3_4_2026-05-28-20-56-09.pdf"))
  assert.ok(userGuide.totalLines > 1000)
  assert.equal(userGuide.capabilities.find((item) => item.id === "files-dictionaries-items")?.manualStatus, "ok")
})
