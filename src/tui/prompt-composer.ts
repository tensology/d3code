export interface ComposerState {
  mode: string
  busy: boolean
  draftText?: string
  queuedCount?: number
}

export function formatComposerTitle(state: Pick<ComposerState, "mode" | "busy">): string {
  if (state.mode === "d3") return state.busy ? "D3 TCL queued input" : "D3 TCL"
  return state.busy ? "Queued input" : "Message D3 Code"
}

export function formatComposerHint(state: Pick<ComposerState, "busy" | "draftText" | "queuedCount">): string {
  const queuedCount = state.queuedCount ?? 0
  if (!state.busy) return "Enter sends; prefix Unix commands with !; /d3 attaches the D3 runtime"
  if (queuedCount > 0) {
    return `${queuedCount} queued; they run automatically after this turn unless you interrupt`
  }
  if ((state.draftText ?? "").trim()) return "Enter queues this prompt; Esc clears the draft first"
  return "type the next instruction while this runs; Enter queues it, Esc interrupts"
}
