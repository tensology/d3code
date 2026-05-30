<h1 align="center">D3 Code</h1>

<p align="center">
  An OpenCode-style coding-agent harness for Rocket D3 servers: connect to an
  existing D3 environment, inspect accounts safely, understand BASIC and
  multivalue data, and build out full modern application slices with API,
  UI, mock data, tests, and proof.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-20%2B-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js 20+" />
  <img src="https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript 5.7" />
  <img src="https://img.shields.io/badge/Rocket%20D3-10.3.x%20Unix-black?style=flat-square" alt="Rocket D3 10.3.x Unix" />
  <img src="https://img.shields.io/badge/CLI-d3code-black?style=flat-square" alt="d3code CLI" />
</p>

<p align="center">
  <a href="#what-d3-code-is"><strong>What it is</strong></a> .
  <a href="#getting-rocket-d3"><strong>Getting Rocket D3</strong></a> .
  <a href="#quick-start"><strong>Quick start</strong></a> .
  <a href="#installing-next-to-a-d3-server"><strong>Server install</strong></a> .
  <a href="#what-d3-code-adds"><strong>Features</strong></a> .
  <a href="#proof-and-safety"><strong>Proof</strong></a>
</p>

---

## What D3 Code Is

D3 Code is not Rocket D3, and it does not install or license Rocket D3 for you.

Rocket D3 is Rocket Software's MultiValue database and application development environment. Rocket describes D3 as a way to build business applications quickly with data connectivity and rapid development tooling, and positions it inside the wider Rocket MultiValue Application Development Platform.

D3 Code is the harness around that existing D3 environment.

If you know tools like OpenCode, Codex, Claude Code, or other terminal coding agents, D3 Code is that idea pointed at Rocket D3 instead of a normal source-code repo. It gives an AI model a controlled set of D3-aware tools, a safety policy, a memory/config layer, and repeatable proof commands. The model does not get raw unlimited shell access to your production database. It works through D3 Code's profiles, command classifiers, adapters, and evidence gates.

Once you are inside `d3code`, you should not have to think in command names first. You can type normal requests like:

```text
show me the files in this account
read item 100 from CUSTOMERS
read dictionary NAME from CUSTOMERS
build an application from files CUSTOMERS,ORDERS programs BP to ./app-output
build an app from bundle d3-app-bundle.json to ./app-output
```

D3 Code handles the D3-aware parts directly when it can. Slash commands still exist for precise control and repeatable proof, but the intended experience is a Claude Code/OpenCode-style session where the assistant can inspect D3 and build application pieces from your request.

In practical terms, D3 Code is made of five pieces:

| Piece | What it means |
|---|---|
| **CLI/TUI harness** | The `d3code` command starts a terminal agent, loads your model/provider settings, remembers the active D3 profile, and exposes D3-aware slash commands. |
| **D3 connection profiles** | Profiles describe how to reach D3: local shell or SSH, entry command, account, prompt pattern, allowed accounts, and whether to keep a persistent session alive. |
| **D3 tool layer** | Instead of treating D3 as plain text in a terminal, D3 Code has tools for items, dictionaries, locks, AQL/TCL, BASIC compile/catalog, subroutine calls, account indexing, and terminal captures. |
| **Safety and proof layer** | Risky operations are classified before they run. Writes, compile/catalog, and subroutine calls require explicit confirmation, and proof commands record what was actually checked. |
| **Application workbench** | Captured D3 evidence can become bundles, audits, resource models, screen plans, OpenAPI contracts, adapter code, mock data, runnable web/API scaffolds, QA evidence, readiness reports, and release handoffs. |

So the short version is:

```text
Rocket D3 is the database/application platform.
D3 Code is the AI coding-agent harness that knows how to inspect, reason about,
guard, document, and build modern applications around that platform.
```

D3 Code sits beside an existing D3 server. It gives an operator or developer a D3-aware assistant that can:

| Area | What D3 Code does |
|---|---|
| **Server discovery** | Detect local D3 entry points, record local or SSH profiles, pin accounts, and verify prompt/session behavior. |
| **Safe terminal work** | Classify TCL, compile, catalog, write, and subroutine commands before running them. |
| **Account inspection** | Read items, dictionaries, locks, indexes, account file lists, BASIC source, and selected records. |
| **BASIC understanding** | Extract symbols, CALL targets, file usage, EXECUTE/TCL hazards, compiler output, and modernization risks. |
| **Multivalue mapping** | Preserve D3 dictionaries, attributes, multivalues, subvalues, indexes, and sampled record shapes. |
| **Application buildout** | Turn a D3 estate slice into resource models, screen plans, access plans, API routes, OpenAPI schemas, adapter code, mock data, smoke tests, QA evidence, and a runnable web/API scaffold. |
| **Evidence** | Keep proof gates explicit: setup proof, profile doctor, live-proof folders, QA evidence, completion audit, and rollback notes. |

The point is not "AI magic." The point is to give the agent enough real D3 evidence to help build the application, not just guess at tables and endpoints from a vague description.

---

## Getting Rocket D3

You need a licensed Rocket D3 environment before D3 Code can do useful live work.

Official Rocket starting points:

| Need | Where to go |
|---|---|
| Product overview | [Rocket D3 product page](https://www.rocketsoftware.com/en-us/products/multivalue/d3) |
| MultiValue platform overview | [Rocket MultiValue Application Development Platform](https://www.rocketsoftware.com/en-us/products/multivalue) |
| Product docs | [Rocket documentation portal](https://docs.rocketsoftware.com/) |
| Support/download portal | [Rocket support login](https://my.rocketsoftware.com/) |
| Sales/access | Use the "Talk to an expert" / "Get Started" links on Rocket's D3 and MultiValue pages |

Notes from Rocket's public material:

- Rocket D3 is part of Rocket's MultiValue platform, alongside UniVerse, UniData, jBASE, OpenQM, mvBase, and related connectivity/developer tools.
- Public Rocket trial listings may show some MultiValue products directly, but D3 access is typically handled through Rocket sales, support, Rocket Business Connect, or the customer/community download portal depending on your maintenance/account status.
- D3 Linux/Unix installation is a server operation. Rocket installation docs describe installing the underlying UNIX/Linux OS first, loading Rocket's D3 package, running `D3_setup`, starting the D3 virtual machine, and activating the product.
- D3 Code currently targets the Rocket D3 Unix/Linux 10.3.x style of estate. Check Rocket's Product Availability Matrix, release notes, and your support contract for the exact supported platform/version before installing or upgrading D3 itself.

D3 Code assumes the D3 server is already legitimate, reachable, and backed up. It will not bypass Rocket licensing, activation, or maintenance.

---

## Quick Start

For a developer machine or a D3 server where Node.js 20+ is already available:

```bash
git clone --recurse-submodules https://github.com/tensology/d3code.git
cd d3code
npm install
npm run build
npm link
d3code
```

That last command is the important bit. On first run, if `~/.d3code/config.json` does not exist, `d3code` opens the setup wizard and asks for:

1. model provider, for example OpenAI, Anthropic, OpenRouter, or a local endpoint
2. model name
3. API key, stored through the configured secret store when entered
4. default safety mode
5. D3 connection type: local, SSH, or skip
6. D3 profile name, account, entry command, prompt pattern, and persistent-session preference

After setup:

```bash
d3code doctor
d3code setup-proof
d3code profile-doctor --profile default
d3code --mode chat
```

If you chose a different profile name in the wizard, use that name instead of `default`.

Inside the session, start with plain language:

```text
show me the files
build an application from files CUSTOMERS,ORDERS programs BP to ./app-output
```

The second request captures a D3 bundle from the active profile, writes `d3-app-bundle.json`, generates the runnable app/API slice, and tells you which proof commands to run next.

---

## Installing Next To A D3 Server

There are two normal deployment shapes.

### Option A: Install on the D3 server

Use this when the server can run Node.js and you want `d3code` to enter D3 locally.

```bash
ssh d3-admin@your-d3-server
node --version
git clone --recurse-submodules https://github.com/tensology/d3code.git
cd d3code
npm install
npm run build
npm link
d3code
```

In the setup wizard:

| Prompt | Typical answer |
|---|---|
| D3 connection | `local` |
| Profile name | `prod`, `test`, or `default` |
| D3 account | `DM`, `SYSPROG`, `SALES`, or the account you are allowed to inspect |
| Command to enter D3/TCL | `d3`, `/usr/bin/d3`, or blank if the shell already lands in D3 |
| D3 prompt regex | usually `>` unless your site uses something else |
| Session mode | `persistent` for account-stateful work |

Then prove it:

```bash
d3code detect
d3code login --profile prod --account DM --safety ask
d3code profile-doctor --profile prod
d3code live-proof --profile prod --run
```

### Option B: Install on your workstation and connect by SSH

Use this when the D3 server should stay cleaner, or Node.js should not be installed on it.

```bash
git clone --recurse-submodules https://github.com/tensology/d3code.git
cd d3code
npm install
npm run build
npm link
d3code setup
```

In the setup wizard choose `ssh`, then provide host, username, port, target account, and the command that enters D3 after SSH login.

Equivalent noninteractive setup:

```bash
d3code setup \
  --provider openai \
  --default-model gpt-5 \
  --api-key-env OPENAI_API_KEY \
  --default-safety ask \
  --d3 ssh \
  --profile-name prod \
  --host d3.example.com \
  --user d3admin \
  --port 22 \
  --account DM \
  --entry "d3" \
  --prompt ">" \
  --session persistent \
  --allowed-accounts DM,SALES
```

Then prove it:

```bash
d3code setup-proof
d3code profile-doctor --profile prod
d3code terminal-plan --profile prod
d3code cockpit-terminal --profile prod
```

---

## What D3 Code Adds

### From D3 account to application

D3 Code is meant to help build complete application slices from a D3 estate.

The interactive workflow is:

1. **Connect to a real account** - local or SSH profile, pinned account, prompt pattern, and safety mode.
2. **Type what you want** - for example, "build an application from files CUSTOMERS,ORDERS programs BP to ./app-output".
3. **D3 Code captures the D3 truth** - files, dictionaries, records, indexes, BASIC programs, subroutine relationships, screen hints, access clues, and terminal evidence.
4. **D3 Code turns that into an application model** - resources, fields, multivalue child structures, validations, relationships, screen plans, access plans, and service boundaries.
5. **D3 Code generates a runnable app/API slice** - OpenAPI contract, D3 adapter seam, routes, mock data, browser UI shell, dashboard/proof data, terminal bridge contract, and smoke tests.
6. **Keep extending with proof** - each generated slice carries readiness checks, QA evidence, completion audit gaps, and rollback notes so the application can grow without losing track of what is proven.

This is different from a normal CRUD generator. A D3 application often hides its shape across dictionaries, BASIC, PROC/screen flows, multivalue records, account conventions, and years of operator practice. D3 Code's job is to extract that shape and turn it into buildable application structure.

The generated app slice is not the final product by itself. It is the starting point a developer or coding agent can keep building: replace mock adapters with live D3 calls, refine screens, add workflows, add authorization, wire front-end components, and use the proof commands to check that the modern app still matches the legacy behavior.

### D3-aware commands

| Command | Purpose |
|---|---|
| `d3code profiles` | List configured local/SSH D3 profiles. |
| `d3code detect` | Detect local D3 availability. |
| `d3code login --profile prod --account DM` | Verify or switch account with WHO/VERSION proof. |
| `d3code read-item CUSTOMERS 100 --profile prod` | Read a D3 item. |
| `d3code read-dict CUSTOMERS NAME --profile prod` | Read a dictionary item. |
| `d3code locks --profile prod` | Inspect lock state. |
| `d3code query-aql LIST CUSTOMERS --profile prod` | Run read-oriented AQL/TCL. |
| `d3code diff-item CUSTOMERS 100 --profile prod --body-file proposed.txt` | Preview a write. |
| `d3code write-item CUSTOMERS 100 --profile prod --body-file proposed.txt --confirm` | Write only after confirmation. |
| `d3code compile-basic BP GET.CUSTOMER --profile prod --confirm` | Compile BASIC with confirmation. |
| `d3code catalog-basic BP GET.CUSTOMER --profile prod --confirm` | Catalog BASIC with confirmation. |
| `d3code call-subroutine GET.CUSTOMER 100 --profile prod --confirm` | Call a subroutine with confirmation. |

### Operating modes

| Mode | Use it for |
|---|---|
| `chat` | General D3-aware terminal assistance. |
| `plan` | Read-only planning and investigation. |
| `audit` | Account/database/code audit. |
| `modernize` | Behavior-preserving BASIC modernization. |
| `api` | REST/OpenAPI planning around D3 files and subroutines. |
| `migrate` | D3-to-web migration slices with QA evidence. |
| `qa` | Regression and proof workflows. |
| `gsd` | Goal, phase, evidence, and completion-gate tracking. |

```bash
d3code --mode migrate
d3code mode-info migrate
d3code runbook migrate
d3code workflow migrate
d3code recipe migrate
```

### Bundle pipeline

D3 Code's main migration artifact is a D3 application bundle:

```bash
d3code bundle-capture \
  --profile prod \
  --account SALES \
  --files CUSTOMERS,ORDERS \
  --program-files BP \
  --sample-limit 5 > d3-app-bundle.json
```

From that bundle:

```bash
d3code bundle-audit d3-app-bundle.json
d3code bundle-code-map d3-app-bundle.json
d3code bundle-index-plan d3-app-bundle.json
d3code bundle-data-plan d3-app-bundle.json
d3code bundle-ui-plan d3-app-bundle.json
d3code bundle-access-plan d3-app-bundle.json
d3code bundle-brief d3-app-bundle.json
d3code bundle-backlog d3-app-bundle.json
d3code bundle-artifacts d3-app-bundle.json --out ./migration-output
d3code webapp-check ./migration-output
d3code webapp-smoke ./migration-output --record
d3code bundle-readiness d3-app-bundle.json --artifacts-dir ./migration-output
```

This is how D3 Code moves from "we inspected a legacy account" to "we have a runnable application slice with a UI shell, API routes, D3 adapter boundary, mock data, generated contracts, smoke tests, and explicit proof gaps."

---

## Proof And Safety

D3 Code deliberately separates inspection from mutation.

| Safety area | Behavior |
|---|---|
| Read-only audit | Easy path: dictionary reads, item reads, index/list captures, bundle capture, analysis, and reports. |
| Risky TCL | Classified before execution. Destructive/shell-like commands are blocked or require confirmation depending on safety mode. |
| Writes | Require explicit write commands and confirmation. `diff-item` exists so proposed writes can be reviewed first. |
| Compile/catalog | Treated as mutation-risk operations and require confirmation. |
| Subroutine calls | Require confirmation because business logic may mutate state. |
| Live proof | Profile doctor, terminal capture, compile/catalog transcript, operator notes, and rollback evidence are tracked separately. |

Proof commands:

```bash
d3code acceptance
d3code setup-proof
d3code readiness
d3code product-audit --allow-incomplete
d3code live-proof-init ./live-proof --profile prod --account DM
d3code live-proof-check ./live-proof
```

---

## Development

```bash
npm install
npm run build
npm run typecheck
npm test
```

The full regression path is heavier:

```bash
npm run regression
```

Generated and local-only outputs are ignored:

| Path | Reason |
|---|---|
| `node_modules/` | Installed dependencies. |
| `dist/` | TypeScript build output. |
| `.env*` | Local secrets/config. |
| `.DS_Store` | macOS metadata. |

---

## Repository

<https://github.com/tensology/d3code>

See [CHANGELOG.md](CHANGELOG.md) for release notes.
