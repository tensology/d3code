# ECC / Hermes Skill Bridge

D3Code imports ECC and Hermes as an operator harness layer, not as a wholesale dependency.

Use:

```bash
d3code hermes-setup --ecc-root <path-to-ecc>
d3code hermes-status
d3code ecc-hermes-skills
d3code rag-build --ecc-root <path-to-ecc>
```

Rules:

- Hermes provides operator memory, workflow import discipline, and learning.
- ECC provides harness construction, evals, retrieval, orchestration, debugging, terminal discipline, style discipline, and token budgeting.
- D3Code remains the Rocket D3 execution authority.
- Imported skills must be adapted into D3-specific behavior before they affect modes or tools.
- Do not copy private Hermes state, credentials, local logs, or customer records into the repo.

The baked import map is implemented in `src/operator/ecc-hermes.ts`.
