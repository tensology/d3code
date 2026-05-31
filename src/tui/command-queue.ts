import { useSyncExternalStore } from "react"

export interface QueuedLine {
  id: number
  line: string
  mode: string
}

let nextId = 1
const queuedLines: QueuedLine[] = []
let snapshot: readonly QueuedLine[] = Object.freeze([])
const listeners = new Set<() => void>()

function emit() {
  snapshot = Object.freeze([...queuedLines])
  for (const listener of listeners) listener()
}

export function subscribeQueuedLines(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getQueuedLinesSnapshot(): readonly QueuedLine[] {
  return snapshot
}

export function useQueuedLines(): readonly QueuedLine[] {
  return useSyncExternalStore(subscribeQueuedLines, getQueuedLinesSnapshot, getQueuedLinesSnapshot)
}

export function enqueueQueuedLine(line: string, mode: string): QueuedLine {
  const queued = { id: nextId++, line, mode }
  queuedLines.push(queued)
  emit()
  return queued
}

export function dequeueQueuedLine(): QueuedLine | undefined {
  const queued = queuedLines.shift()
  if (queued) emit()
  return queued
}

export function dropLastQueuedLine(): QueuedLine | undefined {
  const queued = queuedLines.pop()
  if (queued) emit()
  return queued
}

export function clearQueuedLines(): number {
  const count = queuedLines.length
  if (count === 0) return 0
  queuedLines.length = 0
  emit()
  return count
}

export function getQueuedLineCount(): number {
  return queuedLines.length
}

export function resetQueuedLinesForTest(): void {
  queuedLines.length = 0
  snapshot = Object.freeze([])
  nextId = 1
  listeners.clear()
}

export function queuedTranscriptContent(queued: Pick<QueuedLine, "line" | "mode">): string {
  if (queued.mode === "d3" && !queued.line.startsWith("/") && !queued.line.startsWith("!")) return `:${queued.line}`
  return queued.line
}
