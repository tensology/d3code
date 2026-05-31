import assert from "node:assert/strict"
import test from "node:test"
import { D3_ACTIVE_LIST_PROMPT, D3_TCL_PROMPT, D3_TCL_PROMPT_PATTERN, describeD3PromptPattern, normalizeD3PromptPattern } from "../src/d3/prompts.js"

test("D3 prompt defaults are grounded in Rocket TCL prompt semantics", () => {
  assert.equal(D3_TCL_PROMPT, ":")
  assert.equal(D3_ACTIVE_LIST_PROMPT, ">")
  assert.equal(D3_TCL_PROMPT_PATTERN, "(^|\\n):\\s*$")
  assert.equal(new RegExp(D3_TCL_PROMPT_PATTERN).test("user id:"), false)
  assert.equal(new RegExp(D3_TCL_PROMPT_PATTERN).test("user id:\ndm\n:"), true)
  assert.equal(normalizeD3PromptPattern(":"), D3_TCL_PROMPT_PATTERN)
  assert.equal(normalizeD3PromptPattern(">"), ">")
  assert.equal(normalizeD3PromptPattern(""), undefined)
  assert.match(describeD3PromptPattern(), /standalone `:`/)
  assert.match(describeD3PromptPattern(), /active select list/)
})
