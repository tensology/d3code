from __future__ import annotations

from dataclasses import asdict

from .config import Profile
from .connectors import connector_statuses


def terminal_ready(profile: Profile | None) -> bool:
    return bool(profile and profile.session_mode == "persistent" and profile.prompt_pattern)


def tool_routing_status(profile: Profile | None) -> dict:
    connectors = connector_statuses()
    python_ready = any(connector.available for connector in connectors)
    ready = terminal_ready(profile)
    return {
        "profile": profile.name if profile else None,
        "account": profile.account if profile else None,
        "runtime": "fastapi-python",
        "terminalReady": ready,
        "d3pyAvailable": any(connector.name == "d3py" and connector.available for connector in connectors),
        "uopyAvailable": any(connector.name == "uopy" and connector.available for connector in connectors),
        "connectors": [asdict(connector) for connector in connectors],
        "defaultGuidance": (
            "Prefer Python D3PY/UOPY for proven API operations, persistent PTY for terminal/screen flows, and typed TCL only for guarded command probes."
            if python_ready
            else "FastAPI runtime is online, but D3PY/UOPY is not configured; keep typed TCL guarded and use persistent PTY for screen flows."
        ),
        "routes": [
            {
                "mechanism": "d3py-uopy",
                "status": "spike" if python_ready else "blocked",
                "bestFor": ["record API parity", "subroutine bridge", "batch extraction", "structured D3 data access"],
                "notFor": ["PowerTerm screen flows", "login prompt automation", "unproven destructive operations"],
                "why": "Python-native D3 connectors should own API-style D3 work when installed and parity-proven.",
                "proof": [item for connector in connectors for item in connector.evidence],
            },
            {
                "mechanism": "persistent-pty",
                "status": "ready" if ready else "partial" if profile else "blocked",
                "bestFor": ["IDE terminal", "DM prompts", "System Builder screens", "menus", "operator transcripts"],
                "notFor": ["bulk record reads", "structured API work where D3PY/UOPY is proven"],
                "why": "Interactive D3 screens require a live terminal state and should not be simulated as one-off commands.",
                "proof": ["sessionMode=persistent", "promptPattern configured"] if ready else ["configure sessionMode=persistent and promptPattern"],
            },
            {
                "mechanism": "typed-tcl",
                "status": "ready" if profile else "blocked",
                "bestFor": ["small guarded probes", "WHO/VERSION", "LIST/SELECT/AQL verification"],
                "notFor": ["primary connector when D3PY/UOPY parity exists", "screen flows", "login automation"],
                "why": "Typed TCL remains useful as an auditable fallback, but it should not be the only tool path.",
                "proof": ["permission guard", "profile/account controls"],
            },
        ],
    }
