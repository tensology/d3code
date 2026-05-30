import type { BundleArtifacts, D3ApplicationBundle } from "./bundle.js"
import { createWebUiPlan } from "./ui-plan.js"

export type AccessStatus = "ready" | "review" | "missing"

export interface D3AccessGrant {
  user: string
  role: string
  resource: string
  screen: string
  access: "read" | "write-review" | "admin-review"
  status: AccessStatus
  evidence: string[]
}

export interface D3AccessPlan {
  account: string
  profile: string
  users: Array<{ id: string; name?: string; roles: string[]; status: AccessStatus; evidence: string[] }>
  grants: D3AccessGrant[]
  warnings: string[]
  commands: string[]
}

function accessForRole(role: string): D3AccessGrant["access"] {
  if (/admin|root|super|d3/i.test(role)) return "admin-review"
  if (/write|maint|operator|ops/i.test(role)) return "write-review"
  return "read"
}

function statusForAccess(access: D3AccessGrant["access"]): AccessStatus {
  return access === "read" ? "ready" : "review"
}

export function createD3AccessPlan(bundle: D3ApplicationBundle, artifacts: BundleArtifacts): D3AccessPlan {
  const uiPlan = createWebUiPlan(bundle, artifacts)
  const users = bundle.users.map((user) => ({
    id: user.id,
    name: user.name,
    roles: user.roles,
    status: user.roles.length ? "ready" as const : "review" as const,
    evidence: user.roles.length ? user.roles.map((role) => `role:${role}`) : ["roles:not-captured"],
  }))
  const grants: D3AccessGrant[] = []
  for (const user of bundle.users) {
    const roles = user.roles.length ? user.roles : ["unassigned"]
    for (const role of roles) {
      const access = accessForRole(role)
      for (const screen of uiPlan.screens) {
        grants.push({
          user: user.id,
          role,
          resource: screen.resource,
          screen: screen.id,
          access,
          status: role === "unassigned" ? "review" : statusForAccess(access),
          evidence: [`d3-user:${user.id}`, `role:${role}`, `resource:${screen.resource}`, `d3-file:${screen.d3File}`],
        })
      }
    }
  }

  return {
    account: bundle.account,
    profile: bundle.profile,
    users,
    grants,
    warnings: [
      ...(bundle.users.length ? [] : ["No users were captured; import D3/Unix users during live profile proof before enabling cockpit access controls."]),
      ...(bundle.users.some((user) => user.roles.length === 0) ? ["Some users have no captured roles; keep them read-only or disabled until roles are mapped."] : []),
      ...(grants.some((grant) => grant.access !== "read") ? ["Write/admin grants are review-only until D3 safety, lock, and rollback proof is recorded."] : []),
      ...(uiPlan.screens.length ? [] : ["No generated screens exist yet; access grants cannot be mapped to cockpit screens."]),
    ],
    commands: [
      "d3code bundle-access-plan d3-app-bundle.json",
      "d3code dashboard --bundle d3-app-bundle.json",
      "d3code setup-proof",
      "d3code live-proof --profile <profile> --run",
      "d3code safety-guard --bundle d3-app-bundle.json",
    ],
  }
}

export function renderD3AccessPlan(plan: D3AccessPlan): string {
  return [
    `# D3 Access Plan: ${plan.account}`,
    "",
    `Profile: ${plan.profile}`,
    `Users: ${plan.users.length}`,
    `Grants: ${plan.grants.length}`,
    "",
    "Users:",
    ...(plan.users.length ? plan.users.map((user) => `- [${user.status}] ${user.id}${user.name ? ` (${user.name})` : ""}: ${user.roles.join(", ") || "roles not captured"}`) : ["- none"]),
    "",
    "Grants:",
    ...(plan.grants.length ? plan.grants.map((grant) => `- [${grant.status}] ${grant.user}/${grant.role} -> ${grant.resource} (${grant.screen}): ${grant.access}`) : ["- none"]),
    "",
    "Warnings:",
    ...(plan.warnings.length ? plan.warnings.map((warning) => `- ${warning}`) : ["- none"]),
    "",
    "Commands:",
    ...plan.commands.map((command) => `- \`${command}\``),
  ].join("\n")
}
