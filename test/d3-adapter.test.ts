import assert from "node:assert/strict"
import test from "node:test"
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createD3Session, PersistentLocalD3Session, PersistentSshD3Session, SshD3Session } from "../src/d3/adapter.js"

test("persistent SSH waits for a delayed VM banner before sending the login wakeup", async () => {
  const dir = await mkdtemp(join(tmpdir(), "d3code-delayed-ssh-"))
  const oldPath = process.env.PATH
  const fakeSsh = join(dir, "ssh")
  await writeFile(fakeSsh, `#!${process.execPath}\nlet stage=0;setTimeout(()=>process.stdout.write("Connected to Virtual Machine\\n"),2500);process.stdin.on('data',chunk=>{const line=chunk.toString().trim();if(stage===0){stage=1;process.stdout.write('Enter your user id:');}else if(stage===1&&line==='dm'){stage=2;process.stdout.write('master dictionary:');}else if(stage===2&&line==='dm'){stage=3;process.stdout.write('\\n:');}else if(stage===3&&line==='WHO'){process.stdout.write('\\n1 dm dm\\n:');}else if(line==='OFF')process.exit(0);});\n`)
  await chmod(fakeSsh, 0o700)
  process.env.PATH = `${dir}:${oldPath}`
  const session = new PersistentSshD3Session({ name: "delayed", type: "ssh", host: "fake", username: "dm", startupInput: "dm\ndm\n", promptPattern: "(^|\\n):\\s*$", sessionMode: "persistent" })
  try {
    assert.match((await session.run("WHO", 20_000)).stdout, /1 dm dm/)
  } finally {
    await session.close()
    process.env.PATH = oldPath
    await rm(dir, { recursive: true, force: true })
  }
})

test("persistent local D3 session preserves shell state across commands", async () => {
  const session = new PersistentLocalD3Session({ name: "persistent", type: "local", sessionMode: "persistent" })
  try {
    await session.run("D3CODE_STATE=kept")
    const result = await session.run("printf %s \"$D3CODE_STATE\"")
    assert.equal(result.stdout, "kept")
    assert.equal(result.exitCode, 0)
  } finally {
    await session.close()
  }
})

test("persistent local D3 session streams stdout while command is running", async () => {
  const session = new PersistentLocalD3Session({ name: "persistent", type: "local", sessionMode: "persistent" })
  try {
    let streamed = ""
    const result = await session.run("printf first; sleep 0.05; printf second", 1_000, {
      onStdout: (chunk) => {
        streamed += chunk
      },
    })
    assert.equal(result.stdout, "firstsecond")
    assert.equal(streamed, "firstsecond")
  } finally {
    await session.close()
  }
})

test("factory selects persistent local session when profile requests it", () => {
  const session = createD3Session({ name: "persistent", type: "local", sessionMode: "persistent" })
  assert.ok(session instanceof PersistentLocalD3Session)
})

test("factory keeps d3 entry commands persistent when profile requests terminal state", () => {
  const session = createD3Session({ name: "persistent-d3", type: "local", entryCommand: "d3", sessionMode: "persistent" })
  assert.ok(session instanceof PersistentLocalD3Session)
})

test("factory uses one persistent SSH process for PuTTY-style terminal state", () => {
  const session = createD3Session({
    name: "office",
    type: "ssh",
    host: "office.example.com",
    username: "root",
    entryCommand: "d3",
    sessionMode: "persistent",
  })
  assert.ok(session instanceof PersistentSshD3Session)
})

test("factory keeps explicitly one-shot SSH profiles isolated per command", () => {
  const session = createD3Session({
    name: "office",
    type: "ssh",
    host: "office.example.com",
    username: "root",
    entryCommand: "d3",
    sessionMode: "oneshot",
  })
  assert.ok(session instanceof SshD3Session)
})

test("persistent local D3 session fails when entry exits before prompt", async () => {
  const session = new PersistentLocalD3Session({
    name: "bad-entry",
    type: "local",
    sessionMode: "persistent",
    entryCommand: "node -e \"process.exit(7)\"",
    promptPattern: "D3>",
  })
  await assert.rejects(() => session.run("WHO", 500), /Persistent D3 session exited before the prompt was seen/)
})

test("persistent local D3 session ignores startup prompt before first command", async () => {
  const session = new PersistentLocalD3Session({
    name: "prompted",
    type: "local",
    sessionMode: "persistent",
    entryCommand: "node -e \"process.stdout.write('D3>');process.stdin.on('data',d=>process.stdout.write('RESULT\\\\nD3>'))\"",
    promptPattern: "D3>",
  })
  try {
    const result = await session.run("WHO")
    assert.match(result.stdout, /RESULT/)
  } finally {
    await session.close()
  }
})

test("persistent local D3 session streams prompted output without startup prompt", async () => {
  const session = new PersistentLocalD3Session({
    name: "prompted",
    type: "local",
    sessionMode: "persistent",
    entryCommand: "node -e \"process.stdout.write('D3>');process.stdin.on('data',d=>setTimeout(()=>process.stdout.write('RESULT\\\\nD3>'),20))\"",
    promptPattern: "D3>",
  })
  try {
    let streamed = ""
    const result = await session.run("WHO", 1_000, {
      onStdout: (chunk) => {
        streamed += chunk
      },
    })
    assert.match(result.stdout, /RESULT/)
    assert.match(streamed, /RESULT/)
    assert.doesNotMatch(streamed, /^D3>/)
  } finally {
    await session.close()
  }
})

test("persistent local D3 session detects D3 prompts with terminal control bytes", async () => {
  const session = new PersistentLocalD3Session({
    name: "nul-prompt",
    type: "local",
    sessionMode: "persistent",
    entryCommand: "node -e \"process.stdout.write('banner\\\\r\\\\n\\\\0:');process.stdin.on('data',d=>process.stdout.write('OK\\\\r\\\\n\\\\0:'))\"",
    promptPattern: ":",
  })
  try {
    const result = await session.run("WHO", 1_000)
    assert.match(result.stdout, /OK/)
  } finally {
    await session.close()
  }
})

test("persistent local D3 session can send D3 login startup input before waiting for TCL prompt", async () => {
  const loginScript = `
    let b = "";
    let authed = false;
    process.stdout.write("user id:");
    process.stdin.on("data", d => {
      b += d;
      if (!authed && /dm[\\r\\n]+dm[\\r\\n]+/.test(b)) {
        authed = true;
        b = b.replace(/^.*?dm[\\r\\n]+dm[\\r\\n]+/, "");
        process.stdout.write("\\n:");
      }
      if (authed && /WHO[\\r\\n]+/.test(b)) {
        b = b.replace(/^.*?WHO[\\r\\n]+/, "");
        process.stdout.write("1 dm dm\\n:");
      }
    });
  `
  const compactLoginScript = loginScript.replace(/\s+/g, " ").trim()
  const session = new PersistentLocalD3Session({
    name: "d3-login",
    type: "local",
    sessionMode: "persistent",
    entryCommand: `node -e '${compactLoginScript}'`,
    startupInput: "dm\ndm\n",
    promptPattern: ":",
  })
  try {
    const result = await session.run("WHO", 1_000)
    assert.match(result.stdout, /1 dm dm/)
  } finally {
    await session.close()
  }
})

test("normalizeStartupInput converts carriage returns into login lines", async () => {
  const { normalizeStartupInput } = await import("../src/d3/adapter.js")
  assert.equal(normalizeStartupInput("dm\rdm\r"), "dm\ndm")
  assert.equal(normalizeStartupInput("dm\ndm\n"), "dm\ndm")
})
