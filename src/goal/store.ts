import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { goalsDir } from "../config/paths.js"
import type { D3Goal } from "./goal.js"

export async function saveGoal(goal: D3Goal): Promise<void> {
  await mkdir(goalsDir, { recursive: true })
  await writeFile(goalPath(goal.id), `${JSON.stringify(goal, null, 2)}\n`)
}

export async function loadGoal(id: string): Promise<D3Goal> {
  return JSON.parse(await readFile(goalPath(id), "utf8")) as D3Goal
}

export async function listGoals(): Promise<D3Goal[]> {
  try {
    const files = (await readdir(goalsDir)).filter((file) => file.endsWith(".json")).sort()
    return Promise.all(files.map(async (file) => JSON.parse(await readFile(join(goalsDir, file), "utf8")) as D3Goal))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return []
    throw error
  }
}

function goalPath(id: string): string {
  return join(goalsDir, `${id}.json`)
}
