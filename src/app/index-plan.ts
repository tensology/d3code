import type { BundleArtifacts, D3ApplicationBundle } from "./bundle.js"

export interface IndexValidationItem {
  file: string
  status: "ok" | "missing" | "review"
  index: string
  rationale: string
  evidence: string[]
  commands: string[]
}

export interface IndexValidationPlan {
  account: string
  profile: string
  items: IndexValidationItem[]
}

function normalize(value: string): string {
  return value.toUpperCase()
}

function item(values: IndexValidationItem): IndexValidationItem {
  return values
}

export function createIndexValidationPlan(bundle: D3ApplicationBundle, artifacts: BundleArtifacts): IndexValidationPlan {
  const items: IndexValidationItem[] = []
  for (const file of bundle.files) {
    const observed = new Set((file.observedIndexes ?? []).map(normalize))
    const expected = new Set((file.expectedIndexes ?? []).map(normalize))
    const dictionary = new Set(file.dictionary.map((entry) => normalize(entry.id)))
    const resource = artifacts.migrationPlan.resources.find((entry) => normalize(entry.file) === normalize(file.name))
    const fields = resource?.fields ?? []

    for (const indexName of expected) {
      items.push(item({
        file: file.name,
        index: indexName,
        status: observed.has(indexName) ? "ok" : "missing",
        rationale: observed.has(indexName) ? "Expected index was observed in captured D3 index listing." : "Expected index was not observed and may affect AQL/API performance.",
        evidence: [`expected:${indexName}`, `observed:${observed.has(indexName) ? "yes" : "no"}`, `dictionary:${dictionary.has(indexName) ? "yes" : "no"}`],
        commands: [`LIST-INDEX ${file.name}`, `LIST DICT ${file.name} ${indexName}`],
      }))
    }

    for (const indexName of observed) {
      if (!expected.has(indexName)) {
        items.push(item({
          file: file.name,
          index: indexName,
          status: dictionary.has(indexName) ? "review" : "review",
          rationale: dictionary.has(indexName) ? "Observed index is not in expected list; decide whether the migrated API should rely on it." : "Observed index has no sampled dictionary item; validate the dictionary/index relationship.",
          evidence: [`observed:${indexName}`, `expected:no`, `dictionary:${dictionary.has(indexName) ? "yes" : "no"}`],
          commands: [`LIST-INDEX ${file.name}`, `LIST DICT ${file.name} ${indexName}`],
        }))
      }
    }

    if (expected.size === 0 && observed.size === 0) {
      items.push(item({
        file: file.name,
        index: "__manual_review__",
        status: "review",
        rationale: "No expected or observed indexes were captured; review AQL reports and API list/search endpoints before migration.",
        evidence: [`records:${file.records.length}`, `dictionary:${file.dictionary.length}`],
        commands: [`LIST-INDEX ${file.name}`, `LIST DICT ${file.name}`],
      }))
    }

    for (const field of fields.filter((entry) => entry.dictionaryId && !expected.has(normalize(entry.dictionaryId)) && !observed.has(normalize(entry.dictionaryId)))) {
      items.push(item({
        file: file.name,
        index: field.dictionaryId,
        status: "review",
        rationale: `Field ${field.name} is exposed in the generated API but has no captured index evidence.`,
        evidence: [`resource:${resource?.resource ?? file.name}`, `field:${field.name}`, `dictionary:${field.dictionaryId}`, field.attribute !== undefined ? `attribute:${field.attribute}` : "attribute:unknown"],
        commands: [`LIST-INDEX ${file.name}`, `LIST DICT ${file.name} ${field.dictionaryId}`],
      }))
    }
  }

  return {
    account: bundle.account,
    profile: bundle.profile,
    items: items.sort((a, b) => {
      const rank = { missing: 0, review: 1, ok: 2 }
      return rank[a.status] - rank[b.status] || a.file.localeCompare(b.file) || a.index.localeCompare(b.index)
    }),
  }
}

export function renderIndexValidationPlan(plan: IndexValidationPlan): string {
  return [
    `# D3 Index Validation Plan: ${plan.account}`,
    "",
    `Profile: ${plan.profile}`,
    `Items: ${plan.items.length}`,
    "",
    ...plan.items.flatMap((entry, index) => [
      `${index + 1}. [${entry.status}] ${entry.file} index ${entry.index}`,
      `   Rationale: ${entry.rationale}`,
      "   Evidence:",
      ...entry.evidence.map((evidence) => `   - ${evidence}`),
      "   Commands:",
      ...entry.commands.map((command) => `   - \`${command}\``),
      "",
    ]),
  ].join("\n")
}
