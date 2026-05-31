import assert from "node:assert/strict"
import { mkdtemp, readFile, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { FileSecretStore, secretRefForProvider } from "../src/security/secrets.js"

test("file secret store writes and reads provider keys with owner-only permissions", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3code-secrets-"))
  const path = join(home, "secrets.json")
  const store = new FileSecretStore(path)

  await store.set("file:model:kilocode", "test-secret")

  assert.equal(await store.get("file:model:kilocode"), "test-secret")
  assert.equal(await store.get("env:DOES_NOT_EXIST"), undefined)
  assert.equal((await readFile(path, "utf8")).includes("test-secret"), true)
  assert.equal((await stat(path)).mode & 0o777, 0o600)
})

test("Linux setup uses a writable file secret reference instead of macOS keychain", () => {
  assert.equal(secretRefForProvider("kilocode", "linux"), "file:model:kilocode")
  assert.equal(secretRefForProvider("kilocode", "darwin"), "keychain:model:kilocode")
})
