import type { BundleArtifacts, D3ApplicationBundle } from "./bundle.js"

export interface QaCheck {
  id: string
  surface: "d3" | "api" | "browser" | "regression"
  title: string
  command: string
  evidence: string
}

export interface MigrationQaPlan {
  account: string
  profile: string
  checks: QaCheck[]
}

function check(id: string, values: Omit<QaCheck, "id">): QaCheck {
  return { id, ...values }
}

export function createMigrationQaPlan(bundle: D3ApplicationBundle, artifacts: BundleArtifacts): MigrationQaPlan {
  const checks: QaCheck[] = [
    check("profile-doctor", {
      surface: "d3",
      title: "Prove live D3 profile access",
      command: `d3code profile-doctor --profile ${bundle.profile}`,
      evidence: "WHO, VERSION, and LIST MD read-only output for the target account.",
    }),
    check("webapp-check", {
      surface: "api",
      title: "Verify generated migration scaffold",
      command: "d3code webapp-check ./migration-output",
      evidence: "Ready: yes with package, server, D3 client, browser UI, OpenAPI, migration plan, and resource files.",
    }),
    check("webapp-smoke", {
      surface: "api",
      title: "Build and smoke-test generated API scaffold",
      command: "d3code webapp-smoke ./migration-output --record",
      evidence: "TypeScript build passes and generated mock-mode API smoke tests verify /health, resource reads, write guard, and D3 record roundtrip behavior; qa-evidence.json is written for readiness.",
    }),
    check("regression", {
      surface: "regression",
      title: "Run D3 Code regression suite",
      command: "npm run regression",
      evidence: "Passing unit/CLI tests plus D3 manual scope output.",
    }),
    check("browser-health", {
      surface: "browser",
      title: "Open generated browser shell and confirm API health",
      command: "D3CODE_MOCK=1 npm start # then open http://localhost:3000/",
      evidence: "Browser shell loads, health status is ready, and resources are listed.",
    }),
  ]

  for (const resource of artifacts.migrationPlan.resources) {
    checks.push(check(`api-list-${resource.resource}`, {
      surface: "api",
      title: `List ${resource.resource} through generated API`,
      command: `curl -s http://localhost:3000/${resource.resource}`,
      evidence: `HTTP 200 response from /${resource.resource}; D3 file ${resource.file} access is mocked or backed by live D3.`,
    }))
    checks.push(check(`browser-${resource.resource}`, {
      surface: "browser",
      title: `Inspect ${resource.resource} in browser shell`,
      command: `open http://localhost:3000/ # select ${resource.resource}`,
      evidence: `Resource ${resource.resource} renders in the browser shell without console/API errors.`,
    }))
  }

  for (const program of artifacts.codeMap.programs.filter((entry) => entry.risk !== "low")) {
    checks.push(check(`code-risk-${program.program.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, {
      surface: "d3",
      title: `Verify risky BASIC behavior for ${program.program}`,
      command: "d3code bundle-code-map d3-app-bundle.json",
      evidence: `Risk ${program.risk} reviewed; lock/write/EXECUTE behavior is tested, wrapped, or documented.`,
    }))
  }

  return { account: bundle.account, profile: bundle.profile, checks }
}

export function renderMigrationQaPlan(plan: MigrationQaPlan): string {
  return [
    `# D3 Migration QA Plan: ${plan.account}`,
    "",
    `Profile: ${plan.profile}`,
    `Checks: ${plan.checks.length}`,
    "",
    ...plan.checks.flatMap((entry, index) => [
      `${index + 1}. [${entry.surface}] ${entry.title}`,
      `   Command: \`${entry.command}\``,
      `   Evidence: ${entry.evidence}`,
      "",
    ]),
  ].join("\n")
}
