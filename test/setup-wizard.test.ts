import assert from "node:assert/strict"
import test from "node:test"
import { resolveSetupChoice, type Choice } from "../src/setup/wizard.js"

const choices: Choice[] = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "ollama", label: "Ollama" },
]

test("setup choices accept numbers, ids, labels, and defaults", () => {
  assert.equal(resolveSetupChoice("", choices, "openai"), "openai")
  assert.equal(resolveSetupChoice("4", choices, "openai"), "ollama")
  assert.equal(resolveSetupChoice("ollama", choices, "openai"), "ollama")
  assert.equal(resolveSetupChoice("Ollama", choices, "openai"), "ollama")
})

test("setup choices preserve unknown typed values for validation elsewhere", () => {
  assert.equal(resolveSetupChoice("custom-provider", choices, "openai"), "custom-provider")
})
