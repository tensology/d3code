import assert from "node:assert/strict"
import test from "node:test"
import { createSubagentPromptPack, renderSubagentPromptPack } from "../src/agents/tasks.js"
import { createBundleArtifacts, parseBundle } from "../src/app/bundle.js"
import { createBundleSubagentPlan, createBundleSubagentPromptPack, renderBundleSubagentPromptPack } from "../src/app/subagents.js"

test("subagent prompt pack creates isolated D3 migration work packets", () => {
  const pack = createSubagentPromptPack("migrate")
  assert.equal(pack.mode, "migrate")
  assert.ok(pack.specs.length >= 3)

  const architect = pack.specs.find((spec) => spec.agent === "d3-architect")
  assert.ok(architect)
  assert.equal(architect.safety, "plan")
  assert.ok(architect.allowedTools.includes("d3_search"))
  assert.ok(architect.deniedActions.some((action) => action.includes("No writes")))
  assert.match(architect.prompt, /Evidence gate/)
  assert.match(architect.prompt, /Do not claim completion/)

  const runner = pack.specs.find((spec) => spec.agent === "d3-test-runner")
  assert.ok(runner)
  assert.ok(runner.allowedTools.includes("d3_compile_basic"))
  assert.ok(runner.deniedActions.some((action) => action.includes("explicit approval")))
})

test("subagent prompt pack renders reviewable prompts", () => {
  const rendered = renderSubagentPromptPack(createSubagentPromptPack("audit"))
  assert.match(rendered, /Audit Mode Delegation Plan Prompt Pack/)
  assert.match(rendered, /Allowed tools:/)
  assert.match(rendered, /Denied actions:/)
  assert.match(rendered, /```text/)
})

test("bundle subagent prompt pack creates isolated migration task packets", () => {
  const bundle = parseBundle({
    account: "SALES",
    profile: "prod",
    files: [{ name: "CUSTOMERS", suggestedResource: "customers", dictionary: [{ id: "@ID", attribute: 0 }, { id: "NAME", attribute: 1 }], records: [{ id: "100", raw: "Alice" }], expectedIndexes: ["NAME"], observedIndexes: ["NAME"] }],
    programs: [{ file: "BP", item: "UPDATE.CUSTOMER", source: "SUBROUTINE UPDATE.CUSTOMER(ID)\nOPEN \"CUSTOMERS\" TO F ELSE STOP\nWRITE ID ON F,ID\nRETURN\n" }],
  })
  const pack = createBundleSubagentPromptPack(createBundleSubagentPlan(bundle, createBundleArtifacts(bundle)))
  assert.equal(pack.account, "SALES")
  assert.ok(pack.packets.some((packet) => packet.agent === "d3-architect"))
  assert.ok(pack.packets.some((packet) => packet.agent === "d3-basic-modernizer"))
  const modernizer = pack.packets.find((packet) => packet.agent === "d3-basic-modernizer")
  assert.ok(modernizer?.allowedTools.includes("d3_write_item"))
  assert.ok(modernizer?.deniedActions.some((action) => action.includes("CLEAR-FILE")))
  assert.match(modernizer?.prompt ?? "", /Bundle evidence:/)
  assert.match(modernizer?.prompt ?? "", /Evidence gate:/)
  assert.match(renderBundleSubagentPromptPack(pack), /D3 Bundle Subagent Prompt Pack: SALES/)
})
