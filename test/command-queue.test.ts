import assert from "node:assert/strict"
import test from "node:test"
import {
  clearQueuedLines,
  dequeueQueuedLine,
  dropLastQueuedLine,
  enqueueQueuedLine,
  getQueuedLineCount,
  getQueuedLinesSnapshot,
  queuedTranscriptContent,
  resetQueuedLinesForTest,
  subscribeQueuedLines,
} from "../src/tui/command-queue.js"

test("command queue publishes immutable snapshots for prompt rendering", () => {
  resetQueuedLinesForTest()
  let changes = 0
  const unsubscribe = subscribeQueuedLines(() => {
    changes += 1
  })

  const first = enqueueQueuedLine("hello", "chat")
  const second = enqueueQueuedLine("LIST MD", "d3")

  assert.equal(changes, 2)
  assert.equal(getQueuedLineCount(), 2)
  assert.deepEqual(getQueuedLinesSnapshot().map((queued) => queued.id), [first.id, second.id])
  assert.equal(queuedTranscriptContent(first), "hello")
  assert.equal(queuedTranscriptContent(second), ":LIST MD")

  assert.equal(dequeueQueuedLine()?.line, "hello")
  assert.equal(dropLastQueuedLine()?.line, "LIST MD")
  assert.equal(getQueuedLineCount(), 0)
  assert.equal(changes, 4)

  unsubscribe()
})

test("command queue clears pending input and reports cleared count", () => {
  resetQueuedLinesForTest()
  enqueueQueuedLine("one", "chat")
  enqueueQueuedLine("two", "chat")

  assert.equal(clearQueuedLines(), 2)
  assert.equal(clearQueuedLines(), 0)
  assert.deepEqual(getQueuedLinesSnapshot(), [])
})
