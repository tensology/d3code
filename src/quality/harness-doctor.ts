import type { ProfileDoctorReport } from "../d3/profile-doctor.js"
import type { ModelProofReport } from "../providers/proof.js"
import type { RagIndexStatus } from "../rag/reference-rag.js"
import type { ReferenceSkillAuditReport } from "../skills/reference-audit.js"
import type { SkillCoverageReport } from "../skills/coverage.js"
import type { D3CodeConfig } from "../config/config.js"

export type HarnessDoctorGateStatus = "ok" | "action" | "missing"

export interface HarnessDoctorGate {
  id: string
  status: HarnessDoctorGateStatus
  evidence: string[]
  next: string
}

export interface HarnessDoctorReport {
  ready: boolean
  defaultModel: string
  profile?: string
  gates: HarnessDoctorGate[]
}

export interface HarnessDoctorInputs {
  modelProof: ModelProofReport
  ragStatus: RagIndexStatus
  referenceAudit: ReferenceSkillAuditReport
  skillCoverage: SkillCoverageReport
  profileDoctor?: ProfileDoctorReport
  hermesStatus?: {
    enabled?: boolean
    ready: boolean
    eccRoot?: string
    adapted?: number
    present?: number
    adaptedSkills?: number
    presentSkills?: number
    items?: unknown[]
  }
}

function gate(id: string, status: HarnessDoctorGateStatus, evidence: string[], next: string): HarnessDoctorGate {
  return { id, status, evidence, next }
}

function statusFromReady(ready: boolean): HarnessDoctorGateStatus {
  return ready ? "ok" : "action"
}

export async function createHarnessDoctorReport(config: D3CodeConfig, inputs: HarnessDoctorInputs): Promise<HarnessDoctorReport> {
  const gates: HarnessDoctorGate[] = []
  gates.push(gate(
    "model-proof",
    statusFromReady(inputs.modelProof.ready),
    [
      `default:${inputs.modelProof.defaultModel}`,
      ...inputs.modelProof.items.slice(0, 5).map((item) => `${item.id}:${item.status}:${item.evidence.join("|")}`),
    ],
    inputs.modelProof.ready ? "Model/provider configuration is ready." : "Run `d3code model-proof --json` and configure the missing default provider.",
  ))

  if (inputs.profileDoctor) {
    gates.push(gate(
      "profile-doctor",
      statusFromReady(inputs.profileDoctor.ready),
      [
        `profile:${inputs.profileDoctor.profile}`,
        `account:${inputs.profileDoctor.account ?? "unknown"}`,
        ...inputs.profileDoctor.checks.map((check) => `${check.name}:${check.ok ? "ok" : "fail"}`),
      ],
      inputs.profileDoctor.ready ? "Profile can reach D3 with read-only checks." : "Run `d3code profile-doctor --profile <name>` and fix the failing D3 profile checks.",
    ))
  } else {
    gates.push(gate(
      "profile-doctor",
      config.profiles.length > 0 ? "action" : "missing",
      [`profiles:${config.profiles.length}`],
      "Pass `--profile <name>` to harness-doctor for live read-only D3 checks.",
    ))
  }

  gates.push(gate(
    "rag-status",
    statusFromReady(inputs.ragStatus.ready),
    [`chunks:${inputs.ragStatus.chunks}`, `sources:${inputs.ragStatus.sources.length}`, `built:${inputs.ragStatus.builtAt ?? "not-built"}`],
    inputs.ragStatus.ready ? "Reference RAG index is available." : "Run `d3code rag-build` before D3 reference-heavy work.",
  ))

  gates.push(gate(
    "reference-audit",
    statusFromReady(inputs.referenceAudit.ready),
    [`root:${inputs.referenceAudit.root}`, `total:${inputs.referenceAudit.total}`, `unmapped:${inputs.referenceAudit.items.filter((item) => item.status === "unmapped").length}`],
    inputs.referenceAudit.ready ? "Reference skills are mapped or explicitly out of scope." : "Run `d3code reference-audit <reference-dir>` and map or exclude unmapped skills.",
  ))

  gates.push(gate(
    "skill-coverage",
    statusFromReady(inputs.skillCoverage.ready),
    [`items:${inputs.skillCoverage.items.length}`, `missing:${inputs.skillCoverage.items.filter((item) => !item.covered).length}`],
    inputs.skillCoverage.ready ? "Baked skill coverage gates are satisfied." : "Run `d3code skill-coverage` and wire missing skills to modes/commands.",
  ))

  if (inputs.hermesStatus) {
    const adapted = inputs.hermesStatus.adapted ?? inputs.hermesStatus.adaptedSkills ?? 0
    const present = inputs.hermesStatus.present ?? inputs.hermesStatus.presentSkills ?? 0
    gates.push(gate(
      "hermes-status",
      statusFromReady(inputs.hermesStatus.ready),
      [`enabled:${inputs.hermesStatus.enabled === false ? "no" : "yes"}`, `ecc-root:${inputs.hermesStatus.eccRoot ?? "none"}`, `present:${present}/${adapted}`],
      inputs.hermesStatus.ready ? "Hermes/ECC bridge is ready." : "Run `d3code hermes-status` and configure `--ecc-root` if you want ECC/Hermes references.",
    ))
  }

  return {
    ready: gates.every((item) => item.status === "ok"),
    defaultModel: config.defaultModel,
    profile: inputs.profileDoctor?.profile,
    gates,
  }
}

export function renderHarnessDoctorReport(report: HarnessDoctorReport): string {
  return [
    "# D3Code Harness Doctor",
    "",
    `Ready: ${report.ready ? "yes" : "no"}`,
    `Default model: ${report.defaultModel}`,
    ...(report.profile ? [`Profile: ${report.profile}`] : []),
    "",
    ...report.gates.map((entry) => [
      `- [${entry.status}] ${entry.id}`,
      `  evidence: ${entry.evidence.join("; ")}`,
      `  next: ${entry.next}`,
    ].join("\n")),
    "",
  ].join("\n")
}
