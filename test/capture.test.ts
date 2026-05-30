import assert from "node:assert/strict"
import test from "node:test"
import { captureBundleFromSession } from "../src/capture/capture.js"
import { parseCtItem, parseDictionaryItem, parseIndexNames, parseListOutputIds } from "../src/capture/parsers.js"
import type { ConnectionProfile, D3CommandResult, D3Session } from "../src/domain/types.js"

class MockSession implements D3Session {
  profile: ConnectionProfile = { name: "mock", type: "local", account: "SALES" }

  async run(command: string): Promise<D3CommandResult> {
    const stdout = command.includes("LIST MD")
      ? "CUSTOMERS\nORDERS\n2 items listed\n"
      : command.includes("LIST DICT CUSTOMERS")
        ? "@ID\nNAME\nSTATUS\n"
      : command.includes("LIST DICT ORDERS")
          ? "@ID\nCUSTOMER.ID\nTOTAL\n"
          : command.includes("LIST-INDEX CUSTOMERS")
            ? "INDEX NAME\nNAME\nSTATUS\n2 indexes listed\n"
            : command.includes("LIST-INDEX ORDERS")
              ? "TOTAL\n"
          : command.includes("SELECT CUSTOMERS")
            ? "100\n101\n"
            : command.includes("SELECT ORDERS")
              ? "500\n"
              : command.includes("SELECT BP")
                ? "GET.CUSTOMER\n"
                : command.includes("CT BP GET.CUSTOMER")
                  ? "SUBROUTINE GET.CUSTOMER(ID)\nOPEN \"CUSTOMERS\" TO F ELSE STOP\nRETURN\n"
                  : command.includes("CT CUSTOMERS 100")
                    ? "AliceþRetail"
                    : command.includes("CT CUSTOMERS 101")
                      ? "BobþWholesale"
                      : command.includes("CT ORDERS 500")
                        ? "100þ250.00"
                        : ""
    return { command, stdout, stderr: "", exitCode: 0, durationMs: 1 }
  }

  async close(): Promise<void> {}
}

test("parses list output ids while dropping headings and totals", () => {
  assert.deepEqual(parseListOutputIds("LIST MD\nID\nCUSTOMERS\nORDERS\n2 items listed\n"), ["CUSTOMERS", "ORDERS"])
})

test("parses CT item bodies", () => {
  assert.equal(parseCtItem("CT BP X\nSUBROUTINE X\nRETURN\n"), "SUBROUTINE X\nRETURN")
})

test("parses D3 dictionary item bodies", () => {
  assert.deepEqual(parseDictionaryItem("NAME", "001 A\n002 1\n003 Customer Name\n007 MR2\n"), {
    id: "NAME",
    type: "A",
    attribute: 1,
    heading: "Customer Name",
    conversion: "MR2",
    raw: "001 A\n002 1\n003 Customer Name\n007 MR2",
  })
})

test("parses D3 index listings", () => {
  assert.deepEqual(parseIndexNames("LIST-INDEX CUSTOMERS\nINDEX NAME\nNAME\nSTATUS\n2 indexes listed\n"), ["NAME", "STATUS"])
  assert.deepEqual(parseIndexNames("No indexes found"), [])
})

test("captures D3 application bundle from session commands", async () => {
  const bundle = await captureBundleFromSession(new MockSession(), { profile: "mock", account: "SALES", programFiles: ["BP"], sampleLimit: 2 })
  assert.deepEqual(bundle.files.map((file) => file.name), ["CUSTOMERS", "ORDERS"])
  assert.deepEqual(bundle.files[0]?.dictionary.map((item) => item.id), ["@ID", "NAME", "STATUS"])
  assert.deepEqual(bundle.files[0]?.observedIndexes, ["NAME", "STATUS"])
  assert.equal(bundle.files[0]?.records[0]?.raw, "AliceþRetail")
  assert.equal(bundle.programs[0]?.item, "GET.CUSTOMER")
})
