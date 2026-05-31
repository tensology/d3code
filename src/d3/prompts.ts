export const D3_TCL_PROMPT = ":"
export const D3_ACTIVE_LIST_PROMPT = ">"
export const D3_TCL_PROMPT_PATTERN = ":"

export function describeD3PromptPattern(): string {
  return "Rocket D3's normal TCL prompt is `:`. The `>` prompt means an active select list is present, so use it only when that is the state you expect."
}
