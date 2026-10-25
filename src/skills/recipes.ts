export type RecipeID = "audit" | "migrate" | "api" | "modernize" | "basic-program" | "dictionary-field" | "sbplus-screen" | "legacy-screen"

export interface Recipe {
  id: RecipeID
  title: string
  commands: string[]
}

export const recipes: Record<RecipeID, Recipe> = {
  audit: {
    id: "audit",
    title: "D3 Audit Recipe",
    commands: [
      "d3code runbook audit",
      "d3code workflow audit",
      "d3code index-account --profile <profile>",
      "d3code agent-run file-audit CUSTOMERS --profile <profile> --sample-limit 5",
      "d3code agent-run basic-check BP GET.CUSTOMER --profile <profile> --compile --confirm",
      "d3code bundle-capture --profile <profile> --account <account> --files CUSTOMERS,ORDERS --program-files BP --sample-limit 5 > d3-app-bundle.json",
      "d3code bundle-audit d3-app-bundle.json",
      "d3code bundle-code-map d3-app-bundle.json",
      "d3code bundle-code-plan d3-app-bundle.json",
      "d3code bundle-index d3-app-bundle.json",
      "d3code bundle-index-plan d3-app-bundle.json",
      "d3code bundle-data-plan d3-app-bundle.json",
      "d3code bundle-backlog d3-app-bundle.json",
      "d3code audit-db database-samples.json",
      "d3code audit-json code-samples.json",
      "d3code goal --mode audit <audit title>",
    ],
  },
  migrate: {
    id: "migrate",
    title: "D3-to-Web Migration Recipe",
    commands: [
      "d3code runbook migrate",
      "d3code workflow migrate",
      "d3code connector-strategy --profile <profile>",
      "d3code bundle-capture --profile <profile> --account <account> --files CUSTOMERS,ORDERS --program-files BP --sample-limit 5 > d3-app-bundle.json",
      "d3code agent-run file-audit CUSTOMERS --profile <profile> --sample-limit 5",
      "d3code agent-run basic-check BP GET.CUSTOMER --profile <profile> --compile --confirm",
      "d3code bundle-goal d3-app-bundle.json --artifacts-out ./migration-output",
      "d3code bundle-skill-pack d3-app-bundle.json",
      "d3code agent-run migration-slice d3-app-bundle.json --out ./migration-output",
      "d3code bundle-artifacts d3-app-bundle.json --out ./migration-output",
      "d3code webapp-check ./migration-output",
      "d3code webapp-smoke ./migration-output --record",
      "d3code bundle-refresh-evidence d3-app-bundle.json --artifacts-dir ./migration-output",
      "d3code terminal-capture --profile <profile> --out ./terminal-proof '<screen command>'",
      "d3code screen-parse ./terminal-proof/terminal-transcript.txt",
      "d3code bundle-reconciliation-plan d3-app-bundle.json --target-db <target>",
      "d3code bundle-qa-plan d3-app-bundle.json",
      "d3code bundle-readiness d3-app-bundle.json --artifacts-dir ./migration-output",
      "d3code bundle-delegate d3-app-bundle.json",
      "d3code bundle-completion-audit d3-app-bundle.json --artifacts-dir ./migration-output",
      "d3code bundle-evidence d3-app-bundle.json --artifacts-dir ./migration-output",
      "d3code goal-audit-bundle <goal-id> d3-app-bundle.json --artifacts-dir ./migration-output --apply",
      "d3code bundle-code-plan d3-app-bundle.json",
      "d3code bundle-index-plan d3-app-bundle.json",
      "d3code bundle-data-plan d3-app-bundle.json",
      "d3code bundle-backlog d3-app-bundle.json",
      "d3code audit-db database-samples.json",
      "d3code migration-plan migration-input.json",
      "d3code openapi migration-plan.json",
      "d3code webapp-skeleton migration-plan.json",
      "d3code adapter-write migration-plan.json --out ./generated",
      "d3code goal --mode migrate <migration title>",
    ],
  },
  api: {
    id: "api",
    title: "D3 REST API Recipe",
    commands: [
      "d3code runbook api",
      "d3code workflow api",
      "d3code migration-plan migration-input.json",
      "d3code openapi migration-plan.json",
      "d3code webapp-skeleton migration-plan.json",
      "d3code adapter-skeleton migration-plan.json",
      "d3code adapter-write migration-plan.json --out ./generated",
      "d3code agent-run migration-slice d3-app-bundle.json --out ./generated",
      "d3code webapp-check ./generated",
      "d3code webapp-smoke ./generated --record",
      "d3code bundle-refresh-evidence d3-app-bundle.json --artifacts-dir ./generated",
    ],
  },
  modernize: {
    id: "modernize",
    title: "D3 BASIC Modernization Recipe",
    commands: [
      "d3code runbook modernize",
      "d3code workflow modernize",
      "d3code basic-symbols BP_ITEM.txt",
      "d3code basic-lint BP_ITEM.txt",
      "d3code agent-run basic-check BP GET.CUSTOMER --profile <profile> --compile --catalog --confirm",
      "d3code code-map programs.json",
      "d3code bundle-code-plan d3-app-bundle.json",
      "d3code compile-errors compile-output.txt",
      "d3code modernization-proof --before BP_ITEM.before.txt --after BP_ITEM.txt --compile-output compile-output.txt",
      "d3code goal --mode modernize <modernization title>",
    ],
  },
  "basic-program": {
    id: "basic-program",
    title: "D3 BASIC Program Builder Recipe",
    commands: [
      "d3code rag-search 'D3 BASIC ED BASIC CATALOG program source subroutine'",
      "d3code estate --profile <profile>",
      "d3code read-item BP <PROGRAM> --profile <profile> --lossless > ./<PROGRAM>.baseline.json",
      "d3code basic-lint ./<PROGRAM>.b",
      "d3code build-basic BP <PROGRAM> --profile <profile> --body-file ./<PROGRAM>.b --baseline-file ./<PROGRAM>.baseline.json --compile --confirm",
      "d3code catalog-basic BP <PROGRAM> --profile <profile> --confirm",
      "d3code agent-run basic-check BP <PROGRAM> --profile <profile> --compile --catalog --confirm",
    ],
  },
  "dictionary-field": {
    id: "dictionary-field",
    title: "D3 Dictionary Field Builder Recipe",
    commands: [
      "d3code rag-search 'D3 dictionary attribute defining item DICT AQL conversion correlative'",
      "d3code read-dict <FILE> <FIELD> --profile <profile> --lossless > ./DICT.<FIELD>.baseline.json",
      "d3code query-aql LIST <FILE> <FIELD> --profile <profile>",
      "d3code write-dict <FILE> <FIELD> --profile <profile> --body-file ./DICT.<FIELD>.txt --baseline-file ./DICT.<FIELD>.baseline.json --confirm",
      "d3code query-aql LIST <FILE> <FIELD> --profile <profile>",
      "d3code agent-run file-audit <FILE> --profile <profile> --sample-limit 5",
    ],
  },
  "sbplus-screen": {
    id: "sbplus-screen",
    title: "SB+ Screen and Process Builder Recipe",
    commands: [
      "d3code rag-search 'SB+ input process screen definition validation F1 F3 help drivers'",
      "d3code sbplus-discover --profile <profile>",
      "d3code sbplus-screen-plan --system <system> --process <process> --kind 'input process' --file <FILE> --field <FIELD1> --field <FIELD2>",
      "d3code terminal-capture --profile <profile> --out ./sbplus-proof '<SB+ maintenance command or process name>'",
      "d3code screen-parse ./sbplus-proof/terminal-transcript.txt",
    ],
  },
  "legacy-screen": {
    id: "legacy-screen",
    title: "Legacy D3 Screen Modernization Recipe",
    commands: [
      "d3code terminal-plan --profile <profile>",
      "d3code terminal-capture --profile <profile> --out ./screen-proof '<screen command>'",
      "d3code screen-parse ./screen-proof/terminal-transcript.txt",
      "d3code screen-audit ./BP_ITEM.txt --transcript ./screen-proof/terminal-transcript.txt",
      "d3code bundle-screen-plan d3-app-bundle.json",
      "d3code bundle-ui-plan d3-app-bundle.json",
      "d3code modernization-proof --before ./before.b --after ./after.b --compile-output ./compile-output.txt",
    ],
  },
}

export function renderRecipe(id: string): string {
  const recipe = recipes[id as RecipeID]
  if (!recipe) return `Unknown recipe: ${id}. Available: ${Object.keys(recipes).join(", ")}`
  return [`# ${recipe.title}`, "", ...recipe.commands.map((command, index) => `${index + 1}. \`${command}\``), ""].join("\n")
}
