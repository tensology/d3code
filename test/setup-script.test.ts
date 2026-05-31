import assert from "node:assert/strict"
import { stat, readFile } from "node:fs/promises"
import test from "node:test"

test("setup.sh is executable and documents D3 Code server setup steps", async () => {
  const info = await stat("setup.sh")
  const content = await readFile("setup.sh", "utf8")

  assert.equal(Boolean(info.mode & 0o111), true)
  assert.match(content, /Node\.js 20/)
  assert.match(content, /npm install/)
  assert.match(content, /npm run build/)
  assert.match(content, /npm link/)
  assert.match(content, /d3 -V/)
  assert.match(content, /d3_version_output="\$\(d3 -V 2>&1\)"/)
  assert.match(content, /d3_version_status=\$?/)
  assert.match(content, /MON.*FLASH.*SQL/s)
  assert.doesNotMatch(content, /d3 -V failed/)
  assert.match(content, /nodejs\.org\/dist\/latest-v20\.x/)
  assert.match(content, /install_node_tarball/)
  assert.match(content, /\.local\/node/)
  assert.match(content, /export PATH="\$LOCAL_NODE_BIN:\$PATH"/)
  assert.match(content, /install_global_command_links/)
  assert.match(content, /\/usr\/local\/bin/)
  assert.match(content, /\$link_cmd -sfn "\$LOCAL_NODE_BIN\/node"/)
  assert.match(content, /\$link_cmd -sfn "\$LOCAL_NODE_BIN\/npm"/)
  assert.match(content, /\$link_cmd -sfn "\$LOCAL_NODE_BIN\/d3code"/)
  assert.match(content, /d3code command is available/)
  assert.doesNotMatch(content, /trap .*RETURN/)
  assert.match(content, /d3code setup/)
  assert.match(content, /profile-add-local/)
  assert.match(content, /profile-release/)
  assert.doesNotMatch(content, /profile-add-local --name prod --account DM --entry "d3" --prompt ":" --session persistent/)
})
