import { execFile } from "node:child_process"
import { platform } from "node:os"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export interface SecretStore {
  get(ref: string): Promise<string | undefined>
  set(ref: string, value: string): Promise<void>
}

export class EnvSecretStore implements SecretStore {
  async get(ref: string): Promise<string | undefined> {
    if (ref.startsWith("env:")) return process.env[ref.slice(4)]
    return process.env[ref]
  }

  async set(): Promise<void> {
    throw new Error("EnvSecretStore is read-only")
  }
}

export class KeychainSecretStore implements SecretStore {
  constructor(private readonly service = "d3code") {}

  async get(ref: string): Promise<string | undefined> {
    if (ref.startsWith("env:")) return process.env[ref.slice(4)]
    const key = ref.replace(/^keychain:/, "")
    try {
      if (platform() === "darwin") {
        const { stdout } = await execFileAsync("security", ["find-generic-password", "-s", this.service, "-a", key, "-w"])
        return stdout.trimEnd()
      }
    } catch {
      return undefined
    }
    return undefined
  }

  async set(ref: string, value: string): Promise<void> {
    const key = ref.replace(/^keychain:/, "")
    if (platform() !== "darwin") throw new Error("Writable keychain storage is currently implemented for macOS only")
    await execFileAsync("security", ["add-generic-password", "-U", "-s", this.service, "-a", key, "-w", value])
  }
}

export function defaultSecretStore(): SecretStore {
  return new KeychainSecretStore()
}
