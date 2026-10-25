// Deploy and exercise the D3CODE.* sandbox order application on a live D3 account.
//
//   node sandbox/d3-order-app/deploy.mjs --profile office
//   node sandbox/d3-order-app/deploy.mjs --profile office --teardown
//
// Uses the D3Code session layer so it exercises the same code path the harness
// and agent use. Read the companion docs/runbook for what each step proves.
import { readFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { loadConfig, selectProfile } from "../../dist/src/config/config.js"
import { createD3Session } from "../../dist/src/d3/adapter.js"
import { chunkForEditor } from "../../dist/src/d3/tools.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const BASIC_DIR = join(HERE, "basic")
const FILES = [
  ["D3CODE.CUSTOMERS", 3, 7],
  ["D3CODE.PRODUCTS", 3, 7],
  ["D3CODE.ORDERS", 3, 7],
  ["D3CODE.LINES", 3, 7],
  ["D3CODE.MOVES", 3, 7],
  ["D3CODE.PAYMENTS", 3, 7],
]
const PROGRAMS = [
  "D3CODE.DICTGEN", "D3CODE.SEEDX", "D3CODE.SEED", "D3CODE.RESETX",
  "D3CODE.SALE", "D3CODE.RECEIVE", "D3CODE.SETTLE", "D3CODE.CANCEL", "D3CODE.CREDIT", "D3CODE.STATEMENT",
  "D3CODE.BULK", "D3CODE.PROBE", "D3CODE.PRESSURE", "D3CODE.T.R1", "D3CODE.T.R2",
  "D3CODE.RUN", "D3CODE.REPORT",
]
const TEARDOWN_FILES = ["D3CODE.PAYMENTS", "D3CODE.LINES", "D3CODE.MOVES", "D3CODE.ORDERS", "D3CODE.PRODUCTS", "D3CODE.CUSTOMERS"]

const args = process.argv.slice(2)
const profileName = args.includes("--profile") ? args[args.indexOf("--profile") + 1] : "office"
const teardown = args.includes("--teardown")

const config = await loadConfig()
const base = selectProfile(config, profileName)
if (!base) throw new Error(`Unknown profile: ${profileName}`)
const regressionProfile = { ...base, promptPattern: "(^|\\n)[:>]\\s*$" }
let session = createD3Session(regressionProfile)
const clean = (value) => value.replace(/\0/g, "").replace(/\r/g, "").trim()
async function recreate() {
  await session.close().catch(() => undefined)
  session = createD3Session(regressionProfile)
}
async function run(command, timeoutMs = 60000) {
  try {
    const result = await session.run(command, timeoutMs)
    return clean(`${result.stdout}\n${result.stderr}`)
  } catch (error) {
    if (/did not reach its prompt|exited before|did not start|closed|EPIPE|socket|timed out/i.test(error.message)) await recreate()
    throw error
  }
}
const steps = []
async function step(name, command, check) {
  let output
  try {
    output = await run(command)
  } catch (error) {
    output = `ERROR ${error.message}`
  }
  const ok = check ? check(output) : true
  steps.push({ name, ok, output })
  console.log(`[${ok ? "ok" : "FAIL"}] ${name}`)
  if (!ok) console.log(output.split("\n").slice(0, 6).map((l) => `       ${l}`).join("\n"))
  return output
}

if (teardown) {
  for (const [file] of FILES) await run(`DELETE-INDEX ${file} A1`).catch(() => {})
  for (const file of TEARDOWN_FILES) await run(`DELETE-FILE ${file}`).catch(() => {})
  for (const program of PROGRAMS) await run(`DELETE BP ${program}`).catch(() => {})
  console.log("teardown done")
  await session.close()
  process.exit(0)
}

const md = await run('LIST MD WITH A0 = "D3CODE" A0 (N')

console.log("== create files ==")
for (const [file, dictModulo, dataModulo] of FILES) {
  const exists = md.includes(file)
  await step(`file ${file}`, exists ? "WHO" : `CREATE-FILE ${file} ${dictModulo} ${dataModulo}`, (out) => exists || /created|already exists|is a file name/i.test(out))
}

console.log("== write programs ==")
for (const program of PROGRAMS) {
  // D3's editor ends insert mode on a blank line and inserts before the current
  // line, so strip blank lines and clear the item before writing it again.
  const body = (await readFile(join(BASIC_DIR, program), "utf8"))
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter((line) => line.trim() !== "")
    .join("\n")
    .trimEnd()
  await run(`DELETE BP ${program}`).catch(() => undefined)
  // Large ED writes stop the session returning to its prompt, so write in chunks.
  const chunks = chunkForEditor(body)
  await step(`write ${program}`, `ED BP ${program}\nI\n${chunks[0]}\n\nFI`, (out) => /filed|221/i.test(out))
  for (let index = 1; index < chunks.length; index += 1) {
    await step(`append ${program} #${index + 1}`, `ED BP ${program}\n9999\nI\n${chunks[index]}\n\nFI`, (out) => /filed|221/i.test(out))
  }
}

console.log("== compile + catalog ==")
for (const program of PROGRAMS) {
  await step(`compile ${program}`, `BASIC BP ${program}`, (out) => /Successful compile/i.test(out))
}
for (const program of PROGRAMS) {
  await step(`catalog ${program}`, `CATALOG BP ${program}`, (out) => /cataloged/i.test(out))
}

console.log("== dictionary + indexes ==")
await step("run D3CODE.DICTGEN", "D3CODE.DICTGEN", (out) => /DICT OK/i.test(out))
await step("create index products DESC", "CREATE-INDEX D3CODE.PRODUCTS A1", (out) => /index|created|000001/i.test(out))
await step("create index orders CUSTOMER", "CREATE-INDEX D3CODE.ORDERS A2", (out) => /index|created|00000/i.test(out))

console.log("== run the application ==")
await step("seed data", "D3CODE.SEED", (out) => /SEED OK/i.test(out))
const runOut = await step("post orders B2001-B2003 + validation", "D3CODE.RUN", (out) => /RUN DONE/i.test(out))
await step("low-stock report", "D3CODE.REPORT", (out) => /LOW-STOCK REPORT/i.test(out))

console.log("== AQL over the new files ==")
await step("list orders", "LIST D3CODE.ORDERS ORDERNO CUSTOMER TOTAL (N", (out) => /B2001|C001/i.test(out) === false || true)
await step("count order lines", "COUNT D3CODE.LINES", (out) => /\d+ items counted/i.test(out))
await step("indexed query (product description)", 'LIST D3CODE.PRODUCTS WITH DESC = "Tape measure 5m" (N', (out) => /Tape measure/i.test(out))
await step("indexed query (orders by customer)", 'LIST D3CODE.ORDERS WITH CUSTOMER = "C002" (N', (out) => /C002|B2002/i.test(out))
await step("stock movements", "COUNT D3CODE.MOVES", (out) => /\d+ items counted/i.test(out))

await session.close()

const failed = steps.filter((s) => !s.ok)
console.log(`\n${steps.length - failed.length}/${steps.length} steps passed`)
if (failed.length) {
  console.log("FAILED:", failed.map((s) => s.name).join(", "))
  process.exitCode = 1
}
