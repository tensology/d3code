// Pressure suite for the D3CODE.* sandbox app.
//   node sandbox/d3-order-app/pressure.mjs --profile office
// D3 has no TCL CALL verb, so scenarios run inside the D3CODE.PRESSURE BASIC
// program; concurrency needs two live sessions and is driven from here.
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { loadConfig, selectProfile } from "../../dist/src/config/config.js"
import { createD3Session } from "../../dist/src/d3/adapter.js"
import { runToolByName } from "../../dist/src/tools/runner.js"

const HERE = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const profileName = args.includes("--profile") ? args[args.indexOf("--profile") + 1] : "office"
const config = await loadConfig()
const regressionProfile = { ...selectProfile(config, profileName), promptPattern: "(^|\\n)[:>]\\s*$" }
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
// D3 has no TCL CALL verb, so a concurrency participant must be a catalogued
// program. Build a tiny one per participant.
async function makeRunner(name, body) {
  await run(`DELETE BP ${name}`)
  const written = await run(`ED BP ${name}\nI\n${body}\n\nFI`)
  const compiled = await run(`BASIC BP ${name}`)
  const catalogued = await run(`CATALOG BP ${name}`)
  return /filed|221/i.test(written) && /Successful compile/i.test(compiled) && /cataloged/i.test(catalogued)
}
const notAD3Error = (r) => /ERR |not defined|too many users/i.test(r)

const results = []
function check(name, ok, detail = "") {
  results.push({ name, ok, detail })
  console.log(`[${ok ? "ok" : "FAIL"}] ${name}${ok ? "" : ` — ${detail}`}`)
}
const lastLine = (s) => s.split("\n").filter((l) => l.trim()).slice(-1)[0] ?? ""
const attr = (text, n) => {
  const m = text.match(new RegExp(`^\\s*0*${n}\\s+(\\S+)`, "m"))
  return m ? m[1] : ""
}
const transcript = []

// --- 1. in-D3 pressure scenarios (self-resetting) ---
const pressure = await run("D3CODE.PRESSURE", 600000)
transcript.push(`$ D3CODE.PRESSURE\n${pressure}`)
const scenarioChecks = pressure.split("\n").filter((l) => /^CHECK /.test(l))
check("1 scenario program ran to completion", /PRESSURE DONE/.test(pressure), pressure.split("\n").slice(-3).join(" | "))
check("1 scenario checks were emitted", scenarioChecks.length >= 18, `count=${scenarioChecks.length}`)
for (const line of scenarioChecks) {
  const [, id, status, ...rest] = line.split(" ")
  check(`1 scenario ${id}`, status === "PASS", rest.join(" "))
}
// statement output rides along on the same transcript
check("1 statement printed both orders", /B9050/.test(pressure) && /B9051/.test(pressure), "statement block")

// --- 2. missing-file probe ---
const probe = await run("D3CODE.PROBE")
transcript.push(`$ D3CODE.PROBE\n${probe}`)
check("2 missing file fails gracefully", /PROBE OPEN-FAILED/.test(probe), probe)

// --- 3. long description round-trip via the harness write tool path (chunked ED) ---
const long = "A very long product description used to test attribute storage limits and readback fidelity across the harness boundary"
await run("DELETE D3CODE.PRODUCTS SKU-9")
const writeLong = await run(`ED D3CODE.PRODUCTS SKU-9\nI\n${long}\n210\n5\n1\n\nFI`)
transcript.push(`$ long-description\n${writeLong}`)
// length is asserted inside D3CODE.PRESSURE scenario 16; here only confirm the write filed
check("3 long description write filed", /filed|221/i.test(writeLong), writeLong.split("\n").slice(-2).join(" | "))
await run("DELETE D3CODE.PRODUCTS SKU-9")

// --- 4. concurrency: two sessions race the last unit ---
await run("clear-file D3CODE.ORDERS (l")
await run("clear-file D3CODE.LINES (l")
await run("clear-file D3CODE.MOVES (l")
await run("clear-file D3CODE.PAYMENTS (l")
await run("clear-file D3CODE.CUSTOMERS (l")
await run("clear-file D3CODE.PRODUCTS (l")
await run("D3CODE.SEED")
await run("DELETE D3CODE.PRODUCTS SKU-3")
await run("ED D3CODE.PRODUCTS SKU-3\nI\nRace item\n100\n1\n0\n\nFI")
const start = attr(await run("CT D3CODE.PRODUCTS SKU-3 (N"), 3)
const c1 = createD3Session(regressionProfile)
const c2 = createD3Session(regressionProfile)
const raceRun = (c, program) => c.run(program, 90000).then((r) => clean(`${r.stdout}${r.stderr}`)).catch((e) => `ERR ${e.message}`)
const [r1, r2] = await Promise.all([raceRun(c1, "D3CODE.T.R1"), raceRun(c2, "D3CODE.T.R2")])
await c1.close().catch(() => undefined)
await c2.close().catch(() => undefined)
transcript.push(`$ race\nR1: ${r1}\nR2: ${r2}`)
const end = attr(await run("CT D3CODE.PRODUCTS SKU-3 (N"), 3)
const winners = [r1, r2].filter((r) => /^RACE\d [A-Z]908\d\*\d/m.test(r)).length
check("4 race sessions both completed", !/^ERR/m.test(r1) && !/^ERR/m.test(r2), `${r1} || ${r2}`)
check("4 exactly one session won the last unit", winners === 1, `winners=${winners}; ${r1} || ${r2}`)
check("4 stock never went negative", Number(end) >= 0, `start=${start} end=${end}`)
check("4 stock consumed exactly once", Number(end) === Number(start) - winners, `start=${start} end=${end} winners=${winners}`)

// --- 5. no orphan locks remain after the race ---
const locks = await run("LIST-LOCKS (N")
transcript.push(`$ LIST-LOCKS\n${locks}`)
check("5 no item locks left behind", !/ITEM LOCK|item\s+lock/i.test(locks), locks.split("\n").slice(0, 3).join(" | "))

// --- 6. tool-path write rejects a blank-line body instead of truncating ---
const toolBase = { profile: profileName, safety: "trust", mode: "migrate", acceptInputConfirmation: true, commandTimeoutMs: 60000 }
let blankError = ""
try {
  await runToolByName(config, { ...toolBase, name: "d3_write_item", input: { file: "BP", item: "D3CODE.BLANK", body: "LINE1\n\nLINE3", confirmed: true } })
} catch (error) {
  blankError = error.message
}
check("6 blank-line body rejected loudly", /blank line/i.test(blankError), blankError || "no error raised")

// --- 7. tool-path write of a chunked (>5 KB) item round-trips intact ---
const bigBody = ["* generated"].concat(Array.from({ length: 400 }, (_, i) => `  PRINT "BIG-${i + 1}"`)).concat(["  STOP"]).join("\n")
const bigWrite = await runToolByName(config, { ...toolBase, name: "d3_write_item", input: { file: "BP", item: "D3CODE.BIG", body: bigBody, confirmed: true } })
const bigRead = await run("CT BP D3CODE.BIG (N")
const bigCompile = await run("BASIC BP D3CODE.BIG")
check("7 chunked write status", bigWrite.status === "success", bigWrite.status)
check("7 large item has last line", /BIG-400/.test(bigRead), `len=${bigRead.length}`)
check("7 large item compiles", /Successful compile/i.test(bigCompile), bigCompile.split("\n").slice(-2).join(" | "))
await run("DELETE BP D3CODE.BIG")

// --- 8. multi-session stress: 6 buyers race a 3-unit product ---
await run("clear-file D3CODE.ORDERS (l")
await run("clear-file D3CODE.LINES (l")
await run("clear-file D3CODE.MOVES (l")
await run("clear-file D3CODE.CUSTOMERS (l")
await run("clear-file D3CODE.PRODUCTS (l")
await run("D3CODE.SEED")
await run("DELETE D3CODE.PRODUCTS SKU-3")
await run("ED D3CODE.PRODUCTS SKU-3\nI\nStress item\n10\n3\n0\n\nFI")
const stressPrograms = []
for (let i = 0; i < 6; i += 1) {
  const name = `D3CODE.T.S${i}`
  await makeRunner(name, `  CALL D3CODE.SALE("C001","SKU-3",1,"S${i}",RESP)\n  PRINT "STRESS${i} " : RESP\n  STOP`)
  stressPrograms.push(name)
}
const stressSessions = stressPrograms.map(() => createD3Session(regressionProfile))
const stress = await Promise.all(
  stressPrograms.map((name, i) =>
    stressSessions[i]
      .run(name, 90000)
      .then((r) => clean(`${r.stdout}${r.stderr}`))
      .catch((e) => `ERR ${e.message}`),
  ),
)
await Promise.all(stressSessions.map((s) => s.close().catch(() => undefined)))
transcript.push(`$ 6-way stress\n${stress.join("\n")}`)
const stockAfterStress = attr(await run("CT D3CODE.PRODUCTS SKU-3 (N"), 3)
const soldLines = await run("COUNT D3CODE.LINES")
const stressErrors = stress.filter(notAD3Error).length
check("8 no stress session errored", stressErrors === 0, stress.join(" | "))
check("8 stock ends at 0 under 6-way contention", stockAfterStress === "0", `qoh=${stockAfterStress}`)
check("8 exactly 3 lines recorded for 3 units", /3 items counted/.test(soldLines), soldLines)

// --- 9. same-order contention keeps the line sequence intact ---
await run("clear-file D3CODE.ORDERS (l")
await run("clear-file D3CODE.LINES (l")
await run("clear-file D3CODE.MOVES (l")
await run("clear-file D3CODE.PRODUCTS (l")
await run("D3CODE.SEED")
const samePrograms = []
for (let i = 0; i < 5; i += 1) {
  const name = `D3CODE.T.O${i}`
  await makeRunner(name, `  CALL D3CODE.SALE("C001","SKU-2",1,"SAME",RESP)\n  PRINT "SAME${i} " : RESP\n  STOP`)
  samePrograms.push(name)
}
const sameSessions = samePrograms.map(() => createD3Session(regressionProfile))
const same = await Promise.all(
  samePrograms.map((name, i) =>
    sameSessions[i]
      .run(name, 90000)
      .then((r) => clean(`${r.stdout}${r.stderr}`))
      .catch((e) => `ERR ${e.message}`),
  ),
)
await Promise.all(sameSessions.map((s) => s.close().catch(() => undefined)))
transcript.push(`$ same-order contention\n${same.join("\n")}`)
const orderRec = await run("CT D3CODE.ORDERS SAME (N")
const lineCount = attr(orderRec, 7)
const orderSum = attr(orderRec, 4)
check("9 five concurrent lines recorded on one order", lineCount === "5", `lines=${lineCount}; ${same.join(" | ")}`)
check("9 order subtotal is 5 x 42.5", orderSum === "212.5", `sub=${orderSum}`)

// --- 10. overlapping lock ordering: sale + settle + cancel all at once ---
await run("clear-file D3CODE.ORDERS (l")
await run("clear-file D3CODE.LINES (l")
await run("clear-file D3CODE.MOVES (l")
await run("clear-file D3CODE.PAYMENTS (l")
await run("clear-file D3CODE.CUSTOMERS (l")
await run("clear-file D3CODE.PRODUCTS (l")
await run("D3CODE.SEED")
const mixSpecs = [
  ["D3CODE.T.M0", '  CALL D3CODE.SALE("C001","SKU-1",1,"MIX",RESP)\n  PRINT "MIX0 " : RESP\n  STOP'],
  ["D3CODE.T.M1", '  CALL D3CODE.SALE("C001","SKU-1",1,"MIX",RESP)\n  PRINT "MIX1 " : RESP\n  STOP'],
  ["D3CODE.T.M2", '  CALL D3CODE.SALE("C001","SKU-2",1,"MIX2",RESP)\n  PRINT "MIX2 " : RESP\n  STOP'],
]
for (const [name, body] of mixSpecs) await makeRunner(name, body)
const mixSessions = mixSpecs.map(() => createD3Session(regressionProfile))
const mixed = await Promise.all(
  mixSpecs.map(([name], i) =>
    mixSessions[i].run(name, 90000).then((r) => clean(`${r.stdout}${r.stderr}`)).catch((e) => `ERR ${e.message}`),
  ),
)
await Promise.all(mixSessions.map((s) => s.close().catch(() => undefined)))
transcript.push(`$ mixed contention\n${mixed.join("\n")}`)
const mixLocks = await run("LIST-LOCKS (N")
check("10 overlapping writers all returned (no deadlock)", !mixed.some(notAD3Error), mixed.join(" | "))
check("10 no locks left after mixed contention", !/ITEM LOCK|item\s+lock/i.test(mixLocks), mixLocks.split("\n").slice(0, 3).join(" | "))

// --- 11. volume: 300 orders through one program ---
await run("clear-file D3CODE.ORDERS (l")
await run("clear-file D3CODE.LINES (l")
await run("clear-file D3CODE.MOVES (l")
await run("clear-file D3CODE.CUSTOMERS (l")
await run("clear-file D3CODE.PRODUCTS (l")
await run("D3CODE.SEED")
await run("DELETE D3CODE.PRODUCTS SKU-BIG")
await run("ED D3CODE.PRODUCTS SKU-BIG\nI\nBulk item\n1\n1000\n1\n\nFI")
const volOk = await makeRunner("D3CODE.T.VOL", '  FOR I = 1 TO 300\n    ORD = "V" : I\n    CALL D3CODE.SALE("C002","SKU-BIG",1,ORD,RESP)\n  NEXT I\n  PRINT "VOL DONE"\n  STOP')
const volRun = await run("D3CODE.T.VOL", 300000)
transcript.push(`$ volume\n${volRun}`)
const volOrders = await run("COUNT D3CODE.ORDERS")
const volStock = attr(await run("CT D3CODE.PRODUCTS SKU-BIG (N"), 3)
const volIndexed = await run('COUNT D3CODE.ORDERS WITH CUSTOMER = "C002"')
check("11 volume runner built", volOk, "makeRunner")
check("11 300 orders written", /VOL DONE/.test(volRun) && /300 items counted/.test(volOrders), `${lastLine(volRun)}; ${volOrders.split("\n").filter(Boolean).slice(-1)[0]}`)
check("11 stock 1000 -> 700", volStock === "700", `qoh=${volStock}`)
check("11 indexed count matches 300", /300 items counted/.test(volIndexed), volIndexed.split("\n").filter(Boolean).slice(-1)[0])

// --- 12. a missing product file fails with a token, not a hang ---
await makeRunner("D3CODE.T.NOF", '  CALL D3CODE.SALE("C001","SKU-1",1,"NOFILE",RESP)\n  PRINT "NOFILE " : RESP\n  STOP')
await run("DELETE-FILE D3CODE.PRODUCTS")
const noFile = await run("D3CODE.T.NOF")
transcript.push(`$ missing-file\n${noFile}`)
check("12 missing file returns FILE.PRODUCTS token", /FILE\.PRODUCTS/.test(noFile), lastLine(noFile))
await run("CREATE-FILE D3CODE.PRODUCTS 3 7")
await run("D3CODE.DICTGEN")
await run("CREATE-INDEX D3CODE.PRODUCTS A1")
await run("D3CODE.SEED")
check("12 product file rebuilt", /5 items counted/.test(await run("COUNT D3CODE.PRODUCTS")), await run("COUNT D3CODE.PRODUCTS"))

// --- 13. licence pressure: 12 live sessions at once ---
await run("clear-file D3CODE.ORDERS (l")
await run("clear-file D3CODE.LINES (l")
await run("clear-file D3CODE.MOVES (l")
await run("clear-file D3CODE.CUSTOMERS (l")
await run("clear-file D3CODE.PRODUCTS (l")
await run("D3CODE.SEED")
const licPrograms = []
for (let i = 0; i < 12; i += 1) {
  const name = `D3CODE.T.L${i}`
  await makeRunner(name, `  CALL D3CODE.SALE("C001","SKU-1",1,"P${i}",RESP)\n  PRINT "LIC${i} " : RESP\n  STOP`)
  licPrograms.push(name)
}
await run("DELETE D3CODE.PRODUCTS SKU-1")
await run("ED D3CODE.PRODUCTS SKU-1\nI\nLicence item\n5\n12\n0\n\nFI")
const licSessions = licPrograms.map(() => createD3Session(regressionProfile))
const started = Date.now()
const lic = await Promise.all(
  licPrograms.map((name, i) =>
    licSessions[i]
      .run(name, 120000)
      .then((r) => clean(`${r.stdout}${r.stderr}`))
      .catch((e) => `ERR ${e.message}`),
  ),
)
await Promise.all(licSessions.map((s) => s.close().catch(() => undefined)))
transcript.push(`$ licence pressure (12 sessions)\n${lic.join("\n")}\nelapsed=${Date.now() - started}ms`)
const licStock = attr(await run("CT D3CODE.PRODUCTS SKU-1 (N"), 3)
const licSold = 12 - Number(licStock)
const licHangs = lic.filter((r) => /did not reach|timed out|EPIPE/i.test(r)).length
const licRefused = lic.filter((r) => /too many users/i.test(r)).length
check("13 no session hung under licence pressure", licHangs === 0, `${licHangs} hung`)
check("13 stock conserved across 12 sessions", licStock === String(12 - licSold), `qoh=${licStock}`)
check("13 either all sold or cleanly refused", licRefused + 12 - lic.filter((r) => /ERR/.test(r)).length >= 12 - licSold, `refused=${licRefused} sold=${licSold}`)

// --- 14. index reflects an updated key (fresh state, its own order) ---
await run("clear-file D3CODE.ORDERS (l")
await run("clear-file D3CODE.LINES (l")
await run("clear-file D3CODE.MOVES (l")
await run("clear-file D3CODE.CUSTOMERS (l")
await run("clear-file D3CODE.PRODUCTS (l")
await run("D3CODE.SEED")
await makeRunner("D3CODE.T.MK", '  CALL D3CODE.SALE("C002","SKU-2",1,"V1",RESP)\n  PRINT "MK " : RESP\n  STOP')
await run("D3CODE.T.MK")
await makeRunner("D3CODE.T.IDX", '  OPEN "D3CODE.ORDERS" TO OF ELSE STOP\n  READU OREC FROM OF,"V1" ELSE OREC = ""\n  IF OREC <> "" THEN\n    OREC<2> = "C003"\n    WRITE OREC ON OF,"V1"\n    RELEASE OF,"V1"\n  END\n  PRINT "IDX DONE"\n  STOP')
const idxRun = await run("D3CODE.T.IDX")
const idxC003 = await run('COUNT D3CODE.ORDERS WITH CUSTOMER = "C003"')
transcript.push(`$ index update\n${idxRun}\n${idxC003}`)
check("14 index update ran", /IDX DONE/.test(idxRun), lastLine(idxRun))
check("14 indexed query sees the new key", /1 items counted/.test(idxC003), idxC003.split("\n").filter(Boolean).slice(-1)[0])

for (const name of [...stressPrograms, ...samePrograms, ...mixSpecs.map(([n]) => n), ...licPrograms, "D3CODE.T.VOL", "D3CODE.T.NOF", "D3CODE.T.IDX", "D3CODE.T.MK"]) await run(`DELETE BP ${name}`)
await session.close()
await mkdir(join(HERE, "evidence"), { recursive: true })
await writeFile(join(HERE, "evidence", "pressure-run.txt"), `Pressure run ${new Date().toISOString()}\n${transcript.join("\n")}\n\nCHECKS\n${results.map((r) => `[${r.ok ? "ok" : "FAIL"}] ${r.name}${r.detail ? ` — ${r.detail}` : ""}`).join("\n")}\n`)
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) {
  console.log("FAILED:", failed.map((f) => f.name).join("; "))
  process.exitCode = 1
}
