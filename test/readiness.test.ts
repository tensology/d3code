import assert from "node:assert/strict"
import test from "node:test"
import type { D3CodeConfig } from "../src/config/config.js"
import { createLiveProofReport, profileDoctorGoalEvidence, renderLiveProofReport } from "../src/d3/live-proof.js"
import { createReadinessReport, renderReadinessReport } from "../src/quality/readiness.js"
import { EnvSecretStore } from "../src/security/secrets.js"
import { createSetupProofReport, renderSetupProofReport } from "../src/setup/proof.js"

test("readiness report distinguishes implemented features from proof gates", async () => {
  const config: D3CodeConfig = {
    version: 1,
    defaultModel: "openai/gpt-5",
    defaultSafety: "ask",
    profiles: [],
    modelSecrets: {},
  }

  const report = await createReadinessReport(config)

  assert.equal(report.ready, false)
  assert.equal(report.gates.find((gate) => gate.id === "reference-skills")?.status, "ok")
  assert.equal(report.gates.find((gate) => gate.id === "setup-proof")?.status, "missing")
  assert.equal(report.gates.find((gate) => gate.id === "d3-profile")?.status, "missing")
  assert.equal(report.gates.find((gate) => gate.id === "live-d3-proof")?.status, "action")
  assert.match(renderReadinessReport(report), /Ready: no/)
})

test("readiness report recognizes configured profiles without claiming live D3 proof", async () => {
  const config: D3CodeConfig = {
    version: 1,
    defaultModel: "openai/gpt-5",
    defaultSafety: "ask",
    defaultProfile: "prod",
    profiles: [{ name: "prod", type: "local", account: "SALES", sessionMode: "persistent", promptPattern: ">" }],
    modelSecrets: { openai: "env:OPENAI_API_KEY" },
  }

  process.env.OPENAI_API_KEY = "test-key"
  const report = await createReadinessReport(config, new EnvSecretStore())

  assert.equal(report.ready, false)
  assert.equal(report.gates.find((gate) => gate.id === "model-selection")?.status, "ok")
  assert.equal(report.gates.find((gate) => gate.id === "setup-proof")?.status, "action")
  assert.equal(report.gates.find((gate) => gate.id === "d3-profile")?.status, "ok")
  assert.equal(report.gates.find((gate) => gate.id === "terminal-session")?.status, "ok")
  assert.equal(report.gates.find((gate) => gate.id === "terminal-bridge")?.status, "action")
  assert.equal(report.gates.find((gate) => gate.id === "live-d3-proof")?.status, "action")
  assert.match(renderReadinessReport(report), /live-proof --profile prod --run/)
  assert.match(renderReadinessReport(report), /terminal-plan --profile prod/)
  assert.match(renderReadinessReport(report), /model-proof-ready: yes/)
})

test("setup proof audits first-run model, secret, profile, account, session, prompt, allowlist, and safety", () => {
  const ready = createSetupProofReport({
    version: 1,
    defaultModel: "anthropic/claude-sonnet-4-5",
    defaultSafety: "ask",
    defaultProfile: "prod",
    profiles: [{ name: "prod", type: "ssh", host: "d3.example", username: "d3", account: "SALES", sessionMode: "persistent", promptPattern: ">", allowedAccounts: ["SALES", "DM"] }],
    modelSecrets: { anthropic: "env:ANTHROPIC_API_KEY" },
  })
  assert.equal(ready.ready, true)
  assert.ok(ready.items.every((item) => item.status === "ok"))
  assert.match(renderSetupProofReport(ready), /D3 Code Setup Proof/)
  assert.match(renderSetupProofReport(ready), /allowed accounts: SALES, DM/)

  const missing = createSetupProofReport({
    version: 1,
    defaultModel: "openai/gpt-5",
    defaultSafety: "ask",
    profiles: [{ name: "prod", type: "local", account: "SALES" }],
    modelSecrets: {},
  })
  assert.equal(missing.ready, false)
  assert.equal(missing.items.find((item) => item.id === "model-secret-reference")?.status, "action")
  assert.equal(missing.items.find((item) => item.id === "persistent-session")?.status, "action")
  assert.equal(missing.items.find((item) => item.id === "prompt-pattern")?.status, "action")
  assert.equal(missing.items.find((item) => item.id === "account-allowlist")?.status, "action")
})

test("live proof report gives setup commands when no D3 profile exists", () => {
  const report = createLiveProofReport({ version: 1, defaultModel: "openai/gpt-5", defaultSafety: "ask", profiles: [], modelSecrets: {} })
  assert.equal(report.ready, false)
  assert.equal(report.steps.find((step) => step.id === "profile-config")?.status, "missing")
  assert.match(renderLiveProofReport(report), /profile-add-local/)
})

test("live proof report can include passing profile doctor evidence", () => {
  const config: D3CodeConfig = {
    version: 1,
    defaultModel: "openai/gpt-5",
    defaultSafety: "ask",
    defaultProfile: "prod",
    profiles: [{ name: "prod", type: "local", account: "SALES", sessionMode: "persistent", promptPattern: ">" }],
    modelSecrets: {},
  }
  const doctor = {
    profile: "prod",
    type: "local" as const,
    account: "SALES",
    sessionMode: "persistent" as const,
    ready: true,
    checks: [
      { name: "who", command: "WHO", ok: true, exitCode: 0, durationMs: 1, output: "SALES" },
      { name: "version", command: "VERSION", ok: true, exitCode: 0, durationMs: 1, output: "D3 10.3" },
      { name: "md-list", command: "LIST MD (N", ok: true, exitCode: 0, durationMs: 1, output: "MD" },
    ],
  }
  const report = createLiveProofReport(config, "prod", doctor)
  assert.equal(report.ready, true)
  assert.match(renderLiveProofReport(report), /who:ok/)
  assert.match(renderLiveProofReport(report), /profile-doctor passed for prod/)
  assert.match(profileDoctorGoalEvidence(doctor), /checks=who:ok,version:ok,md-list:ok/)
})
