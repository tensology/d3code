import assert from "node:assert/strict"
import test from "node:test"
import { createHarnessDoctorReport, renderHarnessDoctorReport } from "../src/quality/harness-doctor.js"
import type { D3CodeConfig } from "../src/config/config.js"

test("harness doctor aggregates readiness gates without discarding partial evidence", async () => {
  const config: D3CodeConfig = {
    version: 1,
    defaultModel: "openai/gpt-5",
    defaultSafety: "ask",
    profiles: [],
    modelSecrets: {},
  }

  const report = await createHarnessDoctorReport(config, {
    modelProof: {
      ready: false,
      defaultModel: "openai/gpt-5",
      items: [{ id: "provider-openai", status: "missing", evidence: ["env:OPENAI_API_KEY"], next: "Set OPENAI_API_KEY." }],
    },
    ragStatus: { ready: true, chunks: 12, sources: [], builtAt: "2026-06-22T00:00:00.000Z" },
    referenceAudit: { root: "reference", ready: true, total: 1, items: [] },
    skillCoverage: { ready: true, items: [] },
    hermesStatus: { enabled: true, ready: false, eccRoot: undefined, adaptedSkills: 2, presentSkills: 1, items: [] },
  })

  assert.equal(report.ready, false)
  assert.ok(report.gates.some((gate) => gate.id === "model-proof" && gate.status === "action"))
  assert.ok(report.gates.some((gate) => gate.id === "rag-status" && gate.status === "ok"))
  assert.ok(report.gates.some((gate) => gate.id === "hermes-status" && gate.status === "action"))
  assert.match(renderHarnessDoctorReport(report), /D3Code Harness Doctor/)
  assert.match(renderHarnessDoctorReport(report), /provider-openai/)
})
