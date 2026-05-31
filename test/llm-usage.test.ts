import assert from "node:assert/strict"
import test from "node:test"
import { anthropicUsage, chat, openAIUsage } from "../src/llm/client.js"
import type { D3CodeConfig } from "../src/config/config.js"

test("OpenAI-compatible usage normalizes prompt and completion tokens", () => {
  assert.deepEqual(openAIUsage({
    usage: {
      prompt_tokens: 12,
      completion_tokens: 5,
      total_tokens: 17,
    },
  }), {
    inputTokens: 12,
    outputTokens: 5,
    totalTokens: 17,
  })
})

test("OpenAI-compatible usage supports input/output token aliases", () => {
  assert.deepEqual(openAIUsage({
    input_tokens: 3,
    output_tokens: 9,
  }), {
    inputTokens: 3,
    outputTokens: 9,
    totalTokens: 12,
  })
})

test("Anthropic usage preserves cache token fields", () => {
  assert.deepEqual(anthropicUsage({
    usage: {
      input_tokens: 8,
      output_tokens: 4,
      cache_read_input_tokens: 2,
      cache_creation_input_tokens: 1,
    },
  }), {
    inputTokens: 8,
    outputTokens: 4,
    totalTokens: 15,
    cacheReadInputTokens: 2,
    cacheCreationInputTokens: 1,
  })
})

test("Anthropic chat streams text deltas when token callback is provided", async () => {
  const originalFetch = globalThis.fetch
  const chunks = [
    "data: {\"type\":\"message_start\",\"message\":{\"usage\":{\"input_tokens\":7}}}\n\n",
    "data: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"text_delta\",\"text\":\"Hello\"}}\n\n",
    "data: {\"type\":\"content_block_delta\",\"delta\":{\"type\":\"text_delta\",\"text\":\" D3\"}}\n\n",
    "data: {\"type\":\"message_delta\",\"usage\":{\"output_tokens\":2}}\n\n",
    "data: {\"type\":\"message_stop\"}\n\n",
  ]
  globalThis.fetch = (async (_url, init) => {
    assert.match(String(init?.body), /"stream":true/)
    return new Response(new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk))
        controller.close()
      },
    }), { status: 200, headers: { "content-type": "text/event-stream" } })
  }) as typeof fetch

  try {
    const streamed: string[] = []
    const config: D3CodeConfig = {
      version: 1,
      defaultModel: "anthropic/claude-sonnet-4-5",
      defaultSafety: "ask",
      profiles: [],
      modelSecrets: { anthropic: "env:ANTHROPIC_API_KEY" },
    }
    process.env.ANTHROPIC_API_KEY = "test-key"

    const response = await chat(config, { get: async () => undefined, set: async () => undefined }, {
      modelRef: "anthropic/claude-sonnet-4-5",
      messages: [{ role: "user", content: "hello" }],
      onToken: (token) => streamed.push(token),
    })

    assert.deepEqual(streamed, ["Hello", " D3"])
    assert.equal(response.content, "Hello D3")
    assert.deepEqual(response.usage, { inputTokens: 7, outputTokens: 2, totalTokens: 9 })
  } finally {
    globalThis.fetch = originalFetch
    delete process.env.ANTHROPIC_API_KEY
  }
})

test("OpenAI-compatible chat streams a final SSE line without trailing newline", async () => {
  const originalFetch = globalThis.fetch
  const chunks = [
    "data: {\"choices\":[{\"delta\":{\"content\":\"Hello\"}}]}\n\n",
    "data: {\"choices\":[{\"delta\":{\"content\":\" D3\"}}]}",
  ]
  globalThis.fetch = (async (_url, init) => {
    assert.match(String(init?.body), /"stream":true/)
    return new Response(new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk))
        controller.close()
      },
    }), { status: 200, headers: { "content-type": "text/event-stream" } })
  }) as typeof fetch

  try {
    const streamed: string[] = []
    const config: D3CodeConfig = {
      version: 1,
      defaultModel: "kilocode/kilo-auto/free",
      defaultSafety: "ask",
      profiles: [],
      modelSecrets: { kilocode: "env:KILO_API_KEY" },
    }
    process.env.KILO_API_KEY = "test-key"

    const response = await chat(config, { get: async () => undefined, set: async () => undefined }, {
      modelRef: "kilocode/kilo-auto/free",
      messages: [{ role: "user", content: "hello" }],
      onToken: (token) => streamed.push(token),
    })

    assert.deepEqual(streamed, ["Hello", " D3"])
    assert.equal(response.content, "Hello D3")
  } finally {
    globalThis.fetch = originalFetch
    delete process.env.KILO_API_KEY
  }
})

test("OpenAI-compatible chat streams SSE even when gateway omits the event-stream content type", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (_url, init) => {
    assert.match(String(init?.body), /"stream":true/)
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("data: {\"choices\":[{\"delta\":{\"content\":\"Live\"}}]}\n\n"))
        controller.enqueue(new TextEncoder().encode("data: {\"choices\":[{\"delta\":{\"content\":\" now\"}}]}\n\n"))
        controller.close()
      },
    }), { status: 200, headers: { "content-type": "application/octet-stream" } })
  }) as typeof fetch

  try {
    const streamed: string[] = []
    const config: D3CodeConfig = {
      version: 1,
      defaultModel: "kilocode/kilo-auto/free",
      defaultSafety: "ask",
      profiles: [],
      modelSecrets: { kilocode: "env:KILO_API_KEY" },
    }
    process.env.KILO_API_KEY = "test-key"

    const response = await chat(config, { get: async () => undefined, set: async () => undefined }, {
      modelRef: "kilocode/kilo-auto/free",
      messages: [{ role: "user", content: "hello" }],
      onToken: (token) => streamed.push(token),
    })

    assert.deepEqual(streamed, ["Live", " now"])
    assert.equal(response.content, "Live now")
  } finally {
    globalThis.fetch = originalFetch
    delete process.env.KILO_API_KEY
  }
})
