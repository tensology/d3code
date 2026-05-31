import assert from "node:assert/strict"
import test from "node:test"
import type { D3CodeConfig } from "../src/config/config.js"
import { addChatUsage, parseD3ToolRequest, runD3AgentTurn, createD3AgentSystemPrompt, type AgentChatFunction } from "../src/tui/agent.js"

const config: D3CodeConfig = {
  version: 1,
  defaultModel: "openai/gpt-5",
  defaultSafety: "ask",
  profiles: [],
  modelSecrets: {},
}

const secrets = {
  get: async () => undefined,
  set: async () => undefined,
}

test("agent loop runs a model-requested D3 tool and resumes with the result", async () => {
  const calls: string[] = []
  const events: string[] = []
  const chatFn: AgentChatFunction = async (_config, _secrets, request) => {
    calls.push(request.messages.at(-1)?.content ?? "")
    if (calls.length === 1) {
      return {
        provider: "test",
        model: "test",
        content: [
          "I need to inspect local D3 availability.",
          "<d3_tool>",
          "{\"name\":\"d3_detect\",\"input\":{},\"reason\":\"check whether a local D3 command exists\"}",
          "</d3_tool>",
        ].join("\n"),
      }
    }
    assert.match(request.messages.at(-1)?.content ?? "", /d3_detect/)
    return { provider: "test", model: "test", content: "I checked local D3 availability and will not guess beyond the tool result." }
  }

  const result = await runD3AgentTurn(config, secrets, {
    input: "can you see if this server has D3?",
    model: "openai/gpt-5",
    safety: "ask",
    mode: "chat",
    chatFn,
    onEvent: (event) => {
      if (event.type === "tool_start" || event.type === "tool_result") events.push(`${event.type}:${event.name}`)
    },
  })

  assert.equal(calls.length, 2)
  assert.match(result.output, /checked local D3 availability/i)
  assert.equal(result.toolEvents.length, 1)
  assert.equal(result.toolEvents[0]?.name, "d3_detect")
  assert.deepEqual(events, ["tool_start:d3_detect", "tool_result:d3_detect"])
})

test("agent loop blocks non-D3 tool requests", async () => {
  const chatFn: AgentChatFunction = async () => ({
    provider: "test",
    model: "test",
    content: "<d3_tool>{\"name\":\"write_file\",\"input\":{\"path\":\"app.ts\"},\"reason\":\"generic coding\"}</d3_tool>",
  })

  const result = await runD3AgentTurn(config, secrets, {
    input: "build a random web app",
    model: "openai/gpt-5",
    safety: "ask",
    mode: "chat",
    chatFn,
  })

  assert.match(result.output, /Blocked non-D3 tool request/)
  assert.equal(result.toolEvents.length, 0)
})

test("agent loop forwards streaming tokens from the first model response", async () => {
  let streamed = ""
  const deltas: string[] = []
  const chatFn: AgentChatFunction = async (_config, _secrets, request) => {
    request.onToken?.("Hello")
    request.onToken?.(" D3")
    return { provider: "test", model: "test", content: "Hello D3" }
  }

  const result = await runD3AgentTurn(config, secrets, {
    input: "hello",
    model: "openai/gpt-5",
    safety: "ask",
    mode: "chat",
    chatFn,
    onToken: (token) => {
      streamed += token
    },
    onEvent: (event) => {
      if (event.type === "assistant_delta") deltas.push(`${event.iteration}:${event.token}`)
    },
  })

  assert.equal(streamed, "Hello D3")
  assert.deepEqual(deltas, ["0:Hello", "0: D3"])
  assert.equal(result.output, "Hello D3")
})

test("agent loop streams final assistant response after a tool result", async () => {
  const deltas: string[] = []
  let calls = 0
  const chatFn: AgentChatFunction = async (_config, _secrets, request) => {
    calls += 1
    if (calls === 1) return { provider: "test", model: "test", content: "<d3_tool>{\"name\":\"d3_detect\",\"input\":{}}</d3_tool>" }
    request.onToken?.("Done")
    return { provider: "test", model: "test", content: "Done" }
  }

  const result = await runD3AgentTurn(config, secrets, {
    input: "detect d3",
    model: "openai/gpt-5",
    safety: "ask",
    mode: "chat",
    chatFn,
    onEvent: (event) => {
      if (event.type === "assistant_delta") deltas.push(`${event.iteration}:${event.token}`)
    },
  })

  assert.equal(result.output, "Done")
  assert.deepEqual(deltas, ["1:Done"])
})

test("agent loop aggregates token usage across model/tool iterations", async () => {
  let calls = 0
  const chatFn: AgentChatFunction = async () => {
    calls += 1
    if (calls === 1) {
      return {
        provider: "test",
        model: "test",
        content: "<d3_tool>{\"name\":\"d3_detect\",\"input\":{}}</d3_tool>",
        usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 },
      }
    }
    return {
      provider: "test",
      model: "test",
      content: "Done",
      usage: { inputTokens: 15, outputTokens: 4, totalTokens: 19 },
    }
  }

  const result = await runD3AgentTurn(config, secrets, {
    input: "detect d3",
    model: "openai/gpt-5",
    safety: "ask",
    mode: "chat",
    chatFn,
  })

  assert.deepEqual(result.usage, { inputTokens: 25, outputTokens: 6, totalTokens: 31 })
})

test("chat usage accumulator preserves cache token fields", () => {
  assert.deepEqual(addChatUsage(
    { inputTokens: 1, outputTokens: 2, totalTokens: 3, cacheReadInputTokens: 4 },
    { inputTokens: 5, outputTokens: 6, totalTokens: 7, cacheCreationInputTokens: 8 },
  ), {
    inputTokens: 6,
    outputTokens: 8,
    totalTokens: 10,
    cacheReadInputTokens: 4,
    cacheCreationInputTokens: 8,
  })
})

test("agent system prompt is D3-only and names reference-manual grounding", () => {
  const prompt = createD3AgentSystemPrompt(config, { model: "openai/gpt-5", safety: "plan", mode: "audit" })

  assert.match(prompt, /D3-only terminal engine/)
  assert.match(prompt, /Rocket D3 manuals/)
  assert.match(prompt, /VME/)
  assert.match(prompt, /D-pointers/)
  assert.match(prompt, /master-dictionary environment/)
  assert.match(prompt, /Do not start general-purpose coding/)
  assert.match(prompt, /<d3_tool>/)
})

test("parser extracts one D3 tool request from assistant text", () => {
  const request = parseD3ToolRequest("Need context.\n<d3_tool>{\"name\":\"d3_read_item\",\"input\":{\"file\":\"CUSTOMERS\",\"item\":\"100\"}}</d3_tool>")

  assert.equal(request?.name, "d3_read_item")
  assert.deepEqual(request?.input, { file: "CUSTOMERS", item: "100" })
})

test("parser accepts streamed tool_call blocks emitted by chat models", () => {
  const request = parseD3ToolRequest([
    "I'll inspect the account.",
    "<tool_call>d3_estate_report",
    "<arg_key>reason</arg_key><arg_value>get overview of active account files</arg_value>",
    "</tool_call>",
  ].join("\n"))

  assert.equal(request?.name, "d3_estate_report")
  assert.equal(request?.reason, "get overview of active account files")
  assert.equal(request?.input, undefined)
})

test("parser reports malformed D3 tool JSON clearly", () => {
  assert.throws(
    () => parseD3ToolRequest("<d3_tool>{\"name\":\"d3_list_files\"</d3_tool>"),
    /Malformed D3 tool request JSON/,
  )
})
