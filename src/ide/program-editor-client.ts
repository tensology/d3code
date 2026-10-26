import { basicSetup } from "codemirror"
import { Compartment, EditorState } from "@codemirror/state"
import { EditorView, keymap } from "@codemirror/view"
import { indentWithTab } from "@codemirror/commands"
import { HighlightStyle, StreamLanguage, indentUnit, syntaxHighlighting } from "@codemirror/language"
import { gotoLine, openSearchPanel } from "@codemirror/search"
import { tags } from "@lezer/highlight"
import { d3BasicParser } from "./basic-language.js"

const backing = document.getElementById("itemBody") as HTMLTextAreaElement
const wrap = backing.closest(".editor-wrap") as HTMLElement
const host = document.getElementById("programEditor")!
const surface = host.querySelector<HTMLElement>(".program-editor-surface")!
const position = document.getElementById("programEditorPosition") as HTMLButtonElement
const readOnly = new Compartment(), theme = new Compartment()
let view: EditorView | undefined, identity = "", syncing = false, currentReadOnly = false, currentDark = false

const highlight = syntaxHighlighting(HighlightStyle.define([
  { tag: tags.keyword, color: "color-mix(in srgb, var(--accent) 80%, var(--text))", fontWeight: "600" },
  { tag: tags.string, color: "color-mix(in srgb, var(--accent2) 80%, var(--text))" },
  { tag: [tags.number, tags.atom], color: "color-mix(in srgb, var(--warn) 80%, var(--text))" },
  { tag: tags.comment, color: "color-mix(in srgb, var(--muted) 80%, var(--text))", fontStyle: "italic" },
  { tag: tags.labelName, color: "color-mix(in srgb, var(--accent2) 80%, var(--text))" },
  { tag: tags.operator, color: "var(--soft)" },
]))
const editorTheme = (dark: boolean) => EditorView.theme({
  "&": { height: "100%", color: "var(--text)", backgroundColor: "var(--editor)" },
  ".cm-scroller": { overflow: "auto", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" },
  ".cm-content": { caretColor: "var(--text)", padding: "12px 0" },
  ".cm-gutters": { color: "color-mix(in srgb, var(--muted) 80%, var(--text))", backgroundColor: "var(--panel2)", borderColor: "var(--line)" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "var(--panel2)" },
  ".cm-panels, .cm-tooltip": { color: "var(--text)", backgroundColor: "var(--panel2)", borderColor: "var(--line2)" },
  "&.cm-focused": { outline: "2px solid var(--accent)", outlineOffset: "-2px" },
}, { dark })

function updatePosition() {
  if (!view) return
  const head = view.state.selection.main.head, line = view.state.doc.lineAt(head)
  position.textContent = `Ln ${line.number}, Col ${head - line.from + 1}`
  position.setAttribute("aria-label", `Go to line. Line ${line.number}, column ${head - line.from + 1}`)
}

function state() {
  return EditorState.create({ doc: backing.value, extensions: [
    keymap.of([{ key: "Mod-s", run: () => { if (!backing.readOnly) document.getElementById("writeItem")!.click();return true } }, indentWithTab]),
    basicSetup, StreamLanguage.define(d3BasicParser), highlight, indentUnit.of("  "), EditorState.tabSize.of(2),
    readOnly.of([EditorState.readOnly.of(backing.readOnly), EditorView.editable.of(!backing.readOnly)]),
    theme.of(editorTheme(currentDark)),
    EditorView.contentAttributes.of(view => ({ "aria-label": "D3 BASIC program editor", "aria-readonly": String(view.state.readOnly), tabindex: "0", "aria-describedby": "programEditorKeyboard" })),
    EditorView.updateListener.of(update => {
      if (update.docChanged && !syncing) {
        backing.value = update.state.doc.toString()
        backing.dispatchEvent(new Event("input", { bubbles: true }))
      }
      updatePosition()
    }),
  ] })
}

function sync() {
  const active = document.body.dataset.editorState === "loaded" && document.body.dataset.editorKind === "program"
  host.hidden = !active;wrap.classList.toggle("code-editor-ready", active)
  backing.setAttribute("aria-hidden", String(active))
  if (!active) { identity = "";return }
  const nextIdentity = JSON.stringify([backing.dataset.profile, (document.getElementById("file") as HTMLInputElement).value, (document.getElementById("item") as HTMLInputElement).value, backing.dataset.recordVersion])
  const dark = document.body.dataset.theme !== "light"
  syncing = true
  try {
    if (!view || nextIdentity !== identity) {
      currentDark = dark;currentReadOnly = backing.readOnly
      if (view) view.setState(state())
      else view = new EditorView({ state: state(), parent: surface })
      identity = nextIdentity
    } else {
      if (view.state.doc.toString() !== backing.value) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: backing.value } })
      if (currentReadOnly !== backing.readOnly) { currentReadOnly = backing.readOnly;view.dispatch({ effects: readOnly.reconfigure([EditorState.readOnly.of(currentReadOnly), EditorView.editable.of(!currentReadOnly)]) }) }
      if (currentDark !== dark) { currentDark = dark;view.dispatch({ effects: theme.reconfigure(editorTheme(dark)) }) }
    }
    updatePosition()
  } finally { syncing = false }
}

document.getElementById("programEditorFind")!.onclick = () => { if (view) openSearchPanel(view) }
position.onclick = () => { if (view) gotoLine(view) }
document.addEventListener("d3-editor-sync", sync)
new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["data-editor-state", "data-editor-kind", "data-theme"] })
document.body.dataset.codeEditorState = "ready"
sync()
