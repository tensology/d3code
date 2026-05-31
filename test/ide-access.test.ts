import assert from "node:assert/strict"
import test from "node:test"
import { displayHostForIdeBind, displayUrlForIdeBind, displayUrlLabelForIdeBind, ideAccessNotes, isPrivateIpv4, localNetworkAddress, shouldPromptForPublicIde } from "../src/ide/access.js"

const networks = {
  lo: [{ address: "127.0.0.1", family: "IPv4" as const, internal: true, cidr: "127.0.0.1/8", mac: "00:00:00:00:00:00", netmask: "255.0.0.0" }],
  eth0: [{ address: "192.168.10.44", family: "IPv4" as const, internal: false, cidr: "192.168.10.44/24", mac: "00:00:00:00:00:01", netmask: "255.255.255.0" }],
}

test("IDE public bind displays a reachable LAN URL instead of 0.0.0.0", () => {
  assert.equal(localNetworkAddress(networks), "192.168.10.44")
  assert.equal(displayHostForIdeBind("0.0.0.0", networks), "192.168.10.44")
  assert.equal(displayUrlForIdeBind("0.0.0.0", 3737, networks), "http://192.168.10.44:3737")
  assert.equal(displayUrlLabelForIdeBind("0.0.0.0", networks), "LAN/VPN URL")

  const notes = ideAccessNotes("0.0.0.0", 3737, networks).join("\n")
  assert.match(notes, /Access: listening on all server interfaces/)
  assert.match(notes, /LAN\/VPN URL:/)
  assert.match(notes, /Public\/WAN URL: not known/)
  assert.match(notes, /http:\/\/192\.168\.10\.44:3737/)
  assert.doesNotMatch(notes, /http:\/\/0\.0\.0\.0:3737/)
})

test("IDE detects private IPv4 interface addresses", () => {
  assert.equal(isPrivateIpv4("10.1.2.3"), true)
  assert.equal(isPrivateIpv4("172.16.0.1"), true)
  assert.equal(isPrivateIpv4("172.31.255.255"), true)
  assert.equal(isPrivateIpv4("192.168.10.44"), true)
  assert.equal(isPrivateIpv4("8.8.8.8"), false)
  assert.equal(isPrivateIpv4("172.32.0.1"), false)
})

test("IDE prompts for public mode only for interactive Unix default launch", () => {
  assert.equal(shouldPromptForPublicIde({ hostExplicit: false, stdinIsTTY: true, stdoutIsTTY: true, platformName: "linux" }), true)
  assert.equal(shouldPromptForPublicIde({ hostExplicit: true, stdinIsTTY: true, stdoutIsTTY: true, platformName: "linux" }), false)
  assert.equal(shouldPromptForPublicIde({ hostExplicit: false, visibility: "public", stdinIsTTY: true, stdoutIsTTY: true, platformName: "linux" }), false)
  assert.equal(shouldPromptForPublicIde({ hostExplicit: false, stdinIsTTY: false, stdoutIsTTY: true, platformName: "linux" }), false)
  assert.equal(shouldPromptForPublicIde({ hostExplicit: false, stdinIsTTY: true, stdoutIsTTY: true, platformName: "win32" }), false)
})
