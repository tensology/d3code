import { access, readFile } from "node:fs/promises"
import { join } from "node:path"

export type MvBasicReferenceStatus = "ok" | "missing" | "partial"

export interface MvBasicReferenceCheck {
  id: string
  status: MvBasicReferenceStatus
  evidence: string[]
  implication: string
}

export interface MvBasicReferenceAudit {
  root: string
  ready: boolean
  checks: MvBasicReferenceCheck[]
}

async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8")
  } catch {
    return undefined
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

function check(values: MvBasicReferenceCheck): MvBasicReferenceCheck {
  return values
}

function okWhen(condition: boolean, partialWhen: boolean): MvBasicReferenceStatus {
  if (condition) return "ok"
  return partialWhen ? "partial" : "missing"
}

export async function auditMvBasicReference(root: string): Promise<MvBasicReferenceAudit> {
  const usage = join(root, "docs", "usage")
  const connection = await readOptional(join(usage, "Connection.md"))
  const compile = await readOptional(join(usage, "Compile.md"))
  const onlineEditing = await readOptional(join(usage, "OnlineEditing.md"))
  const hashedFile = await readOptional(join(usage, "HashedFileEditing.md"))
  const debugging = await readOptional(join(usage, "Debugging.md"))
  const diagnostics = await readOptional(join(usage, "Diagnostics.md"))
  const references = await readOptional(join(usage, "References.md"))
  const completion = await readOptional(join(usage, "Completion.md"))
  const docsPresent = await exists(join(root, "README.md")) && await exists(join(root, "mkdocs.yml"))

  const checks = [
    check({
      id: "mvbasic-docs-present",
      status: docsPresent ? "ok" : "missing",
      evidence: docsPresent ? ["README.md", "mkdocs.yml", "docs/usage/*"] : ["reference/rocket-mvbasic is not complete"],
      implication: "Rocket MV BASIC docs are available as an IDE-parity reference without vendoring behavior into D3 Code.",
    }),
    check({
      id: "connection-model",
      status: okWhen(Boolean(connection?.includes('"db"') && connection.includes("host") && connection.includes("account")), Boolean(connection)),
      evidence: ["Connection.md", "host/user/password/account/dataSource/port settings"],
      implication: "D3 Code should keep profile/account credentials as keychain/env references and expose one connected account per session.",
    }),
    check({
      id: "compile-catalog-model",
      status: okWhen(Boolean(compile?.includes("Compile and catalog") && compile.includes("catalog")), Boolean(compile)),
      evidence: ["Compile.md", "BASIC build task", "catalog option", "compile output in terminal"],
      implication: "Compile/catalog in D3 Code must be a guarded operator loop with transcript, changed items, and rollback proof.",
    }),
    check({
      id: "online-editing-locks",
      status: okWhen(Boolean(onlineEditing?.includes("READU") && onlineEditing.includes("WRITE lock")), Boolean(onlineEditing)),
      evidence: ["OnlineEditing.md", "READU lock", "WRITE lock", "server-side save synchronization"],
      implication: "Virtual D3 item editing needs lock awareness, conflict warnings, and write journals before production mutation.",
    }),
    check({
      id: "hashed-file-cockpit",
      status: okWhen(Boolean(hashedFile?.includes("Fetch Field Names from Dictionary") && hashedFile.includes("Update Record")), Boolean(hashedFile)),
      evidence: ["HashedFileEditing.md", "record ID", "dictionary field names", "exclusive lock", "update/delete/release"],
      implication: "The cockpit should look like a database workbench for D3 files, dictionaries, records, locks, and relationships, not like a migration-only SQL tool.",
    }),
    check({
      id: "debugger-boundaries",
      status: okWhen(Boolean(debugging?.includes("Debugging") && debugging.includes("subroutine")), Boolean(debugging)),
      evidence: ["Debugging.md", "launch task", "breakpoints", "subroutine limitations"],
      implication: "D3 Code can plan debugging workflows, but live debugger claims need a separate adapter proof and cannot be inferred from UOPY or PTY alone.",
    }),
    check({
      id: "language-intelligence",
      status: okWhen(Boolean((diagnostics && references && completion) && diagnostics.includes("Diagnostics") && references.includes("References") && completion.includes("Completion")), Boolean(diagnostics || references || completion)),
      evidence: ["Diagnostics.md", "References.md", "Completion.md"],
      implication: "MVBasic language features should inform D3 BASIC symbol extraction, references, completion, diagnostics, and modernization subagents.",
    }),
  ]

  return {
    root,
    ready: checks.every((entry) => entry.status === "ok"),
    checks,
  }
}

export function renderMvBasicReferenceAudit(report: MvBasicReferenceAudit): string {
  return [
    "# Rocket MV BASIC Reference Audit",
    "",
    `Root: ${report.root}`,
    `Ready: ${report.ready ? "yes" : "no"}`,
    "",
    ...report.checks.flatMap((entry) => [
      `- [${entry.status}] ${entry.id}`,
      `  Evidence: ${entry.evidence.join("; ")}`,
      `  Implication: ${entry.implication}`,
    ]),
  ].join("\n")
}
