// Reset the D3CODE.* sandbox, post orders once, and assert the exact results.
//   node sandbox/d3-order-app/verify.mjs --profile office
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { loadConfig, selectProfile } from "../../dist/src/config/config.js"
import { createD3Session } from "../../dist/src/d3/adapter.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const profileName = args.includes("--profile") ? args[args.indexOf("--profile") + 1] : "office"
const regressionProfile = { ...selectProfile(await loadConfig(), profileName), promptPattern: "(^|\\n)[:>]\\s*$" }
let session = createD3Session(regressionProfile)
const clean = (v) => v.replace(/\0/g, "").replace(/\r/g, "").trim()

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
    return `ERROR ${error.message}`
  }
}
const transcript = []
async function capture(title, command) {
  const output = await run(command)
  transcript.push(`\n$ ${command}\n${output}`)
  return output
}

// --- reset so the run is repeatable (clear-file keeps dictionaries and indexes) ---
for (const file of ["D3CODE.ORDERS", "D3CODE.LINES", "D3CODE.MOVES", "D3CODE.PAYMENTS", "D3CODE.CUSTOMERS", "D3CODE.PRODUCTS"]) {
  await run(`clear-file ${file} (l`)
}
await capture("re-seed baseline", "D3CODE.SEED")

const runOutput = await capture("post orders + validation", "D3CODE.RUN")
const report = await capture("low-stock report", "D3CODE.REPORT")
const ctSku1 = await capture("SKU-1 record", "CT D3CODE.PRODUCTS SKU-1 (N")
const ctSku3 = await capture("SKU-3 record", "CT D3CODE.PRODUCTS SKU-3 (N")
const ctSku4 = await capture("SKU-4 record", "CT D3CODE.PRODUCTS SKU-4 (N")
const lines = await capture("order lines", "COUNT D3CODE.LINES")
const moves = await capture("stock moves", "COUNT D3CODE.MOVES")
const orders = await capture("AQL order totals", "LIST D3CODE.ORDERS CUSTOMER SUBTOTAL VAT AMOUNT (N")
const idxCustomer = await capture("indexed orders by customer", 'LIST D3CODE.ORDERS WITH CUSTOMER = "C002" (N')
const idxProduct = await capture("indexed product description", 'LIST D3CODE.PRODUCTS WITH DESC = "Tape measure 5m" (N')
const ctOrder = await capture("order B2001 record", "CT D3CODE.ORDERS B2001 (N")

console.log("\n===== D3CODE.RUN =====")
console.log(runOutput)
console.log("\n===== order B2001 =====")
console.log(ctOrder)
console.log("\n===== stock after posting (attr 3 = QOH) =====")
const qoh = (text) => {
  const m = text.match(/^\s*0*3\s+(\d+)/m)
  return m ? m[1] : "?"
}
console.log("SKU-1:", qoh(ctSku1))
console.log("SKU-3:", qoh(ctSku3))
console.log("SKU-4:", qoh(ctSku4))
console.log("\n===== counts =====")
console.log(lines.split("\n").filter((l) => /items counted/.test(l)).join("\n"))
console.log(moves.split("\n").filter((l) => /items counted/.test(l)).join("\n"))
console.log("\n===== AQL order totals =====")
console.log(orders)

const qohNumber = (text) => {
  const m = text.match(/^\s*0*3\s+(\d+)/m)
  return m ? Number(m[1]) : NaN
}
const checks = [
  ["all three orders posted", /B2001\*/.test(runOutput) && /B2002\*/.test(runOutput) && /B2003\*/.test(runOutput)],
  ["over-stock rejected (NO.STOCK)", /NO\.STOCK/.test(runOutput)],
  ["unknown product rejected", /UNKNOWN\.PRODUCT/.test(runOutput)],
  ["unknown customer rejected", /UNKNOWN\.CUSTOMER/.test(runOutput)],
  ["credit limit enforced", /CREDIT\.LIMIT/.test(runOutput)],
  ["stock SKU-1 40->37", qohNumber(ctSku1) === 37],
  ["stock SKU-3 8->6", qohNumber(ctSku3) === 6],
  ["stock SKU-4 unchanged by rejected credit sale (25)", qohNumber(ctSku4) === 25],
  ["5 order lines recorded", /5 items counted/.test(lines)],
  ["5 stock moves recorded", /5 items counted/.test(moves)],
  ["order B2001 subtotal 694.85", /694\.85/.test(ctOrder)],
  ["order B2001 VAT 104.2275", /104\.2275|104\.23/.test(ctOrder)],
  ["AQL order totals query works", /Page\s+1\s+D3CODE\.ORDERS/.test(orders) && /B2001/.test(orders)],
  ["indexed customer query works", /Page\s+1\s+D3CODE\.ORDERS/.test(idxCustomer) && /B2002/.test(idxCustomer)],
  ["indexed product query works", /Tape measure/.test(idxProduct)],
  ["low-stock report found SKU-3", /SKU-3/.test(report)],
]

console.log("\n===== CHECKS =====")
let failed = 0
for (const [name, ok] of checks) {
  if (!ok) failed += 1
  console.log(`[${ok ? "ok" : "FAIL"}] ${name}`)
}

await mkdir(join(HERE, "evidence"), { recursive: true })
await writeFile(
  join(HERE, "evidence", "live-run.txt"),
  `D3CODE sandbox live evidence (${new Date().toISOString()})\n${transcript.join("\n")}\n\nCHECKS\n${checks.map(([n, ok]) => `[${ok ? "ok" : "FAIL"}] ${n}`).join("\n")}\n`,
)
console.log(`\n${checks.length - failed}/${checks.length} checks passed; evidence at sandbox/d3-order-app/evidence/live-run.txt`)
await session.close()
if (failed) process.exitCode = 1
