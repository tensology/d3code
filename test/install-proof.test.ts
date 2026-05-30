import assert from "node:assert/strict"
import test from "node:test"
import { createInstallProofReport, renderInstallProofReport } from "../src/quality/install-proof.js"

test("install proof verifies d3code command entrypoint", async () => {
  const report = await createInstallProofReport()
  assert.equal(report.ready, true)
  assert.ok(report.checks.some((entry) => entry.id === "package-bin" && entry.status === "ok"))
  assert.ok(report.checks.some((entry) => entry.id === "ink-runtime" && entry.status === "ok"))
  assert.ok(report.checks.some((entry) => entry.id === "terminal-start-script" && entry.status === "ok"))
  assert.ok(report.checks.some((entry) => entry.id === "interactive-default-launch" && entry.status === "ok" && entry.evidence.includes("first-run-setup:yes") && entry.evidence.includes("ink-app-render:yes")))
  assert.ok(report.checks.some((entry) => entry.id === "dist-cli" && entry.status === "ok"))
  assert.ok(report.checks.some((entry) => entry.id === "dist-cli-executable" && entry.status === "ok"))
  assert.ok(report.checks.some((entry) => entry.id === "d3code-help" && entry.status === "ok"))
  assert.match(renderInstallProofReport(report), /D3 Code Install Proof/)
  assert.match(renderInstallProofReport(report), /interactive-default-launch/)
})
