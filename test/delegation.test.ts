import assert from "node:assert/strict"
import test from "node:test"
import { delegationPlanForMode, renderDelegationPlan } from "../src/agents/delegation.js"

test("migration delegation plan includes D3 architecture, data mapping, and verification subagents", () => {
  const plan = delegationPlanForMode("migrate")
  assert.equal(plan.primary.id, "d3-operator")
  assert.deepEqual(plan.tasks.map((task) => task.agent), ["d3-architect", "d3-data-mapper", "d3-test-runner"])
  assert.ok(plan.tasks.every((task) => task.evidenceGate.length > 0))
})

test("modernization delegation plan includes modernizer and linter evidence gates", () => {
  const rendered = renderDelegationPlan("modernize")
  assert.match(rendered, /Modernization Mode Delegation Plan/)
  assert.match(rendered, /d3-basic-modernizer/)
  assert.match(rendered, /d3-linter/)
  assert.match(rendered, /Evidence gate/)
})
