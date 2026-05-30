import type { D3CodeConfig } from "../config/config.js"
import type { SafetyMode } from "../domain/types.js"
import type { D3CodeModeID } from "../skills/modes.js"
import { providers } from "./catalog.js"

export type ModelBias = "quality" | "balanced" | "speed" | "local"

export interface ModelRoute {
  role: string
  recommended: string
  fallback: string
  rationale: string
  safety: SafetyMode
  requiredSecret: string
}

export interface ModelRoutingPlan {
  mode: string
  bias: ModelBias
  configuredDefault: string
  configuredSecrets: string[]
  ready: boolean
  routes: ModelRoute[]
}

const routeSets: Record<D3CodeModeID, Array<Omit<ModelRoute, "requiredSecret">>> = {
  chat: [
    route("interactive terminal assistant", "openai/gpt-5-mini", "anthropic/claude-haiku-4-5", "Fast iteration for shell, D3 reads, and ordinary explanation.", "ask"),
    route("deep D3 reasoning", "openai/gpt-5", "anthropic/claude-sonnet-4-5", "Use a stronger model when code, dictionaries, and migration artifacts must be held together.", "ask"),
  ],
  plan: [
    route("spec and GSD plan authoring", "openai/gpt-5", "anthropic/claude-sonnet-4-5", "Planning benefits from long-horizon reasoning and careful tradeoff handling.", "plan"),
    route("requirements/doc polish", "anthropic/claude-sonnet-4-5", "openai/gpt-5-mini", "Good fit for PRD/ADR/runbook drafting once facts are gathered.", "plan"),
  ],
  gsd: [
    route("goal execution lead", "openai/gpt-5", "anthropic/claude-sonnet-4-5", "Coordinates phase evidence, blockers, and verification gates.", "ask"),
    route("bounded subagent task", "openai/gpt-5-mini", "anthropic/claude-haiku-4-5", "Cheaper model for isolated file-audit, search, and checklist tasks.", "plan"),
  ],
  migrate: [
    route("D3-to-web architect", "openai/gpt-5", "anthropic/claude-sonnet-4-5", "Migration mode needs cross-file reasoning across D3 data, BASIC, APIs, QA, and rollout risk.", "ask"),
    route("web/API scaffold implementer", "openai/gpt-5-mini", "openrouter/anthropic/claude-sonnet-4.5", "Implementation loops can use a balanced model when the execution plan is already explicit.", "ask"),
    route("QA/browser proof runner", "anthropic/claude-haiku-4-5", "openai/gpt-5-mini", "Smoke checks and evidence summaries should be fast and bounded.", "plan"),
  ],
  audit: [
    route("D3 database/code auditor", "openai/gpt-5", "anthropic/claude-sonnet-4-5", "Audit mode needs careful ranking of dictionary, index, data-shape, and BASIC risks.", "plan"),
    route("large-output compactor", "openai/gpt-5-nano", "local/local/default", "Use a small model or local endpoint for noisy command summaries.", "plan"),
  ],
  api: [
    route("REST contract designer", "openai/gpt-5", "anthropic/claude-sonnet-4-5", "OpenAPI and D3 dictionary mapping need correctness over raw speed.", "ask"),
    route("adapter/test writer", "openai/gpt-5-mini", "openrouter/openai/gpt-5", "Generated TypeScript and tests are a balanced-model task after the contract is set.", "ask"),
  ],
  modernize: [
    route("BASIC modernization reviewer", "openai/gpt-5", "anthropic/claude-sonnet-4-5", "Behavior-preserving refactors need stronger reasoning over side effects.", "ask"),
    route("lint/compile fix loop", "openai/gpt-5-mini", "anthropic/claude-haiku-4-5", "Tight error-fix loops can use a faster model with compile evidence.", "ask"),
  ],
  qa: [
    route("release readiness judge", "openai/gpt-5", "anthropic/claude-sonnet-4-5", "Completion audits should prioritize evidence and avoid false readiness claims.", "plan"),
    route("smoke evidence summarizer", "openai/gpt-5-mini", "anthropic/claude-haiku-4-5", "Summarizing test/browser/API output is bounded and speed-sensitive.", "plan"),
  ],
}

function route(role: string, recommended: string, fallback: string, rationale: string, safety: SafetyMode): Omit<ModelRoute, "requiredSecret"> {
  return { role, recommended, fallback, rationale, safety }
}

function providerOf(modelRef: string): string {
  return modelRef.split("/")[0] ?? ""
}

function secretFor(modelRef: string): string {
  const provider = providers.find((item) => item.id === providerOf(modelRef))
  return provider?.env.join("|") ?? "unknown"
}

function score(route: Omit<ModelRoute, "requiredSecret">, bias: ModelBias): Omit<ModelRoute, "requiredSecret"> {
  if (bias === "speed" && !route.role.match(/architect|judge|reviewer|designer|lead/)) {
    return { ...route, recommended: route.fallback, fallback: route.recommended, rationale: `${route.rationale} Speed bias swaps to the lower-latency fallback first.` }
  }
  if (bias === "local") {
    return { ...route, recommended: "local/local/default", fallback: route.recommended, rationale: `${route.rationale} Local bias prefers an OpenAI-compatible local endpoint when configured.` }
  }
  return route
}

export function createModelRoutingPlan(config: D3CodeConfig, mode: string, bias: ModelBias = "balanced"): ModelRoutingPlan {
  const modeID = (mode in routeSets ? mode : "chat") as D3CodeModeID
  const configuredSecrets = Object.keys(config.modelSecrets)
  const routes = routeSets[modeID].map((entry) => {
    const selected = bias === "quality" ? entry : score(entry, bias)
    return { ...selected, requiredSecret: secretFor(selected.recommended) }
  })
  return {
    mode: modeID,
    bias,
    configuredDefault: config.defaultModel,
    configuredSecrets,
    ready: routes.every((entry) => configuredSecrets.includes(providerOf(entry.recommended)) || providerOf(entry.recommended) === "local"),
    routes,
  }
}

export function renderModelRoutingPlan(plan: ModelRoutingPlan): string {
  return [
    `# D3 Model Routing Plan: ${plan.mode}`,
    "",
    `Bias: ${plan.bias}`,
    `Default: ${plan.configuredDefault}`,
    `Configured secrets: ${plan.configuredSecrets.length ? plan.configuredSecrets.join(", ") : "none"}`,
    `Ready: ${plan.ready ? "yes" : "no"}`,
    "",
    ...plan.routes.flatMap((route, index) => [
      `${index + 1}. ${route.role}`,
      `   Recommended: ${route.recommended}`,
      `   Fallback: ${route.fallback}`,
      `   Safety: ${route.safety}`,
      `   Required secret: ${route.requiredSecret}`,
      `   Rationale: ${route.rationale}`,
      "",
    ]),
  ].join("\n")
}
