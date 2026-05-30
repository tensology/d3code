export interface ScreenCell {
  char: string
}

export interface ScreenEvent {
  type: "text" | "cursor" | "clear-screen" | "clear-line" | "clear-to-end" | "newline" | "control"
  value: string
  row: number
  col: number
}

export interface D3ScreenBuffer {
  width: number
  height: number
  row: number
  col: number
  events: ScreenEvent[]
  lines: string[]
}

function blankLine(width: number): string[] {
  return Array.from({ length: width }, () => " ")
}

function event(type: ScreenEvent["type"], value: string, row: number, col: number): ScreenEvent {
  return { type, value, row, col }
}

export function parseD3ScreenTranscript(transcript: string, options: { width?: number; height?: number } = {}): D3ScreenBuffer {
  const width = options.width ?? 80
  const height = options.height ?? 24
  const grid = Array.from({ length: height }, () => blankLine(width))
  const events: ScreenEvent[] = []
  let row = 0
  let col = 0
  let index = 0

  function clampCursor(): void {
    row = Math.max(0, Math.min(height - 1, row))
    col = Math.max(0, Math.min(width - 1, col))
  }

  function clearScreen(): void {
    for (let y = 0; y < height; y++) grid[y] = blankLine(width)
    row = 0
    col = 0
    events.push(event("clear-screen", "clear", row, col))
  }

  function clearToEndOfLine(): void {
    for (let x = col; x < width; x++) grid[row]![x] = " "
    events.push(event("clear-line", "clear-line", row, col))
  }

  function putChar(char: string): void {
    grid[row]![col] = char
    events.push(event("text", char, row, col))
    col += 1
    if (col >= width) {
      col = 0
      row = Math.min(height - 1, row + 1)
    }
  }

  function newline(): void {
    row = Math.min(height - 1, row + 1)
    col = 0
    events.push(event("newline", "\\n", row, col))
  }

  function cursorTo(nextCol: number, nextRow: number, value: string): void {
    col = nextCol
    row = nextRow
    clampCursor()
    events.push(event("cursor", value, row, col))
  }

  while (index < transcript.length) {
    const rest = transcript.slice(index)
    const d3Clear = rest.match(/^@\(-1\)/)
    if (d3Clear) {
      clearScreen()
      index += d3Clear[0].length
      continue
    }
    const d3Home = rest.match(/^@\(-2\)/)
    if (d3Home) {
      cursorTo(0, 0, d3Home[0])
      index += d3Home[0].length
      continue
    }
    const d3ClearEnd = rest.match(/^@\(-3\)/)
    if (d3ClearEnd) {
      for (let y = row; y < height; y++) {
        const start = y === row ? col : 0
        for (let x = start; x < width; x++) grid[y]![x] = " "
      }
      events.push(event("clear-to-end", d3ClearEnd[0], row, col))
      index += d3ClearEnd[0].length
      continue
    }
    const d3ClearLine = rest.match(/^@\(-4\)/)
    if (d3ClearLine) {
      clearToEndOfLine()
      index += d3ClearLine[0].length
      continue
    }
    const d3Cursor = rest.match(/^@\((\d+),(\d+)\)/)
    if (d3Cursor) {
      cursorTo(Number(d3Cursor[1]), Number(d3Cursor[2]), d3Cursor[0])
      index += d3Cursor[0].length
      continue
    }
    const ansiCursor = rest.match(/^\x1b\[(\d+);(\d+)H/)
    if (ansiCursor) {
      cursorTo(Number(ansiCursor[2]) - 1, Number(ansiCursor[1]) - 1, ansiCursor[0])
      index += ansiCursor[0].length
      continue
    }
    const ansiClear = rest.match(/^\x1b\[2J/)
    if (ansiClear) {
      clearScreen()
      index += ansiClear[0].length
      continue
    }
    const ansiClearLine = rest.match(/^\x1b\[K/)
    if (ansiClearLine) {
      clearToEndOfLine()
      index += ansiClearLine[0].length
      continue
    }
    const char = transcript[index]!
    if (char === "\r") {
      col = 0
      events.push(event("control", "\\r", row, col))
    } else if (char === "\n") {
      newline()
    } else if (char === "\b") {
      col = Math.max(0, col - 1)
      events.push(event("control", "\\b", row, col))
    } else if (char >= " ") {
      putChar(char)
    } else {
      events.push(event("control", char.charCodeAt(0).toString(16), row, col))
    }
    index += 1
  }

  return {
    width,
    height,
    row,
    col,
    events,
    lines: grid.map((line) => line.join("").trimEnd()),
  }
}

export function renderD3ScreenBuffer(buffer: D3ScreenBuffer): string {
  const content = buffer.lines.map((line) => `|${line.padEnd(buffer.width, " ")}|`).join("\n")
  return [
    "# D3 Screen Buffer",
    "",
    `Size: ${buffer.width}x${buffer.height}`,
    `Cursor: row=${buffer.row} col=${buffer.col}`,
    `Events: ${buffer.events.length}`,
    "",
    content,
  ].join("\n")
}
