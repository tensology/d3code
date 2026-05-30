import assert from "node:assert/strict"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import type { D3CodeConfig } from "../src/config/config.js"
import { createModernizationGoal } from "../src/goal/goal.js"
import { saveGoal } from "../src/goal/store.js"
import { handleSlashCommand } from "../src/tui/commands.js"

const config: D3CodeConfig = {
  version: 1,
  defaultModel: "openai/gpt-5",
  defaultSafety: "ask",
  defaultProfile: "prod",
  profiles: [{ name: "prod", type: "ssh", host: "10.0.0.5", username: "d3", account: "DM" }],
  modelSecrets: {},
}

const localConfig: D3CodeConfig = {
  ...config,
  defaultProfile: "local",
  profiles: [{ name: "local", type: "local" }],
}

test("slash command changes model", async () => {
  const result = await handleSlashCommand("/model anthropic/claude-sonnet-4-5", config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "chat" })
  assert.equal(result.state?.model, "anthropic/claude-sonnet-4-5")
})

test("slash command renders model routing plan", async () => {
  const result = await handleSlashCommand("/model-routing migrate --bias speed", config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(result.output, /D3 Model Routing Plan: migrate/)
  assert.match(result.output, /web\/API scaffold implementer/)
})

test("slash command renders model proof", async () => {
  const previous = process.env.OPENAI_API_KEY
  process.env.OPENAI_API_KEY = "test-key"
  try {
    const proofConfig = { ...config, modelSecrets: { openai: "env:OPENAI_API_KEY" } }
    const result = await handleSlashCommand("/model-proof migrate", proofConfig, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
    assert.match(result.output, /D3 Model Proof/)
    assert.match(result.output, /provider-openai/)
    assert.match(result.output, /Ready: yes/)
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previous
  }
})

test("slash command rejects unknown profile", async () => {
  const result = await handleSlashCommand("/profile dev", config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "chat" })
  assert.match(result.output, /Unknown profile/)
})

test("slash command changes safety", async () => {
  const result = await handleSlashCommand("/safety trust", config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "chat" })
  assert.equal(result.state?.safety, "trust")
})

test("slash command changes mode and applies mode safety", async () => {
  const result = await handleSlashCommand("/mode migrate", config, { model: "openai/gpt-5", safety: "plan", profile: "prod", mode: "chat" })
  assert.equal(result.state?.mode, "migrate")
  assert.equal(result.state?.safety, "ask")
  assert.match(result.output, /Migration Mode/)
})

test("slash command renders workflow for current mode", async () => {
  const result = await handleSlashCommand("/workflow", config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(result.output, /D3-to-Web Migration Workflow/)
  assert.match(result.output, /Audit database/)
})

test("slash command renders runbook and skill details", async () => {
  const runbook = await handleSlashCommand("/runbook", config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(runbook.output, /Migration Mode Runbook/)
  assert.match(runbook.output, /Evidence Gate/)

  const skill = await handleSlashCommand("/skill systematic-debugging", config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "modernize" })
  assert.match(skill.output, /Source: superpowers/)
  assert.match(skill.output, /root cause/i)
})

test("slash command renders baked skill coverage", async () => {
  const result = await handleSlashCommand("/skill-coverage", config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(result.output, /D3 Code Baked Skill Coverage/)
  assert.match(result.output, /Ready: yes/)
})

test("slash command renders reference skill map", async () => {
  const result = await handleSlashCommand("/reference-skills", config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(result.output, /Reference Skill Map/)
  assert.match(result.output, /gstack-spec/)
  assert.match(result.output, /out-of-scope/)
})

test("slash command renders reference skill audit", async () => {
  const result = await handleSlashCommand("/reference-audit reference", config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(result.output, /Reference Skill Audit/)
  assert.match(result.output, /Ready: yes/)
  assert.match(result.output, /Unmapped: 0/)
})

test("slash command renders goal next guidance", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-goal-next-"))
  const previous = process.env.D3CODE_HOME
  process.env.D3CODE_HOME = home
  try {
    const goal = createModernizationGoal("Migrate orders", "Orders web slice works", "migrate")
    await saveGoal(goal)
    const result = await handleSlashCommand(`/goal-next ${goal.id}`, config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
    assert.match(result.output, /Active Phase: capture/)
    assert.match(result.output, /Suggested Subagents/)
  } finally {
    if (previous === undefined) {
      delete process.env.D3CODE_HOME
    } else {
      process.env.D3CODE_HOME = previous
    }
  }
})

test("slash command renders product readiness", async () => {
  const result = await handleSlashCommand("/readiness", config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(result.output, /D3 Code Readiness/)
  assert.match(result.output, /Live D3 Proof/)
  assert.match(result.output, /Ready: no/)
})

test("slash command renders product completion audit", async () => {
  const result = await handleSlashCommand("/product-audit", config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(result.output, /D3 Code Product Completion Audit/)
  assert.match(result.output, /reference-skills-baked/)
  assert.match(result.output, /live-d3-proof/)
})

test("slash command initializes live proof folder", async () => {
  const dir = await mkdtemp(join(tmpdir(), "d3code-slash-live-proof-init-"))
  const result = await handleSlashCommand(`/live-proof-init ${dir}`, config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(result.output, /D3 Live Proof Scaffold/)
  assert.match(await readFile(join(dir, "README.md"), "utf8"), /live-proof-check/)
})

test("slash command renders setup proof", async () => {
  const result = await handleSlashCommand("/setup-proof", config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(result.output, /D3 Code Setup Proof/)
  assert.match(result.output, /Provider secret reference/)
})

test("slash command renders cockpit status", async () => {
  const result = await handleSlashCommand("/status", config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(result.output, /D3 Code Cockpit/)
  assert.match(result.output, /Mode: migrate/)
  assert.match(result.output, /Next Commands/)
})

test("slash command renders terminal bridge plan", async () => {
  const result = await handleSlashCommand("/terminal-plan prod", config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(result.output, /D3 Terminal Bridge Plan/)
  assert.match(result.output, /legacy screen-buffer adapter/)
})

test("slash command renders cockpit terminal contract", async () => {
  const result = await handleSlashCommand("/cockpit-terminal prod", config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(result.output, /D3 Cockpit Terminal Contract/)
  assert.match(result.output, /UOPY typed adapter/)
})

test("slash command renders D3 connector strategy", async () => {
  const result = await handleSlashCommand("/connector-strategy prod", config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(result.output, /D3 Connector Strategy/)
  assert.match(result.output, /persistent PTY/)
  assert.match(result.output, /PowerTerm-style programs/)
})

test("slash command parses D3 screen transcript", async () => {
  const dir = await mkdtemp(join(tmpdir(), "d3code-screen-command-"))
  const file = join(dir, "screen.txt")
  await writeFile(file, "@(-1)CUSTOMER@(4,2)Name")
  const result = await handleSlashCommand(`/screen-parse ${file} 24 6`, config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(result.output, /D3 Screen Buffer/)
  assert.match(result.output, /CUSTOMER/)
  assert.match(result.output, /Name/)
})

test("slash command captures terminal transcript artifacts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "d3code-terminal-capture-command-"))
  const result = await handleSlashCommand(`/terminal-capture ${dir} printf '@(-1)MENU@(5,2)Choice:'`, localConfig, { model: "openai/gpt-5", safety: "ask", profile: "local", mode: "migrate" })
  assert.match(result.output, /D3 Terminal Capture/)
  assert.match(result.output, /screen-buffer\.json/)
  assert.match(await readFile(join(dir, "screen-buffer.md"), "utf8"), /Choice:/)
})

test("slash command runs mock end-to-end acceptance", async () => {
  const result = await handleSlashCommand("/acceptance", config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(result.output, /D3 Code Mock Acceptance/)
  assert.match(result.output, /Ready: yes/)
  assert.match(result.output, /bundle-capture/)
  assert.match(result.output, /completion-audit/)
})

test("slash command renders live D3 proof plan", async () => {
  const result = await handleSlashCommand("/live-proof prod", config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(result.output, /D3 Live Proof Plan/)
  assert.match(result.output, /profile-doctor --profile prod/)
})

test("slash command records passing live D3 proof on a goal", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-slash-live-proof-"))
  const previous = process.env.D3CODE_HOME
  process.env.D3CODE_HOME = home
  try {
    const script = join(home, "fake-d3.sh")
    await writeFile(script, [
      "#!/bin/sh",
      "input=$(cat)",
      "case \"$input\" in",
      "  *WHO*) printf 'SALES\\n' ;;",
      "  *VERSION*) printf 'D3 10.3 MOCK\\n' ;;",
      "  *'LIST MD'*) printf 'CUSTOMERS\\nBP\\n' ;;",
      "esac",
      "",
    ].join("\n"), { mode: 0o755 })
    const proofConfig: D3CodeConfig = {
      ...config,
      defaultProfile: "fake",
      profiles: [{ name: "fake", type: "local", account: "SALES", entryCommand: script }],
    }
    const state = { model: "openai/gpt-5", safety: "ask" as const, profile: "fake", mode: "migrate" as const }
    const goal = createModernizationGoal("Live proof", "Passing profile doctor output is recorded", "migrate")
    await saveGoal(goal)

    const result = await handleSlashCommand(`/live-proof fake --run --goal ${goal.id} --phase verify`, proofConfig, state)
    assert.match(result.output, /profile-doctor passed for fake/)

    const plan = await handleSlashCommand(`/goal-plan ${goal.id}`, proofConfig, state)
    assert.match(plan.output, /profile-doctor passed for fake/)
    assert.match(plan.output, /checks=who:ok,version:ok,md-list:ok/)
  } finally {
    if (previous === undefined) {
      delete process.env.D3CODE_HOME
    } else {
      process.env.D3CODE_HOME = previous
    }
  }
})

test("slash command renders delegation plan for current mode", async () => {
  const result = await handleSlashCommand("/delegate", config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(result.output, /Migration Mode Delegation Plan/)
  assert.match(result.output, /d3-architect/)
  assert.match(result.output, /Evidence gate/)

  const prompts = await handleSlashCommand("/delegate-prompts", config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(prompts.output, /Migration Mode Delegation Plan Prompt Pack/)
  assert.match(prompts.output, /Allowed tools:/)
  assert.match(prompts.output, /Denied actions:/)
})

test("slash command runs a bounded D3 agent task", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-slash-agent-run-"))
  const script = join(home, "fake-d3.sh")
  await writeFile(script, [
    "#!/bin/sh",
    "input=$(cat)",
    "case \"$input\" in",
    "  *'CT BP GET.CUSTOMER'*) printf 'SUBROUTINE GET.CUSTOMER(ID)\\nRETURN\\n' ;;",
    "  *'BASIC BP GET.CUSTOMER'*) printf 'BASIC OK\\n' ;;",
    "  *) printf 'UNKNOWN\\n' ;;",
    "esac",
    "",
  ].join("\n"), { mode: 0o755 })
  const toolConfig: D3CodeConfig = {
    ...config,
    defaultProfile: "fake",
    profiles: [{ name: "fake", type: "local", account: "SALES", entryCommand: script }],
  }
  const result = await handleSlashCommand("/agent-run basic-check BP GET.CUSTOMER --compile --confirm", toolConfig, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "modernize" })
  assert.match(result.output, /D3 Agent Run: basic-check/)
  assert.match(result.output, /Ready: yes/)
  assert.match(result.output, /compile-basic/)
})

test("slash command renders BASIC modernization proof", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-modernization-proof-"))
  const beforePath = join(home, "before.bp")
  const afterPath = join(home, "after.bp")
  const compilePath = join(home, "compile.txt")
  await writeFile(beforePath, "SUBROUTINE GET.CUSTOMER(ID)\nRETURN\n")
  await writeFile(afterPath, "SUBROUTINE GET.CUSTOMER(ID)\nID = TRIM(ID)\nRETURN\n")
  await writeFile(compilePath, "BASIC OK\n")
  const result = await handleSlashCommand(`/modernization-proof ${beforePath} ${afterPath} ${compilePath}`, config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "modernize" })
  assert.match(result.output, /D3 BASIC Modernization Proof/)
  assert.match(result.output, /Ready: yes/)
})

test("slash command runs a bounded D3 file audit agent task", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-slash-agent-file-audit-"))
  const script = join(home, "fake-d3.sh")
  await writeFile(script, [
    "#!/bin/sh",
    "input=$(cat)",
    "case \"$input\" in",
    "  *'LIST DICT CUSTOMERS'*) printf '@ID\\nNAME\\n' ;;",
    "  *'CT DICT CUSTOMERS @ID'*) printf '001 A\\n002 0\\n003 ID\\n' ;;",
    "  *'CT DICT CUSTOMERS NAME'*) printf '001 A\\n002 1\\n003 Name\\n' ;;",
    "  *'LIST-INDEX CUSTOMERS'*) printf 'NAME\\n' ;;",
    "  *'SELECT CUSTOMERS SAMPLE 1'*) printf '100\\n' ;;",
    "  *'CT CUSTOMERS 100'*) printf 'Aliceþ555-0100\\n' ;;",
    "  *) printf 'UNKNOWN\\n' ;;",
    "esac",
    "",
  ].join("\n"), { mode: 0o755 })
  const toolConfig: D3CodeConfig = {
    ...config,
    defaultProfile: "fake",
    profiles: [{ name: "fake", type: "local", account: "SALES", entryCommand: script }],
  }
  const result = await handleSlashCommand("/agent-run file-audit CUSTOMERS --sample-limit 1", toolConfig, { model: "openai/gpt-5", safety: "plan", profile: "fake", mode: "audit" })
  assert.match(result.output, /D3 Agent Run: file-audit/)
  assert.match(result.output, /Ready: yes/)
  assert.match(result.output, /dictionary-inventory/)
  assert.match(result.output, /dictionary-validation/)
  assert.match(result.output, /index-validation/)
  assert.match(result.output, /sample-records/)
  assert.match(result.output, /data-shape-validation/)
})

test("slash command runs a bounded D3 migration slice agent task", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-slash-agent-migration-slice-"))
  const bundleFile = join(home, "bundle.json")
  const out = join(home, "out")
  await writeFile(bundleFile, JSON.stringify({
    account: "SALES",
    profile: "prod",
    files: [{
      name: "CUSTOMERS",
      suggestedResource: "customers",
      dictionary: [{ id: "@ID", attribute: 0 }, { id: "NAME", attribute: 1 }],
      records: [{ id: "100", raw: "Alice" }],
      observedIndexes: ["NAME"],
    }],
    programs: [{ file: "BP", item: "GET.CUSTOMER", source: "SUBROUTINE GET.CUSTOMER(ID)\nRETURN\n" }],
  }))
  const result = await handleSlashCommand(`/agent-run migration-slice ${bundleFile} --out ${out}`, config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(result.output, /D3 Agent Run: migration-slice/)
  assert.match(result.output, /Ready: yes/)
  assert.match(result.output, /webapp-check/)
  assert.match(result.output, /webapp-smoke/)
  assert.match(result.output, /qa-evidence/)
  assert.match(result.output, /refresh-proof/)
})

test("slash command renders bundle proof reports", async () => {
  const dir = await mkdtemp(join(tmpdir(), "d3code-bundle-slash-"))
  const fixture = join(dir, "bundle.json")
  await writeFile(fixture, JSON.stringify({
    account: "SALES",
    profile: "prod",
    files: [{
      name: "ORDERS",
      suggestedResource: "orders",
      dictionary: [{ id: "@ID", attribute: 0, type: "A" }, { id: "AMOUNT", attribute: 1, type: "A" }],
      records: [{ id: "100", raw: "10" }],
      expectedIndexes: ["AMOUNT"],
      observedIndexes: ["AMOUNT"],
    }],
    programs: [{ file: "BP", item: "LIST.ORDERS", source: "SUBROUTINE LIST.ORDERS()\nCRT @(-1):@(4,2):\"Orders\"\nINPUT ORDER.ID\nOPEN \"ORDERS\" TO F ELSE STOP\nRETURN\n" }],
  }))

  const readiness = await handleSlashCommand(`/bundle-readiness ${fixture}`, config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(readiness.output, /D3 Migration Readiness Report: SALES/)
  assert.match(readiness.output, /live-d3-proof/)

  const delegate = await handleSlashCommand(`/bundle-delegate ${fixture}`, config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(delegate.output, /D3 Bundle Subagent Plan: SALES/)
  assert.match(delegate.output, /d3-test-runner/)

  const completion = await handleSlashCommand(`/bundle-completion-audit ${fixture}`, config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(completion.output, /D3 Goal Completion Audit: SALES/)
  assert.match(completion.output, /live-d3-and-qa-proof/)

  const evidence = await handleSlashCommand(`/bundle-evidence ${fixture}`, config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(evidence.output, /D3 Bundle Goal Evidence: SALES/)
  assert.match(evidence.output, /verify/)

  const executionPlan = await handleSlashCommand(`/bundle-execution-plan ${fixture}`, config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(executionPlan.output, /D3 Migration Execution Plan: SALES/)
  assert.match(executionPlan.output, /rest-api-generation/)
  assert.match(executionPlan.output, /d3-test-runner/)

  const erpPlan = await handleSlashCommand(`/bundle-erp-plan ${fixture}`, config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(erpPlan.output, /D3 ERP Migration Blueprint: SALES/)
  assert.match(erpPlan.output, /Target Data Model/)

  const screenPlan = await handleSlashCommand(`/bundle-screen-plan ${fixture}`, config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(screenPlan.output, /D3 Screen Modernization Plan: SALES/)
  assert.match(screenPlan.output, /screen-parse/)
  assert.match(screenPlan.output, /risk=high/)

  const uiPlan = await handleSlashCommand(`/bundle-ui-plan ${fixture}`, config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(uiPlan.output, /D3 Web UI Plan: SALES/)
  assert.match(uiPlan.output, /Navigation:/)

  const reconciliationPlan = await handleSlashCommand(`/bundle-reconciliation-plan ${fixture}`, config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(reconciliationPlan.output, /D3 Cutover Reconciliation Plan: SALES/)
  assert.match(reconciliationPlan.output, /row count parity/)

  const accessPlan = await handleSlashCommand(`/bundle-access-plan ${fixture}`, config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(accessPlan.output, /D3 Access Plan: SALES/)
  assert.match(accessPlan.output, /No users were captured/)

  const skillPack = await handleSlashCommand(`/bundle-skill-pack ${fixture}`, config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(skillPack.output, /D3 Code Skill Pack: SALES/)
  assert.match(skillPack.output, /Migration Mode/)

  const dashboard = await handleSlashCommand(`/dashboard ${fixture}`, config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(dashboard.output, /D3 Dashboard: SALES/)

  const prd = await handleSlashCommand(`/bundle-prd ${fixture}`, config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(prd.output, /PRD: D3 SALES Web Migration/)
  assert.match(prd.output, /Acceptance Criteria/)

  const adr = await handleSlashCommand(`/bundle-adr ${fixture}`, config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(adr.output, /ADR: Strangler REST Boundary For D3 SALES/)
  assert.match(adr.output, /orders -> ORDERS/)

  const release = await handleSlashCommand(`/bundle-release-report ${fixture}`, config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(release.output, /D3 Migration Release Report: SALES/)
  assert.match(release.output, /Decision: blocked/)

  const contextPack = await handleSlashCommand(`/bundle-context-pack ${fixture}`, config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(contextPack.output, /D3 Context Pack: SALES/)
  assert.match(contextPack.output, /baked skills: needs-proof/)

  const guard = await handleSlashCommand(`/safety-guard ${fixture} CLEAR-FILE ORDERS`, config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(guard.output, /D3 Safety Guard/)
  assert.match(guard.output, /CLEAR-FILE ORDERS/)

  const artifactsDir = await mkdtemp(join(tmpdir(), "d3code-slash-artifacts-"))
  await writeFile(join(artifactsDir, "qa-evidence.json"), JSON.stringify({
    ready: true,
    source: "webapp-smoke",
    checks: [{ id: "api-smoke-tests", status: "ok", message: "ran generated smoke tests", evidence: ["root:test"] }],
  }))
  const artifactEvidence = await handleSlashCommand(`/bundle-evidence ${fixture} ${artifactsDir}`, config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(artifactEvidence.output, /qa-evidence=ready/)
})

test("slash command applies bundle evidence to a goal", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-goal-bundle-evidence-"))
  const previous = process.env.D3CODE_HOME
  process.env.D3CODE_HOME = home
  try {
    const fixture = join(home, "bundle.json")
    await writeFile(fixture, JSON.stringify({
      account: "SALES",
      profile: "prod",
      files: [{ name: "ORDERS", suggestedResource: "orders", dictionary: [{ id: "@ID", attribute: 0 }], records: [{ id: "100", raw: "10" }] }],
      programs: [{ file: "BP", item: "LIST.ORDERS", source: "SUBROUTINE LIST.ORDERS()\nRETURN\n" }],
    }))
    const goal = createModernizationGoal("Migrate orders", "Orders web slice works", "migrate")
    await saveGoal(goal)
    const result = await handleSlashCommand(`/goal-apply-bundle-evidence ${goal.id} ${fixture}`, config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
    assert.match(result.output, /Applied Bundle Evidence/)
    assert.match(result.output, /capture/)
    const audit = await handleSlashCommand(`/goal-audit-bundle ${goal.id} ${fixture} --apply`, config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
    assert.match(audit.output, /D3 Goal Bundle Audit/)
    assert.match(audit.output, /webapp-smoke/)
    const plan = await handleSlashCommand(`/goal-plan ${goal.id}`, config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
    assert.match(plan.output, /Bundle captured for account SALES/)
  } finally {
    if (previous === undefined) delete process.env.D3CODE_HOME
    else process.env.D3CODE_HOME = previous
  }
})

test("slash command runs detect tool", async () => {
  const result = await handleSlashCommand("/run-tool d3_detect", config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "chat" })
  assert.match(result.output, /available/)
})

test("slash command runs local TCL command", async () => {
  const result = await handleSlashCommand("/tcl printf D3CODE_TCL", localConfig, { model: "openai/gpt-5", safety: "ask", profile: "local", mode: "chat" })
  assert.match(result.output, /D3CODE_TCL/)
})

test("slash commands expose D3 account, file, index, compile, catalog, and call workflows", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-slash-d3-tools-"))
  const previous = process.env.D3CODE_HOME
  process.env.D3CODE_HOME = home
  try {
    const script = join(home, "fake-d3.sh")
    await writeFile(script, [
      "#!/bin/sh",
      "input=$(cat)",
      "case \"$input\" in",
      "  *'LOGTO SALES'*) printf 'LOGTO SALES\\nSALES\\nD3 10.3 MOCK\\n' ;;",
      "  *WHO*) printf 'SALES\\n' ;;",
      "  *VERSION*) printf 'D3 10.3 MOCK\\n' ;;",
      "  *'LIST MD'*) printf 'CUSTOMERS D Customer file\\nBP D Programs\\n' ;;",
      "  *'CT CUSTOMERS 100'*) printf '001 CUSTOMER\\nOLD.NAME\\n' ;;",
      "  *'CT DICT CUSTOMERS NAME'*) printf '001 D\\n002 1\\n003 Name\\n' ;;",
      "  *'LIST-LOCKS'*) printf 'No locks present\\n' ;;",
      "  *'ED CUSTOMERS 100'*) printf 'ITEM SAVED\\n' ;;",
      "  *'BASIC BP GET.CUSTOMER'*) printf 'BASIC OK\\n' ;;",
      "  *'CATALOG BP GET.CUSTOMER'*) printf 'CATALOG OK\\n' ;;",
      "  *'CALL GET.CUSTOMER 100'*) printf 'CALL OK\\n' ;;",
      "  *) printf 'CUSTOMERS D Customer file\\nBP D Programs\\n' ;;",
      "esac",
      "",
    ].join("\n"), { mode: 0o755 })
    const toolConfig: D3CodeConfig = {
      ...config,
      defaultProfile: "fake",
      profiles: [{ name: "fake", type: "local", account: "SALES", entryCommand: script, allowedAccounts: ["SALES"] }],
    }

    const login = await handleSlashCommand("/login fake", toolConfig, { model: "openai/gpt-5", safety: "ask", profile: undefined, mode: "chat" })
    assert.equal(login.state?.profile, "fake")
    assert.match(login.output, /Ready: yes/)

    const accountLogin = await handleSlashCommand("/login fake SALES", toolConfig, { model: "openai/gpt-5", safety: "trust", profile: undefined, mode: "chat" })
    assert.equal(accountLogin.state?.profile, "fake")
    assert.match(accountLogin.output, /LOGTO SALES/)

    const account = await handleSlashCommand("/account", toolConfig, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" })
    assert.match(account.output, /Configured account: SALES/)
    assert.match(account.output, /SALES/)

    const files = await handleSlashCommand("/files", toolConfig, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" })
    assert.match(files.output, /CUSTOMERS/)

    const read = await handleSlashCommand("/read CUSTOMERS 100", toolConfig, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" })
    assert.match(read.output, /OLD.NAME/)

    const dict = await handleSlashCommand("/dict CUSTOMERS NAME", toolConfig, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" })
    assert.match(dict.output, /Name/)

    const locks = await handleSlashCommand("/locks", toolConfig, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" })
    assert.match(locks.output, /No locks present/)

    const diff = await handleSlashCommand("/diff CUSTOMERS 100 001 CUSTOMER\\nNEW.NAME", toolConfig, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" })
    assert.match(diff.output, /--- current:CUSTOMERS\/100/)
    assert.match(diff.output, /-OLD.NAME/)
    assert.match(diff.output, /\+NEW.NAME/)

    await assert.rejects(
      handleSlashCommand("/write CUSTOMERS 100 001 CUSTOMER\\nNEW.NAME", toolConfig, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" }),
      /Confirmation required/,
    )

    const write = await handleSlashCommand("/write CUSTOMERS 100 001 CUSTOMER\\nNEW.NAME", toolConfig, { model: "openai/gpt-5", safety: "trust", profile: "fake", mode: "chat" })
    assert.match(write.output, /ITEM SAVED/)

    const index = await handleSlashCommand("/index", toolConfig, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" })
    assert.match(index.output, /profile-fake/)

    const search = await handleSlashCommand("/search Customer", toolConfig, { model: "openai/gpt-5", safety: "ask", profile: "fake", mode: "chat" })
    assert.match(search.output, /Customer file/)

    const compile = await handleSlashCommand("/compile BP GET.CUSTOMER", toolConfig, { model: "openai/gpt-5", safety: "trust", profile: "fake", mode: "modernize" })
    assert.match(compile.output, /BASIC OK/)

    const catalog = await handleSlashCommand("/catalog BP GET.CUSTOMER", toolConfig, { model: "openai/gpt-5", safety: "trust", profile: "fake", mode: "modernize" })
    assert.match(catalog.output, /CATALOG OK/)

    const call = await handleSlashCommand("/call GET.CUSTOMER 100", toolConfig, { model: "openai/gpt-5", safety: "trust", profile: "fake", mode: "chat" })
    assert.match(call.output, /CALL OK/)
  } finally {
    if (previous === undefined) delete process.env.D3CODE_HOME
    else process.env.D3CODE_HOME = previous
  }
})

test("slash command renders migration recipe help", async () => {
  const result = await handleSlashCommand("/migrate-help", config, { model: "openai/gpt-5", safety: "ask", profile: "prod", mode: "migrate" })
  assert.match(result.output, /D3-to-Web Migration Recipe/)
  assert.match(result.output, /adapter-write/)
})
