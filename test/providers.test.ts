import assert from "node:assert/strict"
import test from "node:test"
import { resolveModel } from "../src/providers/catalog.js"
import { createModelProofReport, renderModelProofReport } from "../src/providers/proof.js"
import { createModelRoutingPlan, renderModelRoutingPlan } from "../src/providers/routing.js"
import { EnvSecretStore } from "../src/security/secrets.js"

test("resolves provider/model refs", () => {
  const resolved = resolveModel("openai/gpt-5")
  assert.equal(resolved.provider.id, "openai")
  assert.equal(resolved.model, "gpt-5")
})

test("creates D3 mode-aware model routing plans", () => {
  const plan = createModelRoutingPlan({
    version: 1,
    defaultModel: "openai/gpt-5",
    defaultSafety: "ask",
    profiles: [],
    modelSecrets: { openai: "env:OPENAI_API_KEY", anthropic: "env:ANTHROPIC_API_KEY" },
  }, "migrate", "balanced")

  assert.equal(plan.mode, "migrate")
  assert.ok(plan.routes.some((route) => route.role.includes("architect") && route.recommended === "openai/gpt-5"))
  assert.ok(plan.routes.some((route) => route.role.includes("QA") && route.safety === "plan"))
  assert.match(renderModelRoutingPlan(plan), /D3 Model Routing Plan: migrate/)
  assert.match(renderModelRoutingPlan(plan), /D3-to-web architect/)
})

test("model routing can bias toward Ollama", () => {
  const plan = createModelRoutingPlan({
    version: 1,
    defaultModel: "ollama/llama3.1",
    defaultSafety: "plan",
    profiles: [],
    modelSecrets: {},
  }, "audit", "local")

  assert.equal(plan.ready, true)
  assert.ok(plan.routes.every((route) => route.recommended === "ollama/llama3.1"))
})

test("resolves legacy local model refs to Ollama", () => {
  const resolved = resolveModel("local/local/default")
  assert.equal(resolved.provider.id, "ollama")
  assert.equal(resolved.model, "llama3.1")
})

test("model proof verifies default provider and routing readiness", async () => {
  const previous = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = "test-key"
  try {
    const report = await createModelProofReport({
      version: 1,
      defaultModel: "openai/gpt-5",
      defaultSafety: "ask",
      profiles: [],
      modelSecrets: { openai: "env:OPENAI_API_KEY" },
    }, new EnvSecretStore(), { mode: "migrate" })
    assert.equal(report.ready, true)
    assert.ok(report.items.some((entry) => entry.id === "provider-openai" && entry.status === "ok"))
    assert.ok(report.items.some((entry) => entry.id === "routing-readiness"))
    assert.match(renderModelProofReport(report), /D3 Model Proof/)
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previous
  }
})

test("model proof reports missing default provider secret", async () => {
  const previous = process.env.OPENAI_API_KEY
  delete process.env.OPENAI_API_KEY
  try {
    const report = await createModelProofReport({
      version: 1,
      defaultModel: "openai/gpt-5",
      defaultSafety: "ask",
      profiles: [],
      modelSecrets: {},
    }, new EnvSecretStore(), { mode: "migrate" })
    assert.equal(report.ready, false)
    assert.ok(report.items.some((entry) => entry.id === "provider-openai" && entry.status === "missing"))
  } finally {
    if (previous !== undefined) process.env.OPENAI_API_KEY = previous
  }
})
