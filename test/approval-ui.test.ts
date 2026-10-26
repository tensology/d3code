import assert from "node:assert/strict"
import test from "node:test"
import { runInNewContext } from "node:vm"
import { agentApprovalClientScript } from "../src/ide/agent-approval.js"
import { confirmationClientScript } from "../src/ide/confirmation.js"

const detail = (proposal: unknown): string => runInNewContext(agentApprovalClientScript() + ";approvalDetail(proposal)", { proposal, atob })

test("waiting state belongs only to chats with an unresolved approval", () => {
  for (const [status, expected] of [["pending", true], ["approved", false], ["declined", false]]) {
    const result = runInNewContext(agentApprovalClientScript() + ";chatAwaitingApproval('one')", {
      chatById: () => ({ messages: [{ kind: "approval", status }] }),
    })
    assert.equal(result, expected)
  }
})

test("record review shows readable before/after data and hides encoded baseline metadata", () => {
  const text = detail({ name: "d3_write_dict", profile: "Demo", account: "dm", connection: "not-for-display", input: {
    file: "D3CODE.TEST", item: "NAME", body: "new\nvalue", confirmed: true,
    baseline: { original: Buffer.from("old\xfevalue\xfdsecond\xfcsub", "latin1").toString("base64") },
  } })
  assert.match(text, /DICT D3CODE.TEST \/ NAME/)
  assert.match(text, /Before:\nold\nvalue <value> second <subvalue> sub/)
  assert.match(text, /After:\nnew\nvalue/)
  assert.doesNotMatch(text, /baseline|original|confirmed|not-for-display/)
})

test("review makes hidden command controls visible and does not parse source as HTML", () => {
  const command = detail({ name: "d3_tcl", profile: "Demo", input: { command: "WHO\u0000\u202e\nVERSION" } })
  assert.match(command, /WHO\\x00\\u202e\nVERSION/)
  const source = '<img src=x onerror="evil()">'
  assert.ok(detail({ name: "d3_create_item", profile: "Demo", input: { file: "D3CODE.TEST", item: "NEW", body: source } }).includes(source))
})

test("replacement review refuses a missing or invalid baseline", () => {
  for (const baseline of [undefined, { original: "%%%" }]) {
    assert.throws(() => detail({ name: "d3_write_item", profile: "Demo", input: { file: "D3CODE.TEST", item: "ONE", body: "new", baseline } }), /baseline/)
  }
})

test("overlapping confirmation calls cannot replace the first action", async () => {
  const nodes: Record<string, { textContent?: string; onclick?: () => void; classList: { add(): void; remove(): void }; focus(): void }> = {}
  for (const id of ["d3ApprovalModal", "cancelD3Approval", "approveD3Action", "d3ApprovalTitle", "d3ApprovalDetail"]) nodes[id] = { classList: { add() {}, remove() {} }, focus() {} }
  const context = { $: (id: string) => nodes[id], document: { activeElement: null, addEventListener() {}, removeEventListener() {} } }
  const output = runInNewContext(confirmationClientScript() + ";({first:confirmD3Action('First','FIRST'),second:confirmD3Action('Second','SECOND')})", context) as { first: Promise<boolean>; second: Promise<boolean> }
  assert.equal(await output.second, false)
  assert.equal(nodes.d3ApprovalDetail?.textContent, "FIRST")
  nodes.approveD3Action?.onclick?.()
  assert.equal(await output.first, true)
})
