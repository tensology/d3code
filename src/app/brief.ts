import type { BundleArtifacts, D3ApplicationBundle } from "./bundle.js"

function countFindings(artifacts: BundleArtifacts): { warnings: number; errors: number } {
  const program = artifacts.audit.programFindings.map((item) => item.finding)
  const database = artifacts.audit.database?.files.flatMap((file) => [
    ...file.dictionaryFindings,
    ...file.shapeFindings,
    ...file.indexFindings,
  ]) ?? []
  return {
    warnings: [...program, ...database].filter((finding) => finding.severity === "warning").length,
    errors: [...program, ...database].filter((finding) => finding.severity === "error").length,
  }
}

export function createModernizationBrief(bundle: D3ApplicationBundle, artifacts: BundleArtifacts): string {
  const findings = countFindings(artifacts)
  const resources = artifacts.migrationPlan.resources.map((resource) => `- ${resource.resource}: D3 file ${resource.file}, ${resource.fields?.length ?? 0} mapped field(s)`)
  const services = artifacts.migrationPlan.services.map((service) => `- ${service.suggestedService}: ${service.program}; opens=${service.opens.join(", ") || "none"}; calls=${service.calls.join(", ") || "none"}`)
  const fileUsage = artifacts.codeMap.fileUsage.map((usage) => `- ${usage.file}: readers=${usage.readers.length}, writers=${usage.writers.length}, openers=${usage.openers.length}`)
  const recommendations = [...new Set([
    ...artifacts.codeMap.modernizationRecommendations,
    ...artifacts.migrationPlan.risks,
  ])]
  return [
    `# D3 Modernization Brief: ${bundle.account}`,
    "",
    `Profile: ${bundle.profile}`,
    `Files sampled: ${bundle.files.length}`,
    `Programs sampled: ${bundle.programs.length}`,
    `Audit findings: ${findings.errors} error(s), ${findings.warnings} warning(s)`,
    "",
    "## Resource Map",
    ...(resources.length ? resources : ["- No D3 files were captured."]),
    "",
    "## Service Map",
    ...(services.length ? services : ["- No BASIC programs were captured."]),
    "",
    "## File Usage",
    ...(fileUsage.length ? fileUsage : ["- No file usage was detected from sampled programs."]),
    "",
    "## API Artifacts",
    `- OpenAPI paths: ${Object.keys(artifacts.openapi.paths).length}`,
    `- Adapter files: ${artifacts.adapters.length}`,
    "",
    "## Modernization Risks And Next Steps",
    ...recommendations.map((item) => `- ${item}`),
    "",
    "## GSD Evidence To Record",
    "- profile doctor output for the target D3 account",
    "- bundle capture command and resulting d3-app-bundle.json",
    "- audit.json and code-map.json review notes",
    "- generated OpenAPI/adapter path list",
    "- regression or live-D3 compile/catalog evidence",
    "",
  ].join("\n")
}
