import type { D3Session, SafetyMode } from "../domain/types.js"
import { assertD3Allowed } from "../core/permissions.js"
import { listD3Items } from "./items.js"

export async function readDictionaryFields(session: D3Session, file: string, safety: SafetyMode) {
  assertD3Allowed(safety, `LIST DICT ${file}`, false, session.profile.allowedAccounts, session.profile)
  // shortcut: sample 32 definitions, add explicit dictionary search before expanding large dictionaries.
  const listing = await listD3Items(session, file, { section: "dict", limit: 32 })
  const ids = listing.items.filter(id => /^[A-Za-z0-9_.:@$-]{1,100}$/.test(id))
  if (!ids.length) return { fields: [], partial: listing.mayHaveMore || listing.items.length > 0 }
  const command = `CT DICT ${file} ${ids.join(" ")} (N`
  assertD3Allowed(safety, command, false, session.profile.allowedAccounts, session.profile)
  const result = await session.run(command, 15_000)
  if ((result.exitCode !== null && result.exitCode !== 0) || result.stderr.trim()) throw new Error("Could not read dictionary field definitions.")
  const records = new Map<string, string[]>(), requested = new Set(ids)
  let attributes: string[] | undefined
  for (const line of result.stdout.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "").split(/\r\n?|\n/)) {
    const header = line.match(/^ {4}(.+?)\s*$/)?.[1]
    if (header && requested.has(header)) {
      attributes = []
      records.set(header, attributes)
      continue
    }
    const match = line.match(/^\s*(\d{3})\s?(.*)$/)
    if (attributes && match) attributes[Number(match[1]) - 1] = match[2]
  }
  if (!records.size) throw new Error("Dictionary field output could not be verified.")
  const groups = new Map<number, { id: string; heading: string; primary: boolean }[]>()
  for (const [id, attrs] of records) {
    if (!/^[ASX](?:\s|$)/i.test(attrs[0]?.trim() ?? "") || !/^[1-9]\d*$/.test(attrs[1]?.trim() ?? "") || attrs[7]?.trim()) continue
    const attribute = Number(attrs[1].trim())
    if (!Number.isSafeInteger(attribute)) continue
    const heading = (attrs[2] ?? "").replace(/[\u0000-\u001f\u007f\u00fc-\u00fe]/g, " ").trim()
    const group = groups.get(attribute) ?? []
    group.push({ id, heading: heading === "\\" ? "" : heading, primary: /^A(?:\s|$)/i.test(attrs[0].trim()) })
    groups.set(attribute, group)
  }
  const fields = [...groups].sort(([a], [b]) => a - b).map(([attribute, definitions]) => {
    definitions.sort((a, b) => a.id.localeCompare(b.id))
    const primary = definitions.filter(d => d.primary)
    const candidates = primary.length ? primary : definitions
    return { attribute, label: candidates.length === 1 ? candidates[0].heading || candidates[0].id : candidates.map(d => d.id).join(" / "), ids: definitions.map(d => d.id) }
  })
  return { fields, partial: listing.mayHaveMore || ids.length !== listing.items.length || records.size !== ids.length }
}
