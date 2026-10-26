import assert from "node:assert/strict"
import test from "node:test"
import type { D3CodeConfig } from "../src/config/config.js"
import { getTool } from "../src/d3/tools.js"
import { basicAuthHeader } from "../src/ide/auth.js"
import { startIdeServer, stopIdeServers } from "../src/ide/server.js"

interface JobView {
  job_id: string
  status: string
  pending_approval?: { id: string; expires_at: number; proposal: { name: string; input: { command: string; confirmed: boolean } } }
}

async function withApprovalServer(check: (api: (actor: string, path: string, body?: unknown, stream?: boolean, origin?: string) => Promise<Response>, commands: string[]) => Promise<void>) {
  const previousNamespace = process.env.D3CODE_STORAGE_NAMESPACE
  process.env.D3CODE_STORAGE_NAMESPACE = "approval-proof"
  const config: D3CodeConfig = {
    version: 1, defaultModel: "openai/gpt-5", defaultSafety: "ask", defaultProfile: "demo", modelSecrets: {},
    ideAuth: { username: "proxy", password: "test-only" },
    profiles: ["demo", "other"].map(name => ({ name, type: "local", entryCommand: "d3", account: "dm", allowedAccounts: ["dm"] })),
  }
  const commands: string[] = [], tool = getTool("d3_tcl")!, execute = tool.execute
  tool.execute = (input, context) => execute(input, { ...context, session: {
    profile: context.profile!, close: async () => {},
    run: async command => { commands.push(command); return { command, stdout: "Executed", stderr: "", exitCode: 0, durationMs: 0 } },
  } })
  try {
    const server = await startIdeServer(config, { model: config.defaultModel, safety: "ask", mode: "migrate", profile: "demo" }, {
      port: 0, requireAuth: true, saveConfigFn: async () => {},
      agentChatFn: async (_config, _secrets, request) => {
        if (request.messages.some(message => message.role === "tool")) return { provider: "test", model: "fake", content: "D3 result received" }
        const input = request.messages.at(-1)?.content ?? ""
        const planned = ["UPDATE D3CODE.TEST " + (input.includes("actor-B") ? "B" : "A")]
        if (input.includes("two actions")) planned.push("UPDATE D3CODE.TEST SECOND")
        return { provider: "test", model: "fake", content: "", toolCalls: planned.map((command, i) => ({ id: String(i), name: "d3_tcl", arguments: JSON.stringify({ command, confirmed: true }) })) }
      },
    })
    await check((actor, path, body, stream = false, origin) => fetch(server.url + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { authorization: basicAuthHeader(config.ideAuth!), "x-d3code-user": actor, "content-type": "application/json", ...(stream ? { accept: "text/event-stream" } : {}), ...(origin ? { origin } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }), commands)
  } finally {
    await stopIdeServers()
    tool.execute = execute
    if (previousNamespace === undefined) delete process.env.D3CODE_STORAGE_NAMESPACE
    else process.env.D3CODE_STORAGE_NAMESPACE = previousNamespace
  }
}

async function waitForApproval(api: Parameters<Parameters<typeof withApprovalServer>[0]>[0], actor = "1"): Promise<JobView> {
  for (let i = 0; i < 100; i++) {
    const job = await api(actor, "/api/agent/job?chat_id=same").then(response => response.json()) as JobView
    if (job.pending_approval) return job
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  throw new Error("Approval did not become pending")
}

const decision = (job: JobView, approved: boolean) => ({ chat_id: "same", job_id: job.job_id, approval_id: job.pending_approval!.id, approved })

test("job approvals are user-owned, exact, single-use and protected against cross-origin decisions", async () => {
  await withApprovalServer(async (api, commands) => {
    const firstStream = await api("1", "/api/agent", { chat_id: "same", input: "Update D3 sandbox actor-A" }, true)
    const secondStream = await api("2", "/api/agent", { chat_id: "same", input: "Update D3 sandbox actor-B" }, true)
    const first = await waitForApproval(api), second = await waitForApproval(api, "2")
    assert.notEqual(first.pending_approval!.id, second.pending_approval!.id)
    assert.equal(first.pending_approval!.proposal.input.command, "UPDATE D3CODE.TEST A")
    assert.equal(second.pending_approval!.proposal.input.command, "UPDATE D3CODE.TEST B")
    assert.equal(first.pending_approval!.proposal.input.confirmed, false)
    assert.deepEqual(commands, [])
    assert.equal((await api("3", "/api/agent/approval", decision(first, true))).status, 404)
    assert.equal((await api("2", "/api/agent/approval", decision(first, true))).status, 409)
    assert.equal((await api("1", "/api/agent/approval", { ...decision(first, true), approved: "true" })).status, 400)
    assert.equal((await api("1", "/api/agent/approval", decision(first, true), false, "https://evil.example")).status, 403)
    const otherJobs = await api("3", "/api/agent/jobs").then(response => response.json()) as { jobs: unknown[] }
    assert.deepEqual(otherJobs.jobs, [])
    const attempts = await Promise.all([1, 2].map(() => api("1", "/api/agent/approval", { ...decision(first, true), input: { command: "DELETE D3CODE.TEST EVIL" } })))
    assert.deepEqual(attempts.map(response => response.status).sort(), [200, 409])
    const completed = await firstStream.text()
    assert.match(completed, /approval_required/)
    assert.match(completed, /approval_resolved/)
    assert.equal((await api("1", "/api/agent/job?chat_id=same").then(response => response.json()) as JobView).pending_approval, undefined)
    assert.deepEqual(commands, ["UPDATE D3CODE.TEST A"])
    assert.equal((await api("1", "/api/agent/approval", decision(first, true))).status, 409)
    assert.equal((await waitForApproval(api, "2")).pending_approval!.id, second.pending_approval!.id)
    assert.equal((await api("2", "/api/agent/approval", decision(second, false))).status, 200)
    assert.match(await secondStream.text(), /operator declined/)
    assert.deepEqual(commands, ["UPDATE D3CODE.TEST A"])
  })
})

test("cancelling a job clears its pending approval and prevents replay", async () => {
  await withApprovalServer(async (api, commands) => {
    const stream = await api("1", "/api/agent", { chat_id: "same", input: "Update D3 sandbox" }, true)
    const pending = await waitForApproval(api)
    assert.equal((await api("1", "/api/agent/cancel", { chat_id: "same" })).status, 200)
    assert.match(await stream.text(), /cancelled/)
    assert.equal((await api("1", "/api/agent/approval", decision(pending, true))).status, 409)
    assert.deepEqual(commands, [])
  })
})

test("a completed approval cannot authorize the next action in the same job", async () => {
  await withApprovalServer(async (api, commands) => {
    const stream = await api("1", "/api/agent", { chat_id: "same", input: "Update D3 sandbox, two actions" }, true)
    const first = await waitForApproval(api)
    assert.equal((await api("1", "/api/agent/approval", decision(first, true))).status, 200)
    let second = first
    for (let i = 0; i < 100 && second.pending_approval?.id === first.pending_approval!.id; i++) {
      await new Promise(resolve => setTimeout(resolve, 20))
      second = await waitForApproval(api)
    }
    assert.equal(second.job_id, first.job_id)
    assert.notEqual(second.pending_approval!.id, first.pending_approval!.id)
    assert.equal(second.pending_approval!.proposal.input.command, "UPDATE D3CODE.TEST SECOND")
    assert.equal((await api("1", "/api/agent/approval", decision(first, true))).status, 409)
    assert.deepEqual(commands, ["UPDATE D3CODE.TEST A"])
    assert.equal((await api("1", "/api/agent/approval", decision(second, false))).status, 200)
    await stream.text()
    assert.deepEqual(commands, ["UPDATE D3CODE.TEST A"])
  })
})

test("expired approval is rejected without executing the action", async () => {
  await withApprovalServer(async (api, commands) => {
    const stream = await api("1", "/api/agent", { chat_id: "same", input: "Update D3 sandbox" }, true)
    const pending = await waitForApproval(api), now = Date.now
    try {
      Date.now = () => pending.pending_approval!.expires_at + 1
      assert.equal((await api("1", "/api/agent/approval", decision(pending, true))).status, 409)
    } finally { Date.now = now }
    assert.match(await stream.text(), /expired/)
    assert.deepEqual(commands, [])
  })
})

test("changing selected connection or choosing plan mode invalidates pending approval", async () => {
  for (const [path, body] of [["/api/profile", { profile: "other" }], ["/api/config/safety", { safety: "plan" }]] as const) {
    await withApprovalServer(async (api, commands) => {
      const stream = await api("1", "/api/agent", { chat_id: "same", input: "Update D3 sandbox" }, true)
      const pending = await waitForApproval(api)
      assert.equal((await api("1", path, body)).status, 200)
      assert.equal((await api("1", "/api/agent/approval", decision(pending, true))).status, 409)
      assert.match(await stream.text(), /invalidated/)
      assert.deepEqual(commands, [])
    })
  }
})
