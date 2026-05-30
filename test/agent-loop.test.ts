import assert from "node:assert/strict"
import test from "node:test"
import type { D3CodeConfig } from "../src/config/config.js"
import { parseD3ToolRequest, runD3AgentTurn, createD3AgentSystemPrompt, type AgentChatFunction } from "../src/tui/agent.js"

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
  })

  assert.equal(calls.length, 2)
  assert.match(result.output, /checked local D3 availability/i)
  assert.equal(result.toolEvents.length, 1)
  assert.equal(result.toolEvents[0]?.name, "d3_detect")
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

test("agent system prompt is D3-only and names reference-manual grounding", () => {
  const prompt = createD3AgentSystemPrompt(config, { model: "openai/gpt-5", safety: "plan", mode: "audit" })

  assert.match(prompt, /D3-only terminal engine/)
  assert.match(prompt, /Rocket D3 manuals/)
  assert.match(prompt, /Do not start general-purpose coding/)
  assert.match(prompt, /<d3_tool>/)
})

test("parser extracts one D3 tool request from assistant text", () => {
  const request = parseD3ToolRequest("Need context.\n<d3_tool>{\"name\":\"d3_read_item\",\"input\":{\"file\":\"CUSTOMERS\",\"item\":\"100\"}}</d3_tool>")

  assert.equal(request?.name, "d3_read_item")
  assert.deepEqual(request?.input, { file: "CUSTOMERS", item: "100" })
})
