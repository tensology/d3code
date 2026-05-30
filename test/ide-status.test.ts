import assert from "node:assert/strict"
import test from "node:test"
import type { D3CodeConfig } from "../src/config/config.js"
import { createIdeStatusReport, renderIdeStatusReport } from "../src/quality/ide-status.js"
import { createModernizationGoal } from "../src/goal/goal.js"

test("IDE status report combines runtime state, readiness, live proof, goals, and next commands", async () => {
  const config: D3CodeConfig = {
    version: 1,
    defaultModel: "openai/gpt-5",
    defaultSafety: "ask",
    defaultProfile: "prod",
    profiles: [{ name: "prod", type: "local", account: "SALES", sessionMode: "persistent", promptPattern: ">" }],
    modelSecrets: { openai: "env:OPENAI_API_KEY" },
  }
  const goal = createModernizationGoal("Migrate customers", "Customers web slice works", "migrate")

  const report = await createIdeStatusReport(config, { mode: "migrate", profile: "prod", model: "openai/gpt-5", safety: "ask" }, [goal])
  const rendered = renderIdeStatusReport(report)

  assert.equal(report.ready, false)
  assert.equal(report.profile, "prod")
  assert.equal(report.account, "SALES")
  assert.ok(report.goals.some((entry) => entry.id === goal.id && entry.activePhase === "capture"))
  assert.ok(report.readiness.some((entry) => entry.id === "live-d3-proof"))
  assert.ok(report.liveProof.some((entry) => entry.id === "read-only-smoke"))
  assert.ok(report.nextCommands.some((command) => command.includes("bundle-capture") || command.includes("live-proof")))
  assert.match(rendered, /D3 Code IDE Status/)
  assert.match(rendered, /Active Goals/)
  assert.doesNotMatch(rendered, /- `Run `d3code/)
})
