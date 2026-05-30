import assert from "node:assert/strict"
import test from "node:test"
import { anthropicUsage, openAIUsage } from "../src/llm/client.js"

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
