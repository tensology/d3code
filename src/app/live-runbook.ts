import type { BundleArtifacts, D3ApplicationBundle } from "./bundle.js"

export interface LiveOperatorRunbook {
  account: string
  profile: string
  liveProofDir: string
  assumptions: string[]
  phases: Array<{
    id: string
    title: string
    commands: string[]
    evidence: string[]
  }>
}

export interface LiveProofDefaults {
  liveProofDir: string
  firstFile: string
  screenCommand: string
  basicFile: string
  basicItem: string
}

export function createLiveProofDefaults(bundle: D3ApplicationBundle, artifacts: BundleArtifacts): LiveProofDefaults {
  const firstResource = artifacts.migrationPlan.resources[0]
  const firstFile = firstResource?.file ?? bundle.files[0]?.name ?? "<file>"
  const firstProgram = bundle.programs[0]
  const screenCommand = firstProgram ? `RUN ${firstProgram.file} ${firstProgram.item}` : `LIST ${firstFile}`
  return {
    liveProofDir: "./live-proof",
    firstFile,
    screenCommand,
    basicFile: firstProgram?.file ?? firstFile,
    basicItem: firstProgram?.item ?? "<item>",
  }
}

export function createLiveOperatorRunbook(bundle: D3ApplicationBundle, artifacts: BundleArtifacts): LiveOperatorRunbook {
  const defaults = createLiveProofDefaults(bundle, artifacts)
  const firstProgram = bundle.programs[0]

  return {
    account: bundle.account,
    profile: bundle.profile,
    liveProofDir: defaults.liveProofDir,
    assumptions: [
      "Run this only on the intended Rocket D3 Unix account or a disposable clone.",
      "Keep generated mutation endpoints disabled until lock, rollback, and live-account proof are recorded.",
      "Record outputs into the active GSD goal before treating any migration slice as complete.",
    ],
    phases: [
      {
        id: "setup",
        title: "Configure model and D3 profile",
        commands: [
          "d3code setup-proof",
          `d3code profile-add-local --name ${bundle.profile} --account ${bundle.account} --entry "d3" --allowed-accounts ${bundle.account}`,
          `d3code profile-add-ssh --name ${bundle.profile} --host <host> --user <user> --account ${bundle.account} --entry "d3" --allowed-accounts ${bundle.account}`,
        ],
        evidence: ["setup-proof ready or named missing actions", "profile stores no plaintext secrets", "one active D3 account is pinned"],
      },
      {
        id: "live-d3-proof",
        title: "Prove the D3 profile and account",
        commands: [
          `d3code live-proof-init ${defaults.liveProofDir} --profile ${bundle.profile} --account ${bundle.account} --screen-command '${defaults.screenCommand}' --basic-file ${defaults.basicFile} --basic-item ${defaults.basicItem}`,
          `d3code profile-doctor --profile ${bundle.profile} --json > ${defaults.liveProofDir}/profile-doctor.json`,
          `d3code live-proof --profile ${bundle.profile} --run --goal <goal-id> --phase verify`,
        ],
        evidence: ["live-proof/README.md", "live-proof-manifest.json pins profile/account/screen/disposable item", "profile-doctor.json", "WHO output matches expected account", "VERSION identifies Rocket D3 10.3-compatible runtime", "LIST MD succeeds read-only"],
      },
      {
        id: "terminal-screen-proof",
        title: "Capture PowerTerm-style terminal behavior",
        commands: [
          `d3code terminal-capture --profile ${bundle.profile} --out ${defaults.liveProofDir} '${defaults.screenCommand}'`,
          `d3code screen-parse ${defaults.liveProofDir}/terminal-transcript.txt`,
          `d3code live-proof-check ${defaults.liveProofDir}`,
          `d3code product-audit --live-proof-dir ${defaults.liveProofDir} --allow-incomplete`,
        ],
        evidence: ["live-proof-manifest.json matches collected artifacts", "terminal-transcript.txt", "screen-buffer.json/md", "operator-notes.md", "compile-catalog-transcript.txt", "rollback.md", "live-proof-check Ready: yes"],
      },
      {
        id: "data-code-proof",
        title: "Run D3 data and BASIC audit loops",
        commands: [
          `d3code agent-run file-audit ${defaults.firstFile} --profile ${bundle.profile} --sample-limit 5`,
          firstProgram ? `d3code agent-run basic-check ${firstProgram.file} ${firstProgram.item} --profile ${bundle.profile} --compile --catalog --confirm` : "d3code bundle-code-plan d3-app-bundle.json",
          "d3code bundle-data-plan d3-app-bundle.json",
          "d3code bundle-index-plan d3-app-bundle.json",
        ],
        evidence: ["dictionary validation", "sampled multivalue/subvalue shape", "LIST-INDEX reconciliation", "compile/catalog transcript or explicit live-D3 gap"],
      },
      {
        id: "generated-qa-proof",
        title: "Prove generated API/UI artifacts",
        commands: [
          "d3code webapp-check ./migration-output",
          "d3code webapp-smoke ./migration-output --record",
          "d3code bundle-refresh-evidence d3-app-bundle.json --artifacts-dir ./migration-output",
          "d3code bundle-release-report d3-app-bundle.json --artifacts-dir ./migration-output",
          "npm run regression",
        ],
        evidence: ["qa-evidence.json/md", "proof-data.json", "completion-audit.md", "release-report.md", "regression output"],
      },
      {
        id: "goal-audit",
        title: "Attach and audit GSD goal evidence",
        commands: [
          "d3code bundle-evidence d3-app-bundle.json --artifacts-dir ./migration-output",
          "d3code goal-audit-bundle <goal-id> d3-app-bundle.json --artifacts-dir ./migration-output --apply",
          "d3code goal-verify <goal-id>",
        ],
        evidence: ["capture/audit/map/api/verify phases have recorded evidence", "remaining gaps are explicit", "completion audit is not greenwashed"],
      },
    ],
  }
}

export function renderLiveOperatorRunbook(runbook: LiveOperatorRunbook): string {
  return [
    `# D3 Live Operator Runbook: ${runbook.account}`,
    "",
    `Profile: ${runbook.profile}`,
    "",
    "## Assumptions",
    ...runbook.assumptions.map((assumption) => `- ${assumption}`),
    "",
    ...runbook.phases.flatMap((phase, index) => [
      `## ${index + 1}. ${phase.title}`,
      "",
      `Phase: ${phase.id}`,
      "",
      "Commands:",
      ...phase.commands.map((command) => `- \`${command}\``),
      "",
      "Evidence:",
      ...phase.evidence.map((evidence) => `- ${evidence}`),
      "",
    ]),
  ].join("\n")
}
