# FastAPI D3 Runtime

D3 Code uses the full Node agent harness as the default IDE server. The Python FastAPI backend remains an explicit connector-parity runtime.

The browser frontend and complete agent harness run on the Node IDE server. The optional FastAPI process reads the same `D3CODE_HOME/config.jsonc`, so profiles, accounts, and default safety do not split into separate configurations.

## Runtime

Start the FastAPI API directly:

```sh
d3code api --port 8737
```

Start the complete IDE, including chat, memory, skills, streaming, and Markdown rendering:

```sh
d3code ide --port 3737
```

Start the standalone FastAPI connector workbench explicitly:

```sh
d3code ide --server fastapi
```

The Node IDE can also start FastAPI as a companion API while retaining the complete harness UI:

```sh
d3code ide --api-backend fastapi
```

The FastAPI runtime exposes status at `/api/python-runtime` and shows the D3PY/UOPY route status in profile metadata.

## Routing Policy

- Use D3PY/UOPY for structured record, subroutine, and batch API work after parity is proven on the target host.
- Use persistent PTY for DM prompts, Terminal mode, System Builder, menus, and screen-buffer work.
- Use typed TCL as a guarded fallback for small probes and verification.

The Python server does not silently execute D3PY/UOPY calls until the connector is installed/configured and parity checks exist for the profile. That prevents the UI from claiming Python connector coverage while actually falling back to TCL automation.
