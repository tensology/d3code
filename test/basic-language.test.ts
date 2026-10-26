import assert from "node:assert/strict"
import test from "node:test"
import { StringStream } from "@codemirror/language"
import { d3BasicParser } from "../src/ide/basic-language.js"

function tokens(line: string) {
  const stream = new StringStream(line, 2, 2), result: Array<[string, string | null]> = []
  while (!stream.eol()) {
    stream.start = stream.pos
    const type = d3BasicParser.token(stream, null)
    assert.ok(stream.pos > stream.start, "every token must advance")
    if (type) result.push([stream.current(), type])
  }
  return result
}

test("BASIC highlighting distinguishes comments, strings, labels and field marks", () => {
  assert.deepEqual(tokens('  * PRINT "not code"'), [['* PRINT "not code"', 'comment']])
  assert.deepEqual(tokens('REM READ CUSTOMER'), [['REM READ CUSTOMER', 'comment']])
  assert.deepEqual(tokens('PRINT "* literal"'), [['PRINT', 'keyword'], ['"* literal"', 'string']])
  assert.deepEqual(tokens('LOOP.START: RETURN'), [['LOOP.START:', 'labelName'], ['RETURN', 'keyword']])
  assert.deepEqual(tokens('VALUE = @AM : 42'), [['VALUE', 'variableName'], ['=', 'operator'], ['@AM', 'atom'], [':', 'operator'], ['42', 'number']])
  assert.deepEqual(tokens('X = \\literal\\ ;* comment'), [['X', 'variableName'], ['=', 'operator'], ['\\literal\\', 'string'], [';* comment', 'comment']])
})

test("highlighting always consumes unusual or incomplete source", () => {
  for (const line of ['PRINT "unfinished', '<1,2>', '\u00fe\u00fd\u00fc', '123', 'A!B']) tokens(line)
})
