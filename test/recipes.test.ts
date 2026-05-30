import assert from "node:assert/strict"
import test from "node:test"
import { renderRecipe, recipes } from "../src/skills/recipes.js"

test("renders migration recipe with artifact commands", () => {
  const recipe = renderRecipe("migrate")
  assert.match(recipe, /D3-to-Web Migration Recipe/)
  assert.match(recipe, /d3code runbook migrate/)
  assert.match(recipe, /bundle-artifacts/)
  assert.match(recipe, /bundle-goal/)
  assert.match(recipe, /bundle-backlog/)
  assert.match(recipe, /bundle-qa-plan/)
  assert.match(recipe, /bundle-code-plan/)
  assert.match(recipe, /bundle-readiness/)
  assert.match(recipe, /bundle-delegate/)
  assert.match(recipe, /bundle-completion-audit/)
  assert.match(recipe, /bundle-evidence/)
  assert.match(recipe, /goal-audit-bundle/)
  assert.match(recipe, /agent-run file-audit/)
  assert.match(recipe, /agent-run basic-check/)
  assert.match(recipe, /agent-run migration-slice/)
  assert.match(recipe, /bundle-index-plan/)
  assert.match(recipe, /bundle-data-plan/)
  assert.match(recipe, /webapp-check/)
  assert.match(recipe, /webapp-smoke/)
  assert.match(recipe, /d3code openapi/)
  assert.match(recipe, /webapp-skeleton/)
  assert.match(recipe, /d3code adapter-write/)
})

test("recipes surface executable agent loops for audit api and modernize", () => {
  assert.match(renderRecipe("audit"), /agent-run file-audit/)
  assert.match(renderRecipe("audit"), /agent-run basic-check/)
  assert.match(renderRecipe("api"), /agent-run migration-slice/)
  assert.match(renderRecipe("api"), /webapp-check/)
  assert.match(renderRecipe("api"), /webapp-smoke/)
  assert.match(renderRecipe("modernize"), /agent-run basic-check/)
  assert.match(renderRecipe("modernize"), /modernization-proof/)
})

test("lists recipe definitions", () => {
  assert.deepEqual(Object.keys(recipes).sort(), ["api", "audit", "migrate", "modernize"])
})
