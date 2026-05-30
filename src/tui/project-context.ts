import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { basename, dirname, join, resolve } from "node:path"

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

const instructionNames = ["D3CODE.md", "CLAUDE.md", join(".d3code", "instructions.md")]

export async function loadProjectContext(cwd = process.cwd()): Promise<ProjectContext> {
  const start = resolve(cwd)
  const instructions: ProjectInstruction[] = []
  let current = start

  while (true) {
    for (const name of instructionNames) {
      const path = join(current, name)
      if (!existsSync(path)) continue
      const content = (await readFile(path, "utf8")).trim()
      if (content) instructions.push({ path, label: basename(path), content })
    }
    const parent = dirname(current)
    if (parent === current) break
    current = parent
  }

  return {
    cwd: start,
    root: instructions.at(-1)?.path ? dirname(instructions.at(-1)!.path) : start,
    instructions,
  }
}

export function renderProjectInstructions(context: ProjectContext): string {
  if (context.instructions.length === 0) {
    return [
      "Project Folder Instructions:",
      `- cwd: ${context.cwd}`,
      "- no D3CODE.md, CLAUDE.md, or .d3code/instructions.md found from this folder upward",
    ].join("\n")
  }

  return [
    "Project Folder Instructions:",
    `- cwd: ${context.cwd}`,
    ...context.instructions.map((instruction) => [
      `- ${instruction.label}: ${instruction.path}`,
      instruction.content,
    ].join("\n")),
  ].join("\n")
}
