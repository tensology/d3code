import assert from "node:assert/strict"
import test from "node:test"
import { D3_ACTIVE_LIST_PROMPT, D3_TCL_PROMPT, D3_TCL_PROMPT_PATTERN, describeD3PromptPattern } from "../src/d3/prompts.js"

test("D3 prompt defaults are grounded in Rocket TCL prompt semantics", () => {
  assert.equal(D3_TCL_PROMPT, ":")
  assert.equal(D3_ACTIVE_LIST_PROMPT, ">")
  assert.equal(D3_TCL_PROMPT_PATTERN, ":")
  assert.match(describeD3PromptPattern(), /normal TCL prompt is `:`/)
  assert.match(describeD3PromptPattern(), /active select list/)
})
