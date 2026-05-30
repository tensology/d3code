import type { D3Session } from "../domain/types.js"
import type { D3ApplicationBundle } from "../app/bundle.js"
import { dictionaryItemsFromIds, parseCtItem, parseIndexNames, parseListOutputIds } from "./parsers.js"

export interface CaptureOptions {
  profile: string
  account: string
  files?: string[]
  programFiles?: string[]
  sampleLimit?: number
  captureIndexes?: boolean
}

export async function captureBundleFromSession(session: D3Session, options: CaptureOptions): Promise<D3ApplicationBundle> {
  const files = options.files?.length ? options.files : await captureFileNames(session)
  const programFiles = new Set(options.programFiles ?? ["BP"])
  const sampleLimit = options.sampleLimit ?? 3
  const bundle: D3ApplicationBundle = {
    account: options.account,
    profile: options.profile,
    users: [],
    files: [],
    programs: [],
  }

  for (const file of files) {
    const dictionaryIDs = await captureIDs(session, `LIST DICT ${file} (N`)
    const recordIDs = await captureIDs(session, `SELECT ${file} SAMPLE ${sampleLimit}`)
    const observedIndexes = options.captureIndexes === false ? [] : await captureIndexes(session, file)
    const records = []
    for (const id of recordIDs.slice(0, sampleLimit)) {
      const result = await session.run(`CT ${file} ${id}`)
      records.push({ id, raw: parseCtItem(result.stdout || result.stderr) })
    }
    bundle.files.push({
      name: file,
      suggestedResource: file.toLowerCase(),
      dictionary: dictionaryItemsFromIds(dictionaryIDs),
      records,
      observedIndexes,
    })
  }

  for (const programFile of programFiles) {
    const programIDs = await captureIDs(session, `SELECT ${programFile} SAMPLE ${sampleLimit}`)
    for (const item of programIDs.slice(0, sampleLimit)) {
      const result = await session.run(`CT ${programFile} ${item}`)
      bundle.programs.push({ file: programFile, item, source: parseCtItem(result.stdout || result.stderr) })
    }
  }

  return bundle
}

async function captureFileNames(session: D3Session): Promise<string[]> {
  const result = await session.run('LIST MD WITH A1 = "D" A0 (N')
  return parseListOutputIds(result.stdout || result.stderr)
}

async function captureIDs(session: D3Session, command: string): Promise<string[]> {
  const result = await session.run(command)
  return parseListOutputIds(result.stdout || result.stderr)
}

async function captureIndexes(session: D3Session, file: string): Promise<string[]> {
  try {
    const result = await session.run(`LIST-INDEX ${file}`)
    return parseIndexNames(result.stdout || result.stderr)
  } catch {
    return []
  }
}
