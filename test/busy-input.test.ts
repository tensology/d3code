import assert from "node:assert/strict"
import test from "node:test"
import { createBusyInputHandler } from "../src/tui/busy-input.js"

test("busy input queues completed lines and keeps trailing draft", () => {
  const queued: string[] = []
  let draft = { text: "", cursor: 0 }
  const handler = createBusyInputHandler({
    getDraft: () => draft,
    setDraft: (next) => {
      draft = typeof next === "function" ? next(draft) : next
    },
    submitLine: (line) => {
      queued.push(line)
    },
    completeDraft: (current) => current,
    applyEscapeInput: () => undefined,
    interrupt: () => undefined,
    resetHistoryIndex: () => undefined,
  })

  handler("! echo queued\nnext")

  assert.deepEqual(queued, ["! echo queued"])
  assert.deepEqual(draft, { text: "next", cursor: 4 })
})

test("busy input completes tab before queueing submitted line", () => {
  const queued: string[] = []
  let draft = { text: "", cursor: 0 }
  const handler = createBusyInputHandler({
    getDraft: () => draft,
    setDraft: (next) => {
      draft = typeof next === "function" ? next(draft) : next
    },
    submitLine: (line) => {
      queued.push(line)
    },
    completeDraft: () => ({ text: "/profile ", cursor: 9 }),
    applyEscapeInput: () => undefined,
    interrupt: () => undefined,
    resetHistoryIndex: () => undefined,
  })

  handler("/pr\tprod\n")

  assert.deepEqual(queued, ["/profile prod"])
  assert.deepEqual(draft, { text: "", cursor: 0 })
})
