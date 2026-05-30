import { constants } from "node:fs"
import { access, readFile, stat } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import { fileURLToPath } from "node:url"

const execFileAsync = promisify(execFile)
const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..")

export interface InstallProofCheck {
  id: string
  status: "ok" | "missing" | "failed"
  evidence: string[]
}

export interface InstallProofReport {
  ready: boolean
  packageRoot: string
  command: string
  checks: InstallProofCheck[]
}

function check(id: string, status: InstallProofCheck["status"], evidence: string[]): InstallProofCheck {
  return { id, status, evidence }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function createInstallProofReport(): Promise<InstallProofReport> {
  const checks: InstallProofCheck[] = []
  const packagePath = join(packageRoot, "package.json")
  const sourceCliPath = join(packageRoot, "src", "cli.ts")
  const cliPath = join(packageRoot, "dist", "src", "cli.js")
  let binTarget = ""

  try {
    const parsed = JSON.parse(await readFile(packagePath, "utf8")) as { name?: string; bin?: Record<string, string>; dependencies?: Record<string, string>; scripts?: Record<string, string> }
    binTarget = parsed.bin?.d3code ?? ""
    checks.push(check("package-bin", binTarget === "./dist/src/cli.js" ? "ok" : "failed", [`name:${parsed.name ?? "unknown"}`, `bin:${binTarget || "missing"}`]))
    checks.push(check("ink-runtime", parsed.dependencies?.ink && parsed.dependencies?.react ? "ok" : "missing", [`ink:${parsed.dependencies?.ink ?? "missing"}`, `react:${parsed.dependencies?.react ?? "missing"}`]))
    checks.push(check("terminal-start-script", parsed.scripts?.start === "node dist/src/cli.js" ? "ok" : "failed", [`start:${parsed.scripts?.start ?? "missing"}`]))
  } catch (error) {
    checks.push(check("package-bin", "missing", [error instanceof Error ? error.message : String(error)]))
  }

  try {
    const source = await readFile(sourceCliPath, "utf8")
    const hasDefaultArgument = source.includes(".argument(\"[path]\"")
    const runsSetup = source.includes("if (!existsSync(configPath)) config = await runSetupWizard")
    const rendersInkApp = source.includes("render(React.createElement(App")
    const hasResume = source.includes(".option(\"--resume <session>\"")
    checks.push(check("interactive-default-launch", hasDefaultArgument && runsSetup && rendersInkApp && hasResume ? "ok" : "failed", [
      `path-argument:${hasDefaultArgument ? "yes" : "no"}`,
      `first-run-setup:${runsSetup ? "yes" : "no"}`,
      `ink-app-render:${rendersInkApp ? "yes" : "no"}`,
      `resume-option:${hasResume ? "yes" : "no"}`,
    ]))
  } catch (error) {
    checks.push(check("interactive-default-launch", "missing", [error instanceof Error ? error.message : String(error)]))
  }

  if (!(await exists(cliPath))) {
    checks.push(check("dist-cli", "missing", [`missing:${cliPath}`]))
  } else {
    const firstLine = (await readFile(cliPath, "utf8")).split(/\r?\n/, 1)[0] ?? ""
    checks.push(check("dist-cli", firstLine === "#!/usr/bin/env node" ? "ok" : "failed", [`path:${cliPath}`, `shebang:${firstLine || "missing"}`]))
    try {
      await access(cliPath, constants.X_OK)
      const mode = (await stat(cliPath)).mode.toString(8)
      checks.push(check("dist-cli-executable", "ok", [`mode:${mode}`]))
    } catch (error) {
      checks.push(check("dist-cli-executable", "failed", [error instanceof Error ? error.message : String(error)]))
    }
  }

  if (await exists(cliPath)) {
    try {
      const result = await execFileAsync(cliPath, ["--help"], { cwd: packageRoot, env: { ...process.env, D3CODE_HOME: join(packageRoot, ".tmp-install-proof-home") } })
      const help = result.stdout
      checks.push(check("d3code-help", help.includes("Agentic terminal coding environment") && help.includes("Commands:") ? "ok" : "failed", [`stdout:${help.split(/\r?\n/).slice(0, 3).join(" | ")}`]))
    } catch (error) {
      checks.push(check("d3code-help", "failed", [error instanceof Error ? error.message : String(error)]))
    }
  }

  return {
    ready: checks.every((item) => item.status === "ok"),
    packageRoot,
    command: "d3code",
    checks,
  }
}

export function renderInstallProofReport(report: InstallProofReport): string {
  return [
    "# D3 Code Install Proof",
    "",
    `Ready: ${report.ready ? "yes" : "no"}`,
    `Package root: ${report.packageRoot}`,
    `Command: ${report.command}`,
    "",
    ...report.checks.map((item) => `- [${item.status}] ${item.id}: ${item.evidence.join("; ")}`),
  ].join("\n")
}
