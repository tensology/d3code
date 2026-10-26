import { build } from "esbuild"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"

const result = await build({ entryPoints: ["src/ide/program-editor-client.ts"], bundle: true, format: "iife", target: "es2022", minify: true, legalComments: "eof", metafile: true, write: false })
const packages = [...new Set(Object.keys(result.metafile.inputs).map(path => path.match(/^node_modules\/(?:@[^/]+\/)?[^/]+/)?.[0]).filter(Boolean))].sort()
const licenses = await Promise.all(packages.map(async path => {
  const file = (await readdir(path)).find(name => /^licen[sc]e(?:\.(?:txt|md))?$/i.test(name))
  if (!file) throw new Error(`Missing third-party license: ${path}`)
  return `${path.slice(13)}\n${await readFile(`${path}/${file}`, "utf8")}`
}))
await mkdir("dist/ide", { recursive: true })
await writeFile("dist/ide/program-editor.js", `${result.outputFiles[0].text}\n/*! Third-party licenses\n${licenses.join("\n\n").replaceAll("*/", "* /")}\n*/\n`)
console.log(`Built program editor with licenses for ${packages.length} packages.`)
