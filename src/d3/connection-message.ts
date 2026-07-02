import type { D3CommandResult } from "../domain/types.js"

export function humanD3SessionError(stdout = "", stderr = ""): string | undefined {
  const body = `${stdout}\n${stderr}`
  if (/Virtual Machine.*is not running/i.test(body)) {
    return [
      "D3 virtual machine is not running on the server.",
      "",
      "SSH reached the host, but Rocket D3 (pick0:LINUX) is stopped.",
      "On Crystal Logic hosts, start or restart the pick0 service:",
      "  systemctl enable --now d3_pick0.service   # only when D3 is not running",
      "  systemctl stop d3_pick0.service && systemctl start d3_pick0.service   # restart",
      "",
      "Then retry from this IDE.",
    ].join("\n")
  }
  if (/send:\s*spawn id.*not open/i.test(body)) {
    return [
      "The D3 SSH session closed before the command finished.",
      "",
      "This often happens when the D3 virtual machine is stopped or the connection drops.",
      "Confirm D3 is running on the server, then send the command again.",
    ].join("\n")
  }
  if (/Connection.*closed/i.test(body) && /not running|closed/i.test(body)) {
    return [
      "Connection to the D3 host closed.",
      "",
      "Check that the D3 virtual machine is running and that profile SSH settings are correct.",
    ].join("\n")
  }
  return undefined
}

function stripInternalCommandNoise(message: string): string {
  return message
    .replace(/expect\s+-c\s+[\s\S]*/i, "SSH D3 login")
    .replace(/\s{2,}/g, " ")
    .trim()
}

export function humanizeD3ConnectError(message: string, profile?: { type?: string; host?: string; name?: string }): string {
  const cleaned = stripInternalCommandNoise(message)
  if (/Command timed out after/i.test(cleaned)) {
    const host = profile?.host ? ` (${profile.host})` : ""
    return [
      `D3 connection timed out${host}.`,
      "",
      "The IDE opens a fresh SSH session to list account files. That login did not finish in time.",
      "Check that D3 is running, the profile SSH settings are correct, and startup input matches your login prompts.",
    ].join("\n")
  }
  if (/Timed out waiting for D3 login prompt/i.test(cleaned)) {
    return [
      "D3 login prompts did not match the profile startup input.",
      "",
      "Edit the profile and set startup input for each prompt (user id, password, master dictionary).",
    ].join("\n")
  }
  if (/SSH profiles require host and username/i.test(cleaned)) {
    return cleaned
  }
  if (/expect\s+-c/i.test(message) || /spawn ssh/i.test(message)) {
    return "Could not complete the SSH D3 connection. Check the profile settings and that D3 is running on the server."
  }
  return cleaned.length > 240 ? `${cleaned.slice(0, 237)}…` : cleaned
}

export function isD3CommandResult(value: unknown): value is D3CommandResult {
  return Boolean(value && typeof value === "object" && "stdout" in value && "stderr" in value && "command" in value)
}

export function formatD3ToolResultForDisplay(result: { compact: string; raw: unknown }): string {
  if (isD3CommandResult(result.raw)) {
    const hint = humanD3SessionError(result.raw.stdout, result.raw.stderr)
    if (hint) return hint
  }
  return result.compact
}
