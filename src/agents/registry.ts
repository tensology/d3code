export type AgentMode = "primary" | "subagent" | "all"

export interface AgentInfo {
  id: string
  mode: AgentMode
  description: string
  defaultSafety: "ask" | "plan" | "trust"
  system: string
}

export const agents: AgentInfo[] = [
  {
    id: "build",
    mode: "primary",
    description: "General coding agent with D3 tool access.",
    defaultSafety: "ask",
    system: "Implement requested changes using D3-aware tools and normal filesystem tools.",
  },
  {
    id: "plan",
    mode: "primary",
    description: "Read-only planning and analysis agent.",
    defaultSafety: "plan",
    system: "Explore, reason, and propose plans without mutating D3 or filesystem state.",
  },
  {
    id: "d3-operator",
    mode: "primary",
    description: "Operational D3 account agent for TCL, compile, catalog, and diagnostics.",
    defaultSafety: "ask",
    system: "Operate inside one Rocket D3 account with explicit permission boundaries.",
  },
  {
    id: "d3-architect",
    mode: "subagent",
    description: "Maps D3 applications, accounts, files, dictionaries, and dependencies.",
    defaultSafety: "plan",
    system: "Produce architecture maps and dependency explanations.",
  },
  {
    id: "d3-linter",
    mode: "subagent",
    description: "Reviews BASIC/FlashBASIC and TCL for correctness and risk.",
    defaultSafety: "plan",
    system: "Find compile, data, lock, transaction, and destructive-command risks.",
  },
  {
    id: "d3-data-mapper",
    mode: "subagent",
    description: "Understands dictionaries, AQL output, and file relationships.",
    defaultSafety: "plan",
    system: "Analyze D3 file dictionaries, AQL usage, and data structures.",
  },
  {
    id: "d3-basic-modernizer",
    mode: "subagent",
    description: "Modernizes D3 BASIC while preserving behavior.",
    defaultSafety: "ask",
    system: "Suggest and apply behavior-preserving BASIC improvements.",
  },
  {
    id: "d3-test-runner",
    mode: "subagent",
    description: "Runs compile/catalog/test loops and reports failures.",
    defaultSafety: "ask",
    system: "Execute safe validation loops and summarize actionable failures.",
  },
  {
    id: "research",
    mode: "subagent",
    description: "Searches code, manuals, and reference material.",
    defaultSafety: "plan",
    system: "Gather context from indexed local reference material.",
  },
]

export function getAgent(id: string): AgentInfo | undefined {
  return agents.find((agent) => agent.id === id)
}
