import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { basename, dirname, join, relative, resolve } from "node:path"

export interface ProjectInstruction {
  path: string
  label: string
  content: string
}

export interface ProjectContext {
  cwd: string
  root: string
  instructions: ProjectInstruction[]
}

const instructionNames = ["AGENTS.md", "D3CODE.md", "CLAUDE.md", join(".d3code", "instructions.md"), join(".decisions", "agents.md")]

export async function loadProjectContext(cwd = process.cwd()): Promise<ProjectContext> {
  const start = resolve(cwd)
  const instructions: ProjectInstruction[] = []
  const directories: string[] = []
  let current = start

  while (true) {
    directories.push(current)
    const anchored = existsSync(join(current, ".git"))
      || existsSync(join(current, "package.json"))
      || existsSync(join(current, "D3CODE.md"))
      || existsSync(join(current, "AGENTS.md"))
      || existsSync(join(current, ".decisions", "agents.md"))
    if (anchored) break
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }

  const instructionRoot = directories.at(-1) ?? start
  for (const directory of [...directories].reverse()) {
    for (const name of instructionNames) {
      const path = join(directory, name)
      if (!existsSync(path)) continue
      const content = (await readFile(path, "utf8")).trim()
      if (content) instructions.push({ path, label: basename(path), content })
    }
  }

  return {
    cwd: start,
    root: instructionRoot,
    instructions,
  }
}

const sensitiveInstructionLine = /(?:password|passwd|api[_ -]?key|secret|bearer\s+|private[_ -]?key)\s*[:=]/i

export function renderProjectInstructions(context: ProjectContext, maxChars = 8000): string {
  if (context.instructions.length === 0) {
    return [
      "Project Folder Instructions:",
      `- cwd: ${relative(context.root, context.cwd) || "."}`,
      "- no AGENTS.md, D3CODE.md, CLAUDE.md, .d3code/instructions.md, or .decisions/agents.md found from this folder upward",
    ].join("\n")
  }

  const rendered = [
    "Project Folder Instructions:",
    `- cwd: ${relative(context.root, context.cwd) || "."}`,
    ...context.instructions.map((instruction) => [
      `- ${instruction.label}: ${relative(context.root, instruction.path)}`,
      instruction.content.split(/\r?\n/).filter((line) => !sensitiveInstructionLine.test(line)).join("\n"),
    ].join("\n")),
  ].join("\n")
  if (rendered.length <= maxChars) return rendered
  const suffix = "\n[project instructions truncated by harness]"
  return `${rendered.slice(0, Math.max(0, maxChars - suffix.length)).trimEnd()}${suffix}`
}
