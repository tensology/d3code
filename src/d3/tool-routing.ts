import type { ConnectionProfile } from "../domain/types.js"

export type D3ToolMechanism = "persistent-pty" | "typed-tcl" | "screen-buffer" | "d3py-uopy" | "manual-reference"

export interface D3ToolRoute {
  mechanism: D3ToolMechanism
  status: "ready" | "partial" | "spike" | "blocked"
  bestFor: string[]
  notFor: string[]
  why: string
  proof: string[]
}

export interface D3ToolRoutingStatus {
  profile?: string
  account?: string
  terminalReady: boolean
  d3pyAvailable: boolean
  defaultGuidance: string
  routes: D3ToolRoute[]
}

function terminalReady(profile?: ConnectionProfile): boolean {
  return Boolean(profile?.sessionMode === "persistent" && profile.promptPattern)
}

function d3pyAvailable(): boolean {
  return process.env.D3CODE_D3PY_ENABLED === "1" || Boolean(process.env.D3CODE_D3PY_COMMAND)
}

export function createD3ToolRoutingStatus(profile?: ConnectionProfile): D3ToolRoutingStatus {
  const ready = terminalReady(profile)
  const d3py = d3pyAvailable()
  return {
    profile: profile?.name,
    account: profile?.account,
    terminalReady: ready,
    d3pyAvailable: d3py,
    defaultGuidance: ready
      ? "Use typed tools for reads/audits, persistent PTY for terminal and screen flows, and only use D3PY/UOPY after a parity spike proves it on this host."
      : "Use typed tools for read-only probes, but configure a persistent profile before treating Terminal or System Builder screen flows as interactive.",
    routes: [
      {
        mechanism: "typed-tcl",
        status: profile ? "ready" : "blocked",
        bestFor: ["WHO/VERSION proof", "LIST/SELECT/AQL", "CT item reads", "DICT reads", "locks", "BASIC compile", "CATALOG", "guarded writes"],
        notFor: ["PowerTerm-style screens", "login prompts", "paged menu programs", "high-volume record extraction without batching"],
        why: "Typed TCL is the safest implemented automation layer because every command still goes through D3 permission classification and profile/account controls.",
        proof: ["d3_tcl", "d3_read_item", "d3_query_aql", "d3_compile_basic", "safety-guard"],
      },
      {
        mechanism: "persistent-pty",
        status: ready ? "ready" : profile ? "partial" : "blocked",
        bestFor: ["IDE terminal", "login/account state", "TERM settings", "menus", "System Builder and legacy screen flows", "operator transcript proof"],
        notFor: ["blind bulk extraction", "unconfirmed destructive commands", "structured screen fields before parsing"],
        why: "Interactive D3 work needs a live process so account state, prompts, screen clears, and follow-up keystrokes are not lost between commands.",
        proof: ready ? ["sessionMode=persistent", "promptPattern configured"] : ["configure sessionMode=persistent", "configure promptPattern"],
      },
      {
        mechanism: "screen-buffer",
        status: ready ? "partial" : "blocked",
        bestFor: ["System Builder screen reconstruction", "CRT/DISPLAY/INPUT flows", "menu/form modernization", "cursor-control evidence"],
        notFor: ["database reads without a screen", "claiming PowerTerm parity without live capture"],
        why: "Screen programs are stateful UI flows; the IDE should parse terminal output into a screen buffer before generating modern screens.",
        proof: ["terminal-capture", "screen-parse", "bundle-screen-plan"],
      },
      {
        mechanism: "d3py-uopy",
        status: d3py ? "spike" : "blocked",
        bestFor: ["record API parity spike", "subroutine bridge spike", "batch extraction where UOPY is installed and proven"],
        notFor: ["primary login connector", "PowerTerm screens", "unknown customer D3 environments", "operations before parity evidence"],
        why: d3py
          ? "D3PY/UOPY is available by configuration, but still needs parity tests against typed TCL before becoming the preferred route."
          : "D3PY/UOPY is not configured in this environment, so the IDE must not pretend it can use it yet.",
        proof: d3py ? ["D3CODE_D3PY_* configured", "pending parity test"] : ["set D3CODE_D3PY_ENABLED=1 or D3CODE_D3PY_COMMAND after installing/proving it"],
      },
      {
        mechanism: "manual-reference",
        status: "ready",
        bestFor: ["syntax grounding", "operator runbooks", "D3 behavior checks", "System Builder migration notes"],
        notFor: ["live account facts", "current VM status", "proof of a command result"],
        why: "Reference search explains D3 behavior, but live tools must prove the active account and VM state.",
        proof: ["d3_manual_search", "/api/rag/status"],
      },
    ],
  }
}
