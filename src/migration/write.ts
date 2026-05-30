import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join, normalize } from "node:path"
import type { AdapterFile } from "./adapter.js"

export interface WriteAdapterResult {
  written: string[]
}

export async function writeAdapterFiles(outDir: string, files: AdapterFile[]): Promise<WriteAdapterResult> {
  const written: string[] = []
  for (const file of files) {
    const target = normalize(join(outDir, file.path))
    const root = normalize(outDir)
    if (!target.startsWith(root)) throw new Error(`Refusing to write outside output directory: ${file.path}`)
    await mkdir(dirname(target), { recursive: true })
    await writeFile(target, file.content)
    written.push(target)
  }
  return { written }
}
