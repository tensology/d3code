import assert from "node:assert/strict"
import test from "node:test"
import { runInNewContext } from "node:vm"
import { getTool } from "../src/d3/tools.js"
import { parseD3ToolInput } from "../src/d3/tool-input.js"
import { recordEditorClientScript } from "../src/ide/record-editor.js"
import { startIdeServer } from "../src/ide/server.js"
import { basicAuthHeader } from "../src/ide/auth.js"
import type { D3CodeConfig } from "../src/config/config.js"
import type { D3Session } from "../src/domain/types.js"

const config: D3CodeConfig = { version: 1, defaultModel: "openai/test", defaultSafety: "ask", defaultProfile: "demo", modelSecrets: {}, profiles: [{ name: "demo", type: "local", account: "dm" }], ideAuth: { username: "proxy", password: "fixture" } }

test("typed BASIC execution validates identifiers and requires runtime approval", async () => {
  const commands: string[] = []
  const session: D3Session = { profile: config.profiles[0]!, run: async command => { commands.push(command); return { command, stdout: "PROGRAM OUTPUT", stderr: "", exitCode: 0, durationMs: 1 } }, close: async () => {} }
  const tool = getTool("d3_run_basic")!, input = { file: "bp", item: "D3CODE.PROOF" }
  assert.throws(() => parseD3ToolInput(tool.name, { ...input, item: "X\nDELETE MD X" }), /Invalid/)
  assert.throws(() => parseD3ToolInput(tool.name, { ...input, args: ["extra"] }), /Unrecognized/)
  await assert.rejects(tool.execute(input, { safety: "ask", session }), /Confirmation required/)
  await assert.rejects(tool.execute({ ...input, confirmed: true }, { safety: "plan", session }), /Denied by plan safety policy/)
  assert.equal(commands.length, 0)
  await tool.execute({ ...input, confirmed: true }, { safety: "ask", session })
  assert.deepEqual(commands, ["RUN bp D3CODE.PROOF (AN"])
})

test("program actions use the opened target, refuse drafts and prevent duplicate execution", async () => {
  const nodes: Record<string, any> = { itemBody: { value: "STOP", dataset: { savedBody: "STOP" }, addEventListener() {} }, editorRecordStatus: { dataset: {} }, compileBasic: {}, catalogBasic: {}, runBasic: {} }
  const calls: unknown[][] = []
  const document = { activeElement: nodes.runBasic, body: {} }
  const hiddenCancel = {}
  nodes.d3ApprovalModal = { classList: { contains: () => false }, contains: (element: unknown) => element === hiddenCancel }
  nodes.runBasic.focus = () => { document.activeElement = nodes.runBasic }
  let release: () => void = () => {}
  const context = { document, $: (id: string) => nodes[id], record: { source: true, target: { profile: "demo", file: "bp", item: "D3CODE.PROOF" }, connection: "snapshot" }, runApprovedEditorAction: (...args: unknown[]) => { calls.push(args); document.activeElement = hiddenCancel; return new Promise<void>(resolve => { release = resolve }) } }
  const api = runInNewContext(recordEditorClientScript() + ";editorRecord=record;({run:()=>runSelectedProgramAction('run','Run program?')})", context) as { run(): Promise<void> }
  nodes.itemBody.value = "CHANGED"
  await api.run();assert.equal(calls.length, 0);assert.match(nodes.editorRecordStatus.textContent, /Save your changes/)
  nodes.itemBody.value = "STOP"
  const pending = api.run();await api.run();assert.equal(calls.length, 1);assert.equal(nodes.runBasic.disabled, true)
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), ["/api/basic/run", { file: "bp", item: "D3CODE.PROOF", profile: "demo", connection: "snapshot" }, "Run program?"])
  release();await pending;assert.equal(nodes.runBasic.disabled, false);assert.equal(document.activeElement, nodes.runBasic)
})

test("embedded program actions reject missing and stale connections before executing", async () => {
  const previous = process.env.D3CODE_STORAGE_NAMESPACE
  process.env.D3CODE_STORAGE_NAMESPACE = "program-action-test"
  const tools = ["d3_compile_basic", "d3_catalog", "d3_run_basic"].map(name => getTool(name)!)
  const originals = tools.map(tool => tool.execute)
  const invoked: string[] = []
  tools.forEach(tool => { tool.execute = async () => { invoked.push(tool.name); return { stdout: "OK", stderr: "", exitCode: 0 } } })
  const server = await startIdeServer(config, { model: config.defaultModel, profile: "demo", mode: "migrate", safety: "ask" }, { port: 0, requireAuth: true })
  const headers = { authorization: basicAuthHeader(config.ideAuth!), "x-d3code-user": "1", "content-type": "application/json" }
  try {
    const current = await fetch(server.url + "/api/status", { headers }).then(response => response.json()) as { profile: string; connection: string }
    for (const action of ["compile", "catalog", "run"]) {
      const post = (snapshot: object) => fetch(server.url + "/api/basic/" + action, { method: "POST", headers, body: JSON.stringify({ file: "bp", item: "D3CODE.PROOF", confirmed: true, ...snapshot }) })
      for (const snapshot of [{}, { profile: "demo", connection: "stale" }]) assert.equal((await post(snapshot)).status, 409)
      assert.equal((await post({ profile: current.profile, connection: current.connection })).status, 200)
    }
    assert.deepEqual(invoked, tools.map(tool => tool.name))
    tools[2]!.execute = originals[2]!
    const run = (confirmed: boolean) => fetch(server.url + "/api/basic/run", { method: "POST", headers, body: JSON.stringify({ profile: current.profile, connection: current.connection, file: "bp", item: "D3CODE.PROOF", confirmed }) })
    assert.match(await (await run(false)).text(), /Confirmation required/)
    await fetch(server.url + "/api/config/safety", { method: "POST", headers, body: JSON.stringify({ safety: "plan" }) })
    assert.match(await (await run(true)).text(), /Denied by plan safety policy/)
  } finally {
    await server.close();tools.forEach((tool, index) => { tool.execute = originals[index]! })
    if (previous === undefined) delete process.env.D3CODE_STORAGE_NAMESPACE;else process.env.D3CODE_STORAGE_NAMESPACE = previous
  }
})
