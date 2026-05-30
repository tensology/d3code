import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { createBundleArtifacts, parseBundle } from "../app/bundle.js"
import { writeBundleArtifacts } from "../app/write.js"
import { selectProfile, type D3CodeConfig } from "../config/config.js"
import { captureBundleFromSession } from "../capture/capture.js"
import { createD3Session } from "../d3/adapter.js"
import { runToolByName } from "../tools/runner.js"
import type { CommandResult, RuntimeState } from "./commands.js"

function words(input: string): string[] {
  return input.match(/"[^"]+"|'[^']+'|\S+/g)?.map((part) => part.replace(/^['"]|['"]$/g, "")) ?? []
}

function valueAfter(tokens: string[], labels: string[]): string | undefined {
  const index = tokens.findIndex((token) => labels.includes(token.toLowerCase()))
  return index === -1 ? undefined : tokens[index + 1]
}

function csv(value: string | undefined): string[] | undefined {
  const items = value?.split(",").map((item) => item.trim()).filter(Boolean)
  return items?.length ? items : undefined
}

function isAppBuildIntent(input: string): boolean {
  return /\b(build|create|generate|scaffold|start)\b/i.test(input) && /\b(app|application|screen|screens|ui|frontend|web)\b/i.test(input)
}

function outputDir(tokens: string[]): string {
  return valueAfter(tokens, ["to", "out", "output", "--out"]) ?? "./d3code-app"
}

async function buildFromBundle(tokens: string[], config: D3CodeConfig): Promise<CommandResult | undefined> {
  const bundlePath = valueAfter(tokens, ["bundle", "bundle-file"]) ?? tokens.find((token) => token.endsWith(".json"))
  if (!bundlePath || !bundlePath.endsWith(".json")) return undefined
  const outDir = outputDir(tokens)
  const bundle = parseBundle(JSON.parse(await readFile(bundlePath, "utf8")))
  const artifacts = createBundleArtifacts(bundle)
  const written = await writeBundleArtifacts(outDir, artifacts, bundle)
  return {
    output: [
      `D3 application slice generated from ${bundlePath}`,
      `Account: ${bundle.account}`,
      `Profile: ${bundle.profile}`,
      `Output: ${outDir}`,
      `Files written: ${written.written.length}`,
      "",
      "What you have now:",
      "- runnable Node/TypeScript app/API scaffold",
      "- OpenAPI contract and D3 adapter boundary",
      "- mock D3 data from the bundle",
      "- generated UI plan, access plan, dashboard/proof data, and smoke tests",
      "",
      "Next proof:",
      `- d3code webapp-check ${outDir}`,
      `- d3code webapp-smoke ${outDir} --record`,
      `- d3code bundle-readiness ${bundlePath} --artifacts-dir ${outDir}`,
    ].join("\n"),
  }
}

async function buildFromLiveProfile(input: string, tokens: string[], config: D3CodeConfig, state: RuntimeState): Promise<CommandResult> {
  const profile = selectProfile(config, state.profile)
  if (!profile) {
    return {
      output: [
        "No D3 profile is selected, so I cannot inspect a live D3 account yet.",
        "",
        "Run `d3code` for first-run setup, or configure one explicitly:",
        "d3code setup",
        "d3code profile-add-local --name prod --account DM --entry \"d3\" --prompt \">\" --session persistent",
        "d3code profile-add-ssh --name prod --host <host> --user <user> --account DM --entry \"d3\" --prompt \">\" --session persistent",
      ].join("\n"),
    }
  }

  const outDir = outputDir(tokens)
  const account = valueAfter(tokens, ["account"]) ?? profile.account ?? "unknown"
  const files = csv(valueAfter(tokens, ["file", "files"]))
  const programFiles = csv(valueAfter(tokens, ["program", "programs", "program-file", "program-files"])) ?? ["BP"]
  const sampleLimit = Number(valueAfter(tokens, ["sample", "samples", "limit"]) ?? "3")

  const session = createD3Session(profile)
  try {
    const bundle = await captureBundleFromSession(session, {
      profile: profile.name,
      account,
      files,
      programFiles,
      sampleLimit,
      captureIndexes: !/\b(no indexes|skip indexes|without indexes)\b/i.test(input),
    })
    await mkdir(outDir, { recursive: true })
    const bundlePath = join(outDir, "d3-app-bundle.json")
    await writeFile(bundlePath, `${JSON.stringify(bundle, null, 2)}\n`)
    const artifacts = createBundleArtifacts(bundle)
    const written = await writeBundleArtifacts(outDir, artifacts, bundle)
    return {
      output: [
        "D3 application slice generated from the live profile.",
        `Profile: ${profile.name}`,
        `Account: ${account}`,
        `Captured files: ${bundle.files.map((file) => file.name).join(", ") || "none"}`,
        `Captured programs: ${bundle.programs.map((program) => `${program.file}/${program.item}`).join(", ") || "none"}`,
        `Bundle: ${bundlePath}`,
        `Output: ${outDir}`,
        `Files written: ${written.written.length}`,
        "",
        "Next proof:",
        `- d3code webapp-check ${outDir}`,
        `- d3code webapp-smoke ${outDir} --record`,
        `- d3code bundle-readiness ${bundlePath} --artifacts-dir ${outDir}`,
      ].join("\n"),
    }
  } finally {
    await session.close()
  }
}

async function handleReadIntent(input: string, tokens: string[], config: D3CodeConfig, state: RuntimeState): Promise<CommandResult | undefined> {
  if (/\b(list|show|pull|get)\b.*\bfiles\b/i.test(input)) {
    const output = await runToolByName(config, { name: "d3_list_files", safety: state.safety, profile: state.profile })
    return { output: output.compact }
  }
  if (/\blocks\b/i.test(input)) {
    const output = await runToolByName(config, { name: "d3_locks", safety: state.safety, profile: state.profile })
    return { output: output.compact }
  }
  const readIndex = tokens.findIndex((token) => /^(read|pull|get|show)$/i.test(token))
  const fromIndex = tokens.findIndex((token) => /^from$/i.test(token))
  if (readIndex !== -1 && fromIndex !== -1 && tokens[fromIndex + 1] && tokens[readIndex + 1]) {
    const output = await runToolByName(config, {
      name: /\bdict|dictionary\b/i.test(input) ? "d3_read_dict" : "d3_read_item",
      input: { file: tokens[fromIndex + 1], item: tokens[readIndex + 1] },
      safety: state.safety,
      profile: state.profile,
    })
    return { output: output.compact }
  }
  return undefined
}

export async function handleNaturalIntent(input: string, config: D3CodeConfig, state: RuntimeState): Promise<CommandResult | undefined> {
  const trimmed = input.trim()
  if (!trimmed || trimmed.startsWith("/")) return undefined
  const tokens = words(trimmed)

  if (isAppBuildIntent(trimmed)) {
    return await buildFromBundle(tokens, config) ?? await buildFromLiveProfile(trimmed, tokens, config, state)
  }

  return handleReadIntent(trimmed, tokens, config, state)
}
