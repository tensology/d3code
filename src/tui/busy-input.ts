import { backspace, insertText, moveEnd, moveHome, type PromptDraft } from "./prompt-state.js"

export interface BusyInputController {
  getDraft(): PromptDraft
  setDraft(next: PromptDraft | ((current: PromptDraft) => PromptDraft)): void
  submitLine(line: string): void
  completeDraft(current: PromptDraft): PromptDraft
  applyEscapeInput(value: string): void
  interrupt(message: string): void
  resetHistoryIndex(): void
}

export function createBusyInputHandler(controller: BusyInputController): (value: string) => void {
  function submitDraftWithInput(baseDraft: PromptDraft, value: string): void {
    const hasTrailingDraft = !/[\r\n]$/.test(value)
    const parts = value.split(/\r\n|\r|\n/)
    const completeLines = hasTrailingDraft ? parts.slice(0, -1) : parts
    const trailingDraft = hasTrailingDraft ? parts.at(-1) ?? "" : ""
    if (completeLines.length === 0) {
      controller.setDraft({ text: trailingDraft, cursor: trailingDraft.length })
      controller.resetHistoryIndex()
      return
    }
    const firstDraft = completeLines[0] ? insertText(baseDraft, completeLines[0]) : baseDraft
    const firstLine = firstDraft.text.trim()
    if (firstLine) controller.submitLine(firstLine)
    for (const line of completeLines.slice(1)) {
      const trimmed = line.trim()
      if (trimmed) controller.submitLine(trimmed)
    }
    controller.setDraft({ text: trailingDraft, cursor: trailingDraft.length })
    controller.resetHistoryIndex()
  }

  return (value: string): void => {
    if (value.includes("\u0003")) {
      controller.interrupt("Interrupted. Finishing any already-returned cleanup.")
      return
    }
    if (value.includes("\t")) {
      const tabIndex = value.indexOf("\t")
      const beforeTab = value.slice(0, tabIndex)
      const afterTab = value.slice(tabIndex + 1)
      const draftAtTab = controller.completeDraft(beforeTab ? insertText(controller.getDraft(), beforeTab) : controller.getDraft())
      if (afterTab.search(/[\r\n]/) !== -1) {
        submitDraftWithInput(draftAtTab, afterTab)
        return
      }
      controller.setDraft(afterTab ? insertText(draftAtTab, afterTab) : draftAtTab)
      controller.resetHistoryIndex()
      return
    }
    if (value.search(/[\r\n]/) !== -1) {
      submitDraftWithInput(controller.getDraft(), value)
      return
    }
    if (value.includes("\u001B")) {
      controller.applyEscapeInput(value)
      return
    }
    if (value === "\u007F" || value === "\b") {
      controller.setDraft(backspace)
      controller.resetHistoryIndex()
      return
    }
    if (value === "\u0015") {
      controller.setDraft({ text: "", cursor: 0 })
      controller.resetHistoryIndex()
      return
    }
    if (value === "\u0001") {
      controller.setDraft(moveHome)
      return
    }
    if (value === "\u0005") {
      controller.setDraft(moveEnd)
      return
    }
    controller.setDraft((current) => insertText(current, value))
    controller.resetHistoryIndex()
  }
}
