import assert from "node:assert/strict"
import test from "node:test"
import { renderAcceptanceReport, runMockAcceptance } from "../src/quality/acceptance.js"

test("mock acceptance exercises the full offline D3 Code workflow", async () => {
  const report = await runMockAcceptance()
  assert.equal(report.ready, true)
  assert.ok(report.root.includes("d3code-acceptance-"))
  assert.deepEqual(report.steps.map((step) => step.id), [
    "profile-doctor",
    "bundle-capture",
    "bundle-index",
    "bundle-artifacts",
    "webapp-check",
    "qa-evidence",
    "bundle-refresh-evidence",
    "agent-basic-check",
    "agent-file-audit",
    "agent-migration-slice",
    "modernization-proof",
    "goal-evidence",
    "goal-bundle-audit",
    "readiness-gates",
    "completion-audit",
  ])
  assert.ok(report.steps.every((step) => step.ok))

  const rendered = renderAcceptanceReport(report)
  assert.match(rendered, /D3 Code Mock Acceptance/)
  assert.match(rendered, /Ready: yes/)
  assert.match(rendered, /agent-basic-check/)
  assert.match(rendered, /qa-evidence/)
  assert.match(rendered, /bundle-refresh-evidence/)
  assert.match(rendered, /agent-file-audit/)
  assert.match(rendered, /agent-migration-slice/)
  assert.match(rendered, /modernization-proof/)
  assert.match(rendered, /goal-bundle-audit/)
  assert.match(rendered, /live-d3-proof/)
})
