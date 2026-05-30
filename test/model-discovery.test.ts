import assert from "node:assert/strict"
import test from "node:test"
import { providers } from "../src/providers/catalog.js"
import { discoverProviderModels } from "../src/providers/model-discovery.js"

function provider(id: string) {
  const item = providers.find((candidate) => candidate.id === id)
  assert.ok(item)
  return item
}

test("discovers Kilo Code Gateway models from provider API", async () => {
  const calls: Array<{ url: string; headers?: Record<string, string> }> = []
  const result = await discoverProviderModels(provider("kilocode"), "test-key", async (url, init) => {
    calls.push({ url, headers: init?.headers })
    return {
      ok: true,
      status: 200,
      async json() {
        return { data: [{ id: "anthropic/claude-sonnet-4.5" }, { id: "openai/gpt-5" }] }
      },
    }
  })

  assert.equal(result.source, "provider")
  assert.deepEqual(result.models, ["anthropic/claude-sonnet-4.5", "openai/gpt-5"])
  assert.equal(calls[0]?.url, "https://api.kilo.ai/api/gateway/models")
  assert.equal(calls[0]?.headers?.authorization, "Bearer test-key")
})

test("discovers Anthropic models with Anthropic headers", async () => {
  const result = await discoverProviderModels(provider("anthropic"), "anthropic-key", async (_url, init) => {
    assert.equal(init?.headers?.["x-api-key"], "anthropic-key")
    assert.equal(init?.headers?.["anthropic-version"], "2023-06-01")
    return {
      ok: true,
      status: 200,
      async json() {
        return { data: [{ id: "claude-sonnet-4-5" }] }
      },
    }
  })

  assert.deepEqual(result.models, ["claude-sonnet-4-5"])
})

test("discovers Ollama models from local tags response", async () => {
  const result = await discoverProviderModels(provider("ollama"), undefined, async (url) => {
    assert.equal(url, "http://localhost:11434/api/tags")
    return {
      ok: true,
      status: 200,
      async json() {
        return { models: [{ name: "qwen2.5-coder:7b" }, { name: "llama3.1" }] }
      },
    }
  })

  assert.deepEqual(result.models, ["qwen2.5-coder:7b", "llama3.1"])
})

test("model discovery falls back when provider request fails", async () => {
  const result = await discoverProviderModels(provider("openai"), "bad-key", async () => ({
    ok: false,
    status: 401,
    async json() {
      return {}
    },
  }))

  assert.equal(result.source, "fallback")
  assert.deepEqual(result.models, provider("openai").models)
  assert.match(result.warning ?? "", /using built-in fallback list/)
})
