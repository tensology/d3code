import assert from "node:assert/strict"
import test from "node:test"
import { createD3Session, PersistentLocalD3Session } from "../src/d3/adapter.js"

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

test("persistent local D3 session can send D3 login startup input before waiting for TCL prompt", async () => {
  const session = new PersistentLocalD3Session({
    name: "d3-login",
    type: "local",
    sessionMode: "persistent",
    entryCommand: "node -e \"let b='';let authed=false;process.stdout.write('user id:');process.stdin.on('data',d=>{b+=d;if(!authed&&b==='dm\\\\ndm\\\\n'){authed=true;process.stdout.write('\\\\n:');return}if(authed&&b.endsWith('WHO\\\\n')){process.stdout.write('1 dm dm\\\\n:')}})\"",
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
