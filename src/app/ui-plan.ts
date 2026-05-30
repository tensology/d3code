import type { BundleArtifacts, D3ApplicationBundle } from "./bundle.js"
import { createDataValidationPlan } from "./data-plan.js"
import { createErpMigrationBlueprint } from "./erp-migration.js"
import { createScreenModernizationPlan } from "./screen-plan.js"

export interface WebUiScreenField {
  name: string
  source: string
  kind: "id" | "scalar" | "multivalue" | "computed"
  required: boolean
  warning?: string
}

export interface WebUiScreenPlan {
  id: string
  title: string
  resource: string
  d3File: string
  layout: "table-detail" | "master-detail" | "workflow"
  fields: WebUiScreenField[]
  actions: string[]
  warnings: string[]
  evidence: string[]
}

export interface WebUiPlan {
  account: string
  profile: string
  screens: WebUiScreenPlan[]
  navigation: Array<{ label: string; screen: string; resource: string }>
  globalWarnings: string[]
}

function titleize(input: string): string {
  return input
    .split(/[-_\s.]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ")
}

export function createWebUiPlan(bundle: D3ApplicationBundle, artifacts: BundleArtifacts): WebUiPlan {
  const blueprint = createErpMigrationBlueprint(bundle, artifacts)
  const dataPlan = createDataValidationPlan(bundle, artifacts)
  const screenPlan = createScreenModernizationPlan(bundle)

  const screens = artifacts.migrationPlan.resources.map((resource): WebUiScreenPlan => {
    const blueprintScreen = blueprint.screens.find((screen) => screen.resource === resource.resource)
    const fields: WebUiScreenField[] = [
      { name: "id", source: "@ID", kind: "id", required: true },
      ...(resource.fields ?? []).slice(0, 16).map((field) => ({
        name: field.name,
        source: field.dictionaryId,
        kind: field.multivalue ? "multivalue" as const : "scalar" as const,
        required: field.required,
        warning: field.multivalue ? "Preserve D3 value/subvalue order when editing or migrating this field." : undefined,
      })),
    ]
    const warnings = [
      ...dataPlan.items.filter((item) => item.file === resource.file && item.status !== "ok").map((item) => item.rationale),
      ...screenPlan.items.filter((item) => item.risk !== "none" && item.program !== "*").map((item) => `${item.program} has ${item.risk} legacy screen risk; map terminal prompts before replacing this flow.`),
    ]
    return {
      id: blueprintScreen?.id ?? resource.resource,
      title: blueprintScreen?.title ?? titleize(resource.resource),
      resource: resource.resource,
      d3File: resource.file,
      layout: blueprintScreen?.layout ?? (fields.some((field) => field.kind === "multivalue") ? "master-detail" : "table-detail"),
      fields,
      actions: blueprintScreen?.actions ?? ["search", "view", "compare D3 source"],
      warnings,
      evidence: [`d3-file:${resource.file}`, `endpoint-count:${resource.endpoints.length}`, `field-count:${fields.length}`],
    }
  })

  return {
    account: bundle.account,
    profile: bundle.profile,
    screens,
    navigation: screens.map((screen) => ({ label: screen.title, screen: screen.id, resource: screen.resource })),
    globalWarnings: [
      ...(screens.length === 0 ? ["No web UI screens can be planned until D3 resources are captured."] : []),
      ...(screenPlan.items.some((item) => item.risk !== "none" || item.program === "*") ? ["Legacy D3 terminal screen behavior requires transcript proof before UI replacement is accepted."] : []),
    ],
  }
}

export function renderWebUiPlan(plan: WebUiPlan): string {
  return [
    `# D3 Web UI Plan: ${plan.account}`,
    "",
    `Profile: ${plan.profile}`,
    `Screens: ${plan.screens.length}`,
    "",
    "Navigation:",
    ...(plan.navigation.length ? plan.navigation.map((item) => `- ${item.label}: /${item.resource} (${item.screen})`) : ["- none"]),
    "",
    "Screens:",
    ...plan.screens.flatMap((screen) => [
      `- ${screen.title} (${screen.layout}) -> ${screen.resource}`,
      `  D3 file: ${screen.d3File}`,
      `  Fields: ${screen.fields.map((field) => `${field.name}:${field.kind}`).join(", ") || "none"}`,
      `  Actions: ${screen.actions.join(", ") || "none"}`,
      `  Warnings: ${screen.warnings.join(" | ") || "none"}`,
      `  Evidence: ${screen.evidence.join(", ")}`,
    ]),
    "",
    "Global Warnings:",
    ...(plan.globalWarnings.length ? plan.globalWarnings.map((warning) => `- ${warning}`) : ["- none"]),
  ].join("\n")
}
