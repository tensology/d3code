export interface SbplusScreenPlanInput {
  system?: string
  process?: string
  kind?: string
  file?: string
  fields?: string[]
  notes?: string
}

export interface SbplusScreenFieldPlan {
  name: string
  label: string
  validation: string[]
  source: "operator-supplied" | "to-discover"
}

export interface SbplusScreenActionPlan {
  key: string
  behavior: string
  proof: string
}

export interface SbplusScreenPlan {
  system: string
  process: string
  kind: string
  file?: string
  writePolicy: "no-direct-definition-record-writes"
  referenceFamilies: string[]
  discovery: string[]
  fieldMap: SbplusScreenFieldPlan[]
  actions: SbplusScreenActionPlan[]
  buildSteps: string[]
  proofChecklist: string[]
  notes?: string
}

function label(value: string): string {
  return value.replace(/[._-]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
}

export function createSbplusScreenPlan(input: SbplusScreenPlanInput): SbplusScreenPlan {
  const fields = (input.fields ?? []).filter(Boolean)
  return {
    system: input.system ?? "(confirm-system)",
    process: input.process ?? "(confirm-process)",
    kind: input.kind ?? "input process",
    file: input.file,
    writePolicy: "no-direct-definition-record-writes",
    referenceFamilies: ["system-builder", "sbplus", "d3-reference", "operator-memory"],
    discovery: [
      "Run d3code sbplus-discover against the target profile/account.",
      "Read likely process, screen, menu, and driver definition items before changing anything.",
      "Confirm SB+ naming conventions and generated driver behavior with the operator.",
      "Route any write through SB+ maintenance screens or account-specific tools after proof.",
    ],
    fieldMap: (fields.length ? fields : ["(discover fields from screen/process definition)"]).map((name) => ({
      name,
      label: label(name),
      validation: [
        "confirm dictionary item",
        "confirm conversion/correlative semantics",
        "confirm required/default behavior from SB+ process definition",
        "confirm help/error message behavior from System Builder references",
      ],
      source: fields.length ? "operator-supplied" : "to-discover",
    })),
    actions: [
      { key: "F1", behavior: "field help", proof: "capture help behavior or mark explicitly unsupported" },
      { key: "F3", behavior: "accept/save/advance", proof: "capture submit path and write/readback evidence" },
      { key: "Esc/Break", behavior: "cancel/back out", proof: "capture rollback/cancel behavior" },
    ],
    buildSteps: [
      "Confirm system, process type, primary file, fields, keys, validation, and security rules.",
      "Create a screen/process design document before touching SB+ definition records.",
      "Use SB+ maintenance/runtime flow to apply changes; do not hand-edit definition records in this planning step.",
      "Run generated process once so SB+ can build/refresh drivers.",
      "Capture terminal transcript, parsed screen buffer, operator notes, and rollback path.",
    ],
    proofChecklist: [
      "sbplus-discover output identifies likely definition files.",
      "RAG/manual search cites System Builder or SB+ reference family.",
      "screen-buffer.json proves layout and function-key behavior.",
      "D3 profile/account proof exists for the target account.",
      "Operator approves field/action mapping before implementation.",
    ],
    notes: input.notes,
  }
}

export function renderSbplusScreenPlan(plan: SbplusScreenPlan): string {
  return [
    `# SB+ Screen Plan: ${plan.system}/${plan.process}`,
    "",
    `Type: ${plan.kind}`,
    `Primary file: ${plan.file ?? "(discover)"}`,
    "Write policy: No direct SB+ definition-record writes in this planning step.",
    `References: ${plan.referenceFamilies.join(", ")}`,
    plan.notes ? `Notes: ${plan.notes}` : undefined,
    "",
    "Discovery:",
    ...plan.discovery.map((item) => `- ${item}`),
    "",
    "Fields:",
    ...plan.fieldMap.map((field) => `- ${field.name} (${field.label}) source=${field.source}; validation=${field.validation.join("; ")}`),
    "",
    "Actions:",
    ...plan.actions.map((action) => `- ${action.key}: ${action.behavior}; proof=${action.proof}`),
    "",
    "Build steps:",
    ...plan.buildSteps.map((step, index) => `${index + 1}. ${step}`),
    "",
    "Proof checklist:",
    ...plan.proofChecklist.map((item) => `- ${item}`),
  ].filter((line) => line !== undefined).join("\n")
}
