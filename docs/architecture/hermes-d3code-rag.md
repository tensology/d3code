# Hermes D3Code RAG Layer

D3Code uses a local, deterministic RAG layer to ground D3 work in project references before it edits, explains, or modernizes legacy code.

## Sources

- Rocket D3 reference manual
- Rocket D3 user guide
- Rocket MV BASIC reference material
- System Builder / SB+ manuals from `reference/system-builder/manifest.json`
- Crystal Logic operator notes
- Sanitized Hermes-style operator memory from `~/.d3code/MEMORY.jsonl`

## Responsibilities

D3Code remains the execution harness:

- D3 profiles
- TCL safety
- BASIC and dictionary inspection
- evidence and migration artifacts

Hermes-style operator memory adds the learning layer:

- record verified lessons
- preserve local coding idioms
- remember repeated failure modes
- promote repeated workflows into D3-specific skills

## Local Style Rule

When changing legacy PICK BASIC, generated System Builder code, TCL, or operator scripts, the RAG layer should retrieve local examples and operator memory before suggesting code. Existing house style wins unless a manual, compiler error, or runtime proof shows it is wrong.

The `B.JOBSCHED` curl work produced one important memory pattern:

- do not impose generic patterns such as unnecessary Q-pointers or display helpers
- use already-opened files and local screen routines only when the current program proves that convention
- explain inferred choices separately from verified facts
- prefer the smallest edit that preserves legacy control flow

## Commands

```bash
d3code rag-build
d3code rag-status
d3code rag-route "System Builder menu template"
d3code rag-search "PICK BASIC curl upload"
d3code operator-memory-add --project crystallogic --kind fix --summary "curl exit code 26 means curl cannot read the upload file" --evidence "Verified from D3 screen output"
d3code operator-memory-list --project crystallogic
```

## Retrieval Contract

Every retrieval result includes:

- source title
- source kind
- source path
- line range
- matched excerpt
- routing rationale

Claims about D3, PICK BASIC, System Builder, or local operator behavior should cite one of those retrieved sources or a fresh command result.
