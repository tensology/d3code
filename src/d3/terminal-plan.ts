import type { ConnectionProfile } from "../domain/types.js"

export interface D3TerminalBridgeCapability {
  id: "pty" | "tcl" | "uopy" | "screen"
  status: "implemented" | "partial" | "planned" | "research"
  purpose: string
  risks: string[]
  proof: string[]
}

export interface D3TerminalBridgePlan {
  profile?: string
  account?: string
  terminal: {
    mode: "persistent-pty" | "oneshot-command" | "not-configured"
    emulator: "d3-terminal-control" | "plain-output"
    why: string
  }
  capabilities: D3TerminalBridgeCapability[]
  dashboardEmbedding: string[]
  nextCommands: string[]
}

export function createD3TerminalBridgePlan(profile?: ConnectionProfile): D3TerminalBridgePlan {
  const hasProfile = Boolean(profile)
  const persistent = profile?.sessionMode === "persistent"
  const prompt = profile?.promptPattern
  return {
    profile: profile?.name,
    account: profile?.account,
    terminal: {
      mode: !hasProfile ? "not-configured" : persistent ? "persistent-pty" : "oneshot-command",
      emulator: persistent && prompt ? "d3-terminal-control" : "plain-output",
      why: persistent
        ? "D3 account-stateful work needs a long-lived session so LOGTO, TERM settings, compile/catalog state, and screen flows are not lost between commands."
        : "One-shot TCL is useful for reads and automation, but legacy D3 screens need a persistent terminal bridge.",
    },
    capabilities: [
      {
        id: "pty",
        status: persistent ? "implemented" : "planned",
        purpose: "Maintain a live local/SSH D3 process for terminal-style interaction from the TUI or cockpit.",
        risks: ["prompt detection must be profile-specific", "paged output and full-screen programs can block if the bridge does not send expected keys"],
        proof: ["profile has sessionMode=persistent", "profile has promptPattern", "profile-doctor passes WHO/VERSION/LIST MD"],
      },
      {
        id: "tcl",
        status: "implemented",
        purpose: "Run typed TCL commands, AQL reads, compile/catalog loops, locks, dictionary reads, and item reads/writes through permission gates.",
        risks: ["raw EXECUTE/TCL can hide destructive side effects", "mutation commands must remain behind safety-guard confirmation"],
        proof: ["d3_tcl tool", "safety-guard", "profile-doctor", "agent-run basic-check/file-audit"],
      },
      {
        id: "uopy",
        status: "research",
        purpose: "Optional later UOPY typed API adapter for records/subroutines when the target D3 host supports it well enough.",
        risks: ["may not cover legacy screen flows", "may not expose all account/session/terminal behaviors needed for old ERP programs"],
        proof: ["uopy-demo reference", "live account spike", "record/subroutine parity tests"],
      },
      {
        id: "screen",
        status: "partial",
        purpose: "Build a legacy screen-buffer adapter that decodes D3 BASIC screen utilities, @() cursor addressing, INPUT/CRT/DISPLAY flows, PROC paragraphs, and terminal-control output into inspectable cockpit events.",
        risks: ["PowerTerm/terminal definitions are not guaranteed to behave like xterm", "cursor addressing and status-line behavior require a screen buffer model", "AI must not rewrite screen programs without compile and operator proof"],
        proof: ["manual screen topic scoped", "fixture screen transcript parser", "live screen smoke with captured terminal transcript still required"],
      },
    ],
    dashboardEmbedding: [
      "Cockpit terminal pane should attach to the persistent D3 session, not shell out per command.",
      "Read/search tools can use typed TCL; full-screen legacy programs should use a screen-buffer adapter.",
      "The dashboard should show raw transcript, parsed screen buffer, file/program context, and safety classification side by side.",
      "Writes, catalog, lock breaks, account changes, and destructive TCL remain blocked or confirmed by the D3 safety policy.",
    ],
    nextCommands: [
      profile ? `d3code profile-doctor --profile ${profile.name}` : "d3code profile-add-local --name prod --entry '<d3-command>' --session persistent --prompt '<prompt-regex>'",
      "d3code terminal-plan --profile <profile>",
      "d3code terminal-capture --profile <profile> --out ./terminal-proof '<screen command or menu entry>'",
      "d3code screen-parse screen-transcript.txt --width 80 --height 24",
      "d3code safety-guard --command '<legacy TCL or EXECUTE command>'",
      "d3code manual-scope reference/d3_reference_manual_10.3.4_5-28-2026.pdf",
    ],
  }
}

export function renderD3TerminalBridgePlan(plan: D3TerminalBridgePlan): string {
  return [
    "# D3 Terminal Bridge Plan",
    "",
    `Profile: ${plan.profile ?? "none"}`,
    `Account: ${plan.account ?? "unknown"}`,
    `Mode: ${plan.terminal.mode}`,
    `Emulator: ${plan.terminal.emulator}`,
    `Why: ${plan.terminal.why}`,
    "",
    "Capabilities:",
    ...plan.capabilities.flatMap((capability) => [
      `- [${capability.status}] ${capability.id}: ${capability.purpose}`,
      `  risks: ${capability.risks.join("; ")}`,
      `  proof: ${capability.proof.join("; ")}`,
    ]),
    "",
    "Dashboard Embedding:",
    ...plan.dashboardEmbedding.map((item) => `- ${item}`),
    "",
    "Next Commands:",
    ...plan.nextCommands.map((command) => `- \`${command}\``),
  ].join("\n")
}
