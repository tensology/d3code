import assert from "node:assert/strict"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

test("config preserves JSONC defaults, profile restrictions and secret references after validation", async () => {
  const home = await mkdtemp(join(tmpdir(), "d3-config-validation-")), previous = process.env.D3CODE_HOME
  process.env.D3CODE_HOME = home
  try {
    const { loadConfig, saveConfig, defaultConfig } = await import("../src/config/config.js")
    assert.deepEqual(await loadConfig(), defaultConfig)
    const path = join(home, "config.jsonc")
    await writeFile(path, `{
      // Existing user configuration remains JSONC.
      "version": 1,
      "profiles": [{"name":"Office test","type":"ssh","account":"dm","allowedAccounts":["dm"]}],
      "modelSecrets": {"openrouter":"test-reference"},
      "hermes": {}, "sidecar": {}
    }`)
    const config = await loadConfig()
    assert.equal(config.defaultSafety, "ask")
    assert.equal(config.defaultModel, defaultConfig.defaultModel)
    assert.deepEqual(config.profiles[0]?.allowedAccounts, ["dm"])
    assert.deepEqual(config.modelSecrets, { openrouter: "test-reference" })
    assert.deepEqual(config.hermes, { enabled: true, memoryEnabled: true })
    assert.deepEqual(config.sidecar, { enabled: true, autoStart: true })
    await saveConfig(config)
    assert.deepEqual(await loadConfig(), config)
    const persisted = await readFile(path, "utf8")
    await writeFile(path, JSON.stringify({ ...config, modelSecrets: { openrouter: 123 } }))
    await assert.rejects(loadConfig(), /modelSecrets|openrouter/)
    await writeFile(path, persisted)
    await assert.rejects(saveConfig({ ...config, profiles: [{ ...config.profiles[0]!, port: 1.5 }] }), /port/)
    assert.equal(await readFile(path, "utf8"), persisted, "invalid saves cannot overwrite the current config")
  } finally {
    if (previous === undefined) delete process.env.D3CODE_HOME
    else process.env.D3CODE_HOME = previous
    await rm(home, { recursive: true, force: true })
  }
})
