export const D3_TCL_PROMPT = ":"
export const D3_ACTIVE_LIST_PROMPT = ">"
export const D3_TCL_PROMPT_PATTERN = "(^|\\n):\\s*$"

export function normalizeD3PromptPattern(pattern?: string): string | undefined {
  const trimmed = pattern?.trim()
  if (!trimmed) return undefined
  return trimmed === ":" ? D3_TCL_PROMPT_PATTERN : trimmed
}

export function describeD3PromptPattern(): string {
  return "Rocket D3's normal TCL prompt is a standalone `:` at the end of the screen. The `>` prompt means an active select list is present, so use it only when that is the state you expect."
}
