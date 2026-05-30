import type { ConnectionProfile } from "../domain/types.js"

export type D3ConnectorLayerId = "pty-session" | "typed-tcl" | "terminal-definition" | "screen-buffer" | "mvbasic-ide-parity" | "uopy" | "ai-operator"

export interface D3ConnectorLayer {
  id: D3ConnectorLayerId
  status: "ready" | "partial" | "spike" | "blocked"
  purpose: string
  useWhen: string[]
  notEnoughFor: string[]
  proof: string[]
}

export interface D3ConnectorStrategy {
  profile?: string
  account?: string
  answer: string
  defaultPath: string
  layers: D3ConnectorLayer[]
  ideRequirements: string[]
  liveSpikes: string[]
  failureModes: string[]
}

function profileReady(profile?: ConnectionProfile): boolean {
  return Boolean(profile?.sessionMode === "persistent" && profile.promptPattern)
}

export function createD3ConnectorStrategy(profile?: ConnectionProfile): D3ConnectorStrategy {
  const ready = profileReady(profile)
  return {
    profile: profile?.name,
    account: profile?.account,
    answer: "Yes, the IDE can expose a D3 terminal, but the reliable connector has to be layered: persistent PTY for account/session state, typed TCL for automation, a PowerTerm-aware screen buffer for legacy forms, and UOPY only as an optional typed data/subroutine adapter.",
    defaultPath: ready
      ? "Attach IDE terminal to the configured persistent D3 session, capture representative screen programs, then graduate proven flows into typed tools."
      : "Create a persistent local or SSH profile first; one-shot commands are acceptable for read-only probes but not enough for screen programs.",
    layers: [
      {
        id: "pty-session",
        status: ready ? "ready" : profile ? "partial" : "blocked",
        purpose: "Own the real login/session boundary for D3: Unix login, D3 account, LOGTO state, TERM settings, prompts, paged output, and compile/catalog context.",
        useWhen: ["interactive IDE terminal", "screen programs", "compile/catalog loops", "operator proof"],
        notEnoughFor: ["structured field extraction without a screen parser", "unguarded writes", "multi-agent access without a session lease"],
        proof: ready ? ["sessionMode=persistent", "promptPattern configured", "profile-doctor passes"] : ["profile-add-local/profile-add-ssh with --session persistent", "promptPattern required"],
      },
      {
        id: "typed-tcl",
        status: profile ? "ready" : "blocked",
        purpose: "Provide D3-native automation for WHO, LIST, AQL, dictionary reads, item reads/writes, compile, catalog, locks, and controlled EXECUTE/TCL.",
        useWhen: ["read/search tools", "file and dictionary inventory", "agent compile/catalog feedback", "audit commands"],
        notEnoughFor: ["full-screen menu/form behavior", "unknown terminal prompts", "PowerTerm-only cursor behavior"],
        proof: ["safety-guard classification", "profile-doctor", "agent-run file-audit/basic-check"],
      },
      {
        id: "screen-buffer",
        status: ready ? "partial" : "blocked",
        purpose: "Translate legacy D3 screen output into stable IDE state: cursor moves, clears, prompts, menu selections, INPUT/CRT/DISPLAY flows, PROC screens, and operator keystrokes.",
        useWhen: ["PowerTerm-style programs", "screen modernization", "AI form reconstruction", "IDE terminal replay"],
        notEnoughFor: ["blind automatic rewrites", "guaranteeing all terminal definitions before live capture", "replacing operator approval"],
        proof: ["terminal-capture", "screen-buffer.json/md", "operator-approved transcript", "bundle-screen-plan"],
      },
      {
        id: "terminal-definition",
        status: ready ? "partial" : "blocked",
        purpose: "Preserve D3 terminal semantics that PowerTerm-era applications rely on: TERM width/depth, define-terminal mappings, @() cursor/control functions, screen utilities, protected fields, paging, and status-line behavior.",
        useWhen: ["IDE terminal parity", "legacy screen replay", "screen-to-web migration", "operator training capture"],
        notEnoughFor: ["assuming xterm compatibility", "claiming screen migration readiness without operator capture", "replacing D3 BASIC screen-flow analysis"],
        proof: ["manual-scope terminal/control sections", "TERM/define-terminal capture", "representative PowerTerm session transcript", "screen-buffer parity notes"],
      },
      {
        id: "mvbasic-ide-parity",
        status: "partial",
        purpose: "Borrow the proven IDE workflow shape from Rocket MV BASIC docs: connected account folders, online editing cache boundaries, READU/WRITE locks, hashed-file record editing, compile/catalog tasks, diagnostics, references, completion, and explicit debugger limits.",
        useWhen: ["D3 IDE design", "record/file workbench", "BASIC language intelligence", "lock-aware editing", "operator runbooks"],
        notEnoughFor: ["claiming Rocket D3 support from U2-only behavior", "live debugging without a dedicated D3 adapter", "PowerTerm screen parity"],
        proof: ["mvbasic-reference-audit", "lock/conflict tests", "compile/catalog transcript", "hashed-file IDE smoke test"],
      },
      {
        id: "uopy",
        status: "spike",
        purpose: "Add a typed Python adapter path for record and subroutine operations where the target D3 host supports UOPY cleanly.",
        useWhen: ["record parity spike", "subroutine API bridge", "batch data extraction", "later migration acceleration"],
        notEnoughFor: ["primary terminal connector", "PowerTerm screens", "account/session UI programs", "every legacy ERP workflow"],
        proof: ["uopy-demo parity test", "read/write/subroutine fixture comparison", "fallback to PTY/TCL documented"],
      },
      {
        id: "ai-operator",
        status: "partial",
        purpose: "Let D3 Code plan, ask, execute, diff, compile, catalog, rollback, and delegate subagents only after connector evidence proves the operation boundary.",
        useWhen: ["modernization work", "migration planning", "data integrity audits", "screen-to-web reconstruction"],
        notEnoughFor: ["production mutation without confirmation", "claiming live readiness without real D3 proof"],
        proof: ["goal evidence", "completion-audit", "live-proof", "bundle-readiness"],
      },
    ],
    ideRequirements: [
      "Show raw transcript, parsed screen buffer, current profile/account, safety classification, and command journal together.",
      "Keep terminal sends default-off for generated web scaffolds until D3CODE_TERMINAL_ENABLED=1 is set.",
      "Treat screen programs as stateful flows, not plain xterm output.",
      "Capture target TERM/define-terminal settings and map D3 @() control functions before calling the IDE PowerTerm-compatible.",
      "Use Rocket MV BASIC reference behavior as an IDE-parity checklist, while keeping D3-specific live proof separate from U2/jBASE assumptions.",
      "Require operator-approved captures before converting legacy D3 screens into modern UI layouts.",
      "Keep UOPY behind a parity spike and fallback path; never make it the only connector.",
    ],
    liveSpikes: [
      "Login/profile-doctor against a disposable D3 account.",
      "Run WHO, LIST MD, a read-only AQL command, and a dictionary read through typed TCL.",
      "Capture TERM, terminal width/depth, and define-terminal evidence for the actual customer emulator.",
      "Capture one menu/form program through terminal-capture and validate screen-buffer cursor/input events.",
      "Read, diff-write, compile, catalog, and rollback a disposable BASIC item under ask safety.",
      "Compare Rocket MV BASIC online editing, hashed-file, diagnostics, references, completion, and debug assumptions against the actual D3 account.",
      "Run the same record/subroutine path through UOPY if available and compare outputs to TCL/PTU evidence.",
    ],
    failureModes: [
      "Prompt regex mismatch causes hung sessions or swallowed output.",
      "Paged output waits for a key and blocks the agent loop.",
      "PowerTerm terminal definitions emit controls the parser does not yet model.",
      "Legacy programs hide writes inside EXECUTE, CALL, CHAIN, triggers, or phantoms.",
      "UOPY is unavailable or too narrow for the customer environment.",
    ],
  }
}

export function renderD3ConnectorStrategy(strategy: D3ConnectorStrategy): string {
  return [
    "# D3 Connector Strategy",
    "",
    `Profile: ${strategy.profile ?? "none"}`,
    `Account: ${strategy.account ?? "unknown"}`,
    `Answer: ${strategy.answer}`,
    `Default path: ${strategy.defaultPath}`,
    "",
    "Layers:",
    ...strategy.layers.flatMap((layer) => [
      `- [${layer.status}] ${layer.id}: ${layer.purpose}`,
      `  Use when: ${layer.useWhen.join("; ")}`,
      `  Not enough for: ${layer.notEnoughFor.join("; ")}`,
      `  Proof: ${layer.proof.join("; ")}`,
    ]),
    "",
    "IDE Requirements:",
    ...strategy.ideRequirements.map((item) => `- ${item}`),
    "",
    "Live Spikes:",
    ...strategy.liveSpikes.map((item) => `- ${item}`),
    "",
    "Failure Modes:",
    ...strategy.failureModes.map((item) => `- ${item}`),
  ].join("\n")
}
