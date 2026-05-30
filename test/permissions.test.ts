import assert from "node:assert/strict"
import test from "node:test"
import { classifyD3Command, evaluateD3Permission } from "../src/core/permissions.js"

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
