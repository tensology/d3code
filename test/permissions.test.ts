import assert from "node:assert/strict"
import test from "node:test"
import { assertD3Allowed, classifyD3Command, evaluateD3Permission } from "../src/core/permissions.js"

test("classifies read-only AQL as read", () => {
  assert.equal(classifyD3Command("LIST CUSTOMERS LAST.NAME"), "read")
  assert.equal(evaluateD3Permission("plan", "LIST CUSTOMERS"), "allow")
})

test("plan mode denies compile and write operations", () => {
  assert.equal(classifyD3Command("BASIC BP PROG1"), "compile")
  assert.equal(classifyD3Command("LOGTO SALES"), "write")
  assert.equal(classifyD3Command("CALL GET.CUSTOMER 100"), "write")
  assert.equal(evaluateD3Permission("plan", "BASIC BP PROG1"), "deny")
  assert.equal(evaluateD3Permission("plan", "ED BP PROG1"), "deny")
  assert.equal(evaluateD3Permission("plan", "LOGTO SALES"), "deny")
  assert.equal(evaluateD3Permission("ask", "CALL GET.CUSTOMER 100"), "ask")
})

test("trust mode still confirms destructive and shell commands", () => {
  assert.equal(evaluateD3Permission("trust", "CLEAR-FILE CUSTOMERS"), "confirm")
  assert.equal(evaluateD3Permission("trust", "! rm -rf /tmp/x"), "confirm")
})

test("documented SB+ installation requires approval even in trust mode", () => {
  for (const command of ["RUN DM SB.INITIATE", "run DM sb.initiate", "RUN SB+.DEFN,DM, SB.INITIATE", 'RUN "DM" "SB.INITIATE"', "RUN 'DM' 'SB.INITIATE'", "SB.INITIATE", "WHO\nRUN DM SB.INITIATE"]) {
    assert.equal(classifyD3Command(command), "destructive", command)
    assert.equal(evaluateD3Permission("plan", command), "deny")
    assert.equal(evaluateD3Permission("ask", command), "ask")
    assert.equal(evaluateD3Permission("trust", command), "confirm")
    assert.throws(() => assertD3Allowed("trust", command), /Confirmation required/)
  }
  assert.equal(classifyD3Command("CT DM SB.INITIATE (N"), "read")
  assert.equal(classifyD3Command("RUN bp D3CODE.SB.INITIATE"), "write")
})

test("account switch aliases require approval and respect the profile allowlist", () => {
  for (const command of ["TO MPSTORE", "LOGTO MPSTORE", "WHO\nto MPSTORE"]) {
    assert.equal(evaluateD3Permission("ask", command), "ask")
    assert.throws(() => assertD3Allowed("ask", command, true, ["dm"]), /outside the allowed accounts/)
  }
  assert.doesNotThrow(() => assertD3Allowed("ask", "TO dm", true, ["dm"]))
  assert.throws(() => assertD3Allowed("ask", "TO DM", true, ["dm"]), /outside the allowed accounts/)
  assert.equal(classifyD3Command("LIST ORDERS TO PRINTER"), "write")
})

test("only known diagnostic forms and nonprinting reads run without approval", () => {
  for (const command of ["WHO", "VERSION", "TERM", "STTY", "WHERE (N", "LIST-JOBS (N", "SP-STATUS", "LIST-INDEX PRODUCTS", "CT BP TEST", "CT BP TEST (N", "LIST BP BASIC", 'LIST ORDERS WITH NOTE = "TO PRINTER (P" (N']) {
    assert.equal(classifyD3Command(command), "read", command)
  }
  for (const command of ["RUN BP TEST", "EXECUTE TEST", "B.DAYEND", "Z B.DAYEND", "PHANTOM TEST", "backgrounds TEST", "startsched", "SP-ASSIGN (N", "SPOOL BP TEST", "set-device /backup/d3/sunday", "t-att 512", "t-det", "CREATE-INDEX PRODUCTS A1", "TERM 80,24", "STTY -echo", "printf TEST"]) {
    assert.equal(evaluateD3Permission("ask", command), "ask", command)
    assert.equal(evaluateD3Permission("plan", command), "deny", command)
  }
  for (const command of ["FILE-SAVE (b", "ACCOUNT-SAVE dm", "DELETE-FILE CUSTOMERS", "SP-KILL 1"]) {
    assert.equal(evaluateD3Permission("trust", command), "confirm", command)
  }
})

test("stacked commands take the highest risk and cannot hide shell execution", () => {
  for (const command of ["WHO\n! echo TEST", "WHO\rSH echo TEST", "WHO\nUNIX id", "WHO; echo TEST", 'WHO "$(id)"']) {
    assert.equal(classifyD3Command(command), "shell", command)
    assert.equal(evaluateD3Permission("plan", command), "deny", command)
    assert.throws(() => assertD3Allowed("trust", command), /Confirmation required/, command)
  }
  assert.equal(classifyD3Command("WHO\nRUN BP TEST"), "write")
  assert.equal(classifyD3Command("WHO\nBASIC BP TEST\nCLEAR-FILE CUSTOMERS"), "destructive")
  assert.equal(classifyD3Command("WHO\nVERSION"), "read")
})

test("printing queries never receive read permission", () => {
  for (const command of ["LIST ORDERS (P", "SORT ORDERS (NP)", "LIST ORDERS (P1)", "LIST ORDERS (P) HEADING \"Orders\"", "LIST ORDERS LPTR", "LIST ORDERS TO PRINTER", "CT BP TEST (P"]) {
    assert.equal(classifyD3Command(command), "write", command)
    assert.equal(evaluateD3Permission("plan", command), "deny", command)
    assert.equal(evaluateD3Permission("ask", command), "ask", command)
  }
})

test("print queue inspection permits only plain nonprinting diagnostic forms", () => {
  for (const command of ["LISTPEQS", "LISTPEQS (N", "listpeqs (n)"]) assert.equal(evaluateD3Permission("plan", command), "allow")
  for (const command of ["LISTPEQS (P", "LISTPEQS (NP", "LISTPEQS TO PRINTER", "LISTPEQS; SP-KILL 1", "LISTPEQS 1-10", "LISTPEQS 'other'"]) assert.notEqual(evaluateD3Permission("plan", command), "allow", command)
})


test("native AQL comparisons remain reads while actual shell transports require approval", () => {
  const query = 'LIST ORDERS WITH TOTAL > 100 AND TOTAL < 200'
  for (const profile of [{ type: "ssh" as const }, { type: "local" as const, entryCommand: "d3 -d" }]) {
    assert.equal(classifyD3Command(query, profile), "read")
    assert.equal(evaluateD3Permission("plan", query, profile), "allow")
  }
  for (const profile of [{ type: "local" as const }, { type: "ssh" as const, entryCommand: "/bin/bash -l" }, { type: "local" as const, entryCommand: "sh" }]) {
    assert.equal(classifyD3Command(query, profile), "shell")
    assert.throws(() => assertD3Allowed("plan", query, true, undefined, profile), /Denied by/)
    assert.throws(() => assertD3Allowed("trust", "WHO", false, undefined, profile), /Confirmation required/)
  }
})
