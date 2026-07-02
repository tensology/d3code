# FastAPI D3 Runtime

D3 Code now uses a Python FastAPI backend as the default IDE server.

The browser frontend remains JavaScript, but the backend process for `d3code ide` is FastAPI. It reads the same `D3CODE_HOME/config.jsonc`, so profiles, accounts, and default safety do not split into separate configurations.

## Runtime

Start the FastAPI API directly:

```sh
d3code api --port 8737
```

Start the IDE. This is FastAPI by default:

```sh
d3code ide --port 3737
```

The legacy TypeScript server is available only as an explicit fallback:

```sh
d3code ide --server node
```

The FastAPI IDE exposes runtime status at `/api/python-runtime` and shows the D3PY/UOPY route status in profile metadata.

## Routing Policy

- Use D3PY/UOPY for structured record, subroutine, and batch API work after parity is proven on the target host.
- Use persistent PTY for DM prompts, Terminal mode, System Builder, menus, and screen-buffer work.
- Use typed TCL as a guarded fallback for small probes and verification.

The Python server does not silently execute D3PY/UOPY calls until the connector is installed/configured and parity checks exist for the profile. That prevents the UI from claiming Python connector coverage while actually falling back to TCL automation.
