import { createInterface } from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"
import type { D3CodeConfig } from "../config/config.js"
import { saveConfig } from "../config/config.js"
import { providers } from "../providers/catalog.js"
import type { SecretStore } from "../security/secrets.js"
import type { ConnectionProfile, SafetyMode } from "../domain/types.js"

function normalizeSafety(value: string): SafetyMode {
  if (value === "plan" || value === "trust" || value === "ask") return value
  return "ask"
}

export async function runSetupWizard(config: D3CodeConfig, secrets: SecretStore): Promise<D3CodeConfig> {
  const rl = createInterface({ input, output })
  try {
    console.log("D3 Code first-run setup")
    console.log("Configure the model first, then optionally point D3 Code at a local or SSH Rocket D3 server.")
    console.log("Providers: " + providers.map((provider) => provider.id).join(", "))
    const providerID = (await rl.question(`Provider [openai]: `)).trim() || "openai"
    const provider = providers.find((item) => item.id === providerID) ?? providers[0]
    const model = (await rl.question(`Model [${provider.defaultModel}]: `)).trim() || provider.defaultModel
    const key = await rl.question(`API key for ${provider.name} (blank to use env ${provider.env.join("/")}): `)
    if (key.trim()) {
      const ref = `keychain:model:${provider.id}`
      await secrets.set(ref, key.trim())
      config.modelSecrets[provider.id] = ref
    }
    config.defaultModel = `${provider.id}/${model}`
    config.defaultSafety = normalizeSafety((await rl.question("Default safety ask|plan|trust [ask]: ")).trim() || "ask")

    const localOrSsh = ((await rl.question("D3 server connection local|ssh|skip [local]: ")).trim() || "local").toLowerCase()
    if (localOrSsh !== "skip") {
      const profileName = (await rl.question("Profile name [default]: ")).trim() || "default"
      const account = (await rl.question("Default D3 account name/path: ")).trim() || undefined
      const allowedAccounts = (await rl.question("Allowed D3 accounts for this profile (comma-separated, blank for no allowlist): ")).trim()
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
      const entryCommand = (await rl.question("Command to enter D3/TCL on that server (blank if shell already lands there): ")).trim() || undefined
      const promptPattern = (await rl.question("D3 prompt regex [>]: ")).trim() || ">"
      const sessionModeAnswer = ((await rl.question("Session mode oneshot|persistent [persistent]: ")).trim() || "persistent").toLowerCase()
      const sessionMode = sessionModeAnswer === "oneshot" ? "oneshot" : "persistent"
      let profile: ConnectionProfile
      if (localOrSsh === "ssh") {
        profile = {
          name: profileName,
          type: "ssh",
          host: (await rl.question("SSH host/IP: ")).trim(),
          username: (await rl.question("SSH username: ")).trim(),
          port: Number((await rl.question("SSH port [22]: ")).trim() || "22"),
          account,
          entryCommand,
          promptPattern,
          sessionMode,
          safetyDefault: config.defaultSafety,
          allowedAccounts: allowedAccounts.length ? allowedAccounts : undefined,
        }
      } else {
        profile = { name: profileName, type: "local", account, entryCommand, promptPattern, sessionMode, safetyDefault: config.defaultSafety, allowedAccounts: allowedAccounts.length ? allowedAccounts : undefined }
      }
      config.profiles = [...config.profiles.filter((item) => item.name !== profile.name), profile]
      config.defaultProfile = profile.name
    }
    await saveConfig(config)
    return config
  } finally {
    rl.close()
  }
}
