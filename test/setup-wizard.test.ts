import assert from "node:assert/strict"
import test from "node:test"
import { resolveSetupChoice, type Choice } from "../src/setup/wizard.js"

const choices: Choice[] = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "openrouter", label: "OpenRouter" },
  { id: "ollama", label: "Ollama" },
  { id: "kilocode", label: "Kilo Code Gateway" },
]

test("setup choices accept numbers, ids, labels, and defaults", () => {
  assert.equal(resolveSetupChoice("", choices, "openai"), "openai")
  assert.equal(resolveSetupChoice("4", choices, "openai"), "ollama")
  assert.equal(resolveSetupChoice("5", choices, "openai"), "kilocode")
  assert.equal(resolveSetupChoice("ollama", choices, "openai"), "ollama")
  assert.equal(resolveSetupChoice("Ollama", choices, "openai"), "ollama")
  assert.equal(resolveSetupChoice("Kilo Code Gateway", choices, "openai"), "kilocode")
})

test("setup choices support numbered model selection", () => {
  const models: Choice[] = [
    { id: "anthropic/claude-sonnet-4.5", label: "anthropic/claude-sonnet-4.5" },
    { id: "openai/gpt-5", label: "openai/gpt-5" },
    { id: "google/gemini-2.5-pro", label: "google/gemini-2.5-pro" },
  ]

  assert.equal(resolveSetupChoice("2", models, "anthropic/claude-sonnet-4.5"), "openai/gpt-5")
  assert.equal(resolveSetupChoice("", models, "anthropic/claude-sonnet-4.5"), "anthropic/claude-sonnet-4.5")
  assert.equal(resolveSetupChoice("custom/model", models, "anthropic/claude-sonnet-4.5"), "custom/model")
})

test("setup choices preserve unknown typed values for validation elsewhere", () => {
  assert.equal(resolveSetupChoice("custom-provider", choices, "openai"), "custom-provider")
})
