import type { DictionaryItem } from "../audit/dictionary.js"

export function parseListOutputIds(output: string): string[] {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(LIST|SELECT|SORT|PAGE\b|>)/i.test(line))
    .filter((line) => !/^\d+\s+(items?|records?)\s+listed\.?$/i.test(line))
    .map((line) => line.split(/\s+/)[0]!)
    .filter((id) => !["ID", "ITEM", "ITEM-ID"].includes(id.toUpperCase()))
}

export function parseCtItem(output: string): string {
  const lines = output.split(/\r?\n/)
  const body = lines.filter((line) => !/^(\s*$|>|CT\b|Item\b|PAGE\b)/i.test(line)).join("\n").trim()
  return body || output.trim()
}

export function parseIndexNames(output: string): string[] {
  const normalized = output.trim()
  if (!normalized || /(not\s+found|no\s+indexes?|invalid\s+command|unknown\s+command|not\s+supported)/i.test(normalized)) return []
  return [...new Set(normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(LIST-?INDEX|INDEXES?|FILE\b|PAGE\b|>)/i.test(line))
    .filter((line) => !/^\d+\s+(indexes?|items?|records?)\s+(listed|found)\.?$/i.test(line))
    .map((line) => line.split(/\s+/)[0]!)
    .map((id) => id.replace(/[,:;]$/, ""))
    .filter((id) => id.length > 0)
    .filter((id) => !["INDEX", "INDEX.NAME", "TYPE", "FILE"].includes(id.toUpperCase())))]
}

export function dictionaryItemsFromIds(ids: string[]): DictionaryItem[] {
  return ids.map((id) => ({ id }))
}

export function parseDictionaryItem(id: string, raw: string): DictionaryItem {
  const body = parseCtItem(raw)
  let attrs: string[]
  if (body.includes("\u00fe")) {
    attrs = body.split("\u00fe")
  } else {
    const numbered: string[] = []
    const sequential: string[] = []
    for (const line of body.split(/\r?\n/)) {
      const match = line.match(/^\s*(\d{1,3})\s+(.*)$/)
      if (match) numbered[Number(match[1]) - 1] = match[2]!.trim()
      else if (line.trim()) sequential.push(line.trim())
    }
    attrs = numbered.some((value) => value !== undefined) ? numbered : sequential
  }
  const attribute = attrs[1] && /^-?\d+$/.test(attrs[1]) ? Number(attrs[1]) : undefined
  return {
    id,
    type: attrs[0],
    attribute,
    heading: attrs[2],
    conversion: attrs[6],
    raw: body,
  }
}
