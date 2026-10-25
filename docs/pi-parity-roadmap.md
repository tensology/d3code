# Pi-parity roadmap for D3 Code

`pi` (`@earendil-works/pi-coding-agent`) is the reference harness. This maps the
breakthroughs visible in pi's changelog (290 releases) onto D3 Code, marks what
shipped, and ranks what to do next.

## Where D3 Code stood vs pi

| Capability | pi | D3 Code (before) | D3 Code (now) |
|---|---|---|---|
| Tool calling | Native function calling, many providers | **Text `<d3_tool>` XML parsed from replies** | **Native, with XML fallback** |
| Parallel tools | Codemode runs JS calling tools in parallel | One tool per round, serial | **Read-only tools run in parallel** |
| Tool schemas | JSON Schema per tool | Short contract strings | **JSON Schema (`tool-schema.ts`)** |
| Compaction | Model-summarised, per-model budgets | Truncate/omit only | Truncate (model summary = next) |
| Extensions | Lifecycle hooks, custom tools, renderers | none | none |
| MCP | Full client + OAuth | none | none |
| Codemode | JS tool orchestrator, in-process subagents | none | none |
| Providers | Huge catalog, virtual models, auth | 5 providers | 5 providers + DeepSeek flash |
| Sessions | Session format, branching, context edits | flat JSON events | flat JSON events |
| TUI | Fullscreen, Mermaid/LaTeX, search | Ink TUI | Ink + browser IDE |

## Shipped in this pass

1. **Native tool calling** — `ChatRequest.tools` / `ChatResponse.toolCalls`,
   OpenAI-compatible `tools` + `tool_calls` (streaming and non-streaming) and
   Anthropic `tool_use`/`tool_result`. The agent prefers native calls and falls
   back to `<d3_tool>` so older/local models still work.
2. **Parallel read-only tool execution** — a single assistant turn can request
   several tools; read-only batches run concurrently, mutating batches stay
   serial and operator-gated.
3. **JSON Schema tool catalog** — `src/d3/tool-schema.ts`, generated alongside the
   existing zod validation (validation is unchanged; the schema is for the model).
4. **DeepSeek V4 Flash over OpenRouter** as the default model.
5. **Rocket D3 10.4 reference** (`docs/rocket-d3-10.4.md`) and the D3 prompt fix
   that lets the CLI drive the office box at all.
6. **ECC/Hermes bridge repaired** — `eccRoot` repointed to the live
   `reference/ecc` (ecc-universal 2.0.0-rc.1); bridge now resolves 40/40 skills.

## Next, ranked by leverage

1. **Codemode-style tool orchestration** — let the model write a short JS script
   that calls `d3_*` tools with `Promise.all`. Biggest jump for wide estate scans
   (audit 40 files in one model turn instead of 40 rounds). Reuses the new
   parallel runner as the sandbox bridge.
2. **Summarising compaction** — replace `compactAgentHistory` truncation with an
   LLM summary of the elided span, persisted as a `context_edit` entry. pi's
   compaction is the reason long sessions stay coherent.
3. **Extension/hook API** — `before_tool`, `after_tool`, `before_request`,
   custom tools, and a `registerToolRenderer`-style surface. This is how D3 shops
   would add site-specific verbs (e.g. `B.JOBSCHED` uploads) without forking.
4. **MCP client** — consume MCP servers (Refero/Mobbin/Composio already exist as
   MCPs on this machine) so D3 Code can reach non-D3 tooling through one config.
5. **Session format with branching + context edits** — resume a D3 investigation,
   branch it, and edit context without rewriting history.
6. **Cost/token telemetry + per-model budgets** — pi tracks usage per turn; D3
   Code already accumulates `ChatUsage` and can surface it in status/IDE.

## Notes

- Keep the D3-only scope guard (`src/scope/d3-scope.ts`) in front of every tool
  call, native or XML. The scope guard is D3 Code's differentiator, not a limit
  to relax.
- Untrusted D3 evidence stays wrapped as data in tool results; native tool calls
  do not change that rule.
