import assert from "node:assert/strict"
import test from "node:test"
import { createCockpitTerminalContract, renderCockpitTerminalContract } from "../src/d3/cockpit-terminal.js"
import { createD3ConnectorStrategy, renderD3ConnectorStrategy } from "../src/d3/connector-strategy.js"
import { createD3TerminalBridgePlan, renderD3TerminalBridgePlan } from "../src/d3/terminal-plan.js"

test("terminal bridge plan separates PTY, TCL, UOPY, and legacy screen work", () => {
  const plan = createD3TerminalBridgePlan({ name: "prod", type: "ssh", host: "d3.example", username: "d3", account: "SALES", sessionMode: "persistent", promptPattern: ">" })
  assert.equal(plan.terminal.mode, "persistent-pty")
  assert.equal(plan.terminal.emulator, "d3-terminal-control")
  assert.ok(plan.capabilities.some((capability) => capability.id === "tcl" && capability.status === "implemented"))
  assert.ok(plan.capabilities.some((capability) => capability.id === "uopy" && capability.status === "research"))
  assert.ok(plan.capabilities.some((capability) => capability.id === "screen" && capability.risks.some((risk) => risk.includes("PowerTerm"))))
  assert.match(renderD3TerminalBridgePlan(plan), /D3 Terminal Bridge Plan/)
  assert.match(renderD3TerminalBridgePlan(plan), /legacy screen-buffer adapter/)
})

test("terminal bridge plan makes missing profile explicit", () => {
  const plan = createD3TerminalBridgePlan()
  assert.equal(plan.terminal.mode, "not-configured")
  assert.match(renderD3TerminalBridgePlan(plan), /profile-add-local/)
})

test("cockpit terminal contract names PowerTerm buffer, UOPY limits, and live proof", () => {
  const contract = createCockpitTerminalContract({ name: "prod", type: "ssh", host: "d3.example", username: "d3", account: "SALES", sessionMode: "persistent", promptPattern: ">" })
  assert.equal(contract.attachMode, "persistent-pty")
  assert.equal(contract.terminalModel, "powerterm-aware-buffer")
  assert.ok(contract.features.some((feature) => feature.id === "screen-buffer" && feature.status === "partial"))
  assert.ok(contract.features.some((feature) => feature.id === "terminal-definition" && feature.detail.includes("define-terminal")))
  assert.ok(contract.features.some((feature) => feature.id === "uopy" && feature.detail.includes("cannot be the only connector")))
  assert.equal(contract.sendPolicy.enabledByDefault, false)
  assert.equal(contract.sendPolicy.enableEnv, "D3CODE_TERMINAL_ENABLED=1")
  assert.ok(contract.sendPolicy.blockedUntil.some((proof) => proof.includes("screen-buffer.json")))
  assert.ok(contract.commandPlan.some((command) => command.id === "screen-capture" && command.requiredProof.some((proof) => proof.includes("terminal-capture"))))
  assert.ok(contract.commandPlan.some((command) => command.id === "compile-catalog" && command.safety === "confirm"))
  assert.ok(contract.screenParity.requiredEvidence.some((proof) => proof.includes("@() cursor/control")))
  assert.ok(contract.screenParity.unsupportedUntilProven.some((entry) => entry.includes("UOPY")))
  assert.ok(contract.requiredLiveProof.some((proof) => proof.includes("TERM and define-terminal")))
  assert.ok(contract.requiredLiveProof.some((proof) => proof.includes("terminal-capture")))
  assert.match(renderCockpitTerminalContract(contract), /D3 Cockpit Terminal Contract/)
  assert.match(renderCockpitTerminalContract(contract), /PowerTerm-style screen buffer/)
  assert.match(renderCockpitTerminalContract(contract), /Send Policy/)
  assert.match(renderCockpitTerminalContract(contract), /Command Plan/)
  assert.match(renderCockpitTerminalContract(contract), /D3 terminal definition parity/)
})

test("connector strategy makes PTY primary and UOPY optional for D3 cockpit work", () => {
  const strategy = createD3ConnectorStrategy({ name: "prod", type: "ssh", host: "d3.example", username: "d3", account: "SALES", sessionMode: "persistent", promptPattern: ">" })
  assert.match(strategy.answer, /persistent PTY/)
  assert.ok(strategy.layers.some((layer) => layer.id === "pty-session" && layer.status === "ready"))
  assert.ok(strategy.layers.some((layer) => layer.id === "screen-buffer" && layer.notEnoughFor.some((entry) => entry.includes("blind automatic rewrites"))))
  assert.ok(strategy.layers.some((layer) => layer.id === "terminal-definition" && layer.purpose.includes("@() cursor")))
  assert.ok(strategy.layers.some((layer) => layer.id === "uopy" && layer.notEnoughFor.some((entry) => entry.includes("primary terminal connector"))))
  assert.ok(strategy.cockpitRequirements.some((entry) => entry.includes("TERM/define-terminal")))
  assert.ok(strategy.liveSpikes.some((entry) => entry.includes("terminal-capture")))
  assert.match(renderD3ConnectorStrategy(strategy), /D3 Connector Strategy/)
  assert.match(renderD3ConnectorStrategy(strategy), /PowerTerm-style programs/)
})
