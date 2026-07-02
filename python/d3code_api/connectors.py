from __future__ import annotations

import importlib.util
import os
from dataclasses import dataclass


@dataclass(frozen=True)
class ConnectorStatus:
    name: str
    available: bool
    status: str
    evidence: list[str]
    guidance: str


def module_available(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


def d3py_status() -> ConnectorStatus:
    modules = [name for name in ("d3py", "d3_py") if module_available(name)]
    command = os.environ.get("D3CODE_D3PY_COMMAND")
    enabled = os.environ.get("D3CODE_D3PY_ENABLED") == "1"
    available = bool(modules or command or enabled)
    evidence = []
    if modules:
        evidence.append(f"python module: {modules[0]}")
    if command:
        evidence.append("D3CODE_D3PY_COMMAND configured")
    if enabled:
        evidence.append("D3CODE_D3PY_ENABLED=1")
    if not evidence:
        evidence.append("no d3py module or D3CODE_D3PY_* configuration found")
    return ConnectorStatus(
        name="d3py",
        available=available,
        status="spike" if available else "blocked",
        evidence=evidence,
        guidance="Use for record/subroutine parity tests after comparing output with typed TCL on the same profile."
        if available
        else "Install/configure D3PY before routing tools through it.",
    )


def uopy_status() -> ConnectorStatus:
    modules = [name for name in ("uopy", "u2py") if module_available(name)]
    host = os.environ.get("D3CODE_UOPY_HOST")
    account = os.environ.get("D3CODE_UOPY_ACCOUNT")
    available = bool(modules or host or account)
    evidence = []
    if modules:
        evidence.append(f"python module: {modules[0]}")
    if host:
        evidence.append("D3CODE_UOPY_HOST configured")
    if account:
        evidence.append("D3CODE_UOPY_ACCOUNT configured")
    if not evidence:
        evidence.append("no uopy/u2py module or D3CODE_UOPY_* configuration found")
    return ConnectorStatus(
        name="uopy",
        available=available,
        status="spike" if available else "blocked",
        evidence=evidence,
        guidance="Use for U2/D3 API parity tests where UOPY is installed and the target account is known."
        if available
        else "Install/configure UOPY before routing tools through it.",
    )


def connector_statuses() -> list[ConnectorStatus]:
    return [d3py_status(), uopy_status()]
