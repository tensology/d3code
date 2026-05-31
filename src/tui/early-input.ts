export interface EarlyInputBuffer {
  accept(chunk: string | Buffer): void
  peek(): string
  consume(): string
  clear(): void
}

function removeLastCharacter(value: string): string {
  return Array.from(value).slice(0, -1).join("")
}

export function createEarlyInputBuffer(): EarlyInputBuffer {
  let text = ""
  return {
    accept(chunk) {
      const value = typeof chunk === "string" ? chunk : chunk.toString("utf8")
      let index = 0
      while (index < value.length) {
        const code = value.charCodeAt(index)
        if (code === 3 || code === 4) {
          index += 1
          continue
        }
        if (code === 8 || code === 127) {
          text = removeLastCharacter(text)
          index += 1
          continue
        }
        if (code === 27) {
          index += 1
          if (value[index] === "[") index += 1
          while (index < value.length) {
            const escCode = value.charCodeAt(index)
            index += 1
            if (escCode >= 64 && escCode <= 126) break
          }
          continue
        }
        if (code === 13) {
          text += "\n"
          index += 1
          continue
        }
        if (code < 32 && code !== 9 && code !== 10) {
          index += 1
          continue
        }
        text += value[index]
        index += 1
      }
    },
    peek() {
      return text
    },
    consume() {
      const consumed = text.trim()
      text = ""
      return consumed
    },
    clear() {
      text = ""
    },
  }
}

const processBuffer = createEarlyInputBuffer()
let capturing = false
let readableHandler: (() => void) | undefined

export function startCapturingEarlyInput(stdin = process.stdin): void {
  if (capturing || !stdin.isTTY) return
  capturing = true
  processBuffer.clear()
  try {
    stdin.setEncoding("utf8")
    stdin.setRawMode?.(true)
    stdin.ref()
    readableHandler = () => {
      let chunk: string | Buffer | null
      while ((chunk = stdin.read() as string | Buffer | null) !== null) {
        processBuffer.accept(chunk)
      }
    }
    stdin.on("readable", readableHandler)
  } catch {
    capturing = false
    readableHandler = undefined
  }
}

export function stopCapturingEarlyInput(stdin = process.stdin): void {
  if (!capturing) return
  capturing = false
  if (readableHandler) {
    stdin.removeListener("readable", readableHandler)
    readableHandler = undefined
  }
}

export function consumeEarlyInput(stdin = process.stdin): string {
  stopCapturingEarlyInput(stdin)
  return processBuffer.consume()
}

export function hasEarlyInput(): boolean {
  return processBuffer.peek().trim().length > 0
}
