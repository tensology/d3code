import { access } from "node:fs/promises"
import { constants } from "node:fs"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)

export interface D3Detection {
  available: boolean
  strategy: "configured" | "path-probe" | "well-known-path" | "none"
  command?: string
  details: string
}

const commandProbes = ["d3", "ap", "d3tcl", "dm"]
const wellKnownPaths = ["/usr/bin/d3", "/usr/local/bin/d3", "/usr/bin/ap", "/usr/local/bin/ap"]

export async function detectLocalD3(configuredCommand?: string): Promise<D3Detection> {
  if (configuredCommand) {
    return { available: true, strategy: "configured", command: configuredCommand, details: "Using configured D3 entry command." }
  }

  for (const command of commandProbes) {
    try {
      const { stdout } = await execFileAsync("sh", ["-lc", `command -v ${command}`])
      const resolved = stdout.trim()
      if (resolved) {
        return { available: true, strategy: "path-probe", command, details: `Found ${command} at ${resolved}.` }
      }
    } catch {
      // Try the next probe.
    }
  }

  for (const path of wellKnownPaths) {
    try {
      await access(path, constants.X_OK)
      return { available: true, strategy: "well-known-path", command: path, details: `Found executable at ${path}.` }
    } catch {
      // Try the next path.
    }
  }

  return { available: false, strategy: "none", details: "No local Rocket D3 command was detected." }
}
