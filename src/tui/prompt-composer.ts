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
  void state
  return ""
}

export function formatComposerPrompt(state: Pick<ComposerState, "mode" | "busy">): ComposerPrompt {
  void state.busy
  const glyph = state.mode === "d3" ? ":" : "›"
  return {
    glyph,
    color: state.mode === "d3" ? "yellow" : "cyan",
  }
}

export function formatComposerHint(state: Pick<ComposerState, "busy" | "draftText" | "queuedCount">): string {
  const queuedCount = state.queuedCount ?? 0
  if (!state.busy) return "enter send · ! unix · /d3 D3 · /help"
  if (queuedCount > 0) {
    return `${queuedCount} queued · esc interrupts`
  }
  if ((state.draftText ?? "").trim()) return "enter queues next turn · esc clears draft"
  return "type ahead queues · esc interrupts"
}
