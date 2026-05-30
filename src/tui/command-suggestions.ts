export interface CommandSuggestion {
  name: string
  description: string
}

const suggestions: CommandSuggestion[] = [
  { name: "/setup", description: "configure AI provider and D3 profile" },
  { name: "/profile", description: "show or switch D3 profiles" },
  { name: "/d3", description: "attach to the D3 runtime terminal" },
  { name: "/chat", description: "return from D3 terminal to agent chat" },
  { name: "/status", description: "show readiness, model, profile, and goals" },
  { name: "/ide", description: "open the browser workbench" },
  { name: "/help", description: "show all commands and controls" },
  { name: "/model", description: "switch model for this session" },
  { name: "/models", description: "list configured model providers" },
  { name: "/mode", description: "switch chat, migrate, audit, API, or QA mode" },
  { name: "/safety", description: "switch ask, plan, or trust approval mode" },
  { name: "/read", description: "read a D3 item from a file" },
  { name: "/dict", description: "read a D3 dictionary item" },
  { name: "/files", description: "list D3 files for the selected account" },
  { name: "/locks", description: "inspect D3 locks" },
  { name: "/manual-search", description: "search the local Rocket D3 manuals" },
]

export function commandSuggestions(input: string, limit = 6): CommandSuggestion[] {
  const trimmed = input.trimStart()
  if (!trimmed.startsWith("/")) return []
  const [query = ""] = trimmed.split(/\s+/, 1)
  return suggestions
    .filter((suggestion) => suggestion.name.startsWith(query))
    .slice(0, Math.max(0, limit))
}

