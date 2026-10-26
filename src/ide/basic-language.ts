import type { StreamParser } from "@codemirror/language"

const keywords = new Set("ABORT BEGIN CALL CASE CHAIN CLEAR CLEARFILE CLOSE COMMON CRT DATA DEBUG DELETE DIM ELSE END EQU EQUATE EXECUTE EXIT FOR FROM GOSUB GOTO GO IF IN INPUT LOCATE LOCK LOOP MAT MATPARSE MATBUILD NEXT ON OPEN OPENSEQ PRINT READ READU READV READVU READNEXT RELEASE REMOVE REPEAT RETURN RETURNING REWIND SELECT SLEEP STEP STOP SUBROUTINE THEN TO UNTIL UPDATE USING WEOF WRITE WRITEU WRITEV WRITEVU WHILE DO AND OR NOT MATCHES MATCH EQ NE LT LE GT GE".split(" "))

// Highlighting only. Compilation remains the authority for D3 BASIC syntax.
export const d3BasicParser: StreamParser<null> = {
  name: "d3-basic",
  startState: () => null,
  token(stream) {
    const first = stream.string.slice(0, stream.pos).trim() === ""
    if (stream.eatSpace()) return null
    if ((first && stream.match(/^(?:\*|!|REM\b)/i)) || stream.match(/^;\s*[*!]/)) {
      stream.skipToEnd();return "comment"
    }
    if (stream.match(/^["'\\]/)) {
      const quote = stream.current()
      while (!stream.eol()) if (stream.next() === quote) break
      return "string"
    }
    if (stream.match(/^@(?:[A-Z][A-Z0-9_.]*|\d+)/i)) return "atom"
    if (stream.match(/^[A-Z_$][A-Z0-9_.$]*/i)) {
      if (stream.eat(":")) return "labelName"
      return keywords.has(stream.current().toUpperCase()) ? "keyword" : "variableName"
    }
    if (first && stream.match(/^\d+(?=[:\s])/)) return "labelName"
    if (stream.match(/^\d+(?:\.\d+)?/)) return "number"
    if (stream.match(/^[+\-*/=<>:#]+/)) return "operator"
    stream.next();return null
  },
}
