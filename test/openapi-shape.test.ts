import assert from "node:assert/strict"
import test from "node:test"
import { analyzeD3Record, validateShapeConsistency } from "../src/d3/shape.js"
import { createOpenApiFromMigrationPlan } from "../src/migration/openapi.js"

test("generates OpenAPI paths and D3-shaped schema", () => {
  const doc = createOpenApiFromMigrationPlan({
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
  assert.equal(doc.openapi, "3.1.0")
  assert.ok(doc.paths["/customers"])
  assert.ok(doc.paths["/customers/{id}"])
  assert.ok(doc.components.schemas.Customers)
  const schema = doc.components.schemas.Customers as { properties: Record<string, unknown>; "x-d3-file": string }
  assert.equal(schema["x-d3-file"], "CUSTOMERS")
  assert.deepEqual(schema.properties.name, { type: "string", description: "D3 dictionary NAME, attribute 1", "x-d3-dictionary": "NAME", "x-d3-attribute": 1 })
  assert.match(JSON.stringify(schema.properties.phoneNumbers), /x-d3-multivalue/)
})

test("detects D3 multi-value and shape inconsistency", () => {
  const shapes = [
    analyzeD3Record("A", `one\u00fetwo\u00fdthree`),
    analyzeD3Record("B", `one\u00fetwo\u00fefour\u00fcfive`),
  ]
  const findings = validateShapeConsistency(shapes)
  assert.ok(findings.some((finding) => finding.message.includes("inconsistent attribute counts")))
  assert.ok(findings.some((finding) => finding.message.includes("Multi-valued attributes")))
  assert.ok(findings.some((finding) => finding.message.includes("Sub-valued attributes")))
})
