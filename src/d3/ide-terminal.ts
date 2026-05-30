import type { ConnectionProfile } from "../domain/types.js"
import { createD3TerminalBridgePlan } from "./terminal-plan.js"

export type IdeTerminalFeatureStatus = "ready" | "partial" | "blocked"

export interface IdeTerminalFeature {
  id: "session" | "tcl" | "terminal-definition" | "screen-buffer" | "mvbasic-ide-parity" | "uopy" | "writes" | "operator-proof"
  status: IdeTerminalFeatureStatus
  title: string
  detail: string
  proof: string[]
}

export interface IdeTerminalSendPolicy {
  enabledByDefault: boolean
  enableEnv: string
  mutationEnv: string
  transcriptEnv: string
  mockMode: string
  blockedUntil: string[]
}

export interface IdeTerminalCommandPlan {
  id: "read-tcl" | "screen-capture" | "write-diff" | "compile-catalog"
  title: string
  example: string
  safety: "read" | "ask" | "confirm"
  requiredProof: string[]
}

export interface IdeTerminalScreenParity {
  emulator: "PowerTerm-compatible D3 terminal definitions"
  model: "raw-transcript-plus-screen-buffer"
  requiredEvidence: string[]
  unsupportedUntilProven: string[]
}

export interface IdeTerminalContract {
  profile?: string
  account?: string
  attachMode: "persistent-pty" | "oneshot-command" | "unconfigured"
  terminalModel: "powerterm-aware-buffer" | "plain-transcript"
  summary: string
  features: IdeTerminalFeature[]
  sendPolicy: IdeTerminalSendPolicy
  commandPlan: IdeTerminalCommandPlan[]
  screenParity: IdeTerminalScreenParity
  requiredLiveProof: string[]
}

function feature(values: IdeTerminalFeature): IdeTerminalFeature {
  return values
}

export function createIdeTerminalContract(profile?: ConnectionProfile): IdeTerminalContract {
  const bridge = createD3TerminalBridgePlan(profile)
  const persistent = bridge.terminal.mode === "persistent-pty"
  const configured = Boolean(profile)
  const promptReady = Boolean(profile?.promptPattern)
  const terminalModel = persistent && promptReady ? "powerterm-aware-buffer" : "plain-transcript"

  return {
    profile: profile?.name,
    account: profile?.account,
    attachMode: !configured ? "unconfigured" : persistent ? "persistent-pty" : "oneshot-command",
    terminalModel,
    summary: persistent
      ? "IDE can attach to a long-lived D3 local/SSH process; PowerTerm-style screens still require transcript and screen-buffer proof before AI rewrites the flow."
      : "IDE can run read/search TCL as one-shot commands, but full D3 terminal programs need a persistent PTY profile before they are treated as interactive.",
    features: [
      feature({
        id: "session",
        status: persistent && promptReady ? "ready" : configured ? "partial" : "blocked",
        title: "Persistent D3 session",
        detail: "Keeps LOGTO/account state, TERM settings, prompts, paged output, compile/catalog context, and screen program state alive across IDE sends.",
        proof: persistent && promptReady ? ["profile:sessionMode=persistent", "profile:promptPattern"] : ["configure sessionMode=persistent", "configure promptPattern"],
      }),
      feature({
        id: "tcl",
        status: configured ? "ready" : "blocked",
        title: "Typed TCL bridge",
        detail: "Supports D3-native commands for reads, AQL, dictionaries, files, compile/catalog loops, and safety-classified operator actions.",
        proof: configured ? ["profile configured", "safety-guard available"] : ["add a local or SSH D3 profile"],
      }),
      feature({
        id: "screen-buffer",
        status: persistent && promptReady ? "partial" : "blocked",
        title: "PowerTerm-style screen buffer",
        detail: "Normalizes D3 cursor-control output, CRT/DISPLAY/INPUT flows, PROC menus, and screen utilities into inspectable IDE state instead of assuming xterm behavior.",
        proof: ["terminal-capture artifact", "screen-buffer.json", "operator-approved transcript"],
      }),
      feature({
        id: "terminal-definition",
        status: persistent && promptReady ? "partial" : "blocked",
        title: "D3 terminal definition parity",
        detail: "Tracks TERM/define-terminal behavior, @() cursor/control codes, paging, status-line handling, protected fields, keyboard lock/unlock, and BASIC screen utilities as compatibility evidence for the IDE terminal.",
        proof: ["TERM command capture", "define-terminal evidence", "manual-scope screen/control sections", "operator parity notes"],
      }),
      feature({
        id: "mvbasic-ide-parity",
        status: "partial",
        title: "Rocket MV BASIC IDE parity",
        detail: "Uses Rocket MV BASIC extension behavior as a checklist for connection profiles, account folders, online editing locks, hashed-file browsing, compile/catalog flows, diagnostics, references, completion, and debugger boundaries.",
        proof: ["mvbasic-reference-audit", "online editing lock evidence", "hashed-file IDE parity", "compile/catalog transcript", "debugger adapter proof before live debug claims"],
      }),
      feature({
        id: "uopy",
        status: "partial",
        title: "UOPY typed adapter",
        detail: "Useful as a later record/subroutine API path when the host supports it, but it cannot be the only connector because legacy screen flows and account-terminal state live outside that API surface.",
        proof: ["uopy-demo parity spike", "record read/write parity", "subroutine call parity"],
      }),
      feature({
        id: "writes",
        status: configured ? "partial" : "blocked",
        title: "Guarded writes and catalog",
        detail: "Write, compile, catalog, lock, and destructive TCL operations stay behind safety mode and typed confirmations from the IDE.",
        proof: ["safety-guard report", "diff before write", "compile/catalog transcript"],
      }),
      feature({
        id: "operator-proof",
        status: "partial",
        title: "Human operator proof",
        detail: "The connector is not considered complete until a real D3 operator can reproduce login, terminal send, screen capture, read, write-diff, compile, catalog, and rollback proof.",
        proof: ["profile-doctor", "live-proof", "terminal-capture", "bundle-readiness"],
      }),
    ],
    sendPolicy: {
      enabledByDefault: false,
      enableEnv: "D3CODE_TERMINAL_ENABLED=1",
      mutationEnv: "D3CODE_ALLOW_WRITES=1",
      transcriptEnv: "D3CODE_TERMINAL_RECORD_TRANSCRIPT=1",
      mockMode: "D3CODE_MOCK=1 allows offline IDE terminal smoke tests only",
      blockedUntil: [
        "profile-doctor proves login, prompt detection, WHO, LIST MD, and read-only TCL",
        "terminal-capture records at least one representative menu/form transcript",
        "screen-buffer.json is operator-approved against the target PowerTerm behavior",
        "safety-guard and rollback evidence exist before mutation commands are enabled",
      ],
    },
    commandPlan: [
      {
        id: "read-tcl",
        title: "Read-only TCL probe",
        example: "WHO; LIST MD",
        safety: "read",
        requiredProof: ["profile configured", "safety classification is read"],
      },
      {
        id: "screen-capture",
        title: "Legacy screen capture",
        example: "RUN BP MENU.PROGRAM",
        safety: "ask",
        requiredProof: ["persistent PTY profile", "TERM/define-terminal capture", "terminal-capture artifacts"],
      },
      {
        id: "write-diff",
        title: "Guarded item write",
        example: "ED BP TEST.ITEM or d3_write_item",
        safety: "confirm",
        requiredProof: ["diff before write", "operator approval", "rollback instructions", "D3CODE_ALLOW_WRITES=1"],
      },
      {
        id: "compile-catalog",
        title: "Compile and catalog loop",
        example: "BASIC BP TEST.ITEM; CATALOG BP TEST.ITEM",
        safety: "confirm",
        requiredProof: ["compile transcript", "catalog transcript", "disposable item proof", "rollback notes"],
      },
    ],
    screenParity: {
      emulator: "PowerTerm-compatible D3 terminal definitions",
      model: "raw-transcript-plus-screen-buffer",
      requiredEvidence: [
        "TERM output and terminal width/depth",
        "define-terminal or equivalent terminal definition capture",
        "@() cursor/control behavior mapped in screen-buffer events",
        "operator-approved transcript for a real menu/form program",
      ],
      unsupportedUntilProven: [
        "claiming xterm compatibility",
        "automatic screen rewrites without live transcript evidence",
        "production terminal sends from the generated IDE",
        "using UOPY as a substitute for full-screen D3 workflows",
      ],
    },
    requiredLiveProof: [
      "profile-doctor passes local/SSH login and read-only smoke commands",
      "TERM and define-terminal behavior is captured for the target emulator before claiming PowerTerm parity",
      "terminal-capture records a representative menu/form program with raw transcript and screen-buffer artifacts",
      "screen-buffer parser preserves cursor movement, prompts, clear-screen behavior, and entered keys well enough for an operator to verify",
      "Rocket MV BASIC reference parity is checked for connection, online editing, locks, hashed-file browsing, compile/catalog, diagnostics, and debugger boundaries",
      "read/write-diff/compile/catalog loop is proven on a disposable item before writes are enabled for production files",
    ],
  }
}

export function renderIdeTerminalContract(contract: IdeTerminalContract): string {
  return [
    "# D3 IDE Terminal Contract",
    "",
    `Profile: ${contract.profile ?? "none"}`,
    `Account: ${contract.account ?? "unknown"}`,
    `Attach mode: ${contract.attachMode}`,
    `Terminal model: ${contract.terminalModel}`,
    `Summary: ${contract.summary}`,
    "",
    "Features:",
    ...contract.features.flatMap((entry) => [
      `- [${entry.status}] ${entry.id}: ${entry.title}`,
      `  Detail: ${entry.detail}`,
      `  Proof: ${entry.proof.join("; ")}`,
    ]),
    "",
    "Send Policy:",
    `- enabled by default: ${contract.sendPolicy.enabledByDefault ? "yes" : "no"}`,
    `- enable: ${contract.sendPolicy.enableEnv}`,
    `- mutations: ${contract.sendPolicy.mutationEnv}`,
    `- transcript recording: ${contract.sendPolicy.transcriptEnv}`,
    `- mock: ${contract.sendPolicy.mockMode}`,
    ...contract.sendPolicy.blockedUntil.map((item) => `- blocked until: ${item}`),
    "",
    "Command Plan:",
    ...contract.commandPlan.flatMap((item) => [
      `- [${item.safety}] ${item.id}: ${item.title}`,
      `  Example: ${item.example}`,
      `  Required proof: ${item.requiredProof.join("; ")}`,
    ]),
    "",
    "Screen Parity:",
    `- emulator: ${contract.screenParity.emulator}`,
    `- model: ${contract.screenParity.model}`,
    ...contract.screenParity.requiredEvidence.map((item) => `- evidence: ${item}`),
    ...contract.screenParity.unsupportedUntilProven.map((item) => `- unsupported until proven: ${item}`),
    "",
    "Required Live Proof:",
    ...contract.requiredLiveProof.map((item) => `- ${item}`),
  ].join("\n")
}
