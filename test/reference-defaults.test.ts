import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const externalReferencePath = "/Users/paul/development/WORK/CRYSTALLOGIC/reference"

test("runtime defaults do not point outside the repo reference folder", async () => {
  const files = [
    "package.json",
    "README.md",
    "src/cli.ts",
    "src/tui/commands.ts",
    "src/quality/product-audit.ts",
    "src/quality/readiness.ts",
    "src/app/write.ts",
    "src/app/context-pack.ts",
    "src/app/completion-audit.ts",
    "src/app/evidence.ts",
    "src/d3/terminal-plan.ts",
  ]

  for (const file of files) {
    const source = await readFile(file, "utf8")
    assert.equal(source.includes(externalReferencePath), false, `${file} should use repo-local reference defaults`)
  }
})
