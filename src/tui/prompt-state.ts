export interface PromptDraft {
  text: string
  cursor: number
}

export function clampCursor(text: string, cursor: number): number {
  return Math.max(0, Math.min(text.length, cursor))
}

export function insertText(draft: PromptDraft, value: string): PromptDraft {
  const cursor = clampCursor(draft.text, draft.cursor)
  return {
    text: `${draft.text.slice(0, cursor)}${value}${draft.text.slice(cursor)}`,
    cursor: cursor + value.length,
  }
}

export function backspace(draft: PromptDraft): PromptDraft {
  const cursor = clampCursor(draft.text, draft.cursor)
  if (cursor === 0) return { ...draft, cursor }
  return {
    text: `${draft.text.slice(0, cursor - 1)}${draft.text.slice(cursor)}`,
    cursor: cursor - 1,
  }
}

export function deleteForward(draft: PromptDraft): PromptDraft {
  const cursor = clampCursor(draft.text, draft.cursor)
  if (cursor >= draft.text.length) return { ...draft, cursor }
  return {
    text: `${draft.text.slice(0, cursor)}${draft.text.slice(cursor + 1)}`,
    cursor,
  }
}

export function applyRawPromptInput(draft: PromptDraft, value: string): PromptDraft {
  if (value === "\u007F" || value === "\b") return backspace(draft)
  if (value === "\u001B[3~") return deleteForward(draft)
  return insertText(draft, value)
}

export function applyRawPromptControlInput(draft: PromptDraft, value: string): PromptDraft | undefined {
  if (value === "\u007F" || value === "\b") return backspace(draft)
  if (value === "\u001B[3~") return deleteForward(draft)
  if (value === "\u001B[D") return moveLeft(draft)
  if (value === "\u001B[C") return moveRight(draft)
  if (value === "\u001B[H" || value === "\u001B[1~") return moveHome(draft)
  if (value === "\u001B[F" || value === "\u001B[4~") return moveEnd(draft)
  return undefined
}

export function moveLeft(draft: PromptDraft): PromptDraft {
  return { ...draft, cursor: clampCursor(draft.text, draft.cursor - 1) }
}

export function moveRight(draft: PromptDraft): PromptDraft {
  return { ...draft, cursor: clampCursor(draft.text, draft.cursor + 1) }
}

export function moveHome(draft: PromptDraft): PromptDraft {
  return { ...draft, cursor: 0 }
}

export function moveEnd(draft: PromptDraft): PromptDraft {
  return { ...draft, cursor: draft.text.length }
}

export function renderPromptDraft(draft: PromptDraft, caretOn: boolean): { before: string; cursor: string; after: string } {
  const cursor = clampCursor(draft.text, draft.cursor)
  return {
    before: draft.text.slice(0, cursor),
    cursor: cursor < draft.text.length ? draft.text[cursor]! : " ",
    after: draft.text.slice(cursor + (cursor < draft.text.length ? 1 : 0)),
  }
}
