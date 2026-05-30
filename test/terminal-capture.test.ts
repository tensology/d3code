import assert from "node:assert/strict"
import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { PersistentLocalD3Session } from "../src/d3/adapter.js"
import { captureD3Terminal, renderD3TerminalCapture, writeD3TerminalCapture } from "../src/d3/terminal-capture.js"

test("captures terminal output and writes screen-buffer artifacts", async () => {
  const session = new PersistentLocalD3Session({ name: "local", type: "local", account: "SALES", sessionMode: "persistent" })
  try {
    const capture = await captureD3Terminal(session, "printf '@(-1)MENU@(5,2)Choice:'", { width: 24, height: 6 })
    assert.equal(capture.profile, "local")
    assert.equal(capture.account, "SALES")
    assert.equal(capture.risk, "read")
    assert.ok(capture.screen.lines.some((line) => line.includes("Choice:")))
    assert.match(renderD3TerminalCapture(capture), /D3 Terminal Capture/)

    const out = await mkdtemp(join(tmpdir(), "d3code-terminal-capture-"))
    const written = await writeD3TerminalCapture(out, capture)
    assert.ok(written.written.some((file) => file.endsWith("terminal-transcript.txt")))
    assert.ok(written.written.some((file) => file.endsWith("screen-buffer.json")))
    assert.match(await readFile(join(out, "terminal-capture.md"), "utf8"), /Screen events:/)
  } finally {
    await session.close()
  }
})
