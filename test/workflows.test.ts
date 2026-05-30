import assert from "node:assert/strict"
import test from "node:test"
import { renderWorkflow, workflowForMode } from "../src/skills/workflows.js"

test("renders migration workflow with baked skill section", () => {
  const rendered = renderWorkflow("migrate")
  assert.match(rendered, /D3-to-Web Migration Workflow/)
  assert.match(rendered, /Baked Skills/)
  assert.match(rendered, /Generate API/)
})

test("returns audit workflow template", () => {
  const workflow = workflowForMode("audit")
  assert.equal(workflow.mode, "audit")
  assert.ok(workflow.steps.some((step) => step.id === "data"))
})
