export interface ComposerState {
  mode: string
  busy: boolean
  draftText?: string
  queuedCount?: number
}

export interface ComposerPrompt {
  glyph: string
  color: "cyan" | "yellow"
}

export function formatComposerTitle(state: Pick<ComposerState, "mode" | "busy">): string {
  if (state.mode === "d3") return state.busy ? "D3 TCL queued input" : "D3 TCL"
  return state.busy ? "Queued input" : "Message D3 Code"
}

export function formatComposerPrompt(state: Pick<ComposerState, "mode" | "busy">): ComposerPrompt {
  const glyph = state.mode === "d3" ? ":" : "›"
  return {
    glyph: state.busy ? `queued ${glyph}` : glyph,
    color: state.mode === "d3" ? "yellow" : "cyan",
  }
}

export function formatComposerHint(state: Pick<ComposerState, "busy" | "draftText" | "queuedCount">): string {
  const queuedCount = state.queuedCount ?? 0
  if (!state.busy) return "Enter send · ! Unix · /d3 D3 terminal · /help"
  if (queuedCount > 0) {
    return `${queuedCount} queued · runs after this turn · Esc interrupts`
  }
  if ((state.draftText ?? "").trim()) return "Enter queue · Esc clear draft"
  return "Type the next instruction while this runs · Enter queues · Esc interrupts"
}
