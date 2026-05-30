import assert from "node:assert/strict"
import test from "node:test"
import { generateAdapterSkeleton } from "../src/migration/adapter.js"

test("generates D3-backed REST adapter skeleton files", () => {
  const files = generateAdapterSkeleton({
    account: "SALES",
    strategy: "strangler",
    resources: [{
      file: "CUSTOMERS",
      resource: "customers",
      endpoints: [],
      fields: [
        { name: "name", dictionaryId: "NAME", attribute: 1, type: "string", required: false, multivalue: false },
        { name: "phoneNumbers", dictionaryId: "PHONE.NOS", attribute: 3, type: "array", required: false, multivalue: true },
      ],
    }],
    services: [],
    phases: [],
    risks: [],
  })
  assert.deepEqual(files.map((file) => file.path), [
    "src/d3-record.ts",
    "src/customers/customers.types.ts",
    "src/customers/customers.repository.ts",
    "src/customers/customers.routes.ts",
  ])
  assert.match(files[0]!.content, /parseD3Record/)
  assert.match(files[0]!.content, /formatD3Record/)
  assert.match(files[0]!.content, /parseD3Ids/)
  assert.match(files[1]!.content, /interface CustomersAttributes/)
  assert.match(files[1]!.content, /name\?: string \/\/ D3 NAME attr 1/)
  assert.match(files[1]!.content, /phoneNumbers\?: string\[\] \/\/ D3 PHONE\.NOS attr 3/)
  assert.match(files[2]!.content, /parseD3Record/)
  assert.match(files[2]!.content, /parseD3Ids/)
  assert.match(files[2]!.content, /formatD3Record/)
  assert.match(files[2]!.content, /"attribute": 3/)
  assert.match(files[2]!.content, /CT CUSTOMERS/)
  assert.doesNotMatch(files[2]!.content, /return \[\]/)
  assert.match(files[2]!.content, /ED CUSTOMERS/)
  assert.match(files[3]!.content, /createCustomersRoutes/)
})
